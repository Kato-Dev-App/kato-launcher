import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  Check,
  CircleAlert,
  CircleHelp,
  CloudDownload,
  ExternalLink,
  FolderOpen,
  Gamepad2,
  Globe,
  HardDrive,
  LayoutGrid,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import {
  EMPTY_STATE,
  type AvatarVariant,
  type GameInstance,
  type LauncherState,
  type Loader,
  type OfflineProfile,
} from "../domain/models";
import {
  ALL_LOADERS,
  POPULAR_VERSIONS,
  checkLoaderCompatibility,
} from "../domain/loaders";
import { launcherRepository } from "../services/launcherRepository";
import { LAUNCHER_CONFIG } from "../config/launcherConfig";
import { AVAILABLE_LANGUAGES, getTranslation, type Language } from "../i18n";

type Tab = "instances" | "settings";

const MAX_INSTANCES = LAUNCHER_CONFIG.maxInstances;
const MAX_PROFILES = LAUNCHER_CONFIG.maxProfiles ?? 4;

interface AvatarPreset {
  id: AvatarVariant;
  label: string;
  preview: string;
  image: string;
}

const avatarPresets: AvatarPreset[] = [
  { id: "creeper", label: "Creeper", preview: "Cr", image: "/avatars/creeper.jpg" },
  { id: "zombie", label: "Zombie", preview: "Zo", image: "/avatars/zombie.jpg" },
  { id: "enderman", label: "Enderman", preview: "En", image: "/avatars/enderman.png" },
  { id: "esqueleto", label: "Esqueleto", preview: "Es", image: "/avatars/esqueleto.jpg" },
  { id: "cerdo", label: "Cerdo", preview: "Ce", image: "/avatars/cerdo.jpg" },
  { id: "vaca", label: "Vaca", preview: "Va", image: "/avatars/vaca.jpg" },
  { id: "pollo", label: "Pollo", preview: "Po", image: "/avatars/pollo.jpg" },
];

const getAvatarImage = (variant?: string) => {
  const key = variant || "creeper";
  const found = avatarPresets.find((p) => p.id === key);
  if (found) return found.image;
  if (key === "ender" || key === "enderman") return "/avatars/enderman.png";
  if (key === "steve") return "/avatars/steve.png";
  if (key === "alex") return "/avatars/alex.png";
  return `/avatars/${key}.jpg`;
};

const newId = () => crypto.randomUUID();

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void> | void;
}

export default function App() {
  const [state, setState] = useState<LauncherState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [isInsideProfile, setIsInsideProfile] = useState(false);
  const [tab, setTab] = useState<Tab>("instances");

  const currentLang: Language = (state.language as Language) || "es";
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation(currentLang, key, params);

  const changeLanguage = async (newLang: Language) => {
    const nextState = { ...state, language: newLang };
    await persist(nextState);
  };

  // Instances state
  const [instanceFilter, setInstanceFilter] = useState("");
  const [instanceDialog, setInstanceDialog] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [instanceVersion, setInstanceVersion] = useState("1.21.4");
  const [instanceLoader, setInstanceLoader] = useState<Loader>("Vanilla");
  const [instanceProfileId, setInstanceProfileId] = useState("");

  // Profiles state
  const [profileFilter, setProfileFilter] = useState("");
  const [profileDialog, setProfileDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileAvatar, setNewProfileAvatar] = useState<AvatarVariant>("creeper");

  // Confirmation Modal state (reemplaza a window.confirm que se bloquea en webviews)
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);

  // General state
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const displayVersion = useMemo(() => {
    const v = `v${LAUNCHER_CONFIG.version}`;
    if (!LAUNCHER_CONFIG.tag || v.toLowerCase().includes(LAUNCHER_CONFIG.tag.toLowerCase())) {
      return v;
    }
    return `${v} ${LAUNCHER_CONFIG.tag}`;
  }, []);

  useEffect(() => {
    launcherRepository
      .load()
      .then(async (loaded) => {
        let nextState = loaded;
        // Ensure activeProfileId is valid if profiles exist
        if (loaded.profiles.length > 0) {
          const exists = loaded.profiles.some((p) => p.id === loaded.activeProfileId);
          if (!loaded.activeProfileId || !exists) {
            nextState = { ...loaded, activeProfileId: loaded.profiles[0].id };
          }
        }

        // Migrate any profiles created before avatar persistence
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

        // Si es la primera vez y no hay catálogo de versiones en caché, buscarlo automáticamente de Mojang
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
      .finally(() => setReady(true));
  }, []);

  const persist = async (next: LauncherState) => {
    setState(next);
    try {
      await launcherRepository.save(next);
    } catch (error) {
      setNotice(`No se pudo guardar en disco: ${String(error)}`);
    }
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

  const shownProfiles = useMemo(() => {
    return state.profiles.filter((item) =>
      item.name.toLowerCase().includes(profileFilter.toLowerCase())
    );
  }, [state.profiles, profileFilter]);

  const releaseCount = state.versions.filter((item) => item.type === "release").length;

  const countInstancesForProfile = (profileId: string) => {
    return state.instances.filter((inst) => inst.profileId === profileId).length;
  };

  const isInstanceLimitReached = state.instances.length >= MAX_INSTANCES;
  const isProfileLimitReached = state.profiles.length >= MAX_PROFILES;

  // Compatibilidad de loaders según la versión seleccionada
  const currentCompatibility = useMemo(() => {
    const versionObj = state.versions.find((v) => v.id === instanceVersion);
    return checkLoaderCompatibility(instanceVersion, versionObj?.type);
  }, [instanceVersion, state.versions]);

  const handleVersionChange = (newVer: string) => {
    setInstanceVersion(newVer);
    const versionObj = state.versions.find((v) => v.id === newVer);
    const compat = checkLoaderCompatibility(newVer, versionObj?.type);

    // Si el loader seleccionado no está soportado en la nueva versión, volver a Vanilla
    if (!compat[instanceLoader]?.supported) {
      setInstanceLoader("Vanilla");
    }
  };

  // --- Manejo de Perfiles ---
  const handleOpenProfileDialog = () => {
    if (isProfileLimitReached) {
      setNotice(t("messages.profileLimitReached", { max: MAX_PROFILES }));
      return;
    }
    setNewProfileName("");
    setNewProfileAvatar("creeper");
    setProfileDialog(true);
  };

  const createProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isProfileLimitReached) {
      setNotice(t("messages.profileLimitReached", { max: MAX_PROFILES }));
      return;
    }
    const cleanName = newProfileName.trim();
    if (!cleanName) return;

    if (state.profiles.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
      setNotice(`Ya existe un perfil con el nombre "${cleanName}".`);
      return;
    }

    const created: OfflineProfile = {
      id: newId(),
      name: cleanName,
      avatar: newProfileAvatar,
      createdAt: new Date().toISOString(),
    };

    const isFirst = state.profiles.length === 0;
    const nextState: LauncherState = {
      ...state,
      profiles: [...state.profiles, created],
      activeProfileId: state.activeProfileId || created.id,
    };

    await persist(nextState);
    setNewProfileName("");
    setProfileDialog(false);

    if (isFirst) {
      setNotice(`¡Bienvenido ${cleanName}! Tu perfil ha sido configurado.`);
      setIsInsideProfile(true);
      setTab("instances");
    } else {
      setNotice(`Perfil "${cleanName}" creado correctamente.`);
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
    const linkedCount = countInstancesForProfile(profile.id);
    const extraMsg = linkedCount > 0
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

  // --- Manejo de Instancias ---
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
    setInstanceName("");
    const defaultVer = state.versions.find((v) => v.type === "release")?.id ?? "1.21.4";
    setInstanceVersion(defaultVer);
    setInstanceLoader("Vanilla");
    setInstanceProfileId(activeProfile?.id ?? state.profiles[0].id);
    setInstanceDialog(true);
  };

  const createInstance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isInstanceLimitReached) {
      setNotice(t("messages.instanceLimitReached", { max: MAX_INSTANCES }));
      return;
    }

    const cleanName = instanceName.trim();
    if (!cleanName || !instanceVersion.trim()) return;

    // Verificar compatibilidad del loader antes de guardar
    if (!currentCompatibility[instanceLoader]?.supported) {
      setNotice(`Loader incompatible: ${instanceLoader}`);
      return;
    }

    const assignedProfileId = instanceProfileId || activeProfile?.id || state.profiles[0]?.id;
    if (!assignedProfileId) {
      return;
    }

    const instance: GameInstance = {
      id: newId(),
      name: cleanName,
      minecraftVersion: instanceVersion.trim(),
      loader: instanceLoader,
      profileId: assignedProfileId,
      createdAt: new Date().toISOString(),
    };

    await persist({
      ...state,
      instances: [instance, ...state.instances],
    });
    setInstanceName("");
    setInstanceDialog(false);
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
      const msg = await launcherRepository.launchInstance(instance.id);
      setNotice(msg);
    } catch (error) {
      setNotice(`Error: ${String(error)}`);
    } finally {
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

  const isFirstRun = ready && state.profiles.length === 0;

  return (
    <>
      {!isInsideProfile ? (
        <div className="profile-gate-screen">
          <header className="profile-gate-header">
            <div
              className="brand clickable"
              onClick={() => launcherRepository.openUrl(LAUNCHER_CONFIG.website)}
              title={`Visitar ${LAUNCHER_CONFIG.website}`}
            >
              <img src="/logo.png" className="brand-mark-img" alt="Logo" />
              <div className="brand-info">
                <div className="brand-title">
                  {LAUNCHER_CONFIG.titlePrefix}<span className="brand-light">{LAUNCHER_CONFIG.titleSuffix}</span>
                </div>
                <span className="brand-version">{displayVersion}</span>
              </div>
            </div>
            <div className="profile-gate-tools">
              {AVAILABLE_LANGUAGES.map((lang) => {
                const isSelected = currentLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    className={`lang-gate-badge ${isSelected ? "selected" : ""}`}
                    onClick={() => changeLanguage(lang.code)}
                    title={lang.label}
                  >
                    {lang.short}
                  </button>
                );
              })}
            </div>
          </header>

          <main className="profile-gate-content">
            <div className="profile-gate-hero">
              <span className="profile-gate-version-badge">{displayVersion}</span>
              <h1 className="profile-gate-title">{t("profiles.whoIsPlaying")}</h1>
              <p className="profile-gate-subtitle">{t("profiles.whoIsPlayingDesc")}</p>
            </div>

            <div className="profile-gate-grid">
              {state.profiles.map((p) => {
                const isSelected = p.id === state.activeProfileId;
                const instanceCount = countInstancesForProfile(p.id);
                return (
                  <div
                    key={p.id}
                    className={`profile-gate-card ${isSelected ? "highlight" : ""}`}
                    onClick={() => enterProfile(p.id)}
                  >
                    <button
                      type="button"
                      className="profile-gate-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        promptDeleteProfile(p);
                      }}
                      title={t("instances.delete")}
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="profile-gate-card-inner">
                      <div className={`avatar-xl avatar-${p.avatar ?? "creeper"}`}>
                        <img
                          src={getAvatarImage(p.avatar)}
                          alt=""
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                        <span className="avatar-fallback">{p.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <h3 className="profile-gate-card-name" title={p.name}>{p.name}</h3>
                      <span className="profile-gate-card-meta">
                        {instanceCount} {instanceCount === 1 ? "instancia" : "instancias"}
                      </span>

                      <button
                        type="button"
                        className="profile-gate-enter-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          enterProfile(p.id);
                        }}
                      >
                        <UserCheck size={14} />
                        {t("profiles.enterProfile")}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isProfileLimitReached && (
                <div
                  className="profile-gate-card create-card"
                  onClick={handleOpenProfileDialog}
                >
                  <div className="profile-gate-card-inner">
                    <div className="create-avatar-box">
                      <UserPlus size={26} strokeWidth={1.75} />
                    </div>
                    <h3 className="profile-gate-card-name">{t("profiles.newProfile")}</h3>
                    <span className="profile-gate-card-meta">
                      {state.profiles.length} / {MAX_PROFILES}
                    </span>

                    <button
                      type="button"
                      className="profile-gate-enter-btn create-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProfileDialog();
                      }}
                    >
                      <Plus size={14} />
                      {t("profiles.newProfile")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>

          <footer className="profile-gate-footer">
            <span>{LAUNCHER_CONFIG.name} {displayVersion}</span>
            <span className="footer-dot">·</span>
            <span>{t("footer.mojangDisclaimer")}</span>
          </footer>
        </div>
      ) : (
        <div className="app-shell">
          {/* Sidebar */}
          <aside className="sidebar">
            <div
              className="brand clickable"
              onClick={() => launcherRepository.openUrl(LAUNCHER_CONFIG.website)}
              title={`Visitar ${LAUNCHER_CONFIG.website}`}
            >
              <img src="/logo.png" className="brand-mark-img" alt="Logo" />
              <div className="brand-info">
                <div className="brand-title">
                  {LAUNCHER_CONFIG.titlePrefix}<span className="brand-light">{LAUNCHER_CONFIG.titleSuffix}</span>
                </div>
                <span className="brand-version">{displayVersion}</span>
              </div>
            </div>

            <div className="nav-label">{t("nav.menu")}</div>
            <button
              className={`nav-item ${tab === "instances" ? "active" : ""}`}
              onClick={() => setTab("instances")}
            >
              <LayoutGrid size={17} />
              {t("nav.instances")}
              <span className="nav-count">{state.instances.length}/{MAX_INSTANCES}</span>
            </button>

            <button
              className={`nav-item ${tab === "settings" ? "active" : ""}`}
              onClick={() => setTab("settings")}
            >
              <Settings2 size={17} />
              {t("nav.settings")}
            </button>

            <div className="sidebar-bottom">
              <div className="sidebar-user" title={activeProfile?.name ?? t("nav.noProfile")}>
                <div className={`avatar avatar-${activeProfile?.avatar ?? "creeper"}`}>
                  <img
                    src={getAvatarImage(activeProfile?.avatar)}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                  <span className="avatar-fallback">
                    {activeProfile ? activeProfile.name.charAt(0).toUpperCase() : "?"}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                    {activeProfile ? activeProfile.name : t("nav.noProfile")}
                  </strong>
                  <small>{t("nav.activeProfile")}</small>
                </div>
                <button
                  type="button"
                  className="exit-profile-button"
                  onClick={exitProfile}
                  title={t("profiles.exitProfile")}
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
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

        {/* --- PESTAÑA: INSTANCIAS --- */}
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
                  title={isInstanceLimitReached ? `${t("instances.limitReached")} (${MAX_INSTANCES})` : t("instances.newInstance")}
                >
                  <Plus size={18} /> {t("instances.newInstance")}
                </button>
              </div>
            </section>

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon green">
                  <Box size={18} />
                </div>
                <div>
                  <span>{t("instances.title").toUpperCase()}</span>
                  <strong>{state.instances.length} / {MAX_INSTANCES}</strong>
                </div>
                <small>{isInstanceLimitReached ? t("instances.limitReached") : `${MAX_INSTANCES - state.instances.length} ${t("instances.slotsAvailable")}`}</small>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">
                  <Gamepad2 size={18} />
                </div>
                <div>
                  <span>{t("settings.cachedVersions").toUpperCase()}</span>
                  <strong>{ready ? releaseCount || (state.versions.length ? `${state.versions.length}` : "—") : "…"}</strong>
                </div>
                <small>
                  {busy
                    ? `${t("settings.synchronizing")}`
                    : state.versionsUpdatedAt
                    ? `${t("settings.synchronized")} ${new Date(state.versionsUpdatedAt).toLocaleDateString()}`
                    : "—"}
                </small>
              </div>
              <div
                className="stat-card"
                style={{ cursor: "pointer" }}
                onClick={exitProfile}
                title={t("profiles.switchProfile")}
              >
                <div className="stat-icon amber">
                  <UserRound size={18} />
                </div>
                <div>
                  <span>{t("profiles.active").toUpperCase()}</span>
                  <strong>{activeProfile ? activeProfile.name : "—"}</strong>
                </div>
                <small>{t("profiles.switchProfile")}</small>
              </div>
            </section>

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
                      onChange={(event) => setInstanceFilter(event.target.value)}
                      placeholder={`${t("instances.title")}…`}
                    />
                  </label>
                  <button
                    className="secondary-button refresh-button"
                    onClick={updateVersions}
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
                    <button className="secondary-button" onClick={handleOpenInstanceDialog}>
                      <Plus size={16} /> {t("instances.createFirstInstance")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="instance-grid">
                  {shownInstances.map((instance) => (
                    <article className="instance-card" key={instance.id}>
                      <div className="card-art-simple">
                        <div className="art-top">
                          <span className="loader-pill">{instance.loader}</span>
                          <div className="card-menu-group">
                            <button
                              type="button"
                              className="card-menu"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFolder(instance.id, instance.name);
                              }}
                              title={t("instances.openFolder")}
                            >
                              <FolderOpen size={14} />
                            </button>
                            <button
                              type="button"
                              className="card-menu danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                promptDeleteInstance(instance);
                              }}
                              title={t("instances.delete")}
                            >
                              <Trash2 size={14} />
                            </button>
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
                            {profileFor(instance.profileId)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="play-button"
                          onClick={() => launch(instance)}
                          disabled={busy}
                          title={t("instances.play")}
                        >
                          <Play size={13} fill="currentColor" />
                          {busy ? "..." : t("instances.play")}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* --- PESTAÑA: AJUSTES --- */}
        {tab === "settings" && (
          <>
            <section className="welcome-row">
              <div>
                <div className="eyebrow">
                  <Settings2 size={14} /> {t("settings.eyebrow")}
                </div>
                <h1>{t("settings.title")}</h1>
                <p className="subtitle">{t("settings.subtitle")}</p>
              </div>
            </section>

            <section className="settings-section">
              {/* Selector de Idiomas */}
              <div className="settings-box">
                <h3>
                  <Globe size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
                  {t("settings.languageTitle")}
                </h3>
                <p>{t("settings.languageDesc")}</p>
                <div className="language-selector-group">
                  {AVAILABLE_LANGUAGES.map((lang) => {
                    const isSelected = currentLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        className={`language-chip ${isSelected ? "selected" : ""}`}
                        onClick={() => changeLanguage(lang.code)}
                      >
                        <span className="lang-badge">{lang.short}</span>
                        <span className="lang-name">{lang.label}</span>
                        {isSelected && <Check size={15} className="lang-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Acerca del Launcher */}
              <div className="settings-box">
                <h3>{t("settings.aboutTitle")}</h3>
                <p>{t("settings.aboutDesc")}</p>
                <div className="settings-row">
                  <div>
                    <div className="settings-row-title">{t("settings.version")}</div>
                    <div className="settings-row-desc">{LAUNCHER_CONFIG.name} {displayVersion}</div>
                  </div>
                  <span className="settings-badge">{displayVersion}</span>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-row-title">{t("settings.instanceLimit")}</div>
                    <div className="settings-row-desc">{t("settings.instanceLimitDesc")}</div>
                  </div>
                  <span className="settings-badge">{state.instances.length} / {MAX_INSTANCES}</span>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-row-title">{t("settings.profileLimit")}</div>
                    <div className="settings-row-desc">{t("settings.profileLimitDesc")}</div>
                  </div>
                  <span className="settings-badge">{state.profiles.length} / {MAX_PROFILES}</span>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-row-title">{t("settings.backend")}</div>
                    <div className="settings-row-desc">Tauri v{LAUNCHER_CONFIG.tauriVersion} + Rust Core</div>
                  </div>
                  <span className="settings-badge">Tauri {LAUNCHER_CONFIG.tauriVersion}</span>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-row-title">{t("settings.localStorage")}</div>
                    <div className="settings-row-desc">{t("settings.localStorageDesc")}</div>
                  </div>
                  <span className="settings-badge">
                    <HardDrive size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                    {t("settings.local")}
                  </span>
                </div>
                {LAUNCHER_CONFIG.website && (
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-title">Sitio Web / Comunidad</div>
                      <div className="settings-row-desc">{LAUNCHER_CONFIG.website}</div>
                    </div>
                    <button
                      type="button"
                      className="secondary-button compact"
                      onClick={() => launcherRepository.openUrl(LAUNCHER_CONFIG.website)}
                      title={LAUNCHER_CONFIG.website}
                    >
                      <ExternalLink size={12} /> Visitar
                    </button>
                  </div>
                )}
                <div className="settings-row">
                  <div>
                    <div className="settings-row-title">{t("settings.disclaimerTitle")}</div>
                    <div className="settings-row-desc">{t("footer.mojangDisclaimer")}</div>
                  </div>
                </div>
              </div>

              <div className="settings-box">
                <h3>{t("settings.catalogTitle")}</h3>
                <p>{t("settings.catalogDesc")}</p>
                <div className="settings-row">
                  <div>
                    <div className="settings-row-title">{t("settings.cachedVersions")}</div>
                    <div className="settings-row-desc">
                      {state.versions.length} {t("settings.cachedVersions").toLowerCase()} ({releaseCount} {t("settings.official")})
                      {state.versionsUpdatedAt && ` · ${t("settings.synchronized")} ${new Date(state.versionsUpdatedAt).toLocaleTimeString()}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={updateVersions}
                    disabled={busy}
                  >
                    <RefreshCw size={14} className={busy ? "spin" : ""} />
                    {busy ? t("settings.synchronizing") : t("settings.refreshCatalog")}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        <footer className="page-footer">
          <span className="footer-disclaimer">
            {t("footer.mojangDisclaimer")}
          </span>
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
  )}

  {/* Aviso flotante global */}
  {notice && (
    <div className="toast" role="status">
      {notice}
      <button onClick={() => setNotice("")}>×</button>
    </div>
  )}

      {/* --- MODAL DE CONFIRMACIÓN CUSTOM (REEMPLAZA WINDOW.CONFIRM) --- */}
      {confirmModal && confirmModal.open && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmModal(null);
            }
          }}
        >
          <div className="confirm-modal">
            <div className="confirm-modal-header">
              <div className="confirm-icon-box">
                <Trash2 size={20} />
              </div>
              <div>
                <div className="eyebrow" style={{ color: "#ff7675" }}>{t("instances.delete").toUpperCase()}</div>
                <h3>{confirmModal.title}</h3>
              </div>
            </div>

            <p>{confirmModal.message}</p>

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmModal(null)}
              >
                {t("instanceModal.cancel")}
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={async () => {
                  const act = confirmModal.action;
                  setConfirmModal(null);
                  await act();
                }}
              >
                <Trash2 size={15} /> {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREAR PERFIL (O BIENVENIDA PRIMER USO) --- */}
      {profileDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setProfileDialog(false);
            }
          }}
        >
          <form className="modal" onSubmit={createProfile}>
            <div className="modal-title">
              <div>
                <div className="eyebrow">{isFirstRun ? "WELCOME" : t("profiles.eyebrow")}</div>
                <h2>
                  {isFirstRun
                    ? t("profileModal.firstRunHint")
                    : `${t("profileModal.title")} (${state.profiles.length + 1}/${MAX_PROFILES})`}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setProfileDialog(false)}
              >
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
                value={newProfileName}
                onChange={(event) => setNewProfileName(event.target.value)}
                placeholder={t("profileModal.namePlaceholder")}
              />
            </label>

            <label>
              {t("profileModal.avatarLabel")}
              <div className="avatar-selector-grid">
                {avatarPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`avatar-option ${newProfileAvatar === preset.id ? "selected" : ""}`}
                    onClick={() => setNewProfileAvatar(preset.id)}
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
              <button
                type="button"
                className="secondary-button"
                onClick={() => setProfileDialog(false)}
              >
                {t("profileModal.cancel")}
              </button>
              <button className="primary-button" type="submit">
                <Plus size={17} /> {t("profileModal.submit")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MODAL: CREAR INSTANCIA --- */}
      {instanceDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setInstanceDialog(false)}
        >
          <form className="modal" onSubmit={createInstance}>
            <div className="modal-title">
              <div>
                <div className="eyebrow">{t("instances.eyebrow")}</div>
                <h2>{t("instanceModal.title")} ({state.instances.length + 1}/{MAX_INSTANCES})</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setInstanceDialog(false)}
              >
                ×
              </button>
            </div>

            <label>
              {t("instanceModal.nameLabel")}
              <input
                autoFocus
                required
                value={instanceName}
                onChange={(event) => setInstanceName(event.target.value)}
                placeholder={t("instanceModal.namePlaceholder")}
              />
            </label>

            <div className="form-group" style={{ marginBottom: 15 }}>
              <label style={{ marginBottom: 4 }}>
                {t("instanceModal.versionLabel")}
                <input
                  required
                  value={instanceVersion}
                  onChange={(event) => handleVersionChange(event.target.value)}
                  placeholder="1.21.4"
                  list="cached-versions"
                />
                <datalist id="cached-versions">
                  {state.versions.map((item) => (
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
                    className={`quick-chip ${instanceVersion === pv.id ? "active" : ""}`}
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
                {t("instanceModal.loaderLabel")} ({instanceVersion || "Minecraft"})
              </label>
              <div className="loader-selector-grid">
                {ALL_LOADERS.map((ldr) => {
                  const compat = currentCompatibility[ldr];
                  const isSupported = compat.supported;
                  const isSelected = instanceLoader === ldr;

                  return (
                    <div
                      key={ldr}
                      className={`loader-chip ${isSelected ? "selected" : ""} ${!isSupported ? "disabled" : ""}`}
                      onClick={() => {
                        if (isSupported) {
                          setInstanceLoader(ldr);
                        } else if (compat.reason) {
                          setNotice(compat.reason);
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

              {/* Alerta si el loader seleccionado no es compatible */}
              {!currentCompatibility[instanceLoader]?.supported && (
                <div className="incompatibility-hint">
                  <CircleAlert size={14} />
                  <span>{currentCompatibility[instanceLoader]?.reason}</span>
                </div>
              )}
            </div>

            <label>
              {t("instanceModal.profileLabel")}
              <select
                value={instanceProfileId}
                onChange={(event) => setInstanceProfileId(event.target.value)}
              >
                {state.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.id === state.activeProfileId ? `(${t("profiles.active")})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setInstanceDialog(false)}
              >
                {t("instanceModal.cancel")}
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={!currentCompatibility[instanceLoader]?.supported}
              >
                <Plus size={17} /> {t("instanceModal.submit")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
