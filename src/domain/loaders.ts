import type { Loader } from "./models";

export interface LoaderCompatibility {
  loader: Loader;
  supported: boolean;
  reason?: string;
}

export const ALL_LOADERS: Loader[] = ["Vanilla", "Fabric", "Forge", "NeoForge"];

export const POPULAR_VERSIONS = [
  { id: "1.21.4", label: "1.21.4 (Última)" },
  { id: "1.20.1", label: "1.20.1 (Mods)" },
  { id: "1.19.2", label: "1.19.2" },
  { id: "1.16.5", label: "1.16.5 (Clásico)" },
  { id: "1.12.2", label: "1.12.2 (Grandes mods)" },
  { id: "1.8.9", label: "1.8.9 (PvP)" },
];

/**
 * Determina qué loaders están disponibles para una versión específica de Minecraft
 * y proporciona la razón en caso de incompatibilidad.
 */
export function checkLoaderCompatibility(
  mcVersion: string,
  versionType?: string
): Record<Loader, { supported: boolean; reason?: string }> {
  const clean = (mcVersion || "").trim();
  const isSnapshot =
    versionType === "snapshot" ||
    /^\d{2}w\d{2}[a-z]$/i.test(clean) ||
    clean.includes("-pre") ||
    clean.includes("-rc");

  const match = clean.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  const major = match ? parseInt(match[1], 10) : 0;
  const minor = match ? parseInt(match[2], 10) : 0;
  const patch = match && match[3] ? parseInt(match[3], 10) : 0;

  // 1. Vanilla: Siempre soportado
  const vanilla = {
    supported: true,
  };

  // 2. Fabric:
  // Requiere Minecraft >= 1.14 o snapshots desde 2019 (18w43a+ / 19w+)
  let fabricSupported = false;
  let fabricReason: string | undefined;

  if (match) {
    if (major === 1 && minor >= 14) {
      fabricSupported = true;
    } else {
      fabricReason = "Fabric solo es compatible con Minecraft 1.14 o superior.";
    }
  } else if (isSnapshot) {
    const snapMatch = clean.match(/^(\d{2})w/i);
    const snapYear = snapMatch ? parseInt(snapMatch[1], 10) : 0;
    if (snapYear >= 19) {
      fabricSupported = true;
    } else {
      fabricReason = "Fabric no tiene soporte para snapshots anteriores a 1.14.";
    }
  } else {
    fabricReason = "Versión no reconocida para Fabric.";
  }

  // 3. Forge:
  // Compatible con versiones estables desde 1.1 hasta 1.20+.
  // No tiene soporte para snapshots de desarrollo.
  let forgeSupported = false;
  let forgeReason: string | undefined;

  if (isSnapshot) {
    forgeReason = "Forge no soporta snapshots de desarrollo.";
  } else if (match) {
    if (major === 1 && minor >= 1) {
      forgeSupported = true;
    } else {
      forgeReason = "Forge requiere Minecraft 1.1 o superior.";
    }
  } else {
    forgeReason = "Versión no reconocida para Forge.";
  }

  // 4. NeoForge:
  // Nació en Minecraft 1.20.2 y continúa en 1.20.4, 1.20.6, 1.21+
  let neoForgeSupported = false;
  let neoForgeReason: string | undefined;

  if (isSnapshot) {
    neoForgeReason = "NeoForge está optimizado para versiones oficiales de release.";
  } else if (match) {
    if (major === 1 && (minor > 20 || (minor === 20 && patch >= 2))) {
      neoForgeSupported = true;
    } else {
      neoForgeReason = "NeoForge solo existe para Minecraft 1.20.2 o superior.";
    }
  } else {
    neoForgeReason = "Versión no reconocida para NeoForge.";
  }

  return {
    Vanilla: vanilla,
    Fabric: { supported: fabricSupported, reason: fabricReason },
    Forge: { supported: forgeSupported, reason: forgeReason },
    NeoForge: { supported: neoForgeSupported, reason: neoForgeReason },
  };
}

export function getAvailableLoaders(mcVersion: string, versionType?: string): Loader[] {
  const compatibility = checkLoaderCompatibility(mcVersion, versionType);
  return ALL_LOADERS.filter((loader) => compatibility[loader].supported);
}
