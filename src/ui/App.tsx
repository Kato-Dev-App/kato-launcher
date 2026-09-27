import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleHelp, ExternalLink, Plus, Sparkles } from "lucide-react";
import {
  EMPTY_STATE,
  type AvatarVariant,
  type GameInstance,
  type LauncherState,
  type Loader,
  type OfflineProfile,
} from "../domain/models";
import { launcherRepository } from "../services/launcherRepository";
import { LAUNCHER_CONFIG } from "../config/launcherConfig";
import { getTranslation, type Language } from "../i18n";

// Módulos por Dominio / Negocio
import { ProfileGate } from "../features/profiles/components/ProfileGate";
import { CreateProfileModal } from "../features/profiles/components/CreateProfileModal";
import { CreateInstanceModal } from "../features/instances/components/CreateInstanceModal";
import { InstanceGrid } from "../features/instances/components/InstanceGrid";
import { SettingsView } from "../features/settings/components/SettingsView";
import { ModsModal } from "../features/mods/components/ModsModal";
import { JavaPermissionModal } from "../features/instances/components/JavaPermissionModal";
import { InstanceLogsModal } from "../features/instances/components/InstanceLogsModal";
import { InstanceSettingsModal } from "../features/instances/components/InstanceSettingsModal";

// Componentes Compartidos
import { ConfirmModal, type ConfirmState } from "../shared/components/ConfirmModal";
import { SidebarNav, type NavTab } from "../shared/components/SidebarNav";
import { StatsGrid } from "../shared/components/StatsGrid";

const MAX_INSTANCES = LAUNCHER_CONFIG.maxInstances;
const MAX_PROFILES = LAUNCHER_CONFIG.maxProfiles ?? 4;

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [state, setState] = useState<LauncherState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [isInsideProfile, setIsInsideProfile] = useState(false);
  const [tab, setTab] = useState<NavTab>("instances");

  // Filtros
  const [instanceFilter, setInstanceFilter] = useState("");

  // Modales
  const [instanceDialog, setInstanceDialog] = useState(false);
  const [profileDialog, setProfileDialog] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
  const [modsModalInstance, setModsModalInstance] = useState<GameInstance | null>(null);
  const [logsModalInstance, setLogsModalInstance] = useState<GameInstance | null>(null);
  const [settingsModalInstance, setSettingsModalInstance] = useState<GameInstance | null>(null);
  const [javaPermissionModal, setJavaPermissionModal] = useState<{
    instance: GameInstance;
    requiredVersion: number;
  } | null>(null);
  const [javaDownloading, setJavaDownloading] = useState(false);

  // Estados generales
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const currentLang: Language = (state.language as Language) || "es";
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation(currentLang, key, params);

  const displayVersion = useMemo(() => {
    const v = `v${LAUNCHER_CONFIG.version}`;
    if (!LAUNCHER_CONFIG.tag || v.toLowerCase().includes(LAUNCHER_CONFIG.tag.toLowerCase())) {
      return v;
    }
    return `${v} ${LAUNCHER_CONFIG.tag}`;
  }, []);

  // Carga inicial y normalización de perfiles
  useEffect(() => {
    launcherRepository
      .load()
      .then(async (loaded) => {
        let nextState = loaded;
        if (loaded.profiles.length > 0) {
          const exists = loaded.profiles.some((p) => p.id === loaded.activeProfileId);
          if (!loaded.activeProfileId || !exists) {
            nextState = { ...loaded, activeProfileId: loaded.profiles[0].id };
          }
        }

        let profilesChanged = false;
        const normalizedProfiles = (nextState.profiles || []).map((p) => {
          if (!p.avatar) {
            profilesChanged = true;
            return { ...p, avatar: "creeper" as AvatarVariant };
          }
          return p;
        });

        if (profilesChanged || nextState.activeProfileId !== loaded.activeProfileId) {
          nextState = { ...nextState, profiles: normalizedProfiles };
          launcherRepository.save(nextState).catch(console.error);
        }

        setState(nextState);

        if (nextState.profiles.length === 0) {
          setIsInsideProfile(false);
        }

        // Si es la primera vez y no hay versiones cacheadas, sincronizar Mojang
        if (nextState.versions.length === 0) {
          setBusy(true);
          setNotice("Primera vez: Sincronizando catálogo oficial de versiones de Minecraft…");
          try {
            const updated = await launcherRepository.refreshVersions();
            setState(updated);
            setNotice(`Catálogo sincronizado: ${updated.versions.length} versiones listas.`);
          } catch (error) {
            setNotice(`No se pudo sincronizar automáticamente con Mojang: ${String(error)}`);
          } finally {
            setBusy(false);
          }
        }
      })
      .catch((error) => setNotice(`No se pudo cargar el almacenamiento: ${String(error)}`))
      .finally(() => {
        setReady(true);
        // Calentar caché de Java en segundo plano para apertura inmediata de Ajustes
        launcherRepository.getSystemJavas().catch(() => {});
      });
  }, []);

  const persist = async (next: LauncherState) => {
    setState(next);
    try {
      await launcherRepository.save(next);
    } catch (error) {
      setNotice(`No se pudo guardar en disco: ${String(error)}`);
    }
  };

  const changeLanguage = async (newLang: Language) => {
    const nextState = { ...state, language: newLang };
    await persist(nextState);
  };

  const activeProfile = useMemo(() => {
    if (state.profiles.length === 0) return null;
    return state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0] ?? null;
  }, [state.profiles, state.activeProfileId]);

  const shownInstances = useMemo(() => {
    return state.instances.filter((item) =>
      item.name.toLowerCase().includes(instanceFilter.toLowerCase())
    );
  }, [state.instances, instanceFilter]);

  const releaseCount = useMemo(
    () => state.versions.filter((item) => item.type === "release").length,
    [state.versions]
  );

  const isInstanceLimitReached = state.instances.length >= MAX_INSTANCES;
  const isProfileLimitReached = state.profiles.length >= MAX_PROFILES;

  // Acciones de Perfil
  const handleOpenProfileDialog = () => {
    if (isProfileLimitReached) {
      setNotice(t("messages.profileLimitReached", { max: MAX_PROFILES }));
      return;
    }
    setProfileDialog(true);
  };

  const handleCreateProfile = async (name: string, avatar: AvatarVariant) => {
    if (state.profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setNotice(`Ya existe un perfil con el nombre "${name}".`);
      return;
    }

    const created: OfflineProfile = {
      id: newId(),
      name,
      avatar,
      createdAt: new Date().toISOString(),
    };

    const isFirst = state.profiles.length === 0;
    const nextState: LauncherState = {
      ...state,
      profiles: [...state.profiles, created],
      activeProfileId: state.activeProfileId || created.id,
    };

    await persist(nextState);

    if (isFirst) {
      setNotice(`¡Bienvenido ${name}! Tu perfil ha sido configurado.`);
      setIsInsideProfile(true);
      setTab("instances");
    } else {
      setNotice(`Perfil "${name}" creado correctamente.`);
    }
  };

  const enterProfile = async (profileId: string) => {
    if (state.activeProfileId !== profileId) {
      await persist({ ...state, activeProfileId: profileId });
    }
    setIsInsideProfile(true);
    setTab("instances");
  };

  const exitProfile = () => {
    setIsInsideProfile(false);
  };

  const promptDeleteProfile = (profile: OfflineProfile) => {
    const linkedCount = state.instances.filter((inst) => inst.profileId === profile.id).length;
    const extraMsg =
      linkedCount > 0
        ? `${t("messages.confirmDeleteProfileDesc")} (${linkedCount} ${t("profiles.instancesCount").toLowerCase()})`
        : t("messages.confirmDeleteProfileDesc");

    setConfirmModal({
      open: true,
      title: t("messages.confirmDeleteProfileTitle", { name: profile.name }),
      message: extraMsg,
      confirmLabel: t("instances.delete"),
      action: async () => {
        try {
          const nextProfiles = state.profiles.filter((p) => p.id !== profile.id);
          let nextActiveId = state.activeProfileId;
          if (state.activeProfileId === profile.id || nextProfiles.length === 0) {
            nextActiveId = nextProfiles[0]?.id ?? null;
            setIsInsideProfile(false);
          }
          const nextState: LauncherState = {
            ...state,
            profiles: nextProfiles,
            activeProfileId: nextActiveId,
          };
          await persist(nextState);
          setNotice(`Perfil "${profile.name}" eliminado.`);
        } catch (error) {
          setNotice(`Error: ${String(error)}`);
        }
      },
    });
  };

  // Acciones de Instancia
  const handleOpenInstanceDialog = () => {
    if (isInstanceLimitReached) {
      setNotice(t("messages.instanceLimitReached", { max: MAX_INSTANCES }));
      return;
    }
    if (state.profiles.length === 0) {
      setNotice(t("messages.needProfileFirst"));
      handleOpenProfileDialog();
      return;
    }
    setInstanceDialog(true);
  };

  const handleCreateInstance = async (
    name: string,
    version: string,
    loader: Loader,
    profileId: string,
    ramGb: number = 4
  ) => {
    const instance: GameInstance = {
      id: newId(),
      name,
      minecraftVersion: version,
      loader,
      profileId,
      createdAt: new Date().toISOString(),
      ramGb,
    };

    await persist({
      ...state,
      instances: [instance, ...state.instances],
    });
  };

  const handleUpdateInstanceRam = async (instance: GameInstance, newRamGb: number) => {
    const updatedInstances = state.instances.map((i) =>
      i.id === instance.id ? { ...i, ramGb: newRamGb } : i
    );
    await persist({ ...state, instances: updatedInstances });
    setNotice(`RAM de "${instance.name}" asignada a ${newRamGb} GB.`);
  };

  const promptDeleteInstance = (instance: GameInstance) => {
    setConfirmModal({
      open: true,
      title: t("messages.confirmDeleteInstanceTitle", { name: instance.name }),
      message: t("messages.confirmDeleteInstanceDesc"),
      confirmLabel: t("instances.delete"),
      action: async () => {
        try {
          const updatedState = await launcherRepository.deleteInstance(instance.id);
          setState(updatedState);
        } catch (error) {
          setNotice(`Error: ${String(error)}`);
        }
      },
    });
  };

  const launch = async (instance: GameInstance) => {
    setBusy(true);
    setNotice(t("messages.launching", { version: instance.minecraftVersion }));
    try {
      // 1. Comprobar si se requiere descargar Java antes de lanzar
      const check = await launcherRepository.checkInstanceJava(instance.id);
      if (check.needsDownload) {
        setBusy(false);
        setJavaPermissionModal({
          instance,
          requiredVersion: check.requiredVersion,
        });
        return;
      }

      const msg = await launcherRepository.launchInstance(instance.id);
      setNotice(msg);
    } catch (error) {
      setNotice(`Error: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmJavaDownload = async () => {
    if (!javaPermissionModal) return;
    const { instance, requiredVersion } = javaPermissionModal;
    setJavaDownloading(true);
    setNotice(t("javaModal.downloading", { version: requiredVersion }));
    try {
      await launcherRepository.downloadJavaRuntime(requiredVersion);
      setJavaPermissionModal(null);
      // Java portátil instalado exitosamente, proceder con el lanzamiento
      setBusy(true);
      setNotice(t("messages.launching", { version: instance.minecraftVersion }));
      const msg = await launcherRepository.launchInstance(instance.id);
      setNotice(msg);
    } catch (error) {
      setNotice(`Error con Java ${requiredVersion}: ${String(error)}`);
    } finally {
      setJavaDownloading(false);
      setBusy(false);
    }
  };

  const openFolder = async (instanceId: string, instanceName?: string) => {
    try {
      await launcherRepository.openInstanceFolder(instanceId);
      setNotice(t("messages.openingFolder", { name: instanceName || "instancia" }));
    } catch (error) {
      setNotice(`Error: ${String(error)}`);
    }
  };

  const updateVersions = async () => {
    setBusy(true);
    setNotice("Consultando el catálogo oficial de versiones de Mojang…");
    try {
      const next = await launcherRepository.refreshVersions();
      setState(next);
      setNotice(`Catálogo actualizado: ${next.versions.length} versiones disponibles.`);
    } catch (error) {
      setNotice(`No se pudo actualizar el catálogo: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const profileFor = (profileId: string) => {
    return state.profiles.find((profile) => profile.id === profileId)?.name ?? "Perfil local";
  };

  // --- RENDER 1: Pantalla de Bienvenida / Selección de Perfil ---
  if (!isInsideProfile) {
    return (
      <>
        <ProfileGate
          profiles={state.profiles}
          instances={state.instances}
          activeProfileId={state.activeProfileId}
          currentLang={currentLang}
          displayVersion={displayVersion}
          maxProfiles={MAX_PROFILES}
          t={t}
          onEnterProfile={enterProfile}
          onOpenCreateDialog={handleOpenProfileDialog}
          onPromptDeleteProfile={promptDeleteProfile}
          onChangeLanguage={changeLanguage}
          onOpenWebsite={() => launcherRepository.openUrl(LAUNCHER_CONFIG.website)}
        />

        <CreateProfileModal
          isOpen={profileDialog}
          isFirstRun={state.profiles.length === 0}
          currentCount={state.profiles.length}
          maxProfiles={MAX_PROFILES}
          t={t}
          onClose={() => setProfileDialog(false)}
          onSubmit={handleCreateProfile}
        />

        <ConfirmModal modal={confirmModal} t={t} onClose={() => setConfirmModal(null)} />

        {notice && (
          <div className="toast" role="status">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
      </>
    );
  }

  // --- RENDER 2: Dashboard Principal ---
  return (
    <>
      <div className="app-shell">
        <SidebarNav
          currentTab={tab}
          instancesCount={state.instances.length}
          maxInstances={MAX_INSTANCES}
          activeProfile={activeProfile}
          displayVersion={displayVersion}
          t={t}
          onTabChange={setTab}
          onExitProfile={exitProfile}
          onOpenWebsite={() => launcherRepository.openUrl(LAUNCHER_CONFIG.website)}
        />

        <main className="main-content">
          <header className="topbar">
            <div className="breadcrumb">
              {LAUNCHER_CONFIG.name} <span>/</span>{" "}
              <b>{tab === "instances" ? t("instances.title") : t("settings.title")}</b>
            </div>
            <div className="top-actions">
              <span className="local-label">
                <span />
                {t("settings.local")}
              </span>
              <button
                className="icon-button"
                title={t("settings.aboutTitle")}
                onClick={() => setNotice(t("settings.aboutDesc"))}
              >
                <CircleHelp size={18} />
              </button>
            </div>
          </header>

          {tab === "instances" && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <Sparkles size={14} /> {t("instances.eyebrow")}
                  </div>
                  <h1>{t("instances.title")}</h1>
                  <p className="subtitle">{t("instances.subtitle")}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {isInstanceLimitReached && (
                    <span className="limit-pill">
                      <AlertTriangle size={13} /> {t("instances.limitReached")} ({MAX_INSTANCES}/{MAX_INSTANCES})
                    </span>
                  )}
                  <button
                    className="primary-button"
                    onClick={handleOpenInstanceDialog}
                    disabled={isInstanceLimitReached}
                    title={
                      isInstanceLimitReached
                        ? `${t("instances.limitReached")} (${MAX_INSTANCES})`
                        : t("instances.newInstance")
                    }
                  >
                    <Plus size={18} /> {t("instances.newInstance")}
                  </button>
                </div>
              </section>

              <StatsGrid
                instances={state.instances}
                maxInstances={MAX_INSTANCES}
                versionsCount={state.versions.length}
                releaseCount={releaseCount}
                versionsUpdatedAt={state.versionsUpdatedAt}
                activeProfile={activeProfile}
                ready={ready}
                busy={busy}
                t={t}
                onExitProfile={exitProfile}
              />

              <InstanceGrid
                instances={state.instances}
                shownInstances={shownInstances}
                instanceFilter={instanceFilter}
                ready={ready}
                busy={busy}
                profileFor={profileFor}
                t={t}
                onFilterChange={setInstanceFilter}
                onUpdateVersions={updateVersions}
                onOpenCreateDialog={handleOpenInstanceDialog}
                onLaunch={launch}
                onOpenFolder={(inst) => openFolder(inst.id, inst.name)}
                onOpenLogs={(inst) => setLogsModalInstance(inst)}
                onOpenSettings={(inst) => setSettingsModalInstance(inst)}
                onOpenMods={(inst) => setModsModalInstance(inst)}
                onPromptDelete={promptDeleteInstance}
                onUpdateRam={handleUpdateInstanceRam}
              />
            </>
          )}

          {tab === "settings" && (
            <SettingsView
              currentLang={currentLang}
              instances={state.instances}
              profiles={state.profiles}
              versions={state.versions}
              versionsUpdatedAt={state.versionsUpdatedAt}
              displayVersion={displayVersion}
              busy={busy}
              maxInstances={MAX_INSTANCES}
              maxProfiles={MAX_PROFILES}
              t={t}
              onChangeLanguage={changeLanguage}
              onUpdateVersions={updateVersions}
            />
          )}

          <footer className="page-footer">
            <span className="footer-disclaimer">{t("footer.mojangDisclaimer")}</span>
            {LAUNCHER_CONFIG.website && (
              <span
                className="footer-link"
                onClick={() => launcherRepository.openUrl(LAUNCHER_CONFIG.website)}
                title={LAUNCHER_CONFIG.website}
              >
                {LAUNCHER_CONFIG.name} <ExternalLink size={10} />
              </span>
            )}
          </footer>
        </main>
      </div>

      {/* Modales y avisos */}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <ConfirmModal modal={confirmModal} t={t} onClose={() => setConfirmModal(null)} />

      <CreateProfileModal
        isOpen={profileDialog}
        isFirstRun={state.profiles.length === 0}
        currentCount={state.profiles.length}
        maxProfiles={MAX_PROFILES}
        t={t}
        onClose={() => setProfileDialog(false)}
        onSubmit={handleCreateProfile}
      />

      <CreateInstanceModal
        isOpen={instanceDialog}
        currentCount={state.instances.length}
        maxInstances={MAX_INSTANCES}
        versions={state.versions}
        profiles={state.profiles}
        activeProfileId={activeProfile?.id}
        t={t}
        onClose={() => setInstanceDialog(false)}
        onSubmit={handleCreateInstance}
        onNotice={setNotice}
      />

      {modsModalInstance && (
        <ModsModal
          instance={modsModalInstance}
          language={currentLang}
          onClose={() => setModsModalInstance(null)}
          onOpenFolder={() => openFolder(modsModalInstance.id, modsModalInstance.name)}
        />
      )}

      {javaPermissionModal && (
        <JavaPermissionModal
          instance={javaPermissionModal.instance}
          requiredVersion={javaPermissionModal.requiredVersion}
          downloading={javaDownloading}
          t={t}
          onConfirm={handleConfirmJavaDownload}
          onCancel={() => {
            if (!javaDownloading) setJavaPermissionModal(null);
          }}
        />
      )}

      {logsModalInstance && (
        <InstanceLogsModal
          instance={logsModalInstance}
          language={currentLang}
          onClose={() => setLogsModalInstance(null)}
          onOpenFolder={() => openFolder(logsModalInstance.id, logsModalInstance.name)}
        />
      )}

      {settingsModalInstance && (
        <InstanceSettingsModal
          instance={settingsModalInstance}
          profileName={profileFor(settingsModalInstance.profileId)}
          language={currentLang}
          onClose={() => setSettingsModalInstance(null)}
          onUpdateRam={handleUpdateInstanceRam}
          onOpenMods={(inst) => {
            setSettingsModalInstance(null);
            setModsModalInstance(inst);
          }}
          onOpenFolder={(inst) => openFolder(inst.id, inst.name)}
          onOpenLogs={(inst) => {
            setSettingsModalInstance(null);
            setLogsModalInstance(inst);
          }}
          onPromptDelete={(inst) => {
            setSettingsModalInstance(null);
            promptDeleteInstance(inst);
          }}
        />
      )}
    </>
  );
}
