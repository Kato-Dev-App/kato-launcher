export type Loader = "Vanilla" | "Fabric" | "Forge" | "NeoForge";

export type AvatarVariant =
  | "creeper"
  | "zombie"
  | "enderman"
  | "esqueleto"
  | "cerdo"
  | "vaca"
  | "pollo"
  | "steve"
  | "alex"
  | string;

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
  skinVariant?: string;
  createdAt?: string;
}

export interface GameInstance {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: Loader;
  profileId: string;
  createdAt: string;
  ramGb?: number;
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

export interface InstalledModInfo {
  filename: string;
  name: string;
  enabled: boolean;
  sizeBytes: number;
  modifiedAt?: number;
}

export interface ModrinthSearchResult {
  projectId: string;
  projectType: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  clientSide?: string;
  serverSide?: string;
  iconUrl: string | null;
  downloads: number;
  follows: number;
  author: string;
  latestVersion?: string;
}

export interface ModrinthVersionFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  hashes: {
    sha1?: string;
    sha512?: string;
  };
}

export interface ModrinthDependency {
  versionId: string | null;
  projectId: string | null;
  fileName: string | null;
  dependencyType: "required" | "optional" | "incompatible" | "embedded";
}

export interface ModrinthVersion {
  id: string;
  projectId: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  files: ModrinthVersionFile[];
  dependencies?: ModrinthDependency[];
}

export interface JavaCheckResult {
  needsDownload: boolean;
  requiredVersion: number;
  mcVersion: string;
  currentJavaPath?: string | null;
}
