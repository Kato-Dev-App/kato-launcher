import { invoke } from "@tauri-apps/api/core";
import { EMPTY_STATE, type LauncherState } from "../domain/models";

const isTauri = typeof window !== "undefined" && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
const STORAGE_KEY = "kato_launcher_state";

export const launcherRepository = {
  load: async (): Promise<LauncherState> => {
    if (isTauri) {
      return invoke<LauncherState>("load_state");
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    try {
      const parsed = JSON.parse(raw);
      return { ...EMPTY_STATE, ...parsed };
    } catch {
      return EMPTY_STATE;
    }
  },
  save: async (state: LauncherState): Promise<void> => {
    if (isTauri) {
      return invoke<void>("save_state", { state });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
  refreshVersions: async (): Promise<LauncherState> => {
    if (isTauri) {
      return invoke<LauncherState>("refresh_versions");
    }
    const res = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
    const data = await res.json();
    const current = await launcherRepository.load();
    const updated: LauncherState = {
      ...current,
      versions: (data.versions || []).map((v: { id: string; type: string; releaseTime: string }) => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
      })),
      versionsUpdatedAt: new Date().toISOString(),
    };
    await launcherRepository.save(updated);
    return updated;
  },
  launchInstance: async (instanceId: string): Promise<string> => {
    if (isTauri) {
      return invoke<string>("launch_instance", { instanceId });
    }
    return `Simulación web: Carpeta de instancia "${instanceId}" preparada.`;
  },
  deleteInstance: async (instanceId: string): Promise<LauncherState> => {
    if (isTauri) {
      return invoke<LauncherState>("delete_instance", { instanceId });
    }
    const current = await launcherRepository.load();
    const updated: LauncherState = {
      ...current,
      instances: current.instances.filter((i) => i.id !== instanceId),
    };
    await launcherRepository.save(updated);
    return updated;
  },
  openInstanceFolder: async (instanceId: string): Promise<void> => {
    if (isTauri) {
      return invoke<void>("open_instance_folder", { instanceId });
    }
    console.log("Simulación web: Abriendo carpeta de instancia en Finder", instanceId);
  },
  getInstanceLogs: async (instanceId: string): Promise<string> => {
    if (isTauri) {
      return invoke<string>("get_instance_logs", { instanceId });
    }
    return "Simulación web: Registros de la consola del juego para " + instanceId;
  },
  getSystemJavas: async (force?: boolean) => {
    if (isTauri) {
      return invoke<import("../domain/models").JavaEnvironment[]>("get_system_javas", { force });
    }
    return [
      {
        path: "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java",
        majorVersion: 21,
        versionString: "21.0.8",
        name: "temurin-21.jdk",
        isRecommended: true,
      }
    ];
  },
  checkInstanceJava: async (instanceId: string): Promise<import("../domain/models").JavaCheckResult> => {
    if (isTauri) {
      return invoke<import("../domain/models").JavaCheckResult>("check_instance_java", { instanceId });
    }
    return {
      needsDownload: false,
      requiredVersion: 21,
      mcVersion: "1.21.1",
      currentJavaPath: "java",
    };
  },
  downloadJavaRuntime: async (version: number): Promise<string> => {
    if (isTauri) {
      return invoke<string>("download_java_runtime", { version });
    }
    return `Simulación web: Java ${version} descargado e instalado.`;
  },
  openUrl: async (url: string): Promise<void> => {
    if (isTauri) {
      return invoke<void>("open_external_url", { url });
    }
    window.open(url, "_blank");
  },
  listInstanceMods: async (
    instanceId: string,
    folderType?: string
  ): Promise<import("../domain/models").InstalledModInfo[]> => {
    if (isTauri) {
      return invoke<import("../domain/models").InstalledModInfo[]>("list_instance_mods", {
        instanceId,
        folderType,
      });
    }
    const key = `kato_${folderType || "mods"}_${instanceId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  },
  toggleInstanceMod: async (
    instanceId: string,
    filename: string,
    enable: boolean,
    folderType?: string
  ): Promise<void> => {
    if (isTauri) {
      return invoke<void>("toggle_instance_mod", { instanceId, filename, enable, folderType });
    }
    const current = await launcherRepository.listInstanceMods(instanceId, folderType);
    const updated = current.map((m) => {
      if (m.filename === filename) {
        return { ...m, enabled: enable };
      }
      return m;
    });
    const key = `kato_${folderType || "mods"}_${instanceId}`;
    localStorage.setItem(key, JSON.stringify(updated));
  },
  deleteInstanceMod: async (
    instanceId: string,
    filename: string,
    folderType?: string
  ): Promise<void> => {
    if (isTauri) {
      return invoke<void>("delete_instance_mod", { instanceId, filename, folderType });
    }
    const current = await launcherRepository.listInstanceMods(instanceId, folderType);
    const updated = current.filter((m) => m.filename !== filename);
    const key = `kato_${folderType || "mods"}_${instanceId}`;
    localStorage.setItem(key, JSON.stringify(updated));
  },
  installModFromUrl: async (
    instanceId: string,
    url: string,
    filename: string,
    folderType?: string
  ): Promise<void> => {
    if (isTauri) {
      return invoke<void>("install_mod_from_url", { instanceId, url, filename, folderType });
    }
    const current = await launcherRepository.listInstanceMods(instanceId, folderType);
    if (!current.some((m) => m.filename === filename)) {
      current.push({
        filename,
        name: filename.replace(/\.(jar|zip)(\.disabled)?$/, ""),
        enabled: true,
        sizeBytes: 1024 * 500,
        modifiedAt: Math.floor(Date.now() / 1000),
      });
      const key = `kato_${folderType || "mods"}_${instanceId}`;
      localStorage.setItem(key, JSON.stringify(current));
    }
  },
};


