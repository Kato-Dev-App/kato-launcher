import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const configPath = path.join(rootDir, "launcher.config.json");
if (!fs.existsSync(configPath)) {
  console.error("launcher.config.json no encontrado en:", configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const { name, version } = config;

console.log(`[sync-config] Sincronizando metadatos para "${name}" v${version}...`);

// 1. Sincronizar package.json
const pkgPath = path.join(rootDir, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  let changed = false;
  if (pkg.version !== version) {
    pkg.version = version;
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("  ✓ package.json actualizado.");
  }
}

// 2. Sincronizar src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
  let changed = false;
  if (tauriConf.productName !== name) {
    tauriConf.productName = name;
    changed = true;
  }
  if (tauriConf.version !== version) {
    tauriConf.version = version;
    changed = true;
  }
  if (tauriConf.app?.windows?.[0]?.title !== name) {
    if (!tauriConf.app) tauriConf.app = {};
    if (!tauriConf.app.windows) tauriConf.app.windows = [{}];
    tauriConf.app.windows[0].title = name;
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
    console.log("  ✓ src-tauri/tauri.conf.json actualizado.");
  }
}

// 3. Sincronizar src-tauri/Cargo.toml
const cargoPath = path.join(rootDir, "src-tauri", "Cargo.toml");
if (fs.existsSync(cargoPath)) {
  let cargoContent = fs.readFileSync(cargoPath, "utf-8");
  const versionRegex = /^version\s*=\s*"[^"]+"/m;
  if (versionRegex.test(cargoContent)) {
    const updated = cargoContent.replace(versionRegex, `version = "${version}"`);
    if (updated !== cargoContent) {
      fs.writeFileSync(cargoPath, updated);
      console.log("  ✓ src-tauri/Cargo.toml actualizado.");
    }
  }
}

console.log("[sync-config] Sincronización completada exitosamente.");
