mod downloader;
mod persistence;
mod versions;

use persistence::{load_state_from, save_state_to};
use tauri::Manager;
use versions::refresh_catalog;

#[tauri::command]
fn load_state(app: tauri::AppHandle) -> Result<persistence::LauncherState, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    load_state_from(path)
}

#[tauri::command]
fn save_state(app: tauri::AppHandle, state: persistence::LauncherState) -> Result<(), String> {
    if state.instances.len() > 3 {
        return Err("Has alcanzado el límite máximo de 3 instancias.".to_string());
    }
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    save_state_to(path, &state)
}

#[tauri::command]
async fn refresh_versions(app: tauri::AppHandle) -> Result<persistence::LauncherState, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let current = load_state_from(path.clone())?;
    let next = refresh_catalog(current).await?;
    save_state_to(path, &next)?;
    Ok(next)
}

#[tauri::command]
async fn launch_instance(app: tauri::AppHandle, instance_id: String) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let state = load_state_from(path.clone())?;

    let instance = state
        .instances
        .iter()
        .find(|item| item.id == instance_id)
        .ok_or_else(|| format!("No se encontró la instancia con id {instance_id}."))?;

    // Obtener nombre del perfil offline asignado
    let profile_name = state
        .profiles
        .iter()
        .find(|p| p.id == instance.profile_id)
        .map(|p| p.name.clone())
        .unwrap_or_else(|| "KatoPlayer".to_string());

    // Crear la carpeta física de la instancia en app_data/instances/<id>
    let instance_dir = path.join("instances").join(&instance.id);
    std::fs::create_dir_all(&instance_dir)
        .map_err(|error| format!("No se pudo crear el directorio de la instancia: {error}"))?;

    // Crear estructura estándar de carpetas de Minecraft
    let _ = std::fs::create_dir_all(instance_dir.join("mods"));
    let _ = std::fs::create_dir_all(instance_dir.join("saves"));
    let _ = std::fs::create_dir_all(instance_dir.join("resourcepacks"));
    let _ = std::fs::create_dir_all(instance_dir.join("config"));

    // Guardar manifest local de la instancia
    let metadata_path = instance_dir.join("instance.json");
    if let Ok(content) = serde_json::to_string_pretty(&instance) {
        let _ = std::fs::write(metadata_path, content);
    }

    // 1. Descargar y preparar todos los archivos necesarios (client.jar, librerías, mod loader e índice de assets)
    let client = reqwest::Client::new();
    let prep = downloader::prepare_and_download_all(&client, &path, &instance_dir, &instance.minecraft_version, &instance.loader).await?;

    // 2. Construir classpath uniendo librerías y client.jar
    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    let mut cp_items: Vec<String> = prep.library_paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
    cp_items.push(prep.client_jar.to_string_lossy().to_string());
    let classpath = cp_items.join(separator);

    // 3. Lanzar el proceso Java de Minecraft con la versión detectada
    let mut cmd = std::process::Command::new(&prep.java_binary);
    #[cfg(target_os = "macos")]
    {
        if prep.is_lwjgl3 {
            cmd.arg("-XstartOnFirstThread");
        }
    }
    cmd.arg("-Xms512M");
    cmd.arg("-Xmx2G");
    let launcher_cfg = downloader::get_launcher_config();
    cmd.arg(format!("-Dminecraft.launcher.brand={}", launcher_cfg.name));
    cmd.arg(format!("-Dminecraft.launcher.version={}", launcher_cfg.version));

    // Argumentos JVM adicionales del mod loader (e.g. -Djava.net.preferIPv6Addresses=system)
    for jvm_arg in &prep.extra_jvm_args {
        cmd.arg(jvm_arg);
    }

    cmd.arg("-cp").arg(&classpath);
    cmd.arg(&prep.main_class);

    // Argumentos de juego adicionales del mod loader (e.g. --launchTarget forge_client)
    for game_arg in &prep.extra_game_args {
        cmd.arg(game_arg);
    }

    cmd.arg("--username").arg(&profile_name);
    cmd.arg("--version").arg(&instance.minecraft_version);
    cmd.arg("--gameDir").arg(&instance_dir);
    cmd.arg("--assetsDir").arg(&prep.assets_dir);
    cmd.arg("--assetIndex").arg(&prep.asset_index_id);
    cmd.arg("--uuid").arg("00000000-0000-0000-0000-000000000000");
    cmd.arg("--accessToken").arg("0");
    cmd.arg("--userType").arg("mojang");
    cmd.arg("--versionType").arg("release");

    cmd.current_dir(&instance_dir);

    cmd.spawn()
        .map_err(|e| format!("No se pudo iniciar el proceso de Minecraft con Java ('{}'): {e}", prep.java_binary))?;

    Ok(format!(
        "¡Minecraft {} ({}) lanzado exitosamente con Java {} y el jugador '{}'! La ventana del juego se está abriendo.",
        instance.minecraft_version, prep.loader_name, prep.java_major, profile_name
    ))
}

#[tauri::command]
fn get_system_javas() -> Result<Vec<downloader::JavaEnvironment>, String> {
    Ok(downloader::scan_system_javas())
}

#[tauri::command]
fn delete_instance(app: tauri::AppHandle, instance_id: String) -> Result<persistence::LauncherState, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;

    // 1. Eliminar físicamente la carpeta de la instancia si existe
    let instance_dir = path.join("instances").join(&instance_id);
    if instance_dir.exists() {
        std::fs::remove_dir_all(&instance_dir)
            .map_err(|error| format!("No se pudo eliminar la carpeta de la instancia: {error}"))?;
    }

    // 2. Actualizar estado persistente
    let mut state = load_state_from(path.clone())?;
    state.instances.retain(|item| item.id != instance_id);
    save_state_to(path, &state)?;

    Ok(state)
}

#[tauri::command]
fn open_instance_folder(app: tauri::AppHandle, instance_id: String) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let instance_dir = path.join("instances").join(&instance_id);

    // Asegurar que la estructura de carpetas existe para que el usuario pueda agregar mods
    if !instance_dir.exists() {
        std::fs::create_dir_all(&instance_dir)
            .map_err(|error| format!("No se pudo crear la carpeta: {error}"))?;
        let _ = std::fs::create_dir_all(instance_dir.join("mods"));
        let _ = std::fs::create_dir_all(instance_dir.join("saves"));
        let _ = std::fs::create_dir_all(instance_dir.join("resourcepacks"));
        let _ = std::fs::create_dir_all(instance_dir.join("config"));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&instance_dir)
            .spawn()
            .map_err(|e| format!("Error al abrir Finder: {e}"))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&instance_dir)
            .spawn()
            .map_err(|e| format!("Error al abrir Explorador: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&instance_dir)
            .spawn()
            .map_err(|e| format!("Error al abrir gestor de archivos: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Error al abrir navegador: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Error al abrir navegador: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Error al abrir navegador: {e}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            refresh_versions,
            launch_instance,
            delete_instance,
            open_instance_folder,
            open_external_url,
            get_system_javas
        ])
        .run(tauri::generate_context!())
        .expect("error while running KatoLauncher");
}
