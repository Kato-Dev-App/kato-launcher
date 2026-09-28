use crate::downloader;
use crate::persistence::load_state_from;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaCheckResult {
    pub needs_download: bool,
    pub required_version: u32,
    pub mc_version: String,
    pub current_java_path: Option<String>,
}

#[tauri::command]
pub fn get_system_javas(
    app: tauri::AppHandle,
    force: Option<bool>,
) -> Result<Vec<downloader::JavaEnvironment>, String> {
    if force.unwrap_or(false) {
        downloader::invalidate_java_cache();
    }
    let app_data = app.path().app_data_dir().ok();
    Ok(downloader::scan_system_javas(app_data.as_deref()))
}

#[tauri::command]
pub fn check_instance_java(app: tauri::AppHandle, instance_id: String) -> Result<JavaCheckResult, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let state = load_state_from(path.clone())?;
    let instance = state
        .instances
        .iter()
        .find(|i| i.id == instance_id)
        .ok_or_else(|| format!("Instancia con id {instance_id} no encontrada."))?;

    let required_version = downloader::get_instance_required_java(&path, &instance.minecraft_version);
    match downloader::select_best_java(required_version, &instance.minecraft_version, Some(&path)) {
        Ok(found_path) => Ok(JavaCheckResult {
            needs_download: false,
            required_version,
            mc_version: instance.minecraft_version.clone(),
            current_java_path: Some(found_path),
        }),
        Err(_) => Ok(JavaCheckResult {
            needs_download: true,
            required_version,
            mc_version: instance.minecraft_version.clone(),
            current_java_path: None,
        }),
    }
}

#[tauri::command]
pub async fn download_java_runtime(app: tauri::AppHandle, version: u32) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    downloader::download_portable_java(&path, version).await
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
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
