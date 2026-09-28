use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LauncherState {
    pub instances: Vec<GameInstance>,
    pub profiles: Vec<OfflineProfile>,
    pub versions: Vec<GameVersion>,
    pub versions_updated_at: Option<String>,
    #[serde(default)]
    pub active_profile_id: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameInstance {
    pub id: String,
    pub name: String,
    pub minecraft_version: String,
    pub loader: String,
    pub profile_id: String,
    pub created_at: String,
    #[serde(default)]
    pub ram_gb: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    #[serde(default)]
    pub skin_variant: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameVersion {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub release_time: String,
}

fn state_file(directory: PathBuf) -> PathBuf {
    directory.join("launcher-state.json")
}

pub fn load_state_from(directory: PathBuf) -> Result<LauncherState, String> {
    let file = state_file(directory);
    if !file.exists() {
        return Ok(LauncherState::default());
    }
    let content = fs::read_to_string(file).map_err(|error| format!("No se pudo leer el estado local: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("El estado local no es válido: {error}"))
}

pub fn save_state_to(directory: PathBuf, state: &LauncherState) -> Result<(), String> {
    fs::create_dir_all(&directory).map_err(|error| format!("No se pudo crear el directorio de datos: {error}"))?;
    let destination = state_file(directory);
    let temporary = destination.with_extension("json.tmp");
    let content = serde_json::to_vec_pretty(state).map_err(|error| error.to_string())?;
    fs::write(&temporary, content).map_err(|error| format!("No se pudo escribir el estado: {error}"))?;
    fs::rename(&temporary, &destination).map_err(|error| format!("No se pudo guardar el estado: {error}"))
}
