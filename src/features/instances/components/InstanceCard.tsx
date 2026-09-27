import { Box, FolderOpen, Play, Settings, Terminal, UserRound } from "lucide-react";
import type { GameInstance } from "../../../domain/models";
import { getInstanceBackground } from "../utils";

interface InstanceCardProps {
  instance: GameInstance;
  index: number;
  profileName: string;
  busy: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onLaunch: (instance: GameInstance) => void;
  onOpenFolder: (instance: GameInstance) => void;
  onOpenLogs?: (instance: GameInstance) => void;
  onOpenSettings?: (instance: GameInstance) => void;
  onOpenMods?: (instance: GameInstance) => void;
  onPromptDelete?: (instance: GameInstance) => void;
  onUpdateRam?: (instance: GameInstance, newRamGb: number) => void;
}

export function InstanceCard({
  instance,
  index,
  profileName,
  busy,
  t,
  onLaunch,
  onOpenFolder,
  onOpenLogs,
  onOpenSettings,
}: InstanceCardProps) {
  const bgUrl = getInstanceBackground(index);

  return (
    <article className="instance-card">
      <div
        className="card-art-simple"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(26, 11, 54, 0.35) 0%, rgba(20, 8, 43, 0.88) 100%), url(${bgUrl})`,
        }}
      >
        <div className="art-top">
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="loader-pill">{instance.loader}</span>
          </div>

          <div className="card-menu-group">
            <button
              type="button"
              className="card-menu"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFolder(instance);
              }}
              title={t("instances.openFolder")}
            >
              <FolderOpen size={14} />
            </button>

            {onOpenLogs && (
              <button
                type="button"
                className="card-menu card-menu-logs"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLogs(instance);
                }}
                title={t("instances.viewLogs")}
              >
                <Terminal size={14} />
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                className="card-menu card-menu-settings"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(instance);
                }}
                title={t("instances.configureInstance")}
              >
                <Settings size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="art-center">
          <div className="art-icon">
            <Box size={18} strokeWidth={1.75} />
          </div>
          <span className="game-version">Minecraft {instance.minecraftVersion}</span>
        </div>
      </div>

      <div className="instance-info">
        <div>
          <h3>{instance.name}</h3>
          <p>
            <UserRound size={12} />
            {profileName}
          </p>
        </div>
        <button
          type="button"
          className="play-button"
          onClick={() => onLaunch(instance)}
          disabled={busy}
          title={t("instances.play")}
        >
          <Play size={13} fill="currentColor" />
          {busy ? "..." : t("instances.play")}
        </button>
      </div>
    </article>
  );
}
