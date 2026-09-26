use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherConfigFile {
    pub name: String,
    pub title_prefix: String,
    pub title_suffix: String,
    pub version: String,
    pub tag: String,
    pub description: String,
    pub website: String,
    pub tauri_version: String,
    pub max_instances: usize,
}

pub fn get_launcher_config() -> LauncherConfigFile {
    const RAW: &str = include_str!("../../launcher.config.json");
    serde_json::from_str(RAW).unwrap_or_else(|_| LauncherConfigFile {
        name: "KatoLauncher".to_string(),
        title_prefix: "KATO".to_string(),
        title_suffix: "LAUNCHER".to_string(),
        version: "0.1.0".to_string(),
        tag: "MVP".to_string(),
        description: "Launcher ligero y modular para Minecraft".to_string(),
        website: "https://kato.dev".to_string(),
        tauri_version: "2.8".to_string(),
        max_instances: 3,
    })
}

#[allow(dead_code)]
pub const LAUNCHER_NAME: &str = "KatoLauncher";
#[allow(dead_code)]
pub const LAUNCHER_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const LAUNCHER_USER_AGENT: &str = concat!("KatoLauncher/", env!("CARGO_PKG_VERSION"));

const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FORGE_PROMOTIONS_URL: &str = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
const NEOFORGE_VERSIONS_URL: &str = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaEnvironment {
    pub path: String,
    pub major_version: u32,
    pub version_string: String,
    pub name: String,
    pub is_recommended: bool,
}

#[derive(Deserialize)]
struct VersionManifest {
    versions: Vec<ManifestEntry>,
}

#[derive(Deserialize)]
struct ManifestEntry {
    id: String,
    url: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct VersionPackage {
    #[serde(rename = "mainClass")]
    pub main_class: Option<String>,
    downloads: Option<PackageDownloads>,
    libraries: Option<Vec<LibraryEntry>>,
    #[serde(rename = "assetIndex")]
    asset_index: Option<AssetIndexRef>,
    #[serde(rename = "javaVersion")]
    java_version: Option<JavaVersionRef>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
struct JavaVersionRef {
    pub component: Option<String>,
    #[serde(rename = "majorVersion")]
    pub major_version: Option<u32>,
}

#[derive(Deserialize)]
struct PackageDownloads {
    client: Option<DownloadArtifact>,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
struct DownloadArtifact {
    pub path: Option<String>,
    pub url: String,
    pub size: u64,
    pub sha1: String,
}

#[derive(Deserialize)]
struct AssetIndexRef {
    pub id: String,
    pub url: String,
}

#[derive(Deserialize, Debug, Clone)]
struct LibraryEntry {
    pub name: Option<String>,
    downloads: Option<LibraryDownloads>,
    rules: Option<Vec<Rule>>,
}

#[derive(Deserialize, Debug, Clone)]
struct LibraryDownloads {
    artifact: Option<DownloadArtifact>,
}

#[derive(Deserialize, Debug, Clone)]
struct Rule {
    action: String,
    os: Option<OsRule>,
}

#[derive(Deserialize, Debug, Clone)]
struct OsRule {
    name: Option<String>,
    arch: Option<String>,
}

// Fabric metadata models
#[derive(Deserialize)]
struct FabricLoaderEntry {
    loader: FabricLoaderInfo,
}

#[derive(Deserialize)]
struct FabricLoaderInfo {
    version: String,
}

#[derive(Deserialize)]
struct FabricProfileJson {
    #[serde(rename = "mainClass")]
    main_class: String,
    libraries: Vec<FabricLibrary>,
}

#[derive(Deserialize)]
struct FabricLibrary {
    name: String,
    url: Option<String>,
}

fn is_library_allowed(rules: &Option<Vec<Rule>>) -> bool {
    let rules = match rules {
        Some(r) => r,
        None => return true,
    };

    let mut allowed = false;
    let is_macos = cfg!(target_os = "macos");
    let is_arm64 = cfg!(target_arch = "aarch64");

    for rule in rules {
        let action_allow = rule.action == "allow";
        if let Some(ref os) = rule.os {
            let mut matches_os = true;
            if let Some(ref name) = os.name {
                matches_os = if is_macos {
                    name == "osx"
                } else if cfg!(target_os = "windows") {
                    name == "windows"
                } else {
                    name == "linux"
                };
            }

            if matches_os {
                if let Some(ref arch) = os.arch {
                    if is_arm64 && arch == "arm64" {
                        allowed = action_allow;
                    } else if !is_arm64 && arch != "arm64" {
                        allowed = action_allow;
                    }
                } else {
                    allowed = action_allow;
                }
            }
        } else {
            allowed = action_allow;
        }
    }

    allowed
}

pub fn is_version_at_least(version: &str, target_major: u32, target_minor: u32) -> bool {
    let clean = version.trim();
    let parts: Vec<&str> = clean.split('.').collect();
    if parts.is_empty() {
        return true;
    }
    let major: u32 = parts[0].parse().unwrap_or(1);
    let minor: u32 = parts.get(1).and_then(|m| m.parse().ok()).unwrap_or(0);
    if major > target_major {
        return true;
    }
    if major == target_major {
        return minor >= target_minor;
    }
    false
}

#[allow(dead_code)]
fn parse_jvm_version_from_plist(content: &str) -> (String, u32) {
    if let Some(pos) = content.find("<key>JVMVersion</key>") {
        let rest = &content[pos..];
        if let Some(str_start) = rest.find("<string>") {
            let after_str = &rest[str_start + 8..];
            if let Some(str_end) = after_str.find("</string>") {
                let ver = &after_str[..str_end];
                let major = if ver.starts_with("1.") {
                    ver.split('.').nth(1).and_then(|m| m.parse().ok()).unwrap_or(8)
                } else {
                    ver.split('.').next().and_then(|m| m.parse().ok()).unwrap_or(21)
                };
                return (ver.to_string(), major);
            }
        }
    }
    ("21.0".to_string(), 21)
}

fn detect_java_version(bin_path: &Path) -> (String, u32) {
    if let Ok(output) = std::process::Command::new(bin_path).arg("-version").output() {
        let text = String::from_utf8_lossy(&output.stderr);
        if let Some(pos) = text.find("version \"") {
            let after = &text[pos + 9..];
            if let Some(end) = after.find('"') {
                let ver = &after[..end];
                let major = if ver.starts_with("1.") {
                    ver.split('.').nth(1).and_then(|m| m.parse().ok()).unwrap_or(8)
                } else {
                    ver.split('.').next().and_then(|m| m.parse().ok()).unwrap_or(21)
                };
                return (ver.to_string(), major);
            }
        }
    }
    guess_version_from_path(bin_path)
}

fn guess_version_from_path(path: &Path) -> (String, u32) {
    let s = path.to_string_lossy().to_string();
    if s.contains("8") || s.contains("1.8") {
        ("1.8.0".to_string(), 8)
    } else if s.contains("17") {
        ("17.0.0".to_string(), 17)
    } else if s.contains("26") {
        ("26.0.0".to_string(), 26)
    } else {
        ("21.0.0".to_string(), 21)
    }
}

pub fn scan_system_javas() -> Vec<JavaEnvironment> {
    let mut results = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    let mut add_candidate = |bin_path: PathBuf, display_name: String| {
        if !bin_path.exists() {
            return;
        }
        let canonical_str = bin_path
            .canonicalize()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| bin_path.to_string_lossy().to_string());

        if seen_paths.contains(&canonical_str) {
            return;
        }
        seen_paths.insert(canonical_str);

        let (version_str, major) = detect_java_version(&bin_path);
        results.push(JavaEnvironment {
            path: bin_path.to_string_lossy().to_string(),
            major_version: major,
            version_string: version_str,
            name: display_name,
            is_recommended: major == 21,
        });
    };

    // 1. JAVA_HOME (Multiplataforma: Windows, Linux, macOS)
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let home_path = PathBuf::from(java_home);
        let bin_java = if cfg!(target_os = "windows") {
            let javaw = home_path.join("bin").join("javaw.exe");
            if javaw.exists() { javaw } else { home_path.join("bin").join("java.exe") }
        } else {
            home_path.join("bin").join("java")
        };
        add_candidate(bin_java, "JAVA_HOME".to_string());
    }

    // 2. macOS: /Library/Java y Homebrew
    #[cfg(target_os = "macos")]
    {
        if let Ok(entries) = std::fs::read_dir("/Library/Java/JavaVirtualMachines") {
            for entry in entries.flatten() {
                let p = entry.path().join("Contents/Home/bin/java");
                let dir_name = entry.file_name().to_string_lossy().to_string();
                add_candidate(p, dir_name);
            }
        }

        let homebrew_dirs = [
            "/opt/homebrew/opt/openjdk@21/bin/java",
            "/opt/homebrew/opt/openjdk@17/bin/java",
            "/opt/homebrew/opt/openjdk@8/bin/java",
            "/opt/homebrew/opt/openjdk/bin/java",
            "/usr/local/opt/openjdk@21/bin/java",
            "/usr/local/opt/openjdk@17/bin/java",
            "/usr/local/opt/openjdk@8/bin/java",
            "/usr/local/opt/openjdk/bin/java",
        ];
        for hb in homebrew_dirs {
            add_candidate(PathBuf::from(hb), format!("Homebrew ({hb})"));
        }
    }

    // 3. Linux: /usr/lib/jvm y /usr/bin/java
    #[cfg(target_os = "linux")]
    {
        let jvm_dir = Path::new("/usr/lib/jvm");
        if let Ok(entries) = std::fs::read_dir(jvm_dir) {
            for entry in entries.flatten() {
                let bin_java = entry.path().join("bin").join("java");
                let name = entry.file_name().to_string_lossy().to_string();
                add_candidate(bin_java, name);
            }
        }
        add_candidate(PathBuf::from("/usr/bin/java"), "Linux OpenJDK (/usr/bin/java)".to_string());
    }

    // 4. Windows: C:\Program Files\ y C:\Program Files (x86)\
    #[cfg(target_os = "windows")]
    {
        let prog_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let prog_files_x86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());

        let vendors = [
            "Java",
            "Eclipse Adoptium",
            "BellSoft",
            "Microsoft",
            "Zulu",
            "Semeru",
            "Amazon Corretto",
        ];
        for base in [&prog_files, &prog_files_x86] {
            let base_path = Path::new(base);
            for vendor in &vendors {
                let vendor_dir = base_path.join(vendor);
                if let Ok(entries) = std::fs::read_dir(&vendor_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let javaw = path.join("bin").join("javaw.exe");
                        let java = path.join("bin").join("java.exe");
                        let bin = if javaw.exists() { javaw } else { java };
                        let name = format!("{vendor} - {}", entry.file_name().to_string_lossy());
                        add_candidate(bin, name);
                    }
                }
            }
        }
    }

    // 5. Fallback a PATH global si no se detectó nada
    if results.is_empty() {
        let (ver, major) = detect_java_version(Path::new("java"));
        if !ver.is_empty() && major > 0 {
            results.push(JavaEnvironment {
                path: "java".to_string(),
                major_version: major,
                version_string: ver,
                name: "Sistema (PATH)".to_string(),
                is_recommended: major == 21,
            });
        }
    }

    results
}

pub fn select_best_java(required_major: u32, mc_version: &str) -> Result<String, String> {
    let javas = scan_system_javas();

    if javas.is_empty() {
        return Err(format!(
            "No se detectó Java en tu equipo. Se requiere Java {} para ejecutar Minecraft {}.",
            required_major, mc_version
        ));
    }

    // 1. Coincidencia exacta con la versión requerida
    if let Some(exact) = javas.iter().find(|j| j.major_version == required_major) {
        return Ok(exact.path.clone());
    }

    // 2. Si se requiere Java 17 o 16 (Minecraft 1.17 a 1.20.4), Java 21 LTS es 100% compatible
    if required_major == 16 || required_major == 17 {
        if let Some(j21) = javas.iter().find(|j| j.major_version == 21) {
            return Ok(j21.path.clone());
        }
    }

    // 3. Si se requiere Java 21 o superior, buscar la versión más compatible disponible
    if required_major >= 21 {
        if let Some(newer) = javas.iter().find(|j| j.major_version >= 21) {
            return Ok(newer.path.clone());
        }
    }

    // Si falta la versión requerida, informar al usuario claramente sin exponer rutas privadas
    if required_major <= 8 {
        let hint = if cfg!(target_os = "macos") {
            "En macOS: brew install --cask zulu@8"
        } else if cfg!(target_os = "windows") {
            "En Windows: descarga Java 8 desde https://adoptium.net o Azul Zulu 8"
        } else {
            "En Linux: sudo apt install openjdk-8-jre"
        };
        return Err(format!(
            "Minecraft {} requiere Java 8. No se encontró Java 8 instalado en este equipo.\n\n{}",
            mc_version, hint
        ));
    }

    if required_major == 16 || required_major == 17 {
        let hint = if cfg!(target_os = "macos") {
            "En macOS: brew install --cask temurin@21"
        } else if cfg!(target_os = "windows") {
            "En Windows: descarga Java 17 o 21 desde https://adoptium.net"
        } else {
            "En Linux: sudo apt install openjdk-21-jre"
        };
        return Err(format!(
            "Minecraft {} requiere Java 17 o Java 21. No se encontró una versión compatible instalada en este equipo.\n\n{}",
            mc_version, hint
        ));
    }

    if required_major >= 21 {
        let hint = if cfg!(target_os = "macos") {
            "En macOS: brew install --cask temurin@21"
        } else if cfg!(target_os = "windows") {
            "En Windows: descarga Java 21 desde https://adoptium.net"
        } else {
            "En Linux: sudo apt install openjdk-21-jre"
        };
        return Err(format!(
            "Minecraft {} requiere Java 21 o superior. No se encontró Java 21 instalado en este equipo.\n\n{}",
            mc_version, hint
        ));
    }

    Err(format!(
        "Minecraft {} requiere Java {}. No se encontró una instalación compatible en este equipo.",
        mc_version, required_major
    ))
}

pub fn find_java() -> String {
    select_best_java(21, "1.21.1").unwrap_or_else(|_| "java".to_string())
}

pub fn parse_maven_coord(name: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0];
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() > 3 { parts[3] } else { "" };

    let key = format!("{}:{}:{}", group, artifact, classifier);
    let group_path = group.replace('.', "/");
    let classifier_suffix = if !classifier.is_empty() {
        format!("-{}", classifier)
    } else {
        String::new()
    };
    let rel_path = format!("{group_path}/{artifact}/{version}/{artifact}-{version}{classifier_suffix}.jar");

    Some((key, rel_path))
}

pub struct LibraryMap {
    order: Vec<String>,
    map: HashMap<String, PathBuf>,
}

impl LibraryMap {
    pub fn new() -> Self {
        Self {
            order: Vec::new(),
            map: HashMap::new(),
        }
    }

    pub fn insert(&mut self, key: String, path: PathBuf) {
        if !self.map.contains_key(&key) {
            self.order.push(key.clone());
        }
        self.map.insert(key, path);
    }

    pub fn into_paths(self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        for key in self.order {
            if let Some(p) = self.map.get(&key) {
                paths.push(p.clone());
            }
        }
        paths
    }
}

fn extract_args_from_json(val: Option<&serde_json::Value>) -> Vec<String> {
    let mut result = Vec::new();
    let Some(arr) = val.and_then(|v| v.as_array()) else {
        return result;
    };

    for item in arr {
        if let Some(s) = item.as_str() {
            result.push(s.to_string());
        } else if let Some(obj) = item.as_object() {
            let os_name = if cfg!(target_os = "macos") {
                "osx"
            } else if cfg!(target_os = "windows") {
                "windows"
            } else {
                "linux"
            };
            let allowed = if let Some(rules_val) = obj.get("rules").and_then(|r| r.as_array()) {
                let mut allow = false;
                for r in rules_val {
                    let action = r.get("action").and_then(|a| a.as_str()).unwrap_or("");
                    let os_match = r
                        .get("os")
                        .and_then(|o| o.get("name"))
                        .and_then(|n| n.as_str())
                        .map(|n| n == os_name)
                        .unwrap_or(true);
                    if action == "allow" && os_match {
                        allow = true;
                    } else if action == "disallow" && os_match {
                        allow = false;
                    }
                }
                allow
            } else {
                true
            };

            if allowed {
                if let Some(val) = obj.get("value") {
                    if let Some(s) = val.as_str() {
                        result.push(s.to_string());
                    } else if let Some(sub_arr) = val.as_array() {
                        for sub_item in sub_arr {
                            if let Some(s) = sub_item.as_str() {
                                result.push(s.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    result
}

fn load_custom_version_json(
    loader_filter: &str,
    instance_dir: &Path,
    app_data: &Path,
    lib_map: &mut LibraryMap,
    main_class: &mut String,
    extra_jvm_args: &mut Vec<String>,
    extra_game_args: &mut Vec<String>,
) {
    let versions_dir = instance_dir.join("versions");
    let Ok(entries) = std::fs::read_dir(&versions_dir) else {
        return;
    };

    let mut candidate_json: Option<PathBuf> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let dir_name = entry.file_name().to_string_lossy().to_string().to_lowercase();
            if dir_name.contains(loader_filter) {
                let json_path = path.join(format!("{}.json", entry.file_name().to_string_lossy()));
                if json_path.exists() {
                    candidate_json = Some(json_path);
                }
            }
        }
    }

    let Some(json_path) = candidate_json else {
        return;
    };

    let Ok(content) = std::fs::read_to_string(&json_path) else {
        return;
    };

    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) else {
        return;
    };

    if let Some(mc) = parsed.get("mainClass").and_then(|m| m.as_str()) {
        *main_class = mc.to_string();
    }

    if let Some(args_obj) = parsed.get("arguments").and_then(|a| a.as_object()) {
        extra_jvm_args.extend(extract_args_from_json(args_obj.get("jvm")));
        extra_game_args.extend(extract_args_from_json(args_obj.get("game")));
    }

    if let Some(libs_arr) = parsed.get("libraries").and_then(|l| l.as_array()) {
        for lib_val in libs_arr {
            if let Some(rules_val) = lib_val.get("rules") {
                if let Ok(rules) = serde_json::from_value::<Vec<Rule>>(rules_val.clone()) {
                    if !is_library_allowed(&Some(rules)) {
                        continue;
                    }
                }
            }

            let name = lib_val.get("name").and_then(|n| n.as_str()).unwrap_or("");
            if let Some((key, calculated_rel_path)) = parse_maven_coord(name) {
                let explicit_path = lib_val
                    .get("downloads")
                    .and_then(|d| d.get("artifact"))
                    .and_then(|a| a.get("path"))
                    .and_then(|p| p.as_str());

                let rel_path = explicit_path.unwrap_or(&calculated_rel_path);

                let inst_lib_path = instance_dir.join("libraries").join(rel_path);
                let app_lib_path = app_data.join("libraries").join(rel_path);

                let final_path = if inst_lib_path.exists() {
                    Some(inst_lib_path)
                } else if app_lib_path.exists() {
                    Some(app_lib_path)
                } else {
                    None
                };

                if let Some(p) = final_path {
                    lib_map.insert(key, p);
                }
            }
        }
    }
}

pub struct PreparedLaunch {
    pub main_class: String,
    pub client_jar: PathBuf,
    pub library_paths: Vec<PathBuf>,
    pub asset_index_id: String,
    pub assets_dir: PathBuf,
    pub loader_name: String,
    pub extra_jvm_args: Vec<String>,
    pub extra_game_args: Vec<String>,
    pub java_binary: String,
    pub is_lwjgl3: bool,
    pub java_major: u32,
}

pub async fn prepare_and_download_all(
    client: &reqwest::Client,
    app_data: &Path,
    instance_dir: &Path,
    mc_version: &str,
    loader: &str,
) -> Result<PreparedLaunch, String> {
    // Asegurar estructura de carpetas
    let _ = std::fs::create_dir_all(instance_dir.join("mods"));
    let _ = std::fs::create_dir_all(instance_dir.join("saves"));
    let _ = std::fs::create_dir_all(instance_dir.join("resourcepacks"));
    let _ = std::fs::create_dir_all(instance_dir.join("config"));

    // 1. Obtener manifiesto oficial para encontrar la URL del paquete de la versión
    let manifest_res = client
        .get(MANIFEST_URL)
        .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Error de red al consultar el catálogo de Mojang: {e}"))?
        .error_for_status()
        .map_err(|e| format!("El servidor de Mojang respondió con error: {e}"))?;

    let manifest: VersionManifest = manifest_res
        .json()
        .await
        .map_err(|e| format!("No se pudo decodificar el manifiesto de versiones: {e}"))?;

    let entry = manifest
        .versions
        .into_iter()
        .find(|v| v.id.eq_ignore_ascii_case(mc_version))
        .ok_or_else(|| format!("La versión '{}' de Minecraft no se encontró en el catálogo de Mojang.", mc_version))?;

    // 2. Descargar o leer version.json oficial de Minecraft
    let version_file = instance_dir.join("version.json");
    let package_bytes = if version_file.exists() && std::fs::metadata(&version_file).map(|m| m.len() > 0).unwrap_or(false) {
        std::fs::read(&version_file).map_err(|e| e.to_string())?
    } else {
        let package_res = client
            .get(&entry.url)
            .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
            .send()
            .await
            .map_err(|e| format!("Error al descargar metadatos de versión {}: {e}", mc_version))?
            .error_for_status()
            .map_err(|e| format!("Error del servidor de versión {}: {e}", mc_version))?;

        let bytes = package_res
            .bytes()
            .await
            .map_err(|e| format!("Error al leer paquete de versión: {e}"))?;
        let _ = std::fs::write(&version_file, &bytes);
        bytes.to_vec()
    };

    let package_data: VersionPackage = serde_json::from_slice(&package_bytes)
        .map_err(|e| format!("Formato de versión incompatible en version.json: {e}"))?;

    let client_download = package_data
        .downloads
        .and_then(|d| d.client)
        .ok_or_else(|| format!("La versión {} no dispone de cliente descargable.", mc_version))?;

    // 3. Descargar client.jar si falta
    let client_jar_path = instance_dir.join("client.jar");
    let needs_jar = if client_jar_path.exists() {
        std::fs::metadata(&client_jar_path).map(|m| m.len() == 0).unwrap_or(true)
    } else {
        true
    };

    if needs_jar {
        let jar_res = client
            .get(&client_download.url)
            .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
            .send()
            .await
            .map_err(|e| format!("Error al descargar client.jar: {e}"))?
            .error_for_status()
            .map_err(|e| format!("Error en servidor de client.jar: {e}"))?;

        let jar_bytes = jar_res.bytes().await.map_err(|e| e.to_string())?;
        std::fs::write(&client_jar_path, &jar_bytes).map_err(|e| e.to_string())?;
    }

    // 4. Descargar índice de assets y objetos esenciales (iconos, fuentes, texturas UI)
    let assets_dir = app_data.join("assets");
    let mut asset_index_id = "legacy".to_string();
    if let Some(index_ref) = package_data.asset_index {
        asset_index_id = index_ref.id.clone();
        let indexes_dir = assets_dir.join("indexes");
        let _ = std::fs::create_dir_all(&indexes_dir);
        let index_file = indexes_dir.join(format!("{}.json", index_ref.id));

        let index_bytes = if index_file.exists() && std::fs::metadata(&index_file).map(|m| m.len() > 0).unwrap_or(false) {
            std::fs::read(&index_file).ok()
        } else {
            if let Ok(res) = client.get(&index_ref.url).header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT).send().await {
                if let Ok(bytes) = res.bytes().await {
                    let _ = std::fs::write(&index_file, &bytes);
                    Some(bytes.to_vec())
                } else {
                    None
                }
            } else {
                None
            }
        };

        if let Some(bytes) = index_bytes {
            if let Ok(index_val) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                if let Some(objects) = index_val.get("objects").and_then(|o| o.as_object()) {
                    let objects_dir = assets_dir.join("objects");
                    let _ = std::fs::create_dir_all(&objects_dir);

                    let mut downloads = Vec::new();
                    for (name, obj) in objects {
                        let is_critical = name.starts_with("icons/")
                            || name.starts_with("minecraft/font/")
                            || name.starts_with("minecraft/lang/")
                            || name.starts_with("minecraft/textures/");

                        if is_critical {
                            if let Some(hash) = obj.get("hash").and_then(|h| h.as_str()) {
                                if hash.len() >= 2 {
                                    let prefix = &hash[0..2];
                                    let target_folder = objects_dir.join(prefix);
                                    let target_file = target_folder.join(hash);

                                    if !target_file.exists() || std::fs::metadata(&target_file).map(|m| m.len() == 0).unwrap_or(true) {
                                        let _ = std::fs::create_dir_all(&target_folder);
                                        let url = format!("https://resources.download.minecraft.net/{prefix}/{hash}");
                                        downloads.push((url, target_file));
                                    }
                                }
                            }
                        }
                    }

                    // Descarga concurrente rápida de los assets esenciales
                    for chunk in downloads.chunks(20) {
                        let mut tasks = Vec::new();
                        for (url, target) in chunk {
                            let client = client.clone();
                            let url = url.clone();
                            let target = target.clone();
                            tasks.push(tokio::spawn(async move {
                                if let Ok(res) = client.get(&url).header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT).send().await {
                                    if let Ok(data) = res.bytes().await {
                                        let _ = std::fs::write(target, data);
                                    }
                                }
                            }));
                        }
                        for task in tasks {
                            let _ = task.await;
                        }
                    }
                }
            }
        }
    }

    // 5. Descargar librerías base de Minecraft (LWJGL, etc.)
    let libraries_dir = app_data.join("libraries");
    let mut lib_map = LibraryMap::new();

    if let Some(libraries) = package_data.libraries {
        for lib in libraries {
            if !is_library_allowed(&lib.rules) {
                continue;
            }
            if let Some(downloads) = lib.downloads {
                if let Some(art) = downloads.artifact {
                    let rel_path_opt = art.path.clone().or_else(|| {
                        lib.name.as_deref().and_then(|n| parse_maven_coord(n).map(|(_, r)| r))
                    });

                    if let Some(rel_path) = rel_path_opt {
                        let target_path = libraries_dir.join(&rel_path);
                        let needs_lib = if target_path.exists() {
                            std::fs::metadata(&target_path).map(|m| m.len() == 0).unwrap_or(true)
                        } else {
                            true
                        };

                        if needs_lib {
                            if let Some(parent) = target_path.parent() {
                                let _ = std::fs::create_dir_all(parent);
                            }
                            if let Ok(res) = client
                                .get(&art.url)
                                .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
                                .send()
                                .await
                            {
                                if let Ok(bytes) = res.bytes().await {
                                    let _ = std::fs::write(&target_path, bytes);
                                }
                            }
                        }

                        if target_path.exists() {
                            let key = lib
                                .name
                                .as_deref()
                                .and_then(parse_maven_coord)
                                .map(|(k, _)| k)
                                .unwrap_or_else(|| rel_path.clone());
                            lib_map.insert(key, target_path);
                        }
                    }
                }
            }
        }
    }

    let mut main_class = package_data
        .main_class
        .unwrap_or_else(|| "net.minecraft.client.main.Main".to_string());

    let is_lwjgl3 = is_version_at_least(mc_version, 1, 13);
    let required_java_major = package_data
        .java_version
        .as_ref()
        .and_then(|j| j.major_version)
        .unwrap_or_else(|| {
            if is_version_at_least(mc_version, 1, 17) {
                17
            } else {
                8
            }
        });

    let java_bin = select_best_java(required_java_major, mc_version)?;

    let mut extra_jvm_args = Vec::new();
    let mut extra_game_args = Vec::new();

    // 6. Configurar e instalar el Mod Loader seleccionado (Fabric, Forge, NeoForge)
    match loader {
        "Fabric" => {
            // Instalar Fabric Loader
            let fabric_meta_url = format!("https://meta.fabricmc.net/v2/versions/loader/{mc_version}");
            let f_res = client
                .get(&fabric_meta_url)
                .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
                .send()
                .await
                .map_err(|e| format!("Error de conexión con Fabric Meta: {e}"))?;

            let fabric_loaders: Vec<FabricLoaderEntry> = f_res
                .json()
                .await
                .map_err(|e| format!("No se pudo interpretar catálogo de Fabric: {e}"))?;

            let loader_entry = fabric_loaders
                .first()
                .ok_or_else(|| format!("No existe versión de Fabric Loader para Minecraft {mc_version}"))?;

            let loader_ver = &loader_entry.loader.version;
            let profile_url = format!("https://meta.fabricmc.net/v2/versions/loader/{mc_version}/{loader_ver}/profile/json");

            let prof_res = client
                .get(&profile_url)
                .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
                .send()
                .await
                .map_err(|e| format!("Error al descargar perfil de Fabric: {e}"))?;

            let prof: FabricProfileJson = prof_res
                .json()
                .await
                .map_err(|e| format!("Perfil de Fabric incompatible: {e}"))?;

            // Descargar librerías de Fabric (fabric-loader, mixin, asm, intermediary)
            for lib in prof.libraries {
                if let Some((key, rel_path)) = parse_maven_coord(&lib.name) {
                    let target_path = libraries_dir.join(&rel_path);
                    if !target_path.exists() || std::fs::metadata(&target_path).map(|m| m.len() == 0).unwrap_or(true) {
                        if let Some(parent) = target_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        let base_url = lib.url.unwrap_or_else(|| "https://maven.fabricmc.net/".to_string());
                        let full_url = format!("{}/{}", base_url.trim_end_matches('/'), rel_path);
                        if let Ok(res) = client.get(&full_url).header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT).send().await {
                            if let Ok(bytes) = res.bytes().await {
                                let _ = std::fs::write(&target_path, bytes);
                            }
                        }
                    }
                    if target_path.exists() {
                        lib_map.insert(key, target_path);
                    }
                }
            }

            main_class = prof.main_class;
        }

        "Forge" => {
            // Asegurar launcher_profiles.json requerido por el instalador oficial de Forge
            let lp_file = instance_dir.join("launcher_profiles.json");
            if !lp_file.exists() {
                let _ = std::fs::write(&lp_file, b"{\"profiles\":{}}");
            }

            let marker = instance_dir.join("forge_installed.marker");
            let installer_jar = instance_dir.join("forge-installer.jar");

            if !marker.exists() {
                // Consultar versión de Forge para este Minecraft
                let promo_res = client
                    .get(FORGE_PROMOTIONS_URL)
                    .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
                    .send()
                    .await
                    .map_err(|e| format!("Error al consultar promociones de Forge: {e}"))?;

                let promo_json: serde_json::Value = promo_res
                    .json()
                    .await
                    .map_err(|e| format!("Formato inválido en promociones Forge: {e}"))?;

                let promos = promo_json.get("promos").and_then(|p| p.as_object());
                let forge_ver = promos
                    .and_then(|p| {
                        p.get(&format!("{mc_version}-recommended"))
                            .or_else(|| p.get(&format!("{mc_version}-latest")))
                    })
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| format!("No se encontró versión recomendada de Forge para Minecraft {mc_version}"))?;

                // Descargar el installer de Forge
                let installer_url = format!(
                    "https://maven.minecraftforge.net/net/minecraftforge/forge/{mc_version}-{forge_ver}/forge-{mc_version}-{forge_ver}-installer.jar"
                );

                let inst_bytes = client
                    .get(&installer_url)
                    .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
                    .send()
                    .await
                    .map_err(|e| format!("Error al descargar instalador de Forge: {e}"))?
                    .error_for_status()
                    .map_err(|e| format!("Servidor de Forge respondió con error: {e}"))?
                    .bytes()
                    .await
                    .map_err(|e| e.to_string())?;

                std::fs::write(&installer_jar, &inst_bytes).map_err(|e| e.to_string())?;

                // Ejecutar el instalador headless de Forge en la carpeta de la instancia
                let java_bin = find_java();
                let output = std::process::Command::new(&java_bin)
                    .arg("-jar")
                    .arg(&installer_jar)
                    .arg("--installClient")
                    .arg(instance_dir)
                    .current_dir(instance_dir)
                    .output()
                    .map_err(|e| format!("No se pudo ejecutar el instalador de Forge: {e}"))?;

                if !output.status.success() {
                    let err_msg = format!(
                        "stdout: {} stderr: {}",
                        String::from_utf8_lossy(&output.stdout),
                        String::from_utf8_lossy(&output.stderr)
                    );
                    return Err(format!("El instalador de Forge falló: {err_msg}"));
                }

                let _ = std::fs::write(&marker, b"installed");
            }

            // Cargar configuración exacta generada por Forge (mainClass, librerías sin duplicados y argumentos)
            load_custom_version_json(
                "forge",
                instance_dir,
                app_data,
                &mut lib_map,
                &mut main_class,
                &mut extra_jvm_args,
                &mut extra_game_args,
            );

            // Desactivar la ventana preliminar de Forge que presenta fallos gráficos en macOS
            extra_jvm_args.push("-Dfml.earlydisplay=false".to_string());
            extra_jvm_args.push("-Dforge.earlydisplay=false".to_string());
        }

        "NeoForge" => {
            // Asegurar launcher_profiles.json requerido por el instalador oficial de NeoForge
            let lp_file = instance_dir.join("launcher_profiles.json");
            if !lp_file.exists() {
                let _ = std::fs::write(&lp_file, b"{\"profiles\":{}}");
            }

            let marker = instance_dir.join("neoforge_installed.marker");
            let installer_jar = instance_dir.join("neoforge-installer.jar");

            if !marker.exists() {
                let neo_res = client
                    .get(NEOFORGE_VERSIONS_URL)
                    .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
                    .send()
                    .await
                    .map_err(|e| format!("Error al consultar versiones de NeoForge: {e}"))?;

                let neo_json: serde_json::Value = neo_res
                    .json()
                    .await
                    .map_err(|e| format!("Formato inválido en NeoForge: {e}"))?;

                let versions_arr = neo_json.get("versions").and_then(|v| v.as_array());
                let prefix = if mc_version.starts_with("1.") {
                    let parts: Vec<&str> = mc_version.split('.').collect();
                    if parts.len() >= 2 {
                        if parts.len() >= 3 {
                            format!("{}.{}.", parts[1], parts[2])
                        } else {
                            format!("{}.", parts[1])
                        }
                    } else {
                        "21.1.".to_string()
                    }
                } else {
                    "21.1.".to_string()
                };

                let best_neo = versions_arr
                    .and_then(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .filter(|s| s.starts_with(&prefix))
                            .last()
                    })
                    .ok_or_else(|| format!("No se encontró versión de NeoForge para Minecraft {mc_version}"))?;

                let installer_url = format!(
                    "https://maven.neoforged.net/releases/net/neoforged/neoforge/{best_neo}/neoforge-{best_neo}-installer.jar"
                );

                let inst_bytes = client
                    .get(&installer_url)
                    .header(reqwest::header::USER_AGENT, LAUNCHER_USER_AGENT)
                    .send()
                    .await
                    .map_err(|e| format!("Error al descargar instalador de NeoForge: {e}"))?
                    .error_for_status()
                    .map_err(|e| format!("Servidor de NeoForge respondió con error: {e}"))?
                    .bytes()
                    .await
                    .map_err(|e| e.to_string())?;

                std::fs::write(&installer_jar, &inst_bytes).map_err(|e| e.to_string())?;

                let java_bin = find_java();
                let output = std::process::Command::new(&java_bin)
                    .arg("-jar")
                    .arg(&installer_jar)
                    .arg("--installClient")
                    .arg(instance_dir)
                    .current_dir(instance_dir)
                    .output()
                    .map_err(|e| format!("No se pudo ejecutar el instalador de NeoForge: {e}"))?;

                if !output.status.success() {
                    let err_msg = format!(
                        "stdout: {} stderr: {}",
                        String::from_utf8_lossy(&output.stdout),
                        String::from_utf8_lossy(&output.stderr)
                    );
                    return Err(format!("El instalador de NeoForge falló: {err_msg}"));
                }

                let _ = std::fs::write(&marker, b"installed");
            }

            load_custom_version_json(
                "neoforge",
                instance_dir,
                app_data,
                &mut lib_map,
                &mut main_class,
                &mut extra_jvm_args,
                &mut extra_game_args,
            );

            extra_jvm_args.push("-Dneoforge.earlydisplay=false".to_string());
        }

        _ => {
            // Vanilla: no requiere loader extra
        }
    }

    let library_paths = lib_map.into_paths();

    Ok(PreparedLaunch {
        main_class,
        client_jar: client_jar_path,
        library_paths,
        asset_index_id,
        assets_dir,
        loader_name: loader.to_string(),
        extra_jvm_args,
        extra_game_args,
        java_binary: java_bin,
        is_lwjgl3,
        java_major: required_java_major,
    })
}
