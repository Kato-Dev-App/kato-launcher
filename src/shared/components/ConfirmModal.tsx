import { Trash2 } from "lucide-react";

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

interface ConfirmModalProps {
  modal: ConfirmState | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
}

export function ConfirmModal({ modal, t, onClose }: ConfirmModalProps) {
  if (!modal || !modal.open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="confirm-modal">
        <div className="confirm-modal-header">
          <div className="confirm-icon-box">
            <Trash2 size={20} />
          </div>
          <div>
            <div className="eyebrow" style={{ color: "#ff7675" }}>
              {t("instances.delete").toUpperCase()}
            </div>
            <h3>{modal.title}</h3>
          </div>
        </div>

        <p>{modal.message}</p>

        <div className="confirm-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("instanceModal.cancel")}
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={async () => {
              const act = modal.action;
              onClose();
              await act();
            }}
          >
            <Trash2 size={15} /> {modal.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
