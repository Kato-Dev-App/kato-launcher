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

// Lista de dependencias conocidas para versiones legacy donde el creador omitió declararlas en Modrinth
const KNOWN_LEGACY_DEPENDENCIES: Array<{
  projectIdsOrSlugs: string[];
  loaders?: string[];
  gameVersions?: string[];
  requiredProjectId: string;
}> = [
  {
    // Xaero's Minimap y Xaero's World Map en Forge 1.16.5 y 1.12.2 requieren XaeroLib (ZaQIxZKn),
    // pero más de 70 versiones antiguas en Modrinth tienen dependencies: [] por omisión del autor.
    projectIdsOrSlugs: ["1bokancj", "xaeros-minimap", "ncutcpym", "xaeros-world-map"],
    loaders: ["forge", "neoforge"],
    gameVersions: ["1.16.5", "1.12.2"],
    requiredProjectId: "ZaQIxZKn", // XaeroLib
  },
];

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
      dependencies?: Array<{
        version_id: string | null;
        project_id: string | null;
        file_name: string | null;
        dependency_type: "required" | "optional" | "incompatible" | "embedded";
      }>;
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
          dependencies: (v.dependencies || []).map(
            (d: {
              version_id: string | null;
              project_id: string | null;
              file_name: string | null;
              dependency_type: "required" | "optional" | "incompatible" | "embedded";
            }) => ({
              versionId: d.version_id || null,
              projectId: d.project_id || null,
              fileName: d.file_name || null,
              dependencyType: d.dependency_type,
            })
          ),
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

  /**
   * Obtiene todas las versiones compatibles de un proyecto para el Minecraft y Loader dados.
   */
  getProjectVersions: async (
    projectIdOrSlug: string,
    version?: string,
    loader?: string,
    projectType: ModrinthProjectType = "mod"
  ): Promise<
    Array<{
      version: ModrinthVersion;
      primaryFile: ModrinthVersionFile;
      datePublished?: string;
      versionType?: string;
    }>
  > => {
    const searchParams = new URLSearchParams();

    if (projectType === "mod" && loader && loader.toLowerCase() !== "vanilla") {
      searchParams.set("loaders", JSON.stringify([loader.toLowerCase()]));
    }
    if (version && version.trim() !== "") {
      searchParams.set("game_versions", JSON.stringify([version.trim()]));
    }

    try {
      const response = await fetch(
        `${MODRINTH_API}/project/${encodeURIComponent(projectIdOrSlug)}/version?${searchParams.toString()}`,
        {
          headers: {
            "User-Agent": USER_AGENT,
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data: Array<{
        id: string;
        project_id: string;
        name: string;
        version_number: string;
        game_versions: string[];
        loaders: string[];
        date_published?: string;
        version_type?: string;
        dependencies?: Array<{
          version_id: string | null;
          project_id: string | null;
          file_name: string | null;
          dependency_type: "required" | "optional" | "incompatible" | "embedded";
        }>;
        files: Array<{
          url: string;
          filename: string;
          primary: boolean;
          size: number;
          hashes?: { sha1?: string; sha512?: string };
        }>;
      }> = await response.json();

      if (!Array.isArray(data)) {
        return [];
      }

      const results: Array<{
        version: ModrinthVersion;
        primaryFile: ModrinthVersionFile;
        datePublished?: string;
        versionType?: string;
      }> = [];

      for (const v of data) {
        if (!v.files || v.files.length === 0) continue;
        const validFiles = v.files.filter(
          (f) => f.filename.endsWith(".jar") || f.filename.endsWith(".zip")
        );
        if (validFiles.length === 0) continue;

        const primary = validFiles.find((f) => f.primary) || validFiles[0];

        results.push({
          version: {
            id: v.id,
            projectId: v.project_id,
            name: v.name,
            versionNumber: v.version_number,
            gameVersions: v.game_versions || [],
            loaders: v.loaders || [],
            dependencies: (v.dependencies || []).map((d) => ({
              versionId: d.version_id || null,
              projectId: d.project_id || null,
              fileName: d.file_name || null,
              dependencyType: d.dependency_type,
            })),
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
          datePublished: v.date_published,
          versionType: v.version_type,
        });
      }

      return results;
    } catch {
      return [];
    }
  },

  /**
   * Obtiene la información básica de un proyecto (título, slug, icono).
   */
  getProject: async (
    projectIdOrSlug: string
  ): Promise<{ id: string; slug: string; title: string; iconUrl: string | null } | null> => {
    try {
      const response = await fetch(`${MODRINTH_API}/project/${encodeURIComponent(projectIdOrSlug)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        iconUrl: data.icon_url || null,
      };
    } catch {
      return null;
    }
  },

  /**
   * Obtiene una versión específica por su ID.
   */
  getVersion: async (
    versionId: string
  ): Promise<{ version: ModrinthVersion; primaryFile: ModrinthVersionFile } | null> => {
    try {
      const response = await fetch(`${MODRINTH_API}/version/${encodeURIComponent(versionId)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) return null;
      const v = await response.json();
      if (!v || !v.files || v.files.length === 0) return null;
      const validFiles = v.files.filter((f: { filename: string }) => f.filename.endsWith(".jar") || f.filename.endsWith(".zip"));
      if (validFiles.length === 0) return null;
      const primary = validFiles.find((f: { primary: boolean }) => f.primary) || validFiles[0];

      return {
        version: {
          id: v.id,
          projectId: v.project_id,
          name: v.name,
          versionNumber: v.version_number,
          gameVersions: v.game_versions || [],
          loaders: v.loaders || [],
          dependencies: (v.dependencies || []).map(
            (d: {
              version_id: string | null;
              project_id: string | null;
              file_name: string | null;
              dependency_type: "required" | "optional" | "incompatible" | "embedded";
            }) => ({
              versionId: d.version_id || null,
              projectId: d.project_id || null,
              fileName: d.file_name || null,
              dependencyType: d.dependency_type,
            })
          ),
          files: v.files.map((f: { url: string; filename: string; primary: boolean; size: number; hashes?: { sha1?: string; sha512?: string } }) => ({
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
    } catch {
      return null;
    }
  },

  /**
   * Resuelve de forma recursiva todas las dependencias obligatorias ('required')
   * de una versión de Modrinth, verificando si ya están instaladas.
   */
  resolveDependencies: async (params: {
    version: ModrinthVersion;
    minecraftVersion?: string;
    loader?: string;
    installedFiles?: Array<{ filename: string; name?: string }>;
    projectSlug?: string;
  }): Promise<ModDependencyItem[]> => {
    const { version, minecraftVersion, loader, installedFiles = [], projectSlug } = params;
    const visitedProjects = new Set<string>();
    if (version.projectId) visitedProjects.add(version.projectId);

    const resolvedMap = new Map<string, ModDependencyItem>();
    const queue: Array<{
      versionId: string | null;
      projectId: string | null;
      dependencyType: "required" | "optional";
    }> = [];

    for (const dep of version.dependencies || []) {
      if (
        (dep.dependencyType === "required" || dep.dependencyType === "optional") &&
        (dep.projectId || dep.versionId)
      ) {
        queue.push({
          versionId: dep.versionId,
          projectId: dep.projectId,
          dependencyType: dep.dependencyType,
        });
      }
    }

    // Comprobar si hay dependencias obligatorias conocidas que falten en los metadatos de Modrinth
    const currentLoader = (loader || "").toLowerCase();
    const currentMc = (minecraftVersion || "").trim();
    const currentProject = (projectSlug || version.projectId || "").toLowerCase();

    for (const rule of KNOWN_LEGACY_DEPENDENCIES) {
      const matchProject =
        rule.projectIdsOrSlugs.includes(currentProject) ||
        (version.projectId && rule.projectIdsOrSlugs.includes(version.projectId.toLowerCase()));

      const matchLoader = !rule.loaders || rule.loaders.includes(currentLoader);
      const matchVersion = !rule.gameVersions || rule.gameVersions.includes(currentMc);

      if (matchProject && matchLoader && matchVersion) {
        const alreadyInDeps = (version.dependencies || []).some(
          (d) => d.projectId === rule.requiredProjectId
        );
        const alreadyInQueue = queue.some((q) => q.projectId === rule.requiredProjectId);
        if (!alreadyInDeps && !alreadyInQueue) {
          queue.push({
            versionId: null,
            projectId: rule.requiredProjectId,
            dependencyType: "required",
          });
        }
      }
    }

    let iterations = 0;
    const MAX_ITERATIONS = 25;

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const current = queue.shift()!;
      let resolvedVersionInfo: { version: ModrinthVersion; primaryFile: ModrinthVersionFile } | null = null;

      if (current.versionId) {
        resolvedVersionInfo = await modrinthService.getVersion(current.versionId);
        // Si el versionId fijo devuelve una versión no compatible con el Minecraft actual, usar getCompatibleVersion
        if (
          resolvedVersionInfo &&
          minecraftVersion &&
          resolvedVersionInfo.version.gameVersions.length > 0 &&
          !resolvedVersionInfo.version.gameVersions.includes(minecraftVersion.trim()) &&
          current.projectId
        ) {
          const compatibleFallback = await modrinthService.getCompatibleVersion(
            current.projectId,
            minecraftVersion,
            loader,
            "mod"
          );
          if (compatibleFallback) {
            resolvedVersionInfo = compatibleFallback;
          }
        } else if (!resolvedVersionInfo && current.projectId) {
          resolvedVersionInfo = await modrinthService.getCompatibleVersion(
            current.projectId,
            minecraftVersion,
            loader,
            "mod"
          );
        }
      } else if (current.projectId) {
        if (visitedProjects.has(current.projectId)) {
          const existing = resolvedMap.get(current.projectId);
          if (existing && current.dependencyType === "required") {
            existing.dependencyType = "required";
          }
          continue;
        }
        resolvedVersionInfo = await modrinthService.getCompatibleVersion(
          current.projectId,
          minecraftVersion,
          loader,
          "mod"
        );
      }

      if (!resolvedVersionInfo || !resolvedVersionInfo.primaryFile) continue;

      const pId = resolvedVersionInfo.version.projectId || current.projectId;
      if (!pId) continue;

      if (visitedProjects.has(pId)) {
        const existing = resolvedMap.get(pId);
        if (existing && current.dependencyType === "required") {
          existing.dependencyType = "required";
        }
        continue;
      }
      visitedProjects.add(pId);

      // Obtener metadatos del proyecto
      const projectMeta = await modrinthService.getProject(pId);
      const knownTitleMap: Record<string, string> = {
        ZaQIxZKn: "XaeroLib",
        xaerolib: "XaeroLib",
        "1bokaNcj": "Xaero's Minimap",
        "xaeros-minimap": "Xaero's Minimap",
        NcUtCpym: "Xaero's World Map",
        "xaeros-world-map": "Xaero's World Map",
      };
      const title =
        projectMeta?.title ||
        knownTitleMap[pId] ||
        resolvedVersionInfo.version.name ||
        resolvedVersionInfo.primaryFile.filename ||
        pId;
      const slug = projectMeta?.slug || pId;
      const iconUrl = projectMeta?.iconUrl || null;

      const alreadyInstalled = isModFilenameInstalled(
        slug,
        title,
        resolvedVersionInfo.primaryFile.filename,
        installedFiles
      );

      const item: ModDependencyItem = {
        projectId: pId,
        projectTitle: title,
        slug,
        iconUrl,
        versionId: resolvedVersionInfo.version.id,
        versionNumber: resolvedVersionInfo.version.versionNumber,
        filename: resolvedVersionInfo.primaryFile.filename,
        downloadUrl: resolvedVersionInfo.primaryFile.url,
        size: resolvedVersionInfo.primaryFile.size,
        alreadyInstalled,
        dependencyType: current.dependencyType,
      };

      resolvedMap.set(pId, item);

      // Si tiene dependencias hijas requeridas, encolarlas (siempre como obligatorias)
      for (const childDep of resolvedVersionInfo.version.dependencies || []) {
        if (
          childDep.dependencyType === "required" &&
          childDep.projectId &&
          !visitedProjects.has(childDep.projectId)
        ) {
          queue.push({
            versionId: childDep.versionId,
            projectId: childDep.projectId,
            dependencyType: "required",
          });
        }
      }
    }

    const result = Array.from(resolvedMap.values());
    result.sort((a, b) => {
      if (a.dependencyType === "required" && b.dependencyType !== "required") return -1;
      if (a.dependencyType !== "required" && b.dependencyType === "required") return 1;
      return a.projectTitle.localeCompare(b.projectTitle);
    });

    return result;
  },
};

export interface ModDependencyItem {
  projectId: string;
  projectTitle: string;
  slug: string;
  iconUrl?: string | null;
  versionId: string;
  versionNumber: string;
  filename: string;
  downloadUrl: string;
  size: number;
  alreadyInstalled: boolean;
  dependencyType: "required" | "optional";
}

/**
 * Verifica si un archivo o slug ya existe entre los elementos instalados.
 */
export function isModFilenameInstalled(
  slug: string,
  title: string,
  filename: string,
  installedFiles: Array<{ filename: string; name?: string }>
): boolean {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanFilename = filename.toLowerCase();

  return installedFiles.some((im) => {
    const imFile = im.filename.toLowerCase();
    const imClean = imFile.replace(/[^a-z0-9]/g, "");
    const imName = (im.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Coincidencia exacta de nombre de archivo
    if (imFile === cleanFilename) return true;

    // Coincidencia por slug
    if (slug.length >= 3 && (imFile.includes(slug.toLowerCase()) || imClean.includes(cleanSlug))) {
      return true;
    }

    // Coincidencia por título limpio
    if (cleanTitle.length >= 4 && (imClean.includes(cleanTitle) || imName.includes(cleanTitle))) {
      return true;
    }

    return false;
  });
}
