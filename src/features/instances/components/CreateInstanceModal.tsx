import { useMemo, useState } from "react";
import { CircleAlert, Plus } from "lucide-react";
import type { GameVersion, Loader, OfflineProfile } from "../../../domain/models";
import {
  ALL_LOADERS,
  POPULAR_VERSIONS,
  checkLoaderCompatibility,
} from "../../../domain/loaders";

interface CreateInstanceModalProps {
  isOpen: boolean;
  currentCount: number;
  maxInstances: number;
  versions: GameVersion[];
  profiles: OfflineProfile[];
  activeProfileId?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
  onSubmit: (name: string, version: string, loader: Loader, profileId: string, ramGb: number) => Promise<void>;
  onNotice?: (notice: string) => void;
}

export function CreateInstanceModal({
  isOpen,
  currentCount,
  maxInstances,
  versions,
  profiles,
  activeProfileId,
  t,
  onClose,
  onSubmit,
  onNotice,
}: CreateInstanceModalProps) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.21.4");
  const [loader, setLoader] = useState<Loader>("Vanilla");
  const [profileId, setProfileId] = useState(activeProfileId || (profiles[0]?.id ?? ""));
  const [ramGb, setRamGb] = useState<number>(4);
  const [submitting, setSubmitting] = useState(false);

  // Determinar compatibilidad según la versión
  const currentCompatibility = useMemo(() => {
    const selectedVersionObj = versions.find((v) => v.id === version);
    return checkLoaderCompatibility(version, selectedVersionObj?.type);
  }, [version, versions]);

  if (!isOpen) return null;

  const handleVersionChange = (newVer: string) => {
    setVersion(newVer);
    const selectedVersionObj = versions.find((v) => v.id === newVer);
    const compat = checkLoaderCompatibility(newVer, selectedVersionObj?.type);

    // Si el loader actual no es compatible con la nueva versión, seleccionar Vanilla por seguridad
    if (!compat[loader]?.supported) {
      setLoader("Vanilla");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!currentCompatibility[loader]?.supported) return;

    try {
      setSubmitting(true);
      await onSubmit(name.trim(), version, loader, profileId || (profiles[0]?.id ?? ""), ramGb);
      setName("");
      setVersion("1.21.4");
      setLoader("Vanilla");
      setRamGb(4);
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
            <div className="eyebrow">{t("instances.eyebrow")}</div>
            <h2>
              {t("instanceModal.title")} ({currentCount + 1}/{maxInstances})
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>

        <label>
          {t("instanceModal.nameLabel")}
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("instanceModal.namePlaceholder")}
          />
        </label>

        <div className="form-group" style={{ marginBottom: 15 }}>
          <label style={{ marginBottom: 4 }}>
            {t("instanceModal.versionLabel")}
            <input
              required
              value={version}
              onChange={(e) => handleVersionChange(e.target.value)}
              placeholder="1.21.4"
              list="cached-versions"
            />
            <datalist id="cached-versions">
              {versions.map((item) => (
                <option key={item.id} value={item.id} />
              ))}
            </datalist>
          </label>

          {/* Accesos rápidos a versiones populares */}
          <div className="version-quick-chips">
            {POPULAR_VERSIONS.map((pv) => (
              <button
                key={pv.id}
                type="button"
                className={`quick-chip ${version === pv.id ? "active" : ""}`}
                onClick={() => handleVersionChange(pv.id)}
              >
                {pv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Loader con validación de compatibilidad */}
        <div style={{ marginBottom: 15 }}>
          <label style={{ marginBottom: 4 }}>
            {t("instanceModal.loaderLabel")} ({version || "Minecraft"})
          </label>
          <div className="loader-selector-grid">
            {ALL_LOADERS.map((ldr) => {
              const compat = currentCompatibility[ldr];
              const isSupported = compat.supported;
              const isSelected = loader === ldr;

              return (
                <div
                  key={ldr}
                  className={`loader-chip ${isSelected ? "selected" : ""} ${
                    !isSupported ? "disabled" : ""
                  }`}
                  onClick={() => {
                    if (isSupported) {
                      setLoader(ldr);
                    } else if (compat.reason && onNotice) {
                      onNotice(compat.reason);
                    }
                  }}
                  title={!isSupported ? compat.reason : `Usar ${ldr}`}
                >
                  <strong>{ldr}</strong>
                  <small>
                    {isSupported ? (ldr === "Vanilla" ? "Vanilla" : "OK") : "No"}
                  </small>
                </div>
              );
            })}
          </div>

          {!currentCompatibility[loader]?.supported && (
            <div className="incompatibility-hint">
              <CircleAlert size={14} />
              <span>{currentCompatibility[loader]?.reason}</span>
            </div>
          )}
        </div>

        {/* Asignación de Memoria RAM */}
        <div style={{ marginBottom: 15 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ margin: 0 }}>
              Memoria RAM Asignada
            </label>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>
              {ramGb} GB RAM
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[2, 4, 6, 8, 12, 16].map((gb) => (
              <button
                key={gb}
                type="button"
                className={`quick-chip ${ramGb === gb ? "active" : ""}`}
                style={{ flex: 1, padding: "6px 0", fontSize: 11, textAlign: "center" }}
                onClick={() => setRamGb(gb)}
              >
                {gb}G
              </button>
            ))}
          </div>
          <div className="field-hint" style={{ marginTop: 4 }}>
            {ramGb <= 2
              ? "Suficiente para Vanilla ligero o versiones clásicas (1.12 y anteriores)."
              : ramGb === 4
              ? "Recomendado para la mayoría de versiones (1.20+) y mods esenciales."
              : "Excelente para modpacks exigentes, shaders pesados o alto render distance."}
          </div>
        </div>

        <label>
          {t("instanceModal.profileLabel")}
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.id === activeProfileId ? `(${t("profiles.active")})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("instanceModal.cancel")}
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={!currentCompatibility[loader]?.supported || submitting}
          >
            <Plus size={17} /> {t("instanceModal.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
