import { Plus, Trash2, UserCheck, UserPlus } from "lucide-react";
import type { GameInstance, OfflineProfile } from "../../../domain/models";
import { LAUNCHER_CONFIG } from "../../../config/launcherConfig";
import { AVAILABLE_LANGUAGES, type Language } from "../../../i18n";
import { getAvatarImage } from "../utils";

interface ProfileGateProps {
  profiles: OfflineProfile[];
  instances: GameInstance[];
  activeProfileId?: string | null;
  currentLang: Language;
  displayVersion: string;
  maxProfiles: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onEnterProfile: (profileId: string) => void;
  onOpenCreateDialog: () => void;
  onPromptDeleteProfile: (profile: OfflineProfile) => void;
  onChangeLanguage: (lang: Language) => void;
  onOpenWebsite: () => void;
}

export function ProfileGate({
  profiles,
  instances,
  activeProfileId,
  currentLang,
  displayVersion,
  maxProfiles,
  t,
  onEnterProfile,
  onOpenCreateDialog,
  onPromptDeleteProfile,
  onChangeLanguage,
  onOpenWebsite,
}: ProfileGateProps) {
  const isProfileLimitReached = profiles.length >= maxProfiles;

  const countInstancesForProfile = (profileId: string) =>
    instances.filter((i) => i.profileId === profileId).length;

  return (
    <div className="profile-gate-screen">
      <header className="profile-gate-header">
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

        <div className="profile-gate-tools">
          {AVAILABLE_LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                className={`lang-gate-badge ${isSelected ? "selected" : ""}`}
                onClick={() => onChangeLanguage(lang.code)}
                title={lang.label}
              >
                {lang.short}
              </button>
            );
          })}
        </div>
      </header>

      <main className="profile-gate-content">
        <div className="profile-gate-hero">
          <span className="profile-gate-version-badge">{displayVersion}</span>
          <h1 className="profile-gate-title">{t("profiles.whoIsPlaying")}</h1>
          <p className="profile-gate-subtitle">{t("profiles.whoIsPlayingDesc")}</p>
        </div>

        <div className="profile-gate-grid">
          {profiles.map((p) => {
            const isSelected = p.id === activeProfileId;
            const instanceCount = countInstancesForProfile(p.id);
            return (
              <div
                key={p.id}
                className={`profile-gate-card ${isSelected ? "highlight" : ""}`}
                onClick={() => onEnterProfile(p.id)}
              >
                <button
                  type="button"
                  className="profile-gate-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPromptDeleteProfile(p);
                  }}
                  title={t("instances.delete")}
                >
                  <Trash2 size={14} />
                </button>

                <div className="profile-gate-card-inner">
                  <div className={`avatar-xl avatar-${p.avatar ?? "creeper"}`}>
                    <img
                      src={getAvatarImage(p.avatar)}
                      alt=""
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                    <span className="avatar-fallback">{p.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <h3 className="profile-gate-card-name" title={p.name}>
                    {p.name}
                  </h3>
                  <span className="profile-gate-card-meta">
                    {instanceCount} {instanceCount === 1 ? "instancia" : "instancias"}
                  </span>

                  <button
                    type="button"
                    className="profile-gate-enter-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterProfile(p.id);
                    }}
                  >
                    <UserCheck size={14} />
                    {t("profiles.enterProfile")}
                  </button>
                </div>
              </div>
            );
          })}

          {!isProfileLimitReached && (
            <div
              className="profile-gate-card create-card"
              onClick={onOpenCreateDialog}
            >
              <div className="profile-gate-card-inner">
                <div className="create-avatar-box">
                  <UserPlus size={26} strokeWidth={1.75} />
                </div>
                <h3 className="profile-gate-card-name">{t("profiles.newProfile")}</h3>
                <span className="profile-gate-card-meta">
                  {profiles.length} / {maxProfiles}
                </span>

                <button
                  type="button"
                  className="profile-gate-enter-btn create-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCreateDialog();
                  }}
                >
                  <Plus size={14} />
                  {t("profiles.newProfile")}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="profile-gate-footer">
        <span>
          {LAUNCHER_CONFIG.name} {displayVersion}
        </span>
        <span className="footer-dot">·</span>
        <span>{t("footer.mojangDisclaimer")}</span>
      </footer>
    </div>
  );
}
