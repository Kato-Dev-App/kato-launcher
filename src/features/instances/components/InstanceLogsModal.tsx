import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  FolderOpen,
  Loader2,
  RefreshCw,
  Terminal,
  X,
} from "lucide-react";
import type { GameInstance } from "../../../domain/models";
import { launcherRepository } from "../../../services/launcherRepository";
import { getTranslation, type Language } from "../../../i18n";

interface InstanceLogsModalProps {
  instance: GameInstance;
  language?: Language;
  onClose: () => void;
  onOpenFolder: () => void;
}

export function InstanceLogsModal({
  instance,
  language = "es",
  onClose,
  onOpenFolder,
}: InstanceLogsModalProps) {
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation(language, key, params);

  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const output = await launcherRepository.getInstanceLogs(instance.id);
      setLogs(output);
    } catch (e) {
      setLogs(`Error al leer registros: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [instance.id]);

  useEffect(() => {
    if (consoleRef.current && !loading) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, loading]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  };

  const lines = logs.split("\n");

  const getLineClass = (line: string) => {
    const upper = line.toUpperCase();
    if (
      upper.includes("ERROR") ||
      upper.includes("EXCEPTION") ||
      upper.includes("FATAL") ||
      upper.includes("CAUSED BY:") ||
      upper.includes("UNSATISFIEDLINKERROR")
    ) {
      return "log-line-error";
    }
    if (upper.includes("WARN") || upper.includes("WARNING")) {
      return "log-line-warn";
    }
    if (upper.includes("INFO")) {
      return "log-line-info";
    }
    return "log-line-default";
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal logs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logs-modal-header">
          <div className="logs-header-title">
            <div className="logs-title-row">
              <Terminal size={18} className="logs-header-icon" />
              <h3>{t("instances.logsModalTitle", { name: instance.name })}</h3>
              <span className="logs-version-badge">MC {instance.minecraftVersion}</span>
              <span className={`logs-loader-badge loader-${instance.loader.toLowerCase()}`}>
                {instance.loader}
              </span>
            </div>
            <p className="logs-subtitle">{t("instances.logsModalSubtitle")}</p>
          </div>

          <div className="logs-header-actions">
            <button
              type="button"
              className="logs-action-btn"
              onClick={fetchLogs}
              disabled={loading}
              title={t("instances.logsRefresh")}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>{t("instances.logsRefresh")}</span>
            </button>

            <button
              type="button"
              className={`logs-action-btn ${copied ? "copied" : ""}`}
              onClick={handleCopy}
              disabled={!logs || loading}
              title={t("instances.logsCopy")}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? t("instances.logsCopied") : t("instances.logsCopy")}</span>
            </button>

            <button
              type="button"
              className="logs-action-btn"
              onClick={onOpenFolder}
              title={t("instances.openFolder")}
            >
              <FolderOpen size={14} />
              <span>{t("instances.openFolder")}</span>
            </button>

            <button
              type="button"
              className="logs-close-icon-btn"
              onClick={onClose}
              title={t("instances.logsClose")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="logs-console-wrapper" ref={consoleRef}>
          {loading ? (
            <div className="logs-loading-box">
              <Loader2 size={24} className="animate-spin" />
              <span>{t("instances.logsLoading")}</span>
            </div>
          ) : !logs.trim() ? (
            <div className="logs-empty-box">
              <p>{t("instances.logsEmpty")}</p>
            </div>
          ) : (
            <pre className="logs-terminal-pre">
              {lines.map((line, idx) => (
                <div key={idx} className={`log-line ${getLineClass(line)}`}>
                  <span className="log-line-num">{idx + 1}</span>
                  <span className="log-line-content">{line || " "}</span>
                </div>
              ))}
            </pre>
          )}
        </div>

        <div className="logs-modal-footer">
          <div className="logs-footer-meta">
            <span>
              {lines.length === 1
                ? t("instances.logsLine", { count: lines.length })
                : t("instances.logsLines", { count: lines.length })}
            </span>
            <span>•</span>
            <span>UTF-8</span>
            <span>•</span>
            <span>launcher_game.log</span>
          </div>
          <button type="button" className="logs-footer-close-btn" onClick={onClose}>
            {t("instances.logsClose")}
          </button>
        </div>
      </div>
    </div>
  );
}
