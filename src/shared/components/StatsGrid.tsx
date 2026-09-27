import { Box, Gamepad2, UserRound } from "lucide-react";
import type { GameInstance, OfflineProfile } from "../../domain/models";

interface StatsGridProps {
  instances: GameInstance[];
  maxInstances: number;
  versionsCount: number;
  releaseCount: number;
  versionsUpdatedAt: string | null;
  activeProfile?: OfflineProfile | null;
  ready: boolean;
  busy: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onExitProfile: () => void;
}

export function StatsGrid({
  instances,
  maxInstances,
  versionsCount,
  releaseCount,
  versionsUpdatedAt,
  activeProfile,
  ready,
  busy,
  t,
  onExitProfile,
}: StatsGridProps) {
  const isInstanceLimitReached = instances.length >= maxInstances;

  return (
    <section className="stats-grid">
      <div className="stat-card stat-card-instances">
        <div className="stat-icon green">
          <Box size={18} />
        </div>
        <div>
          <span>{t("instances.title").toUpperCase()}</span>
          <strong>
            {instances.length} / {maxInstances}
          </strong>
        </div>
        <small>
          {isInstanceLimitReached
            ? t("instances.limitReached")
            : `${maxInstances - instances.length} ${t("instances.slotsAvailable")}`}
        </small>
      </div>

      <div className="stat-card stat-card-versions">
        <div className="stat-icon purple">
          <Gamepad2 size={18} />
        </div>
        <div>
          <span>{t("settings.cachedVersions").toUpperCase()}</span>
          <strong>
            {ready
              ? releaseCount || (versionsCount ? `${versionsCount}` : "—")
              : "…"}
          </strong>
        </div>
        <small>
          {busy
            ? `${t("settings.synchronizing")}`
            : versionsUpdatedAt
            ? `${t("settings.synchronized")} ${new Date(versionsUpdatedAt).toLocaleDateString()}`
            : "—"}
        </small>
      </div>

      <div
        className="stat-card stat-card-profile"
        style={{ cursor: "pointer" }}
        onClick={onExitProfile}
        title={t("profiles.switchProfile")}
      >
        <div className="stat-icon amber">
          <UserRound size={18} />
        </div>
        <div>
          <span>{t("profiles.active").toUpperCase()}</span>
          <strong>{activeProfile ? activeProfile.name : "—"}</strong>
        </div>
        <span className="profile-switch-badge">{t("profiles.switchProfile")}</span>
      </div>
    </section>
  );
}
