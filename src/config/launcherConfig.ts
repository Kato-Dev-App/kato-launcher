import config from "../../launcher.config.json";

export interface LauncherConfig {
  name: string;
  titlePrefix: string;
  titleSuffix: string;
  version: string;
  tag: string;
  description: string;
  website: string;
  tauriVersion: string;
  maxInstances: number;
  maxProfiles: number;
}

/**
 * Configuración centralizada de identidad y versionado de KatoLauncher.
 * La fuente de la verdad es el archivo `launcher.config.json` en la raíz del proyecto.
 */
export const LAUNCHER_CONFIG: LauncherConfig = config as LauncherConfig;
