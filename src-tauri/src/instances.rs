use crate::downloader;
use crate::persistence::{load_state_from, save_state_to, LauncherState};
use tauri::Manager;

#[tauri::command]
pub async fn launch_instance(app: tauri::AppHandle, instance_id: String) -> Result<String, String> {
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

    // Asegurar compatibilidad de librerías nativas en macOS (.jnilib <-> .dylib) para instancias previas
    #[cfg(target_os = "macos")]
    if let Ok(entries) = std::fs::read_dir(&prep.natives_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                if ext == "jnilib" {
                    let dylib = p.with_extension("dylib");
                    if !dylib.exists() {
                        let _ = std::fs::copy(&p, &dylib);
                    }
                } else if ext == "dylib" {
                    let jnilib = p.with_extension("jnilib");
                    if !jnilib.exists() {
                        let _ = std::fs::copy(&p, &jnilib);
                    }
                }
            }
        }
    }

    // Proveer iconos de ventana para versiones legacy (Minecraft 1.0 - 1.5)
    let icons_dir = prep.assets_dir.join("icons");
    if !icons_dir.exists() {
        let _ = std::fs::create_dir_all(&icons_dir);
    }
    const MINIMAL_PNG: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0B, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x60, 0x00, 0x02, 0x00,
        0x00, 0x05, 0x00, 0x01, 0xE9, 0xFA, 0xDC, 0xD8, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ];
    let icon16 = icons_dir.join("icon_16x16.png");
    let icon32 = icons_dir.join("icon_32x32.png");
    if !icon16.exists() {
        let _ = std::fs::write(&icon16, MINIMAL_PNG);
    }
    if !icon32.exists() {
        let _ = std::fs::write(&icon32, MINIMAL_PNG);
    }

    // 3. Lanzar el proceso Java de Minecraft con la versión detectada
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let mut cmd = if !prep.is_lwjgl3 {
        // En macOS Apple Silicon con Minecraft LWJGL 2, forzar ejecución bajo el subsistema x86_64 / Rosetta 2
        let mut c = std::process::Command::new("/usr/bin/arch");
        c.arg("-x86_64");
        c.arg(&prep.java_binary);
        c
    } else {
        std::process::Command::new(&prep.java_binary)
    };

    #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
    let mut cmd = std::process::Command::new(&prep.java_binary);
    #[cfg(target_os = "macos")]
    {
        // Limpiar variables DYLD heredadas de Tauri/Cargo que desbordan el buffer snprintf de JNA en Minecraft 1.17 - 1.20.1
        cmd.env_remove("DYLD_FALLBACK_LIBRARY_PATH");
        cmd.env_remove("DYLD_LIBRARY_PATH");
        cmd.env_remove("DYLD_FRAMEWORK_PATH");

        if prep.is_lwjgl3 {
            cmd.arg("-XstartOnFirstThread");
        }
    }
    cmd.arg(format!("-Djava.library.path={}", prep.natives_dir.to_string_lossy()));
    cmd.arg(format!("-Dorg.lwjgl.librarypath={}", prep.natives_dir.to_string_lossy()));

    let ram_gb = instance.ram_gb.unwrap_or(4);
    let xms_mb = if ram_gb >= 4 { 1024 } else { 512 };
    cmd.arg(format!("-Xms{xms_mb}M"));
    cmd.arg(format!("-Xmx{ram_gb}G"));
    let launcher_cfg = downloader::get_launcher_config();
    cmd.arg(format!("-Dminecraft.launcher.brand={}", launcher_cfg.name));
    cmd.arg(format!("-Dminecraft.launcher.version={}", launcher_cfg.version));

    // Argumentos JVM adicionales del mod loader (e.g. -Djava.net.preferIPv6Addresses=system)
    let mut has_ignore_list = false;
    for jvm_arg in &prep.extra_jvm_args {
        if jvm_arg.starts_with("-DignoreList=") {
            has_ignore_list = true;
            if !jvm_arg.contains("client.jar") {
                cmd.arg(format!("{jvm_arg},client.jar"));
            } else {
                cmd.arg(jvm_arg);
            }
        } else {
            cmd.arg(jvm_arg);
        }
    }

    if (prep.loader_name == "Forge" || prep.loader_name == "NeoForge") && !has_ignore_list {
        cmd.arg(format!("-DignoreList=client-extra,{}.jar,client.jar", instance.minecraft_version));
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

    // Redirigir la salida y errores de Minecraft a launcher_game.log dentro de la carpeta de la instancia
    let log_path = instance_dir.join("launcher_game.log");
    let log_file = std::fs::File::create(&log_path)
        .map_err(|e| format!("No se pudo inicializar archivo de registro del juego: {e}"))?;
    let log_err = log_file.try_clone()
        .map_err(|e| format!("No se pudo duplicar handle de registro: {e}"))?;

    cmd.stdout(std::process::Stdio::from(log_file));
    cmd.stderr(std::process::Stdio::from(log_err));

    let mut child = cmd.spawn()
        .map_err(|e| format!("No se pudo iniciar el proceso de Minecraft con Java ('{}'): {e}", prep.java_binary))?;

    // Esperar y comprobar si el proceso finalizó de inmediato por algún error de Java/librerías
    for _ in 0..10 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if let Ok(Some(status)) = child.try_wait() {
            if !status.success() {
                let log_text = std::fs::read_to_string(&log_path).unwrap_or_default();
                let last_lines: Vec<&str> = log_text.lines().rev().take(15).collect();
                let mut summary = last_lines.into_iter().rev().collect::<Vec<&str>>().join("\n");
                if summary.trim().is_empty() {
                    summary = format!("Código de salida del proceso: {status}");
                }
                return Err(format!("Minecraft se cerró inmediatamente con error:\n{summary}"));
            }
        }
    }

    Ok(format!(
        "¡Minecraft {} ({}) iniciado correctamente con Java {}! La ventana del juego se abrirá en breve.",
        instance.minecraft_version, prep.loader_name, prep.java_major
    ))
}

#[tauri::command]
pub fn get_instance_logs(app: tauri::AppHandle, instance_id: String) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let instance_dir = path.join("instances").join(&instance_id);

    // 1. Revisar launcher_game.log (captura stdout y stderr crudos del proceso Java)
    let game_log = instance_dir.join("launcher_game.log");
    if game_log.exists() {
        if let Ok(text) = std::fs::read_to_string(&game_log) {
            if !text.trim().is_empty() {
                return Ok(text);
            }
        }
    }

    // 2. Si no hay nada en launcher_game.log, revisar logs/latest.log de Minecraft
    let latest_log = instance_dir.join("logs").join("latest.log");
    if latest_log.exists() {
        if let Ok(text) = std::fs::read_to_string(&latest_log) {
            if !text.trim().is_empty() {
                return Ok(text);
            }
        }
    }

    Ok("No se encontraron registros para esta instancia todavía.\nInicia el juego para registrar la actividad de la consola.".to_string())
}

#[tauri::command]
pub fn delete_instance(app: tauri::AppHandle, instance_id: String) -> Result<LauncherState, String> {
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
pub fn open_instance_folder(app: tauri::AppHandle, instance_id: String) -> Result<(), String> {
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
