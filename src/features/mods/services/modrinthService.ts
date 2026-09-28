import type { ModrinthSearchResult, ModrinthVersion, ModrinthVersionFile } from "../../../domain/models";
import { LAUNCHER_CONFIG } from "../../../config/launcherConfig";

const MODRINTH_API = "https://api.modrinth.com/v2";
const USER_AGENT = `${LAUNCHER_CONFIG.name}/${LAUNCHER_CONFIG.version} (dev.kato.launcher)`;

export type ModrinthProjectType = "mod" | "shader" | "resourcepack";

export interface ModrinthSearchParams {
  query?: string;
  projectType?: ModrinthProjectType;
  version?: string;
  loader?: string;
  limit?: number;
  offset?: number;
  index?: "relevance" | "downloads" | "follows" | "newest" | "updated";
}

export const modrinthService = {
  /**
   * Busca mods, shaders o resourcepacks compatibles con la versión de Minecraft.
   */
  searchMods: async (params: ModrinthSearchParams): Promise<{ hits: ModrinthSearchResult[]; totalHits: number }> => {
    const {
      query = "",
      projectType = "mod",
      version,
      loader,
      limit = 20,
      offset = 0,
      index = "downloads",
    } = params;

    const facets: string[][] = [[`project_type:${projectType}`]];

    if (version && version.trim() !== "") {
      facets.push([`versions:${version.trim()}`]);
    }

    if (projectType === "mod" && loader && loader.toLowerCase() !== "vanilla") {
      facets.push([`categories:${loader.toLowerCase()}`]);
    }

    const searchParams = new URLSearchParams();
    if (query.trim()) {
      searchParams.set("query", query.trim());
    }
    searchParams.set("facets", JSON.stringify(facets));
    searchParams.set("index", index);
    searchParams.set("limit", String(limit));
    searchParams.set("offset", String(offset));

    const response = await fetch(`${MODRINTH_API}/search?${searchParams.toString()}`, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Error de Modrinth (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    const hits: ModrinthSearchResult[] = (data.hits || []).map((hit: {
      project_id: string;
      project_type: string;
      slug: string;
      title: string;
      description: string;
      categories?: string[];
      client_side?: string;
      server_side?: string;
      icon_url: string | null;
      downloads: number;
      follows: number;
      author: string;
      latest_version?: string;
    }) => ({
      projectId: hit.project_id,
      projectType: hit.project_type,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      categories: hit.categories || [],
      clientSide: hit.client_side,
      serverSide: hit.server_side,
      iconUrl: hit.icon_url,
      downloads: hit.downloads || 0,
      follows: hit.follows || 0,
      author: hit.author,
      latestVersion: hit.latest_version,
    }));

    return {
      hits,
      totalHits: data.total_hits || 0,
    };
  },

  /**
   * Obtiene la versión compatible más reciente de un mod, shader o resourcepack.
   */
  getCompatibleVersion: async (
    projectIdOrSlug: string,
    version?: string,
    loader?: string,
    projectType: ModrinthProjectType = "mod"
  ): Promise<{ version: ModrinthVersion; primaryFile: ModrinthVersionFile } | null> => {
    const searchParams = new URLSearchParams();

    if (projectType === "mod" && loader && loader.toLowerCase() !== "vanilla") {
      searchParams.set("loaders", JSON.stringify([loader.toLowerCase()]));
    }
    if (version && version.trim() !== "") {
      searchParams.set("game_versions", JSON.stringify([version.trim()]));
    }

    const response = await fetch(
      `${MODRINTH_API}/project/${encodeURIComponent(projectIdOrSlug)}/version?${searchParams.toString()}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const versions: Array<{
      id: string;
      project_id: string;
      name: string;
      version_number: string;
      game_versions: string[];
      loaders: string[];
      files: Array<{
        url: string;
        filename: string;
        primary: boolean;
        size: number;
        hashes?: { sha1?: string; sha512?: string };
      }>;
    }> = await response.json();

    if (!Array.isArray(versions) || versions.length === 0) {
      return null;
    }

    // Buscar la versión más reciente con un archivo .jar o .zip descargable
    for (const v of versions) {
      if (!v.files || v.files.length === 0) continue;
      const validFiles = v.files.filter((f) => f.filename.endsWith(".jar") || f.filename.endsWith(".zip"));
      if (validFiles.length === 0) continue;

      const primary = validFiles.find((f) => f.primary) || validFiles[0];
      return {
        version: {
          id: v.id,
          projectId: v.project_id,
          name: v.name,
          versionNumber: v.version_number,
          gameVersions: v.game_versions || [],
          loaders: v.loaders || [],
          files: v.files.map((f) => ({
            url: f.url,
            filename: f.filename,
            primary: f.primary,
            size: f.size,
            hashes: f.hashes || {},
          })),
        },
        primaryFile: {
          url: primary.url,
          filename: primary.filename,
          primary: primary.primary,
          size: primary.size,
          hashes: primary.hashes || {},
        },
      };
    }

    return null;
  },
};
