export type Loader = "Vanilla" | "Fabric" | "Forge" | "NeoForge";

export type AvatarVariant = "steve" | "alex" | "creeper" | "ender" | "diamond" | "netherite";

export interface JavaEnvironment {
  path: string;
  majorVersion: number;
  versionString: string;
  name: string;
  isRecommended: boolean;
}

export interface OfflineProfile {
  id: string;
  name: string;
  avatar?: AvatarVariant;
  createdAt?: string;
}

export interface GameInstance {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: Loader;
  profileId: string;
  createdAt: string;
}

export interface GameVersion {
  id: string;
  type: "release" | "snapshot" | string;
  releaseTime: string;
}

export type Language = "es" | "en";

export interface LauncherState {
  instances: GameInstance[];
  profiles: OfflineProfile[];
  versions: GameVersion[];
  versionsUpdatedAt: string | null;
  activeProfileId?: string | null;
  language?: Language;
}

export const EMPTY_STATE: LauncherState = {
  instances: [],
  profiles: [],
  versions: [],
  versionsUpdatedAt: null,
  activeProfileId: null,
  language: "es",
};
