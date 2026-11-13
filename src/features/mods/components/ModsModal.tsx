import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  FolderOpen,
  History,
  Info,
  Layers,
  Loader2,
  Package,
  Palette,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  SunMedium,
  Trash2,
  X,
} from "lucide-react";
import type {
  GameInstance,
  InstalledModInfo,
  ModrinthSearchResult,
  ModrinthVersion,
  ModrinthVersionFile,
} from "../../../domain/models";
import { launcherRepository } from "../../../services/launcherRepository";
import {
  modrinthService,
  isModFilenameInstalled,
  type ModrinthProjectType,
  type ModDependencyItem,
} from "../services/modrinthService";
import { getTranslation, type Language } from "../../../i18n";

interface ModsModalProps {
  instance: GameInstance;
  language?: Language;
  onClose: () => void;
  onOpenFolder: () => void;
}

export function ModsModal({ instance, language = "es", onClose, onOpenFolder }: ModsModalProps) {
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation(language, key, params);

  const [tab, setTab] = useState<"installed" | "explore">("installed");
  const [contentType, setContentType] = useState<ModrinthProjectType>("mod");

  // Installed items state
  const [installedItems, setInstalledItems] = useState<InstalledModInfo[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState<boolean>(true);
  const [installedFilter, setInstalledFilter] = useState<string>("");
  const [togglingItem, setTogglingItem] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  // Modrinth search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"downloads" | "relevance" | "newest">("downloads");
  const [searchResults, setSearchResults] = useState<ModrinthSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installProgressText, setInstallProgressText] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [pendingInstallItem, setPendingInstallItem] = useState<{
    item: ModrinthSearchResult;
    compatible: { version: ModrinthVersion; primaryFile: ModrinthVersionFile };
    dependencies: ModDependencyItem[];
  } | null>(null);
  const [selectedDepProjectIds, setSelectedDepProjectIds] = useState<Set<string>>(new Set());

  const toggleDependency = (projectId: string) => {
    setSelectedDepProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const selectAllDependencies = (deps: ModDependencyItem[]) => {
    const uninstalledIds = deps.filter((d) => !d.alreadyInstalled).map((d) => d.projectId);
    setSelectedDepProjectIds(new Set(uninstalledIds));
  };

  const selectOnlyRequiredDependencies = (deps: ModDependencyItem[]) => {
    const requiredIds = deps
      .filter((d) => !d.alreadyInstalled && d.dependencyType === "required")
      .map((d) => d.projectId);
    setSelectedDepProjectIds(new Set(requiredIds));
  };

  // Modal para ver y seleccionar versiones de un mod del catálogo
  const [versionsModalItem, setVersionsModalItem] = useState<ModrinthSearchResult | null>(null);
  const [availableVersions, setAvailableVersions] = useState<
    Array<{
      version: ModrinthVersion;
      primaryFile: ModrinthVersionFile;
      datePublished?: string;
      versionType?: string;
    }>
  >([]);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);

  // Selector de versión para una dependencia en el modal de dependencias
  const [depVersionPicker, setDepVersionPicker] = useState<{
    dep: ModDependencyItem;
    versions: Array<{
      version: ModrinthVersion;
      primaryFile: ModrinthVersionFile;
      datePublished?: string;
      versionType?: string;
    }>;
    loading: boolean;
  } | null>(null);

  const handleOpenVersionsModal = async (item: ModrinthSearchResult) => {
    setVersionsModalItem(item);
    setLoadingVersions(true);
    setAvailableVersions([]);
    try {
      const list = await modrinthService.getProjectVersions(
        item.projectId,
        instance.minecraftVersion,
        instance.loader,
        contentType
      );
      setAvailableVersions(list);
    } catch (e) {
      console.error("Error al cargar versiones:", e);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleInstallSpecificVersion = async (
    item: ModrinthSearchResult,
    vInfo: { version: ModrinthVersion; primaryFile: ModrinthVersionFile }
  ) => {
    setVersionsModalItem(null);
    setInstallingId(item.projectId);
    setInstallProgressText(t("mods.resolvingDependencies"));

    try {
      if (contentType === "mod") {
        const dependencies = await modrinthService.resolveDependencies({
          version: vInfo.version,
          minecraftVersion: instance.minecraftVersion,
          loader: instance.loader,
          installedFiles: installedItems,
          projectSlug: item.slug || item.projectId,
        });

        const uninstalledDeps = dependencies.filter((d) => !d.alreadyInstalled);
        if (uninstalledDeps.length > 0) {
          setSelectedDepProjectIds(new Set(uninstalledDeps.map((d) => d.projectId)));
          setPendingInstallItem({
            item,
            compatible: vInfo,
            dependencies,
          });
          setInstallingId(null);
          setInstallProgressText(null);
          return;
        }
      }

      await executeDirectInstall(item, vInfo);
    } catch (err) {
      console.error("Error instalando versión específica:", err);
      setFeedback({
        text: t("mods.downloadError", { title: item.title }),
        type: "error",
      });
      setInstallingId(null);
      setInstallProgressText(null);
    }
  };

  const handleOpenDepVersionPicker = async (dep: ModDependencyItem) => {
    setDepVersionPicker({
      dep,
      versions: [],
      loading: true,
    });
    try {
      const list = await modrinthService.getProjectVersions(
        dep.projectId,
        instance.minecraftVersion,
        instance.loader,
        "mod"
      );
      setDepVersionPicker({
        dep,
        versions: list,
        loading: false,
      });
    } catch (e) {
      console.error("Error al cargar versiones de dependencia:", e);
      setDepVersionPicker(null);
    }
  };

  const handleSelectDepVersion = (
    dep: ModDependencyItem,
    selectedV: { version: ModrinthVersion; primaryFile: ModrinthVersionFile }
  ) => {
    setDepVersionPicker(null);
    if (!pendingInstallItem) return;

    const updatedDeps = pendingInstallItem.dependencies.map((d) => {
      if (d.projectId === dep.projectId) {
        return {
          ...d,
          versionId: selectedV.version.id,
          versionNumber: selectedV.version.versionNumber,
          filename: selectedV.primaryFile.filename,
          downloadUrl: selectedV.primaryFile.url,
          size: selectedV.primaryFile.size,
          alreadyInstalled: isModFilenameInstalled(
            d.slug,
            d.projectTitle,
            selectedV.primaryFile.filename,
            installedItems
          ),
        };
      }
      return d;
    });

    setPendingInstallItem({
      ...pendingInstallItem,
      dependencies: updatedDeps,
    });
  };

  // Cargar elementos instalados según la carpeta del tipo de contenido
  const refreshInstalled = async (type: ModrinthProjectType = contentType) => {
    try {
      setLoadingInstalled(true);
      const list = await launcherRepository.listInstanceMods(instance.id, type);
      setInstalledItems(list);
    } catch (e) {
      console.error("Error al cargar elementos instalados:", e);
    } finally {
      setLoadingInstalled(false);
    }
  };

  useEffect(() => {
    refreshInstalled(contentType);
  }, [instance.id, contentType]);

  // Cargar recomendados o buscar al entrar a la pestaña 'explore' o cambiar de tipo
  useEffect(() => {
    if (tab === "explore") {
      performSearch(searchQuery, contentType);
    }
  }, [tab, contentType]);

  const performSearch = async (queryText: string, type: ModrinthProjectType = contentType) => {
    try {
      setLoadingSearch(true);
      setSearchError(null);
      const { hits } = await modrinthService.searchMods({
        query: queryText,
        projectType: type,
        version: instance.minecraftVersion,
        loader: instance.loader,
        index: sortBy,
        limit: 30,
      });
      setSearchResults(hits);
    } catch (err: unknown) {
      console.error("Error buscando en Modrinth:", err);
      setSearchError(t("mods.errorLoading"));
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleContentTypeChange = (newType: ModrinthProjectType) => {
    if (newType === contentType) return;
    setContentType(newType);
    setInstalledFilter("");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery, contentType);
  };

  const handleToggle = async (item: InstalledModInfo) => {
    try {
      setTogglingItem(item.filename);
      await launcherRepository.toggleInstanceMod(instance.id, item.filename, !item.enabled, contentType);
      await refreshInstalled(contentType);
    } catch (err) {
      console.error("Error al alternar estado:", err);
    } finally {
      setTogglingItem(null);
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      setDeletingItem(filename);
      await launcherRepository.deleteInstanceMod(instance.id, filename, contentType);
      await refreshInstalled(contentType);
    } catch (err) {
      console.error("Error al eliminar archivo:", err);
    } finally {
      setDeletingItem(null);
    }
  };

  const executeDirectInstall = async (
    item: ModrinthSearchResult,
    compatible: { version: ModrinthVersion; primaryFile: ModrinthVersionFile }
  ) => {
    try {
      setInstallingId(item.projectId);
      setInstallProgressText(t("mods.installing"));
      await launcherRepository.installModFromUrl(
        instance.id,
        compatible.primaryFile.url,
        compatible.primaryFile.filename,
        contentType
      );

      await refreshInstalled(contentType);
      const folderName =
        contentType === "shader"
          ? "shaderpacks"
          : contentType === "resourcepack"
          ? "resourcepacks"
          : "mods";

      setFeedback({
        text: t("mods.installSuccessInFolder", {
          title: item.title,
          folder: folderName,
        }),
        type: "success",
      });
    } catch (err: unknown) {
      console.error("Error al instalar:", err);
      setFeedback({
        text: t("mods.downloadError", { title: item.title }),
        type: "error",
      });
    } finally {
      setInstallingId(null);
      setInstallProgressText(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleInstall = async (item: ModrinthSearchResult) => {
    try {
      setInstallingId(item.projectId);
      setInstallProgressText(t("mods.installing"));
      setFeedback(null);

      const compatible = await modrinthService.getCompatibleVersion(
        item.projectId,
        instance.minecraftVersion,
        instance.loader,
        contentType
      );

      if (!compatible || !compatible.primaryFile) {
        setFeedback({
          text: t("mods.noCompatibleVersion", {
            title: item.title,
            version: instance.minecraftVersion,
          }),
          type: "error",
        });
        setInstallingId(null);
        setInstallProgressText(null);
        return;
      }

      // Si es un mod, comprobar si tiene dependencias requeridas
      if (contentType === "mod") {
        setInstallProgressText(t("mods.resolvingDependencies"));
        try {
          const dependencies = await modrinthService.resolveDependencies({
            version: compatible.version,
            minecraftVersion: instance.minecraftVersion,
            loader: instance.loader,
            installedFiles: installedItems,
            projectSlug: item.slug || item.projectId,
          });

          const uninstalledDeps = dependencies.filter((d) => !d.alreadyInstalled);
          if (uninstalledDeps.length > 0) {
            // Pre-seleccionar todas las dependencias no instaladas
            setSelectedDepProjectIds(new Set(uninstalledDeps.map((d) => d.projectId)));
            // Mostrar modal de confirmación con la lista de dependencias
            setPendingInstallItem({
              item,
              compatible,
              dependencies,
            });
            setInstallingId(null);
            setInstallProgressText(null);
            return;
          }
        } catch (depErr) {
          console.warn(
            "No se pudieron resolver dependencias, continuando con instalación directa:",
            depErr
          );
        }
      }

      // Proceder con la instalación directa del mod principal
      await executeDirectInstall(item, compatible);
    } catch (err: unknown) {
      console.error("Error al instalar:", err);
      setFeedback({
        text: t("mods.downloadError", { title: item.title }),
        type: "error",
      });
      setInstallingId(null);
      setInstallProgressText(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleConfirmInstallAll = async () => {
    if (!pendingInstallItem) return;
    const { item, compatible, dependencies } = pendingInstallItem;
    const depsToInstall = dependencies.filter(
      (d) => !d.alreadyInstalled && selectedDepProjectIds.has(d.projectId)
    );

    setPendingInstallItem(null);
    setInstallingId(item.projectId);
    setFeedback(null);

    try {
      const totalSteps = depsToInstall.length + 1;
      let currentStep = 1;

      // 1. Instalar cada dependencia seleccionada
      for (const dep of depsToInstall) {
        setInstallProgressText(
          t("mods.installingDependency", {
            name: dep.projectTitle,
            current: currentStep,
            total: totalSteps,
          })
        );
        await launcherRepository.installModFromUrl(
          instance.id,
          dep.downloadUrl,
          dep.filename,
          "mod"
        );
        currentStep++;
      }

      // 2. Instalar el mod principal
      setInstallProgressText(
        t("mods.installingDependency", {
          name: item.title,
          current: totalSteps,
          total: totalSteps,
        })
      );
      await launcherRepository.installModFromUrl(
        instance.id,
        compatible.primaryFile.url,
        compatible.primaryFile.filename,
        "mod"
      );

      await refreshInstalled("mod");

      setFeedback({
        text:
          depsToInstall.length > 0
            ? t("mods.installSuccessWithDeps", {
                title: item.title,
                count: depsToInstall.length,
              })
            : t("mods.installSuccessInFolder", {
                title: item.title,
                folder: "mods",
              }),
        type: "success",
      });
    } catch (err) {
      console.error("Error instalando mod con dependencias:", err);
      setFeedback({
        text: t("mods.downloadError", { title: item.title }),
        type: "error",
      });
    } finally {
      setInstallingId(null);
      setInstallProgressText(null);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleInstallModOnly = async () => {
    if (!pendingInstallItem) return;
    const { item, compatible } = pendingInstallItem;
    setPendingInstallItem(null);
    await executeDirectInstall(item, compatible);
  };

  // Comprobar si un elemento ya está instalado
  const isInstalled = (item: ModrinthSearchResult) => {
    const slug = item.slug.toLowerCase();
    const title = item.title.toLowerCase().replace(/\s+/g, "");
    return installedItems.some((im) => {
      const filename = im.filename.toLowerCase();
      return (
        filename.includes(slug) ||
        filename.includes(title) ||
        (im.name && im.name.toLowerCase().includes(slug))
      );
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredInstalled = installedItems.filter(
    (m) =>
      m.name.toLowerCase().includes(installedFilter.toLowerCase()) ||
      m.filename.toLowerCase().includes(installedFilter.toLowerCase())
  );

  const getPlaceholder = () => {
    switch (contentType) {
      case "shader":
        return t("mods.searchPlaceholderShaders");
      case "resourcepack":
        return t("mods.searchPlaceholderResourcePacks");
      default:
        return t("mods.searchPlaceholder");
    }
  };

  const getEmptyInstalledLabel = () => {
    switch (contentType) {
      case "shader":
        return t("mods.noShaders");
      case "resourcepack":
        return t("mods.noResourcePacks");
      default:
        return t("mods.noMods");
    }
  };

  const getEmptyInstalledDesc = () => {
    switch (contentType) {
      case "shader":
        return t("mods.noShadersDesc");
      case "resourcepack":
        return t("mods.noResourcePacksDesc");
      default:
        return t("mods.noModsDesc");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal mods-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado */}
        <div className="mods-modal-header">
          <div className="mods-modal-title">
            <div className="mods-title-badges">
              <span className="eyebrow">{t("mods.eyebrow")}</span>
              <span className="mods-badge">{instance.name}</span>
              <span className="mods-badge version">MC {instance.minecraftVersion}</span>
              <span className={`mods-badge loader loader-${instance.loader.toLowerCase()}`}>
                {instance.loader}
              </span>
            </div>
            <h2>{t("mods.managerTitle")}</h2>
          </div>

          <div className="mods-header-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={onOpenFolder}
              title={t("mods.openFolder")}
            >
              <FolderOpen size={15} />
              <span>{t("mods.openFolder")}</span>
            </button>
            <button
              type="button"
              className="icon-button close-btn"
              onClick={onClose}
              title={t("mods.close")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Selector de Tipo de Contenido: Mods | Shaders | Resource Packs */}
        <div className="mods-type-selector">
          <button
            type="button"
            className={`type-chip ${contentType === "mod" ? "active" : ""}`}
            onClick={() => handleContentTypeChange("mod")}
          >
            <Package size={14} />
            <span>{t("mods.typeMods")}</span>
          </button>
          <button
            type="button"
            className={`type-chip ${contentType === "shader" ? "active" : ""}`}
            onClick={() => handleContentTypeChange("shader")}
          >
            <SunMedium size={14} />
            <span>{t("mods.typeShaders")}</span>
          </button>
          <button
            type="button"
            className={`type-chip ${contentType === "resourcepack" ? "active" : ""}`}
            onClick={() => handleContentTypeChange("resourcepack")}
          >
            <Palette size={14} />
            <span>{t("mods.typeResourcePacks")}</span>
          </button>
        </div>

        {/* Pestañas de navegación */}
        <div className="mods-tabs">
          <button
            type="button"
            className={`mods-tab ${tab === "installed" ? "active" : ""}`}
            onClick={() => setTab("installed")}
          >
            {contentType === "shader" ? (
              <SunMedium size={15} />
            ) : contentType === "resourcepack" ? (
              <Palette size={15} />
            ) : (
              <Package size={15} />
            )}
            <span>{t("mods.installedTab")}</span>
            <span className="tab-count-pill">{installedItems.length}</span>
          </button>
          <button
            type="button"
            className={`mods-tab ${tab === "explore" ? "active" : ""}`}
            onClick={() => setTab("explore")}
          >
            <Sparkles size={15} />
            <span>
              {contentType === "shader"
                ? t("mods.exploreTabShaders")
                : contentType === "resourcepack"
                ? t("mods.exploreTabResourcePacks")
                : t("mods.exploreTab")}
            </span>
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {feedback && (
          <div className={`mods-feedback ${feedback.type}`}>
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Avisos contextuales compactos (1 línea, ahorro de espacio) */}
        {contentType === "mod" && instance.loader === "Vanilla" && (
          <div className="mods-compact-hint warning">
            <AlertTriangle size={13} className="hint-icon" />
            <span>
              <strong>Loader Vanilla:</strong> {t("mods.vanillaNotice")}
            </span>
          </div>
        )}

        {contentType === "shader" && (
          <div className="mods-compact-hint shader">
            <SunMedium size={13} className="hint-icon" />
            <span>
              <strong>{t("mods.shaderNoticeLabel")}</strong> {t("mods.shaderNoticeDesc")}
            </span>
          </div>
        )}

        {contentType === "resourcepack" && (
          <div className="mods-compact-hint resourcepack">
            <Palette size={13} className="hint-icon" />
            <span>
              <strong>{t("mods.resourcepackNoticeLabel")}</strong> {t("mods.resourcepackNoticeDesc")}
            </span>
          </div>
        )}

        {/* CONTENIDO PESTAÑA: ELEMENTOS INSTALADOS */}
        {tab === "installed" && (
          <div className="mods-tab-content">
            <div className="mods-toolbar">
              <div className="mods-search-input-wrap">
                <Search size={15} />
                <input
                  type="text"
                  placeholder={t("mods.filterInstalledPlaceholder", {
                    type:
                      contentType === "shader"
                        ? t("mods.filterShaders")
                        : contentType === "resourcepack"
                        ? t("mods.filterResourcePacks")
                        : t("mods.filterMods"),
                  })}
                  value={installedFilter}
                  onChange={(e) => setInstalledFilter(e.target.value)}
                />
                {installedFilter && (
                  <button type="button" onClick={() => setInstalledFilter("")}>
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => refreshInstalled(contentType)}
                disabled={loadingInstalled}
                title={t("mods.reloadList")}
              >
                <RefreshCw size={14} className={loadingInstalled ? "animate-spin" : ""} />
              </button>
            </div>

            {loadingInstalled ? (
              <div className="mods-loading-state">
                <Loader2 size={28} className="animate-spin" />
                <p>{t("mods.readingFolder")}</p>
              </div>
            ) : filteredInstalled.length === 0 ? (
              <div className="mods-empty-state">
                {contentType === "shader" ? (
                  <SunMedium size={42} strokeWidth={1.5} style={{ color: "#f59e0b" }} />
                ) : contentType === "resourcepack" ? (
                  <Palette size={42} strokeWidth={1.5} style={{ color: "#c084fc" }} />
                ) : (
                  <Package size={42} strokeWidth={1.5} />
                )}
                <h3>{installedFilter ? t("mods.noFilterResults") : getEmptyInstalledLabel()}</h3>
                <p>{installedFilter ? t("mods.noFilterResultsDesc") : getEmptyInstalledDesc()}</p>
                {!installedFilter && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => setTab("explore")}
                  >
                    <Sparkles size={16} />
                    <span>{t("mods.exploreModrinthBtn")}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="mods-list">
                {filteredInstalled.map((item) => (
                  <div
                    key={item.filename}
                    className={`mod-row ${item.enabled ? "enabled" : "disabled"}`}
                  >
                    <div className="mod-row-icon">
                      {contentType === "shader" ? (
                        <SunMedium size={18} style={{ color: "#f59e0b" }} />
                      ) : contentType === "resourcepack" ? (
                        <Palette size={18} style={{ color: "#c084fc" }} />
                      ) : (
                        <Package size={18} />
                      )}
                    </div>
                    <div className="mod-row-details">
                      <div className="mod-row-header">
                        <h4>{item.name}</h4>
                        <span className={`mod-status-tag ${item.enabled ? "active" : "inactive"}`}>
                          {item.enabled ? t("mods.enabled") : t("mods.disabled")}
                        </span>
                      </div>
                      <div className="mod-row-meta">
                        <span className="mod-filename">{item.filename}</span>
                        <span className="mod-size">• {formatFileSize(item.sizeBytes)}</span>
                      </div>
                    </div>

                    <div className="mod-row-actions">
                      <button
                        type="button"
                        className={`mod-action-toggle ${item.enabled ? "is-enabled" : ""}`}
                        onClick={() => handleToggle(item)}
                        disabled={togglingItem === item.filename}
                        title={item.enabled ? t("mods.actionDisable") : t("mods.actionEnable")}
                      >
                        <Power size={14} />
                        <span>{item.enabled ? t("mods.actionDisable") : t("mods.actionEnable")}</span>
                      </button>

                      <button
                        type="button"
                        className="mod-action-delete"
                        onClick={() => handleDelete(item.filename)}
                        disabled={deletingItem === item.filename}
                        title={t("mods.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO PESTAÑA: EXPLORAR MODRINTH */}
        {tab === "explore" && (
          <div className="mods-tab-content">
            <form className="mods-toolbar" onSubmit={handleSearchSubmit}>
              <div className="mods-search-input-wrap">
                <Search size={15} />
                <input
                  type="text"
                  placeholder={getPlaceholder()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")}>
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="mods-sort-wrap">
                <span>{t("mods.sortBy")}</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const val = e.target.value as "downloads" | "relevance" | "newest";
                    setSortBy(val);
                    performSearch(searchQuery, contentType);
                  }}
                >
                  <option value="downloads">{t("mods.sortDownloads")}</option>
                  <option value="relevance">{t("mods.sortRelevance")}</option>
                  <option value="newest">{t("mods.sortNewest")}</option>
                </select>
              </div>

              <button
                type="submit"
                className="primary-btn search-submit-btn"
                disabled={loadingSearch}
              >
                {loadingSearch ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                <span>{t("mods.searchBtn")}</span>
              </button>
            </form>

            <div className="mods-explore-context">
              <span className="context-pill">
                {t("mods.catalogLabel")}{" "}
                <strong>
                  {contentType === "shader"
                    ? t("mods.typeShaders")
                    : contentType === "resourcepack"
                    ? t("mods.typeResourcePacks")
                    : t("mods.typeMods")}
                </strong>{" "}
                {t("mods.catalogFor")} <strong>Minecraft {instance.minecraftVersion}</strong>
                {contentType === "mod" && (
                  <>
                    {" "}
                    • {t("mods.catalogLoader")} <strong>{instance.loader}</strong>
                  </>
                )}
              </span>
            </div>

            {loadingSearch ? (
              <div className="mods-loading-state">
                <Loader2 size={32} className="animate-spin" />
                <p>{t("mods.readingModrinth")}</p>
              </div>
            ) : searchError ? (
              <div className="mods-empty-state error">
                <AlertTriangle size={36} />
                <h3>{searchError}</h3>
                <p>{t("mods.errorCheckConnection")}</p>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => performSearch(searchQuery, contentType)}
                >
                  <RefreshCw size={14} /> {t("mods.retry")}
                </button>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="mods-empty-state">
                <Search size={38} strokeWidth={1.5} />
                <h3>{t("mods.noResults")}</h3>
                <p>{t("mods.noResultsDesc")}</p>
              </div>
            ) : (
              <div className="modrinth-grid">
                {searchResults.map((item) => {
                  const alreadyInstalled = isInstalled(item);
                  const isInstalling = installingId === item.projectId;

                  return (
                    <article className="modrinth-card" key={item.projectId}>
                      <div className="modrinth-card-main">
                        <div className="modrinth-icon-box">
                          {item.iconUrl ? (
                            <img
                              src={item.iconUrl}
                              alt={item.title}
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : contentType === "shader" ? (
                            <SunMedium size={24} style={{ color: "#f59e0b" }} />
                          ) : contentType === "resourcepack" ? (
                            <Palette size={24} style={{ color: "#c084fc" }} />
                          ) : (
                            <Package size={24} />
                          )}
                        </div>

                        <div className="modrinth-info">
                          <div className="modrinth-heading">
                            <h4>{item.title}</h4>
                            <span className="modrinth-author">
                              {t("mods.byAuthor", { author: item.author })}
                            </span>
                          </div>
                          <p className="modrinth-desc">{item.description}</p>
                        </div>
                      </div>

                      <div className="modrinth-card-footer">
                        <div className="modrinth-tags">
                          <span className="modrinth-stat">
                            <Download size={12} />
                            {item.downloads.toLocaleString()} {t("mods.downloads")}
                          </span>
                          {item.categories.slice(0, 3).map((cat) => (
                            <span className="modrinth-cat-tag" key={cat}>
                              {cat}
                            </span>
                          ))}
                        </div>

                        <div className="modrinth-card-actions">
                          <button
                            type="button"
                            className="modrinth-versions-btn"
                            title={t("mods.viewVersions")}
                            onClick={() => handleOpenVersionsModal(item)}
                          >
                            <History size={12} />
                            <span>{t("mods.versions")}</span>
                          </button>

                          <button
                            type="button"
                            className={`modrinth-install-btn ${
                              alreadyInstalled ? "installed" : ""
                            }`}
                            onClick={() => handleInstall(item)}
                            disabled={alreadyInstalled || isInstalling}
                          >
                            {isInstalling ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>{installProgressText || t("mods.installing")}</span>
                              </>
                            ) : alreadyInstalled ? (
                              <>
                                <Check size={13} />
                                <span>{t("mods.installed")}</span>
                              </>
                            ) : (
                              <>
                                <Download size={13} />
                                <span>{t("mods.install")}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal de confirmación y visualización de dependencias */}
        {pendingInstallItem && (
          <div
            className="dependencies-modal-backdrop"
            onClick={() => setPendingInstallItem(null)}
          >
            <div
              className="dependencies-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dependencies-modal-header">
                <div className="dep-header-icon">
                  <Layers size={22} />
                </div>
                <div className="dep-header-text">
                  <span className="eyebrow">MODRINTH DEPENDENCIES</span>
                  <h3>{t("mods.dependenciesTitle")}</h3>
                </div>
                <button
                  type="button"
                  className="ghost-button icon-only dep-close-btn"
                  onClick={() => setPendingInstallItem(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <p className="dependencies-modal-subtitle">
                {t("mods.dependenciesSubtitle", {
                  title: pendingInstallItem.item.title,
                })}
              </p>

              <div className="dep-toolbar-row">
                <span className="dep-toolbar-label">
                  {t("mods.dependenciesCountBadge", {
                    count: pendingInstallItem.dependencies.length,
                  })}
                </span>
                <div className="dep-toolbar-actions">
                  <button
                    type="button"
                    className="dep-toolbar-btn"
                    onClick={() =>
                      selectAllDependencies(pendingInstallItem.dependencies)
                    }
                  >
                    {t("mods.dependenciesSelectAll")}
                  </button>
                  <button
                    type="button"
                    className="dep-toolbar-btn"
                    onClick={() =>
                      selectOnlyRequiredDependencies(
                        pendingInstallItem.dependencies
                      )
                    }
                  >
                    {t("mods.dependenciesOnlyRequired")}
                  </button>
                </div>
              </div>

              <div className="dependencies-list-container">
                <div className="dep-list">
                  {pendingInstallItem.dependencies.map((dep) => {
                    const isSelected =
                      dep.alreadyInstalled ||
                      selectedDepProjectIds.has(dep.projectId);
                    return (
                      <div
                        key={dep.projectId}
                        className={`dep-card ${
                          dep.alreadyInstalled
                            ? "installed"
                            : isSelected
                            ? "selected"
                            : "unselected"
                        }`}
                        onClick={() => {
                          if (!dep.alreadyInstalled) {
                            toggleDependency(dep.projectId);
                          }
                        }}
                      >
                        <div className="dep-card-select">
                          <input
                            type="checkbox"
                            className="dep-checkbox"
                            checked={isSelected}
                            disabled={dep.alreadyInstalled}
                            onChange={() => {
                              if (!dep.alreadyInstalled) {
                                toggleDependency(dep.projectId);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="dep-card-icon">
                          {dep.iconUrl ? (
                            <img
                              src={dep.iconUrl}
                              alt={dep.projectTitle}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <Package size={15} />
                          )}
                        </div>
                        <div className="dep-card-info">
                          <div className="dep-card-title-row">
                            <span className="dep-card-title">
                              {dep.projectTitle || dep.slug || dep.filename}
                            </span>
                            <div
                              className="dep-version-picker-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="dep-version-selector-btn"
                                onClick={() => {
                                  if (depVersionPicker?.dep.projectId === dep.projectId) {
                                    setDepVersionPicker(null);
                                  } else {
                                    handleOpenDepVersionPicker(dep);
                                  }
                                }}
                                title={t("mods.changeDepVersion")}
                              >
                                <span>v{dep.versionNumber}</span>
                                <ChevronDown
                                  size={11}
                                  className={
                                    depVersionPicker?.dep.projectId === dep.projectId
                                      ? "rotate-180"
                                      : ""
                                  }
                                />
                              </button>

                              {depVersionPicker?.dep.projectId === dep.projectId && (
                                <div className="dep-version-dropdown">
                                  <div className="dep-version-dropdown-header">
                                    <span>{t("mods.changeDepVersion")}</span>
                                    <button
                                      type="button"
                                      className="ghost-button icon-only close-dropdown-btn"
                                      onClick={() => setDepVersionPicker(null)}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                  {depVersionPicker.loading ? (
                                    <div className="dep-version-dropdown-loading">
                                      <Loader2 size={14} className="animate-spin" />
                                      <span>{t("mods.loadingVersions")}</span>
                                    </div>
                                  ) : depVersionPicker.versions.length === 0 ? (
                                    <div className="dep-version-dropdown-empty">
                                      {t("mods.noCompatibleVersionsFound")}
                                    </div>
                                  ) : (
                                    <div className="dep-version-dropdown-list">
                                      {depVersionPicker.versions.map((vObj) => {
                                        const isCurrent = vObj.version.id === dep.versionId;
                                        const isInst = installedItems.some(
                                          (inst) =>
                                            inst.filename.toLowerCase() ===
                                            vObj.primaryFile.filename.toLowerCase()
                                        );
                                        return (
                                          <button
                                            key={vObj.version.id}
                                            type="button"
                                            className={`dep-version-dropdown-item ${
                                              isCurrent ? "current" : ""
                                            }`}
                                            onClick={() =>
                                              handleSelectDepVersion(dep, vObj)
                                            }
                                          >
                                            <div className="dep-version-item-info">
                                              <span className="dep-v-num">
                                                v{vObj.version.versionNumber}
                                              </span>
                                              <span className="dep-v-name">
                                                {vObj.primaryFile.filename}
                                              </span>
                                            </div>
                                            <div className="dep-v-meta">
                                              {vObj.versionType && (
                                                <span
                                                  className={`dep-v-type ${vObj.versionType}`}
                                                >
                                                  {vObj.versionType}
                                                </span>
                                              )}
                                              {isInst && (
                                                <span className="dep-v-installed-tag">
                                                  {t("mods.statusInstalled")}
                                                </span>
                                              )}
                                              {isCurrent && (
                                                <Check
                                                  size={12}
                                                  className="dep-v-check"
                                                />
                                              )}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className={`dep-type-badge ${dep.dependencyType}`}>
                              {dep.dependencyType === "required"
                                ? t("mods.dependenciesRequired")
                                : t("mods.dependenciesOptional")}
                            </span>
                          </div>
                          <span className="dep-card-filename">{dep.filename}</span>
                        </div>
                        <div className="dep-card-badge-wrap">
                          {dep.alreadyInstalled ? (
                            <span className="dep-status-badge installed" title={t("mods.statusInstalled")}>
                              <Check size={9.5} />
                              <span>{t("mods.statusInstalled")}</span>
                            </span>
                          ) : isSelected ? (
                            <span className="dep-status-badge will-download" title={t("mods.statusWillDownload")}>
                              <Download size={9.5} />
                              <span>{t("mods.statusWillDownload")}</span>
                            </span>
                          ) : (
                            <span className="dep-status-badge skipped" title={t("mods.statusSkipped")}>
                              <span>{t("mods.statusSkipped")}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="dependencies-modal-actions">
                <button
                  type="button"
                  className="dep-cancel-btn"
                  onClick={() => setPendingInstallItem(null)}
                >
                  {t("mods.cancel")}
                </button>
                <div className="dep-actions-right">
                  <button
                    type="button"
                    className="dep-secondary-btn"
                    onClick={handleInstallModOnly}
                  >
                    {t("mods.installModOnly", {
                      title: pendingInstallItem.item.title,
                    })}
                  </button>
                  <button
                    type="button"
                    className="primary-button dep-confirm-btn"
                    onClick={handleConfirmInstallAll}
                  >
                    <Download size={14} />
                    <span>
                      {t("mods.installSelectedWithDeps", {
                        count:
                          pendingInstallItem.dependencies.filter(
                            (d) =>
                              !d.alreadyInstalled &&
                              selectedDepProjectIds.has(d.projectId)
                          ).length + 1,
                      })}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de selección de versiones de un mod del catálogo */}
        {versionsModalItem && (
          <div
            className="dependencies-modal-backdrop"
            onClick={() => setVersionsModalItem(null)}
          >
            <div
              className="dependencies-modal versions-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dependencies-modal-header">
                <div className="dep-header-icon">
                  <History size={22} />
                </div>
                <div className="dep-header-text">
                  <span className="eyebrow">{t("mods.versions")}</span>
                  <h3>
                    {t("mods.versionsTitle", {
                      title: versionsModalItem.title,
                    })}
                  </h3>
                </div>
                <button
                  type="button"
                  className="ghost-button icon-only dep-close-btn"
                  onClick={() => setVersionsModalItem(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <p className="dependencies-modal-subtitle">
                {t("mods.versionsSubtitle", {
                  version: instance.minecraftVersion,
                  loader: instance.loader,
                })}
              </p>

              <div className="dependencies-list-container versions-list-container">
                {loadingVersions ? (
                  <div className="mods-loading-state">
                    <Loader2 size={28} className="animate-spin" />
                    <p>{t("mods.loadingVersions")}</p>
                  </div>
                ) : availableVersions.length === 0 ? (
                  <div className="mods-empty-state">
                    <AlertTriangle size={32} />
                    <p>{t("mods.noCompatibleVersionsFound")}</p>
                  </div>
                ) : (
                  <div className="versions-list">
                    {availableVersions.map((vObj) => {
                      const isInst = installedItems.some(
                        (inst) =>
                          inst.filename.toLowerCase() ===
                          vObj.primaryFile.filename.toLowerCase()
                      );
                      const isInstalling =
                        installingId === versionsModalItem.projectId;

                      return (
                        <div
                          key={vObj.version.id}
                          className={`version-item-card ${
                            isInst ? "installed" : ""
                          }`}
                        >
                          <div className="version-item-details">
                            <div className="version-item-title-row">
                              <span className="version-item-number">
                                v{vObj.version.versionNumber}
                              </span>
                              {vObj.version.name &&
                                vObj.version.name !==
                                  vObj.version.versionNumber && (
                                  <span className="version-item-name">
                                    {vObj.version.name}
                                  </span>
                                )}
                              {vObj.versionType && (
                                <span
                                  className={`version-tag-type ${vObj.versionType}`}
                                >
                                  {vObj.versionType === "release"
                                    ? t("mods.releaseTypeRelease")
                                    : vObj.versionType === "beta"
                                    ? t("mods.releaseTypeBeta")
                                    : t("mods.releaseTypeAlpha")}
                                </span>
                              )}
                            </div>
                            <div className="version-item-meta">
                              <span className="version-filename">
                                {vObj.primaryFile.filename}
                              </span>
                              <span className="version-size">
                                • {formatFileSize(vObj.primaryFile.size)}
                              </span>
                              {vObj.datePublished && (
                                <span className="version-date">
                                  •{" "}
                                  {new Date(
                                    vObj.datePublished
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="version-item-action">
                            {isInst ? (
                              <span className="dep-status-badge installed">
                                <Check size={11} />
                                <span>{t("mods.installed")}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="primary-button version-install-btn"
                                onClick={() =>
                                  handleInstallSpecificVersion(
                                    versionsModalItem,
                                    vObj
                                  )
                                }
                                disabled={isInstalling}
                              >
                                {isInstalling ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Download size={13} />
                                )}
                                <span>{t("mods.installThisVersion")}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="dependencies-modal-actions">
                <button
                  type="button"
                  className="dep-cancel-btn"
                  onClick={() => setVersionsModalItem(null)}
                >
                  {t("mods.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
