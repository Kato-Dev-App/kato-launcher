import { LayoutGrid, LogOut, Settings2 } from "lucide-react";
import type { OfflineProfile } from "../../domain/models";
import { LAUNCHER_CONFIG } from "../../config/launcherConfig";
import { getAvatarImage } from "../../features/profiles/utils";

export type NavTab = "instances" | "settings";

interface SidebarNavProps {
  currentTab: NavTab;
  instancesCount: number;
  maxInstances: number;
  activeProfile?: OfflineProfile | null;
  displayVersion: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onTabChange: (tab: NavTab) => void;
  onExitProfile: () => void;
  onOpenWebsite: () => void;
}

export function SidebarNav({
  currentTab,
  instancesCount,
  maxInstances,
  activeProfile,
  displayVersion,
  t,
  onTabChange,
  onExitProfile,
  onOpenWebsite,
}: SidebarNavProps) {
  return (
    <aside className="sidebar">
      <div
        className="brand clickable"
        onClick={onOpenWebsite}
        title={`Visitar ${LAUNCHER_CONFIG.website}`}
      >
        <img src="/logo.png" className="brand-mark-img" alt="Logo" />
        <div className="brand-info">
          <div className="brand-title">
            {LAUNCHER_CONFIG.titlePrefix}
            <span className="brand-light">{LAUNCHER_CONFIG.titleSuffix}</span>
          </div>
          <span className="brand-version">{displayVersion}</span>
        </div>
      </div>

      <div className="nav-label">{t("nav.menu")}</div>
      <button
        className={`nav-item ${currentTab === "instances" ? "active" : ""}`}
        onClick={() => onTabChange("instances")}
      >
        <LayoutGrid size={17} />
        {t("nav.instances")}
        <span className="nav-count">
          {instancesCount}/{maxInstances}
        </span>
      </button>

      <button
        className={`nav-item ${currentTab === "settings" ? "active" : ""}`}
        onClick={() => onTabChange("settings")}
      >
        <Settings2 size={17} />
        {t("nav.settings")}
      </button>

      <div className="sidebar-bottom">
        <div className="sidebar-user" title={activeProfile?.name ?? t("nav.noProfile")}>
          <div className={`avatar avatar-${activeProfile?.avatar ?? "creeper"}`}>
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {activeProfile ? activeProfile.name : t("nav.noProfile")}
            </strong>
            <small>{t("nav.activeProfile")}</small>
          </div>
          <button
            type="button"
            className="exit-profile-button"
            onClick={onExitProfile}
            title={t("profiles.exitProfile")}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
