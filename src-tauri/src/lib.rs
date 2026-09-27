mod downloader;
mod instances;
mod mods;
mod persistence;
mod system;
mod versions;

use instances::{delete_instance, get_instance_logs, launch_instance, open_instance_folder};
pub use mods::InstalledModInfo;
use mods::{delete_instance_mod, install_mod_from_url, list_instance_mods, toggle_instance_mod};
use persistence::{load_state_from, save_state_to};
use system::{check_instance_java, download_java_runtime, get_system_javas, open_external_url};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            refresh_versions,
            launch_instance,
            get_instance_logs,
            delete_instance,
            open_instance_folder,
            open_external_url,
            get_system_javas,
            check_instance_java,
            download_java_runtime,
            list_instance_mods,
            toggle_instance_mod,
            delete_instance_mod,
            install_mod_from_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running KatoLauncher");
}
