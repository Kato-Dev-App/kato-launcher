import { useState } from "react";
import {
  Cpu,
  ExternalLink,
  FolderOpen,
  Package,
  Settings,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { GameInstance } from "../../../domain/models";
import { getTranslation, type Language } from "../../../i18n";

interface InstanceSettingsModalProps {
  instance: GameInstance;
  profileName: string;
  language?: Language;
  onClose: () => void;
  onUpdateRam: (instance: GameInstance, newRamGb: number) => void;
  onOpenMods: (instance: GameInstance) => void;
  onOpenFolder: (instance: GameInstance) => void;
  onOpenLogs: (instance: GameInstance) => void;
  onPromptDelete: (instance: GameInstance) => void;
}

export function InstanceSettingsModal({
  instance,
  profileName,
  language = "es",
  onClose,
  onUpdateRam,
  onOpenMods,
  onOpenFolder,
  onPromptDelete,
}: InstanceSettingsModalProps) {
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation(language, key, params);

  const [selectedRam, setSelectedRam] = useState<number>(instance.ramGb || 4);

  const handleRamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setSelectedRam(val);
      onUpdateRam(instance, val);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal instance-settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="instance-settings-header">
          <div className="instance-settings-title-group">
            <div className="instance-settings-title-row">
              <div className="instance-settings-icon-box">
                <Settings size={20} />
              </div>
              <div>
                <h3>{instance.name}</h3>
                <div className="instance-settings-badges">
                  <span className="loader-pill">Minecraft {instance.minecraftVersion}</span>
                  <span className={`loader-pill loader-${instance.loader.toLowerCase()}`}>
                    {instance.loader}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="logs-close-icon-btn"
            onClick={onClose}
            title={t("instances.logsClose")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="instance-settings-body">
          {/* 1. Configuración de Memoria RAM (Combobox) */}
          <div className="settings-field-group">
            <label className="settings-label" htmlFor="instance-ram-select">
              <Cpu size={15} className="text-accent" />
              <span>{t("instances.ramSectionTitle")}</span>
            </label>
            <div className="settings-select-wrapper">
              <select
                id="instance-ram-select"
                className="settings-select"
                value={selectedRam}
                onChange={handleRamChange}
              >
                <option value={2}>{t("instances.ramOption2")}</option>
                <option value={4}>{t("instances.ramOption4")}</option>
                <option value={6}>{t("instances.ramOption6")}</option>
                <option value={8}>{t("instances.ramOption8")}</option>
                <option value={12}>{t("instances.ramOption12")}</option>
                <option value={16}>{t("instances.ramOption16")}</option>
              </select>
            </div>
            <p className="settings-field-hint">
              {t("instances.ramSectionDesc")}
            </p>
          </div>

          {/* 2. Modrinth Content & Mods Banner */}
          <div className="settings-mods-banner">
            <div className="settings-mods-info">
              <div className="settings-mods-icon">
                <Package size={20} />
              </div>
              <div>
                <strong>{t("instances.manageMods")}</strong>
                <p>
                  {t("instances.manageModsDesc", { loader: instance.loader })}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="settings-mods-btn"
              onClick={() => {
                onClose();
                onOpenMods(instance);
              }}
            >
              <span>{t("mods.title")}</span>
              <ExternalLink size={14} />
            </button>
          </div>

          {/* 3. Ficha Técnica / Información */}
          <div className="settings-meta-box">
            <div className="settings-meta-item">
              <span className="settings-meta-label">{t("instances.metaUserProfile")}</span>
              <span className="settings-meta-value">
                <UserRound size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {profileName}
              </span>
            </div>
            <div className="settings-meta-item">
              <span className="settings-meta-label">{t("instances.metaModLoader")}</span>
              <span className="settings-meta-value">{instance.loader}</span>
            </div>
            <div className="settings-meta-item">
              <span className="settings-meta-label">{t("instances.metaFolder")}</span>
              <button
                type="button"
                className="settings-link-btn"
                onClick={() => onOpenFolder(instance)}
                title={t("instances.openFolder")}
              >
                <FolderOpen size={12} />
                <span>{t("instances.openFolder")}</span>
              </button>
            </div>
          </div>

          {/* 4. Danger Zone */}
          <div className="settings-danger-card">
            <div className="settings-danger-text">
              <strong>{t("instances.dangerSectionTitle")}</strong>
              <p>{t("instances.deleteInstanceDesc")}</p>
            </div>
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                onClose();
                onPromptDelete(instance);
              }}
            >
              <Trash2 size={14} />
              <span>{t("instances.delete")}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="instance-settings-footer">
          <button type="button" className="logs-footer-close-btn" onClick={onClose}>
            {t("instances.logsClose")}
          </button>
        </div>
      </div>
    </div>
  );
}
