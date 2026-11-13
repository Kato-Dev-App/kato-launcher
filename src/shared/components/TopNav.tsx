import { AlertTriangle, CircleHelp, LayoutGrid, LogOut, Plus, Settings2 } from "lucide-react";
import type { OfflineProfile } from "../../domain/models";
import { LAUNCHER_CONFIG } from "../../config/launcherConfig";
import { getAvatarImage } from "../../features/profiles/utils";

export type NavTab = "instances" | "settings";

export interface TopNavProps {
  currentTab: NavTab;
  instancesCount: number;
  maxInstances: number;
  activeProfile?: OfflineProfile | null;
  displayVersion: string;
  isInstanceLimitReached: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onTabChange: (tab: NavTab) => void;
  onOpenCreateInstance: () => void;
  onExitProfile: () => void;
  onOpenWebsite: () => void;
  onAboutClick: () => void;
}

export function TopNav({
  currentTab,
  instancesCount,
  maxInstances,
  activeProfile,
  displayVersion,
  isInstanceLimitReached,
  t,
  onTabChange,
  onOpenCreateInstance,
  onExitProfile,
  onOpenWebsite,
  onAboutClick,
}: TopNavProps) {
  return (
    <header className="top-nav">
      {/* Brand / Logo */}
      <div
        className="top-nav-brand clickable"
        onClick={onOpenWebsite}
        title={`Visitar ${LAUNCHER_CONFIG.website}`}
      >
        <img src="/logo.png" className="top-nav-logo" alt="Logo" />
        <div className="top-nav-brand-text">
          <span className="top-nav-brand-title">
            {LAUNCHER_CONFIG.titlePrefix}
            <span className="top-nav-brand-suffix">{LAUNCHER_CONFIG.titleSuffix}</span>
          </span>
          <span className="top-nav-version-badge">{displayVersion}</span>
        </div>
      </div>

      {/* Navegación central (Tabs) */}
      <nav className="top-nav-tabs" aria-label="Navegación principal">
        <button
          type="button"
          className={`top-nav-tab ${currentTab === "instances" ? "active" : ""}`}
          onClick={() => onTabChange("instances")}
        >
          <LayoutGrid size={16} />
          <span>{t("nav.instances")}</span>
          <span className="top-nav-tab-badge">
            {instancesCount}/{maxInstances}
          </span>
        </button>

        <button
          type="button"
          className={`top-nav-tab ${currentTab === "settings" ? "active" : ""}`}
          onClick={() => onTabChange("settings")}
        >
          <Settings2 size={16} />
          <span>{t("nav.settings")}</span>
        </button>
      </nav>

      {/* Acciones y Perfil a la derecha */}
      <div className="top-nav-actions">
        {/* Botón Nueva Instancia */}
        <button
          type="button"
          className="top-nav-create-btn"
          onClick={onOpenCreateInstance}
          disabled={isInstanceLimitReached}
          title={
            isInstanceLimitReached
              ? `${t("instances.limitReached")} (${maxInstances})`
              : t("instances.newInstance")
          }
        >
          <Plus size={16} />
          <span>{t("instances.newInstance")}</span>
        </button>

        {/* Perfil del usuario activo */}
        <div className="top-nav-profile-pill" title={activeProfile?.name ?? t("nav.noProfile")}>
          <div className={`avatar avatar-sm avatar-${activeProfile?.avatar ?? "creeper"}`}>
            <img
              src={getAvatarImage(activeProfile?.avatar)}
              alt=""
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
            <span className="avatar-fallback">
              {activeProfile ? activeProfile.name.charAt(0).toUpperCase() : "?"}
            </span>
          </div>

          <div className="top-nav-profile-info">
            <span className="top-nav-profile-name">
              {activeProfile ? activeProfile.name : t("nav.noProfile")}
            </span>
          </div>

          <button
            type="button"
            className="top-nav-logout-btn"
            onClick={onExitProfile}
            title={t("profiles.switchProfile")}
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Botón de ayuda/acerca de */}
        <button
          type="button"
          className="top-nav-icon-btn"
          title={t("settings.aboutTitle")}
          onClick={onAboutClick}
        >
          <CircleHelp size={17} />
        </button>
      </div>
    </header>
  );
}

