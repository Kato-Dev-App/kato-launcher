use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModInfo {
    pub filename: String,
    pub name: String,
    pub enabled: bool,
    pub size_bytes: u64,
    pub modified_at: Option<u64>,
}

fn resolve_target_folder(base_path: &Path, instance_id: &str, folder_type: Option<&str>) -> (PathBuf, &'static str) {
    let (sub, ext) = match folder_type {
        Some("shader") | Some("shaders") | Some("shaderpack") | Some("shaderpacks") => ("shaderpacks", ".zip"),
        Some("resourcepack") | Some("resourcepacks") => ("resourcepacks", ".zip"),
        _ => ("mods", ".jar"),
    };
    (base_path.join("instances").join(instance_id).join(sub), ext)
}

#[tauri::command]
pub fn list_instance_mods(
    app: tauri::AppHandle,
    instance_id: String,
    folder_type: Option<String>,
) -> Result<Vec<InstalledModInfo>, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let (target_dir, expected_ext) = resolve_target_folder(&path, &instance_id, folder_type.as_deref());

    if !target_dir.exists() {
        let _ = std::fs::create_dir_all(&target_dir);
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(&target_dir)
        .map_err(|e| format!("Error al leer directorio: {e}"))?;

    let mut items = Vec::new();
    for entry in entries.flatten() {
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if !file_type.is_file() {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }

        let is_valid_ext = file_name.ends_with(expected_ext) || (expected_ext == ".jar" && file_name.ends_with(".jar"));
        let is_disabled = file_name.ends_with(".disabled");

        if !is_valid_ext && !is_disabled {
            continue;
        }

        let metadata = entry.metadata().ok();
        let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_at = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        let clean_name = if is_disabled {
            file_name
                .trim_end_matches(".disabled")
                .trim_end_matches(expected_ext)
                .to_string()
        } else {
            file_name.trim_end_matches(expected_ext).to_string()
        };

        items.push(InstalledModInfo {
            filename: file_name,
            name: clean_name,
            enabled: !is_disabled,
            size_bytes,
            modified_at,
        });
    }

    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[tauri::command]
pub fn toggle_instance_mod(
    app: tauri::AppHandle,
    instance_id: String,
    filename: String,
    enable: bool,
    folder_type: Option<String>,
) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let (target_dir, _) = resolve_target_folder(&path, &instance_id, folder_type.as_deref());
    let current_path = target_dir.join(&filename);

    if !current_path.exists() {
        return Err("El archivo seleccionado no existe.".to_string());
    }

    let new_filename = if enable {
        if filename.ends_with(".disabled") {
            filename.trim_end_matches(".disabled").to_string()
        } else {
            filename
        }
    } else {
        if !filename.ends_with(".disabled") {
            format!("{filename}.disabled")
        } else {
            filename
        }
    };

    let target_path = target_dir.join(&new_filename);
    if current_path != target_path {
        std::fs::rename(&current_path, &target_path)
            .map_err(|e| format!("Error al cambiar estado del archivo: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_instance_mod(
    app: tauri::AppHandle,
    instance_id: String,
    filename: String,
    folder_type: Option<String>,
) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let (target_dir, _) = resolve_target_folder(&path, &instance_id, folder_type.as_deref());
    let target = target_dir.join(&filename);

    if target.exists() {
        std::fs::remove_file(&target)
            .map_err(|e| format!("Error al eliminar archivo: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn install_mod_from_url(
    app: tauri::AppHandle,
    instance_id: String,
    url: String,
    filename: String,
    folder_type: Option<String>,
) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let (target_dir, _) = resolve_target_folder(&path, &instance_id, folder_type.as_deref());
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Error al crear directorio: {e}"))?;

    let target_file = target_dir.join(&filename);

    let client = reqwest::Client::builder()
        .user_agent(crate::downloader::LAUNCHER_USER_AGENT)
        .build()
        .map_err(|e| format!("Error al inicializar cliente HTTP: {e}"))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error al descargar archivo desde Modrinth: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("El servidor de Modrinth respondió con error {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Error al leer bytes del archivo: {e}"))?;

    std::fs::write(&target_file, bytes)
        .map_err(|e| format!("Error al guardar archivo descargado: {e}"))?;

    Ok(())
}
