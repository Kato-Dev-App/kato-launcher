import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Box,
  FlaskConical,
  Layers,
  Calendar,
} from "lucide-react";
import type { GameVersion, Loader } from "../../../domain/models";
import { checkLoaderCompatibility } from "../../../domain/loaders";

interface VersionSelectorProps {
  versions: GameVersion[];
  selectedVersion: string;
  selectedLoader: Loader;
  onSelectVersion: (versionId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type VersionFilterTab = "release" | "snapshot" | "all";

export function VersionSelector({
  versions,
  selectedVersion,
  selectedLoader,
  onSelectVersion,
  t,
}: VersionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<VersionFilterTab>("release");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Enfocar input de búsqueda al abrir
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Información de la versión seleccionada actualmente
  const selectedVersionObj = useMemo(() => {
    return versions.find((v) => v.id === selectedVersion);
  }, [versions, selectedVersion]);

  const selectedCompatibility = useMemo(() => {
    return checkLoaderCompatibility(
      selectedVersion,
      selectedVersionObj?.type
    );
  }, [selectedVersion, selectedVersionObj]);

  const formatReleaseDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  };

  // Filtrado de versiones
  const filteredVersions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let list = versions;
    if (activeTab === "release") {
      list = list.filter((v) => v.type === "release");
    } else if (activeTab === "snapshot") {
      list = list.filter((v) => v.type === "snapshot");
    }

    if (query) {
      list = list.filter((v) => v.id.toLowerCase().includes(query));
    }

    return list;
  }, [versions, searchQuery, activeTab]);

  const isCurrentSnapshot =
    selectedVersionObj?.type === "snapshot" ||
    /^\d{2}w\d{2}[a-z]$/i.test(selectedVersion) ||
    selectedVersion.includes("-pre") ||
    selectedVersion.includes("-rc");

  return (
    <div className="version-selector-container" ref={containerRef}>
      {/* Tarjeta de visualización de la versión seleccionada */}
      <div
        className={`version-selected-card ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
      >
        <div className="version-selected-main">
          <div className="version-icon-box">
            <Layers size={18} />
          </div>
          <div className="version-selected-info">
            <div className="version-selected-header">
              <span className="version-selected-id">{selectedVersion || "1.21.4"}</span>
              <span
                className={`version-type-badge ${
                  isCurrentSnapshot ? "snapshot" : "release"
                }`}
              >
                {isCurrentSnapshot
                  ? t("instanceModal.snapshotType")
                  : t("instanceModal.releaseType")}
              </span>
              {selectedVersionObj?.releaseTime && (
                <span className="version-date-pill">
                  <Calendar size={11} />
                  {formatReleaseDate(selectedVersionObj.releaseTime)}
                </span>
              )}
            </div>

            {/* Compatibilidad resumida de modloaders */}
            <div className="version-loader-badges">
              <span
                className={`mini-loader-tag ${
                  selectedCompatibility.Vanilla.supported ? "supported" : ""
                }`}
              >
                Vanilla
              </span>
              <span
                className={`mini-loader-tag ${
                  selectedCompatibility.Fabric.supported ? "supported" : "unsupported"
                }`}
              >
                Fabric
              </span>
              <span
                className={`mini-loader-tag ${
                  selectedCompatibility.NeoForge.supported ? "supported" : "unsupported"
                }`}
              >
                NeoForge
              </span>
              <span
                className={`mini-loader-tag ${
                  selectedCompatibility.Forge.supported ? "supported" : "unsupported"
                }`}
              >
                Forge
              </span>
            </div>
          </div>
        </div>

        <div className="version-toggle-btn">
          <span className="version-toggle-text">
            {t("instanceModal.changeVersion")}
          </span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Menú desplegable / Buscador de versiones */}
      {isOpen && (
        <div className="version-dropdown-panel animate-slide-down">
          {/* Barra de búsqueda */}
          <div className="version-search-bar">
            <Search size={15} className="version-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="version-search-input"
              placeholder={t("instanceModal.searchVersionPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="version-search-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                <X size={14} />
              </button>
            )}
            <span className="version-count-pill">
              {filteredVersions.length}
            </span>
          </div>

          {/* Pestañas de filtrado */}
          <div className="version-filter-tabs">
            <button
              type="button"
              className={`version-tab-btn ${activeTab === "release" ? "active" : ""}`}
              onClick={() => setActiveTab("release")}
            >
              <Box size={13} />
              {t("instanceModal.filterReleases")}
            </button>
            <button
              type="button"
              className={`version-tab-btn ${activeTab === "snapshot" ? "active" : ""}`}
              onClick={() => setActiveTab("snapshot")}
            >
              <FlaskConical size={13} />
              {t("instanceModal.filterSnapshots")}
            </button>
            <button
              type="button"
              className={`version-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              {t("instanceModal.filterAll")}
            </button>
          </div>

          {/* Lista de versiones */}
          <div className="version-list-scroll">
            {filteredVersions.length === 0 ? (
              <div className="version-empty-state">
                <span>{t("instanceModal.noVersionsFound")}</span>
              </div>
            ) : (
              filteredVersions.slice(0, 150).map((v) => {
                const isSelected = selectedVersion === v.id;
                const isSnapshot = v.type === "snapshot";
                const compat = checkLoaderCompatibility(v.id, v.type);

                return (
                  <div
                    key={v.id}
                    className={`version-list-item ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      onSelectVersion(v.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="version-item-main">
                      <strong className="version-item-id">{v.id}</strong>
                      <span
                        className={`version-item-badge ${
                          isSnapshot ? "snapshot" : "release"
                        }`}
                      >
                        {isSnapshot ? "Snapshot" : "Release"}
                      </span>
                      {v.releaseTime && (
                        <span className="version-item-date">
                          {formatReleaseDate(v.releaseTime)}
                        </span>
                      )}
                    </div>

                    <div className="version-item-right">
                      {/* Indicadores de loaders para esta versión */}
                      <div className="version-item-loaders">
                        {compat.Fabric.supported && (
                          <span className="loader-micro-badge fabric" title="Fabric soportado">
                            Fabric
                          </span>
                        )}
                        {compat.NeoForge.supported && (
                          <span className="loader-micro-badge neoforge" title="NeoForge soportado">
                            NeoForge
                          </span>
                        )}
                        {compat.Forge.supported && (
                          <span className="loader-micro-badge forge" title="Forge soportado">
                            Forge
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="version-item-check">
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
