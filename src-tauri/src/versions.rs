use crate::persistence::{GameVersion, LauncherState};
use serde::Deserialize;

const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Deserialize)]
struct VersionManifest {
    versions: Vec<ManifestVersion>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestVersion {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    release_time: String,
}

pub async fn refresh_catalog(mut state: LauncherState) -> Result<LauncherState, String> {
    let response = reqwest::Client::new()
        .get(MANIFEST_URL)
        .header(reqwest::header::USER_AGENT, "KatoLauncher/0.1.0")
        .send()
        .await
        .map_err(|error| format!("Error de red al consultar versiones: {error}"))?
        .error_for_status()
        .map_err(|error| format!("El catálogo de Minecraft respondió con error: {error}"))?;
    let manifest: VersionManifest = response.json().await.map_err(|error| format!("No se pudo interpretar el manifiesto: {error}"))?;
    state.versions = manifest.versions.into_iter().map(|item| GameVersion { id: item.id, kind: item.kind, release_time: item.release_time }).collect();
    state.versions_updated_at = Some(chrono::Utc::now().to_rfc3339());
    Ok(state)
}
