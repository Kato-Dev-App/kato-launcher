import { useEffect, useState } from "react";
import { Check, Coffee, ExternalLink, Globe, HardDrive, RefreshCw, Settings2 } from "lucide-react";
import type { GameInstance, GameVersion, OfflineProfile } from "../../../domain/models";
import { LAUNCHER_CONFIG } from "../../../config/launcherConfig";
import { AVAILABLE_LANGUAGES, type Language } from "../../../i18n";
import { launcherRepository } from "../../../services/launcherRepository";

interface SettingsViewProps {
  currentLang: Language;
  instances: GameInstance[];
  profiles: OfflineProfile[];
  versions: GameVersion[];
  versionsUpdatedAt: string | null;
  displayVersion: string;
  busy: boolean;
  maxInstances: number;
  maxProfiles: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onChangeLanguage: (lang: Language) => void;
  onUpdateVersions: () => void;
}

export function SettingsView({
  currentLang,
  instances,
  profiles,
  versions,
  versionsUpdatedAt,
  displayVersion,
  busy,
  maxInstances,
  maxProfiles,
  t,
  onChangeLanguage,
  onUpdateVersions,
}: SettingsViewProps) {
  const releaseCount = versions.filter((v) => v.type === "release").length;

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <Settings2 size={14} /> {t("settings.eyebrow")}
          </div>
          <h1>{t("settings.title")}</h1>
          <p className="subtitle">{t("settings.subtitle")}</p>
        </div>
      </section>

      <section className="settings-section">
        {/* Selector de Idiomas */}
        <div className="settings-box">
          <h3>
            <Globe size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
            {t("settings.languageTitle")}
          </h3>
          <p>{t("settings.languageDesc")}</p>
          <div className="language-selector-group">
            {AVAILABLE_LANGUAGES.map((lang) => {
              const isSelected = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  className={`language-chip ${isSelected ? "selected" : ""}`}
                  onClick={() => onChangeLanguage(lang.code)}
                >
                  <span className="lang-badge">{lang.short}</span>
                  <span className="lang-name">{lang.label}</span>
                  {isSelected && <Check size={15} className="lang-check" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Acerca del Launcher */}
        <div className="settings-box">
          <h3>{t("settings.aboutTitle")}</h3>
          <p>{t("settings.aboutDesc")}</p>
          <div className="settings-row">
            <div>
              <div className="settings-row-title">{t("settings.version")}</div>
              <div className="settings-row-desc">
                {LAUNCHER_CONFIG.name} {displayVersion}
              </div>
            </div>
            <span className="settings-badge">{displayVersion}</span>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-title">{t("settings.instanceLimit")}</div>
              <div className="settings-row-desc">{t("settings.instanceLimitDesc")}</div>
            </div>
            <span className="settings-badge">
              {instances.length} / {maxInstances}
            </span>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-title">{t("settings.profileLimit")}</div>
              <div className="settings-row-desc">{t("settings.profileLimitDesc")}</div>
            </div>
            <span className="settings-badge">
              {profiles.length} / {maxProfiles}
            </span>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-title">{t("settings.backend")}</div>
              <div className="settings-row-desc">
                Tauri v{LAUNCHER_CONFIG.tauriVersion} + Rust Core
              </div>
            </div>
            <span className="settings-badge">Tauri {LAUNCHER_CONFIG.tauriVersion}</span>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-title">{t("settings.localStorage")}</div>
              <div className="settings-row-desc">{t("settings.localStorageDesc")}</div>
            </div>
            <span className="settings-badge">
              <HardDrive size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
              {t("settings.local")}
            </span>
          </div>
          {LAUNCHER_CONFIG.website && (
            <div className="settings-row">
              <div>
                <div className="settings-row-title">{t("settings.website")}</div>
                <div className="settings-row-desc">{LAUNCHER_CONFIG.website}</div>
              </div>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => launcherRepository.openUrl(LAUNCHER_CONFIG.website)}
                title={LAUNCHER_CONFIG.website}
              >
                <ExternalLink size={12} /> Visitar
              </button>
            </div>
          )}
          <div className="settings-row">
            <div>
              <div className="settings-row-title">{t("settings.disclaimerTitle")}</div>
              <div className="settings-row-desc">{t("footer.mojangDisclaimer")}</div>
            </div>
          </div>
        </div>

        {/* Catálogo de versiones Mojang */}
        <div className="settings-box">
          <h3>{t("settings.catalogTitle")}</h3>
          <p>{t("settings.catalogDesc")}</p>
          <div className="settings-row">
            <div>
              <div className="settings-row-title">{t("settings.cachedVersions")}</div>
              <div className="settings-row-desc">
                {versions.length} {t("settings.cachedVersions").toLowerCase()} ({releaseCount}{" "}
                {t("settings.official")})
                {versionsUpdatedAt &&
                  ` · ${t("settings.synchronized")} ${new Date(
                    versionsUpdatedAt
                  ).toLocaleTimeString()}`}
              </div>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={onUpdateVersions}
              disabled={busy}
            >
              <RefreshCw size={14} className={busy ? "spin" : ""} />
              {busy ? t("settings.synchronizing") : t("settings.refreshCatalog")}
            </button>
          </div>
        </div>

        {/* Entornos Java y Runtimes Portables */}
        <JavaSettingsBox />
      </section>
    </>
  );
}

// Cache en memoria a nivel de módulo para que abrir Ajustes sea instantáneo (0ms)
let cachedSystemJavas: import("../../../domain/models").JavaEnvironment[] | null = null;
let isFetchingJavas = false;

function JavaSettingsBox() {
  const [javas, setJavas] = useState<import("../../../domain/models").JavaEnvironment[]>(
    () => cachedSystemJavas || []
  );
  const [loading, setLoading] = useState(() => !cachedSystemJavas);

  const loadJavas = (force = false) => {
    if (isFetchingJavas && !force) return;
    isFetchingJavas = true;
    if (force || !cachedSystemJavas) {
      setLoading(true);
    }
    launcherRepository
      .getSystemJavas(force)
      .then((data) => {
        cachedSystemJavas = data;
        setJavas(data);
      })
      .catch(console.error)
      .finally(() => {
        isFetchingJavas = false;
        setLoading(false);
      });
  };

  useEffect(() => {
    loadJavas(false);
  }, []);

  return (
    <div className="settings-box">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>
          <Coffee size={16} style={{ verticalAlign: "middle", marginRight: 8, color: "#f59e0b" }} />
          Entornos Java y Runtimes Portables
        </h3>
        <button
          type="button"
          className="secondary-button compact"
          onClick={() => loadJavas(true)}
          disabled={loading}
        >
          <RefreshCw size={12} className={loading ? "spin" : ""} /> Refrescar
        </button>
      </div>
      <p>
        Runtimes de Java detectados en tu equipo y carpetas portables aisladas de Kato Launcher.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {javas.length === 0 ? (
          <div style={{ fontSize: 12, color: "#baa9d4", padding: "10px 0" }}>
            {loading ? "Buscando entornos Java..." : "No se detectó ningún runtime de Java en el sistema."}
          </div>
        ) : (
          javas.map((j) => {
            const isPortable = j.name.toLowerCase().includes("portable");
            return (
              <div key={j.path} className="settings-row" style={{ alignItems: "center" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="settings-row-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{j.name}</span>
                    {isPortable && (
                      <span style={{ fontSize: 10, background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.4)", borderRadius: 4, padding: "1px 6px" }}>
                        Portable
                      </span>
                    )}
                    {j.isRecommended && (
                      <span style={{ fontSize: 10, background: "rgba(46, 204, 113, 0.2)", color: "#2ecc71", border: "1px solid rgba(46, 204, 113, 0.4)", borderRadius: 4, padding: "1px 6px" }}>
                        Recomendado
                      </span>
                    )}
                  </div>
                  <div className="settings-row-desc" style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                    Java {j.majorVersion} ({j.versionString})
                  </div>
                </div>
                <span className="settings-badge">
                  Java {j.majorVersion}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
