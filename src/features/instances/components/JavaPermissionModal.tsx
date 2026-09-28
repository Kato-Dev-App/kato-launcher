import { Coffee, Download, HardDriveDownload, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import type { GameInstance } from "../../../domain/models";

interface JavaPermissionModalProps {
  instance: GameInstance;
  requiredVersion: number;
  downloading: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function JavaPermissionModal({
  instance,
  requiredVersion,
  downloading,
  t,
  onConfirm,
  onCancel,
}: JavaPermissionModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (!downloading && e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="java-modal">
        <div className="java-modal-header">
          <div className="java-icon-box">
            <Coffee size={24} />
          </div>
          <div>
            <div className="eyebrow" style={{ color: "#f59e0b" }}>
              {t("javaModal.eyebrow")}
            </div>
            <h3 className="java-modal-title">
              {t("javaModal.title", { version: requiredVersion })}
            </h3>
          </div>
        </div>

        <p className="java-modal-desc">
          {t("javaModal.desc", {
            name: instance.name,
            mcVersion: instance.minecraftVersion,
            version: requiredVersion,
          })}
        </p>

        {downloading ? (
          <div className="java-download-progress-box">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: "#f59e0b" }} />
              <strong style={{ fontSize: 13, color: "#fff" }}>
                {t("javaModal.downloading", { version: requiredVersion })}
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#baa9d4", lineHeight: 1.4 }}>
              {t("javaModal.downloadingHint")}
            </p>
            <div className="java-download-bar-track">
              <div className="java-download-bar-animated" />
            </div>
          </div>
        ) : (
          <div className="java-benefits-list">
            <div className="java-benefit-item">
              <ShieldCheck size={16} className="java-benefit-icon" />
              <div className="java-benefit-content">
                <span className="java-benefit-title">{t("javaModal.benefit1Title")}</span>
                <span className="java-benefit-desc">{t("javaModal.benefit1Desc")}</span>
              </div>
            </div>

            <div className="java-benefit-item">
              <HardDriveDownload size={16} className="java-benefit-icon" />
              <div className="java-benefit-content">
                <span className="java-benefit-title">{t("javaModal.benefit2Title")}</span>
                <span className="java-benefit-desc">{t("javaModal.benefit2Desc")}</span>
              </div>
            </div>

            <div className="java-benefit-item">
              <Sparkles size={16} className="java-benefit-icon" />
              <div className="java-benefit-content">
                <span className="java-benefit-title">{t("javaModal.benefit3Title")}</span>
                <span className="java-benefit-desc">{t("javaModal.benefit3Desc")}</span>
              </div>
            </div>
          </div>
        )}

        <div className="java-modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={downloading}
          >
            {t("javaModal.cancel")}
          </button>
          <button
            type="button"
            className="java-primary-btn"
            onClick={onConfirm}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("javaModal.downloading", { version: requiredVersion })}
              </>
            ) : (
              <>
                <Download size={16} />
                {t("javaModal.confirm")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
