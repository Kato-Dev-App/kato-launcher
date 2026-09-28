import { Box, CloudDownload, Gamepad2, Plus, Search } from "lucide-react";
import type { GameInstance } from "../../../domain/models";
import { InstanceCard } from "./InstanceCard";

interface InstanceGridProps {
  instances: GameInstance[];
  shownInstances: GameInstance[];
  instanceFilter: string;
  ready: boolean;
  busy: boolean;
  profileFor: (profileId: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onFilterChange: (filter: string) => void;
  onUpdateVersions: () => void;
  onOpenCreateDialog: () => void;
  onLaunch: (instance: GameInstance) => void;
  onOpenFolder: (instance: GameInstance) => void;
  onOpenLogs?: (instance: GameInstance) => void;
  onOpenSettings?: (instance: GameInstance) => void;
  onOpenMods?: (instance: GameInstance) => void;
  onPromptDelete?: (instance: GameInstance) => void;
  onUpdateRam?: (instance: GameInstance, newRamGb: number) => void;
}

export function InstanceGrid({
  shownInstances,
  instanceFilter,
  ready,
  busy,
  profileFor,
  t,
  onFilterChange,
  onUpdateVersions,
  onOpenCreateDialog,
  onLaunch,
  onOpenFolder,
  onOpenLogs,
  onOpenSettings,
  onOpenMods,
  onPromptDelete,
  onUpdateRam,
}: InstanceGridProps) {
  return (
    <section className="instances-section">
      <div className="section-heading">
        <div>
          <h2>{t("instances.title")}</h2>
          <p>{t("instances.subtitle")}</p>
        </div>
        <div className="list-tools">
          <label className="search-box">
            <Search size={16} />
            <input
              value={instanceFilter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={`${t("instances.title")}…`}
            />
          </label>
          <button
            className="secondary-button refresh-button"
            onClick={onUpdateVersions}
            disabled={busy}
          >
            <CloudDownload size={16} />
            {busy ? t("settings.synchronizing") : t("settings.refreshCatalog")}
          </button>
        </div>
      </div>

      {!ready ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Box size={24} />
          </div>
          <h3>...</h3>
        </div>
      ) : shownInstances.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Gamepad2 size={24} />
          </div>
          <h3>{t("instances.noInstancesTitle")}</h3>
          <p>{t("instances.noInstancesDesc")}</p>
          {!instanceFilter && (
            <button className="secondary-button" onClick={onOpenCreateDialog}>
              <Plus size={16} /> {t("instances.createFirstInstance")}
            </button>
          )}
        </div>
      ) : (
        <div className="instance-grid">
          {shownInstances.map((instance, index) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              index={index}
              profileName={profileFor(instance.profileId)}
              busy={busy}
              t={t}
              onLaunch={onLaunch}
              onOpenFolder={onOpenFolder}
              onOpenLogs={onOpenLogs}
              onOpenSettings={onOpenSettings}
              onOpenMods={onOpenMods}
              onPromptDelete={onPromptDelete}
              onUpdateRam={onUpdateRam}
            />
          ))}
        </div>
      )}
    </section>
  );
}
