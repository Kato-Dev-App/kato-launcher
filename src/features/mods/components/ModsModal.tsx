import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FolderOpen,
  Info,
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
import type { GameInstance, InstalledModInfo, ModrinthSearchResult } from "../../../domain/models";
import { launcherRepository } from "../../../services/launcherRepository";
import { modrinthService, type ModrinthProjectType } from "../services/modrinthService";
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
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

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

  const handleInstall = async (item: ModrinthSearchResult) => {
    try {
      setInstallingId(item.projectId);
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
        return;
      }

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
      setTimeout(() => setFeedback(null), 5000);
    }
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
                              <span>{t("mods.installing")}</span>
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
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
