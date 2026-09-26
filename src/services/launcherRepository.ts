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
  getSystemJavas: async () => {
    if (isTauri) {
      return invoke<import("../domain/models").JavaEnvironment[]>("get_system_javas");
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
  openUrl: async (url: string): Promise<void> => {
    if (isTauri) {
      return invoke<void>("open_external_url", { url });
    }
    window.open(url, "_blank");
  },
};

