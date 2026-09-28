import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { AvatarVariant } from "../../../domain/models";
import { AVATAR_PRESETS } from "../utils";

interface CreateProfileModalProps {
  isOpen: boolean;
  isFirstRun: boolean;
  currentCount: number;
  maxProfiles: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
  onSubmit: (name: string, avatar: AvatarVariant) => Promise<void>;
}

export function CreateProfileModal({
  isOpen,
  isFirstRun,
  currentCount,
  maxProfiles,
  t,
  onClose,
  onSubmit,
}: CreateProfileModalProps) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarVariant>("creeper");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      await onSubmit(name.trim(), avatar);
      setName("");
      setAvatar("creeper");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">
          <div>
            <div className="eyebrow">{isFirstRun ? "WELCOME" : t("profiles.eyebrow")}</div>
            <h2>
              {isFirstRun
                ? t("profileModal.firstRunHint")
                : `${t("profileModal.title")} (${currentCount + 1}/${maxProfiles})`}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>

        {isFirstRun && (
          <div className="welcome-callout">
            <Sparkles size={20} />
            <div>
              <strong>{t("profileModal.title")}</strong>
              <p>{t("profileModal.desc")}</p>
            </div>
          </div>
        )}

        <label>
          {t("profileModal.nameLabel")}
          <input
            autoFocus
            required
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("profileModal.namePlaceholder")}
          />
        </label>

        <label>
          {t("profileModal.avatarLabel")}
          <div className="avatar-selector-grid">
            {AVATAR_PRESETS.map((preset) => (
              <div
                key={preset.id}
                className={`avatar-option ${avatar === preset.id ? "selected" : ""}`}
                onClick={() => setAvatar(preset.id)}
              >
                <div className={`avatar-preview avatar-${preset.id}`}>
                  <img
                    src={preset.image}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                  <span className="avatar-fallback">{preset.preview}</span>
                </div>
                <span>{preset.label}</span>
              </div>
            ))}
          </div>
        </label>

        <div className="modal-actions">
          {!isFirstRun && (
            <button type="button" className="secondary-button" onClick={onClose}>
              {t("instanceModal.cancel")}
            </button>
          )}
          <button className="primary-button" type="submit" disabled={submitting}>
            <Plus size={17} /> {t("profileModal.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
