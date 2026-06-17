import { useState, useEffect, useRef } from 'react';
import { useInstanceStore, getInitialInstanceState } from '../../store/instanceStore';
import { useAppStore } from '../../store/appStore';
import { useAccountStore } from '../../store/accountStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useI18n, translateBackendStatus } from '../../utils/i18n';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getInstanceIconSrc } from '../../utils/versionUtils';
import { listen } from '@tauri-apps/api/event';
import { Play, Loader, FolderOpen, Square } from 'lucide-react';
import { CustomConfirmModal } from '../../components/common/CustomConfirmModal';
import { ServerEditModal } from './ServerEditModal';
import { ModrinthDownloadModal } from './ModrinthDownloadModal';
import { IconEditModal } from './IconEditModal';
import { VersionEditModal } from './VersionEditModal';
import { JavaSelectorModal } from './JavaSelectorModal';
import { ModVersionModal } from './ModVersionModal';

import { EditTab } from './tabs/EditTab';
import { LogTab } from './tabs/LogTab';
import { ModsTab } from './tabs/ModsTab';
import { ResourcePacksTab } from './tabs/ResourcePacksTab';
import { ShaderPacksTab } from './tabs/ShaderPacksTab';
import { WorldsTab } from './tabs/WorldsTab';
import { ServersTab } from './tabs/ServersTab';
import { SettingsTab } from './tabs/SettingsTab';
import { ModpackUpdateTab } from './tabs/ModpackUpdateTab';
import styles from './InstanceDetail.module.css';

// 避免 Zustand 與 React 重複渲染的空陣列常數
const EMPTY_LOGS: string[] = [];

interface Props {
  instanceId: string;
}

interface ModItem {
  fileName: string;
  name: string;
  version: string;
  environment: string;
  sha1: string;
  enabled: boolean;
}

interface ResourcePackItem {
  fileName: string;
  name: string;
  description: string;
  packFormat: number;
  gameVersion: string;
  sha1: string;
}

interface WorldItem {
  folderName: string;
  name: string;
  sizeBytes: number;
  datapacks: string[];
}

interface ServerItem {
  name: string;
  ip: string;
  acceptTextures?: number;
}



export function InstanceDetail({ instanceId }: Props) {
  const { t, language } = useI18n();
  const instances = useInstanceStore((state) => state.instances);
  const updateInstanceSettings = useInstanceStore((state) => state.updateInstanceSettings);
  const updateInstanceConfig = useInstanceStore((state) => state.updateInstanceConfig);
  const deleteInstance = useInstanceStore((state) => state.deleteInstance);
  const launchInstance = useInstanceStore((state) => state.launchInstance);
  const instanceStates = useInstanceStore((state) => state.instanceStates);
  const loadInstances = useInstanceStore((state) => state.loadInstances);
  const watchInstanceFolders = useInstanceStore((state) => state.watchInstanceFolders);
  const unwatchInstanceFolders = useInstanceStore((state) => state.unwatchInstanceFolders);
  const setLogs = useInstanceStore((state) => state.setLogs);
  const clearLogs = useInstanceStore((state) => state.clearLogs);
  const killGame = useInstanceStore((state) => state.killGame);
  const addNotification = useAppStore((state) => state.addNotification);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const activeTab = useAppStore((state) => state.activeDetailTab);
  const setActiveTab = useAppStore((state) => state.setActiveDetailTab);
  const accounts = useAccountStore((state) => state.accounts);
  const selectedAccountId = useAccountStore((state) => state.selectedAccountId);
  const settingsConfig = useSettingsStore((state) => state.config);

  const instance = instances.find(i => i && i.id === instanceId);

  const [baseDir, setBaseDir] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTabRef = useRef(activeTab);

  const [jvmArgs, setJvmArgs] = useState('');
  const [maxMemory, setMaxMemory] = useState(4096);
  const [customJava, setCustomJava] = useState('');

  const logs = useInstanceStore(state => state.instanceLogs[instanceId] ?? EMPTY_LOGS);
  const [mods, setMods] = useState<ModItem[]>([]);
  const [modsUpdates, setModsUpdates] = useState<Record<string, any>>({});
  const [isCheckingModsUpdates, setIsCheckingModsUpdates] = useState(false);
  const [resourcePacks, setResourcePacks] = useState<ResourcePackItem[]>([]);
  const [rpUpdates, setRpUpdates] = useState<Record<string, any>>({});
  const [isCheckingRpUpdates, setIsCheckingRpUpdates] = useState(false);
  const [shaderPacks, setShaderPacks] = useState<ResourcePackItem[]>([]);
  const [activeWorldForDatapacks, setActiveWorldForDatapacks] = useState<WorldItem | null>(null);
  const [datapacks, setDatapacks] = useState<ResourcePackItem[]>([]);
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [isCheckingModpackUpdate, setIsCheckingModpackUpdate] = useState(false);
  const [latestModpackVersion, setLatestModpackVersion] = useState<any>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [activeScreenshotIndex, setActiveScreenshotIndex] = useState(0);
  const prevActiveRef = useRef(activeScreenshotIndex);
  const [isScreenshotZoomed, setIsScreenshotZoomed] = useState(false);

  useEffect(() => {
    prevActiveRef.current = activeScreenshotIndex;
  }, [activeScreenshotIndex]);

  useEffect(() => {
    setIsScreenshotZoomed(false);
  }, [activeScreenshotIndex]);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmDeleteWorldOpen, setIsConfirmDeleteWorldOpen] = useState(false);
  const [targetDeleteWorld, setTargetDeleteWorld] = useState<string | null>(null);
  const [isConfirmKillGameOpen, setIsConfirmKillGameOpen] = useState(false);

  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    type: 'mod' | 'resourcepack' | 'shaderpack' | 'datapack' | 'server' | 'modpack_update' | 'screenshot';
    fileName?: string;
    serverIndex?: number;
    serverName?: string;
  } | null>(null);

  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerItem | null>(null);
  const [editingServerIndex, setEditingServerIndex] = useState<number | null>(null);

  const [isModrinthModalOpen, setIsModrinthModalOpen] = useState(false);
  const [modrinthModalType, setModrinthModalType] = useState<'mod' | 'resourcepack' | 'shader' | 'datapack'>('mod');
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [isJavaSelectorOpen, setIsJavaSelectorOpen] = useState(false);
  const [activeModForVersionChange, setActiveModForVersionChange] = useState<ModItem | null>(null);
  const [isModVersionModalOpen, setIsModVersionModalOpen] = useState(false);

  const logConsoleRef = useRef<HTMLDivElement>(null);
  const lastLoadIdRef = useRef(0);

  // 取得應用程式基礎路徑
  useEffect(() => {
    invoke<string>('init_app_dirs').then(setBaseDir).catch(console.error);
  }, []);

  // 當實例變更時同步設定
  const instanceId_dep   = instance?.id;
  const instanceName_dep = instance?.name;
  const instanceJvm_dep  = instance?.jvmArgs;
  const instanceMem_dep  = instance?.maxMemory;
  const instanceJava_dep = instance?.javaPath;
  useEffect(() => {
    if (instance) {
      setEditedName(instance.name || '');
      setJvmArgs(instance.jvmArgs || '');
      setMaxMemory(instance.maxMemory || 4096);
      setCustomJava(instance.javaPath || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId_dep, instanceName_dep, instanceJvm_dep, instanceMem_dep, instanceJava_dep]);



  // 監聽本機檔案變動以自動重新載入
  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | undefined;

    const setupWatcher = async () => {
      // 開始監聽
      await watchInstanceFolders(instanceId);
      if (!active) return;

      // 監聽事件變更
      const unlisten = await listen<{ folder: string; instanceId: string }>('folder-change', async (event) => {
        if (event.payload.instanceId !== instanceId) return;
        
        console.log(`Received folder change event: ${event.payload.folder}`);
        const loadId = ++lastLoadIdRef.current;
        
        if (event.payload.folder === 'mods') {
          try {
            const list = await invoke<ModItem[]>('get_installed_mods', { instanceId });
            if (loadId === lastLoadIdRef.current) {
              setMods(list);
              setModsUpdates({});
            }
          } catch (err) {
            console.error('Failed to reload mods:', err);
          }
        } else if (event.payload.folder === 'saves') {
          try {
            const list = await invoke<WorldItem[]>('get_installed_worlds', { instanceId });
            if (loadId === lastLoadIdRef.current) {
              setWorlds(list);
            }
          } catch (err) {
            console.error('Failed to reload worlds:', err);
          }
        } else if (event.payload.folder === 'screenshots') {
          loadScreenshots(loadId);
        } else if (event.payload.folder === 'datapacks') {
          if (activeWorldForDatapacks) {
            refreshDatapacks(activeWorldForDatapacks.folderName);
          }
        }
      });

      if (!active) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    };

    setupWatcher();

    return () => {
      active = false;
      unwatchInstanceFolders();
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [instanceId, activeWorldForDatapacks]);

  // 載入當前分頁資料
  useEffect(() => {
    if (!instance) return;
    loadTabData();
  }, [activeTab, instanceId]);

  // 分頁變更時觸發動畫
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // 自動滾動日誌
  useEffect(() => {
    if (logConsoleRef.current) {
      logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
    }
  }, [logs, activeTab]);



  useEffect(() => {
    if (activeWorldForDatapacks) {
      refreshDatapacks(activeWorldForDatapacks.folderName);
    } else {
      setDatapacks([]);
    }
  }, [activeWorldForDatapacks]);

  if (!instance) {
    return <div className={styles.notFound}>{t('detail.not_found')}</div>;
  }

  const instState = instanceStates[instance.id] || getInitialInstanceState();
  const isDownloading = instState.isDownloading;
  const isLaunching = instState.isLaunching;
  const isRunning = instState.isRunning;
  const isCrashed = instState.isCrashed;
  const downloadProgress = instState.downloadProgress;
  const downloadStatusText = instState.downloadStatusText;
  const launchPhase = instState.launchPhase;

  const loadScreenshots = async (loadId?: number) => {
    setLoadingScreenshots(true);
    try {
      const list = await invoke<string[]>('get_screenshots', { instanceId });
      if (loadId === undefined || loadId === lastLoadIdRef.current) {
        setScreenshots(list);
        setActiveScreenshotIndex(0);
      }
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    } finally {
      if (loadId === undefined || loadId === lastLoadIdRef.current) {
        setLoadingScreenshots(false);
      }
    }
  };

  const handleOpenActiveScreenshot = async () => {
    const activePath = screenshots[activeScreenshotIndex];
    if (!activePath) return;
    try {
      await invoke('open_in_browser', { url: activePath });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyActiveScreenshot = async () => {
    const activePath = screenshots[activeScreenshotIndex];
    if (!activePath) return;
    try {
      const response = await fetch(convertFileSrc(activePath));
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      addNotification({
        type: 'success',
        title: t('detail.notification.screenshot_copied.title'),
        message: t('detail.notification.screenshot_copied.msg')
      });
    } catch (err) {
      console.error('Failed to copy screenshot:', err);
      try {
        await navigator.clipboard.writeText(activePath);
        addNotification({
          type: 'info',
          title: t('detail.notification.path_copied.title'),
          message: t('detail.notification.path_copied.msg')
        });
      } catch (e) {
        addNotification({ type: 'error', title: t('detail.notification.copy_failed'), message: String(e) });
      }
    }
  };

  const handleDeleteActiveScreenshotClick = () => {
    const activePath = screenshots[activeScreenshotIndex];
    if (!activePath) return;
    const fileName = activePath.substring(Math.max(activePath.lastIndexOf('/'), activePath.lastIndexOf('\\')) + 1);
    setConfirmDeleteTarget({ type: 'screenshot', fileName });
  };

  const refreshDatapacks = async (worldFolder: string) => {
    if (!instance) return;
    setLoadingList(true);
    try {
      const list = await invoke<ResourcePackItem[]>('get_installed_datapacks', {
        instanceId: instance.id,
        worldFolder
      });
      setDatapacks(list);
    } catch (err) {
      console.error('Failed to load datapacks:', err);
    } finally {
      setLoadingList(false);
    }
  };



  const loadTabData = async () => {
    if (!instance) return;
    const loadId = ++lastLoadIdRef.current;
    setLoadingList(true);
    try {
      if (activeTab === 'log') {
        const isCurrentlyActive = isLaunching || isRunning;
        if (!isCurrentlyActive) {
          const history = await invoke<string>('read_latest_log', { instanceId });
          if (loadId === lastLoadIdRef.current) {
            setLogs(instanceId, history ? history.split('\n') : []);
          }
        }
      } else if (activeTab === 'edit') {
        loadScreenshots(loadId);
      } else if (activeTab === 'mods') {
        const list = await invoke<ModItem[]>('get_installed_mods', { instanceId });
        if (loadId === lastLoadIdRef.current) {
          setMods(list);
          setModsUpdates({});
        }
      } else if (activeTab === 'resourcepacks') {
        const list = await invoke<ResourcePackItem[]>('get_installed_resourcepacks', { instanceId });
        if (loadId === lastLoadIdRef.current) {
          setResourcePacks(list);
          setRpUpdates({});
        }
      } else if (activeTab === 'shaderpacks') {
        const list = await invoke<ResourcePackItem[]>('get_installed_shaderpacks', { instanceId });
        if (loadId === lastLoadIdRef.current) setShaderPacks(list);
      } else if (activeTab === 'worlds') {
        const list = await invoke<WorldItem[]>('get_installed_worlds', { instanceId });
        if (loadId === lastLoadIdRef.current) setWorlds(list);
      } else if (activeTab === 'servers') {
        const list = await invoke<ServerItem[]>('get_servers', { instanceId });
        if (loadId === lastLoadIdRef.current) setServers(list);
      } else if (activeTab === 'modpack_update' && instance.modrinthProjectId) {
        setIsCheckingModpackUpdate(true);
        const res = await fetch(`https://api.modrinth.com/v2/project/${instance.modrinthProjectId}/version`, {
          headers: {
            'User-Agent': 'focal-craft-launcher'
          }
        });
        if (res.ok) {
          const versions = await res.json();
          // Filter versions supporting current game version
          const valid = versions.filter((v: any) =>
            v.game_versions.includes(instance.version) &&
            v.files.some((f: any) => f.filename.endsWith('.mrpack'))
          );
          if (loadId === lastLoadIdRef.current && valid.length > 0) {
            setLatestModpackVersion(valid[0]);
          }
        }
        if (loadId === lastLoadIdRef.current) setIsCheckingModpackUpdate(false);
      }
    } catch (err) {
      console.error('Failed to load tab data:', err);
    } finally {
      if (loadId === lastLoadIdRef.current) {
        setLoadingList(false);
      }
    }
  };

  // 啟動遊戲
  const handlePlay = async () => {
    if (isLaunching || isRunning) return;

    if (!selectedAccountId) {
      addNotification({
        type: 'warning',
        title: t('detail.notification.cannot_launch.title'),
        message: t('detail.notification.cannot_launch.login_first')
      });
      return;
    }

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount) {
      addNotification({
        type: 'error',
        title: t('detail.notification.cannot_launch.title'),
        message: t('detail.notification.cannot_launch.account_missing')
      });
      return;
    }

    addNotification({
      type: 'info',
      title: t('detail.btn.launching'),
      message: t('detail.notification.preparing_launch', { name: instance.name })
    });

    const accountJson = JSON.stringify({
      id: selectedAccount.id,
      mcId: selectedAccount.mcId,
      mcAccessToken: selectedAccount.mcAccessToken
    });

    // 執行啟動程序
    const launchPromise = launchInstance(instance.id, accountJson);

    // 切換至日誌分頁並清除舊日誌
    setActiveTab('log');
    clearLogs(instance.id);

    try {
      await launchPromise;
    } catch (error: any) {
      // Error is handled in store
    }
  };

  // 開啟資料夾
  const handleOpenFolder = async (folderType?: string) => {
    try {
      const instsDir = settingsConfig.instancesPath || `${baseDir}/instances`;
      let targetPath = `${instsDir}/${instance.id}`;
      if (folderType) {
        targetPath = `${targetPath}/minecraft/${folderType}`;
      }
      await invoke('open_in_browser', { url: targetPath });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('detail.notification.cannot_open_folder'),
        message: String(error)
      });
    }
  };

  // 編輯實例名稱
  const handleSaveName = async () => {
    setIsEditingName(false);
    if (!editedName.trim() || editedName === instance.name) return;
    try {
      await updateInstanceConfig(
        instance.id,
        editedName.trim(),
        instance.version,
        instance.modloader,
        instance.loaderVersion,
        instance.modrinthProjectId || undefined,
        instance.modrinthVersionId || undefined
      );
      addNotification({
        type: 'success',
        title: t('overview.notification.rename.title'),
        message: t('overview.notification.rename.msg', { name: editedName.trim() })
      });
    } catch (err: any) {
      addNotification({ type: 'error', title: t('overview.notification.rename_failed.title'), message: String(err) });
      setEditedName(instance.name);
    }
  };

  // 設定實例圖示
  const handleIconClick = () => {
    setIsIconModalOpen(true);
  };

  const handleSelectLocalIcon = async () => {
    try {
      const path = await invoke<string>('select_single_file', {
        title: t('detail.select.instance_icon'),
        filter: `${t('detail.select.icon_filter')} (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp`
      });
      if (path === 'CANCELLED') return;
      await invoke('update_instance_icon', { id: instance.id, filePath: path });
      await loadInstances();
      addNotification({ type: 'success', title: t('detail.notification.icon_updated.title'), message: t('detail.notification.icon_updated.local_msg') });
      setIsIconModalOpen(false);
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.icon_updated.failed'), message: String(err) });
    }
  };

  const handleSelectUrlIcon = async (url: string) => {
    try {
      await invoke('update_instance_icon_url', { id: instance.id, url });
      await loadInstances();
      addNotification({ type: 'success', title: t('detail.notification.icon_updated.title'), message: t('detail.notification.icon_updated.url_msg') });
      setIsIconModalOpen(false);
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.icon_updated.failed'), message: String(err) });
    }
  };

  const handleSelectEmojiIcon = async (emoji: string) => {
    try {
      await invoke('update_instance_icon_value', { id: instance.id, value: emoji });
      await loadInstances();
      addNotification({ type: 'success', title: t('detail.notification.icon_updated.title'), message: t('detail.notification.icon_updated.emoji_msg') });
      setIsIconModalOpen(false);
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.icon_updated.failed'), message: String(err) });
    }
  };

  const handleClearIcon = async () => {
    try {
      await invoke('update_instance_icon_value', { id: instance.id, value: null });
      await loadInstances();
      addNotification({ type: 'success', title: t('detail.notification.icon_updated.title'), message: t('detail.notification.icon_reset.msg') });
      setIsIconModalOpen(false);
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.icon_updated.failed'), message: String(err) });
    }
  };

  const getIconSrc = () => {
    return getInstanceIconSrc(instance, baseDir, settingsConfig.instancesPath);
  };

  // 編輯版本與載入器
  const handleOpenEditVersion = () => {
    setIsEditingVersion(true);
  };

  const handleToggleMod = async (mod: ModItem, enabled: boolean) => {
    try {
      await invoke('toggle_mod', {
        instanceId: instance.id,
        fileName: mod.fileName,
        enabled
      });
      addNotification({
        type: 'success',
        title: enabled ? t('detail.notification.mod_toggle.enabled') : t('detail.notification.mod_toggle.disabled'),
        message: t('detail.notification.mod_toggle.msg', { name: mod.name })
      });
      // 重新整理模組列表
      const list = await invoke<ModItem[]>('get_installed_mods', { instanceId });
      setMods(list);
    } catch (err: any) {
      addNotification({ type: 'error', title: t('detail.notification.mod_toggle.failed'), message: String(err) });
    }
  };

  // 檢查模組更新
  const handleCheckModsUpdates = async () => {
    if (mods.length === 0) return;
    setIsCheckingModsUpdates(true);
    try {
      const hashes = mods.map(m => m.sha1).filter(h => h !== '');
      const res = await fetch('https://api.modrinth.com/v2/version_files/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'focal-craft-launcher' },
        body: JSON.stringify({
          hashes,
          algorithm: 'sha1',
          loaders: [instance.modloader.toLowerCase()],
          game_versions: [instance.version],
        })
      });
      if (res.ok) {
        const data = await res.json();
        const filteredData: Record<string, any> = {};
        const localHashesSet = new Set(hashes);
        
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          if (val && val.files) {
            const hasSameHash = val.files.some((f: any) => f.hashes?.sha1 && localHashesSet.has(f.hashes.sha1));
            if (!hasSameHash) {
              filteredData[key] = val;
            }
          }
        });

        setModsUpdates(filteredData);
        addNotification({
          type: 'success',
          title: t('detail.notification.mods_check.title'),
          message: t('detail.notification.mods_check.msg', { count: Object.keys(filteredData).length })
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingModsUpdates(false);
    }
  };

  const handleUpdateMod = async (mod: ModItem, updateObj: any) => {
    try {
      const file = updateObj.files.find((f: any) => f.primary) || updateObj.files[0];
      if (!file) return;

      addNotification({ type: 'info', title: t('detail.notification.mod_update.downloading', { name: '' }).split('...')[0], message: t('detail.notification.mod_update.downloading', { name: mod.name }) });

      await invoke('download_and_replace_file', {
        instanceId: instance.id,
        folderName: 'mods',
        downloadUrl: file.url,
        newFilename: file.filename,
        oldFilename: mod.fileName
      });

      addNotification({ type: 'success', title: t('detail.notification.mod_update.success', { name: '' }).split(' ')[1] || t('notification.success'), message: t('detail.notification.mod_update.success', { name: mod.name }) });
      loadTabData();
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.mod_update.failed'), message: String(err) });
    }
  };

  const handleDeleteMod = (fileName: string) => {
    setConfirmDeleteTarget({ type: 'mod', fileName });
  };

  const handleOpenModVersionModal = (mod: ModItem) => {
    setActiveModForVersionChange(mod);
    setIsModVersionModalOpen(true);
  };

  const handleImportMods = async () => {
    try {
      const paths = await invoke<string[]>('select_multiple_files', {
        title: t('detail.tab.mods'),
        filter: "Java Archive (*.jar)|*.jar"
      });
      if (paths && paths !== ('CANCELLED' as any)) {
        await invoke('import_files', { instanceId: instance.id, folderName: 'mods', filePaths: paths });
        loadTabData();
      }
    } catch (err) {
      if (err !== 'CANCELLED') console.error(err);
    }
  };

  // 檢查資源包更新
  const handleCheckRpUpdates = async () => {
    if (resourcePacks.length === 0) return;
    setIsCheckingRpUpdates(true);
    try {
      const hashes = resourcePacks.map(rp => rp.sha1).filter(h => h !== '');
      const res = await fetch('https://api.modrinth.com/v2/version_files/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'focal-craft-launcher' },
        body: JSON.stringify({
          hashes,
          algorithm: 'sha1',
          loaders: [],
          game_versions: [instance.version],
        })
      });
      if (res.ok) {
        const data = await res.json();
        const filteredData: Record<string, any> = {};
        const localHashesSet = new Set(hashes);
        
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          if (val && val.files) {
            const hasSameHash = val.files.some((f: any) => f.hashes?.sha1 && localHashesSet.has(f.hashes.sha1));
            if (!hasSameHash) {
              filteredData[key] = val;
            }
          }
        });

        setRpUpdates(filteredData);
        addNotification({
          type: 'success',
          title: t('detail.notification.rp_check.title'),
          message: t('detail.notification.rp_check.msg', { count: Object.keys(filteredData).length })
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingRpUpdates(false);
    }
  };

  const handleUpdateRp = async (rp: ResourcePackItem, updateObj: any) => {
    try {
      const file = updateObj.files.find((f: any) => f.primary) || updateObj.files[0];
      if (!file) return;

      addNotification({ type: 'info', title: t('detail.notification.rp_update.downloading', { name: '' }).split('...')[0], message: t('detail.notification.rp_update.downloading', { name: rp.name }) });

      await invoke('download_and_replace_file', {
        instanceId: instance.id,
        folderName: 'resourcepacks',
        downloadUrl: file.url,
        newFilename: file.filename,
        oldFilename: rp.fileName
      });

      addNotification({ type: 'success', title: t('detail.notification.rp_update.success', { name: '' }).split(' ')[1] || t('notification.success'), message: t('detail.notification.rp_update.success', { name: rp.name }) });
      loadTabData();
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.rp_update.failed'), message: String(err) });
    }
  };

  const handleDeleteRp = (fileName: string) => {
    setConfirmDeleteTarget({ type: 'resourcepack', fileName });
  };

  const handleDeleteSp = (fileName: string) => {
    setConfirmDeleteTarget({ type: 'shaderpack', fileName });
  };

  const handleImportSps = async () => {
    try {
      const paths = await invoke<string[]>('select_multiple_files', {
        title: t('detail.select.shaderpack'),
        filter: `${t('detail.select.shaderpack_filter')} (*.zip)|*.zip`
      });
      if (paths && paths !== ('CANCELLED' as any)) {
        await invoke('import_files', { instanceId: instance.id, folderName: 'shaderpacks', filePaths: paths });
        const list = await invoke<ResourcePackItem[]>('get_installed_shaderpacks', { instanceId });
        setShaderPacks(list);
      }
    } catch (err) {
      if (err !== 'CANCELLED') console.error(err);
    }
  };

  const handleImportRps = async () => {
    try {
      const paths = await invoke<string[]>('select_multiple_files', {
        title: t('detail.select.resourcepack'),
        filter: "Resource Pack Zip (*.zip)|*.zip"
      });
      if (paths && paths !== ('CANCELLED' as any)) {
        await invoke('import_files', { instanceId: instance.id, folderName: 'resourcepacks', filePaths: paths });
        loadTabData();
      }
    } catch (err) {
      if (err !== 'CANCELLED') console.error(err);
    }
  };

  // 世界存檔操作
  const handleImportWorld = async () => {
    try {
      const path = await invoke<string>('select_single_file', {
        title: t('detail.select.world_zip'),
        filter: "World Backup (*.zip)|*.zip"
      });
      if (path && path !== 'CANCELLED') {
        addNotification({ type: 'info', title: t('detail.notification.world_import.preparing'), message: t('detail.notification.world_import.preparing_msg') });
        await invoke('import_world_zip', { instanceId: instance.id, zipPath: path });
        addNotification({ type: 'success', title: t('detail.notification.world_import.success'), message: t('detail.notification.world_import.success_msg') });
        loadTabData();
      }
    } catch (err) {
      if (err !== 'CANCELLED') addNotification({ type: 'error', title: t('detail.notification.world_import.failed'), message: String(err) });
    }
  };

  const handleDeleteWorldClick = (folderName: string) => {
    setTargetDeleteWorld(folderName);
    setIsConfirmDeleteWorldOpen(true);
  };

  const handleConfirmDeleteWorld = async () => {
    if (!targetDeleteWorld) return;
    setIsConfirmDeleteWorldOpen(false);
    try {
      await invoke('delete_instance_file', {
        instanceId: instance.id,
        folderName: 'saves',
        fileName: targetDeleteWorld
      });
      addNotification({ type: 'success', title: t('detail.notification.world_delete.success'), message: t('detail.notification.world_delete.success_msg', { name: targetDeleteWorld }) });
      loadTabData();
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.world_delete.failed'), message: String(err) });
    } finally {
      setTargetDeleteWorld(null);
    }
  };

  const handleImportDatapacks = async () => {
    if (!activeWorldForDatapacks) return;
    try {
      const paths = await invoke<string[]>('select_multiple_files', {
        title: t('detail.select.datapack'),
        filter: `${t('detail.select.datapack_filter')} (*.zip)|*.zip`
      });
      if (paths && paths !== ('CANCELLED' as any)) {
        await invoke('import_files', {
          instanceId: instance.id,
          folderName: `saves/${activeWorldForDatapacks.folderName}/datapacks`,
          filePaths: paths
        });
        refreshDatapacks(activeWorldForDatapacks.folderName);
      }
    } catch (err) {
      if (err !== 'CANCELLED') console.error(err);
    }
  };

  const handleOpenDatapacksFolder = async () => {
    if (!activeWorldForDatapacks) return;
    try {
      const instsDir = settingsConfig.instancesPath || `${baseDir}/instances`;
      const targetPath = `${instsDir}/${instance.id}/minecraft/saves/${activeWorldForDatapacks.folderName}/datapacks`;
      await invoke('open_in_browser', { url: targetPath });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('detail.notification.cannot_open_folder'),
        message: String(error)
      });
    }
  };

  const handleDeleteDpClick = (fileName: string) => {
    setConfirmDeleteTarget({ type: 'datapack', fileName });
  };

  // 伺服器列表操作
  const handleOpenServerModal = (server: ServerItem | null, index: number | null) => {
    setEditingServer(server);
    setEditingServerIndex(index);
    setIsServerModalOpen(true);
  };

  const handleSaveServer = async (name: string, ip: string, acceptTextures: number) => {
    setIsServerModalOpen(false);
    try {
      const updatedServers = [...servers];
      if (editingServerIndex !== null) {
        // 編輯模式
        updatedServers[editingServerIndex] = { name, ip, acceptTextures };
      } else {
        // 新增模式
        updatedServers.push({ name, ip, acceptTextures });
      }

      await invoke('save_servers', { instanceId: instance.id, servers: updatedServers });
      loadTabData();
    } catch (err) {
      addNotification({ type: 'error', title: t('detail.notification.server_save.failed'), message: String(err) });
    }
  };

  const handleDeleteServer = (index: number) => {
    const srv = servers[index];
    setConfirmDeleteTarget({ type: 'server', serverIndex: index, serverName: srv ? srv.name : `Server #${index + 1}` });
  };

  // 詳細設定操作
  const handleSaveSettings = async () => {
    try {
      await updateInstanceSettings(instance.id, jvmArgs, maxMemory, customJava.trim() || undefined);
      addNotification({
        type: 'success',
        title: t('detail.notification.settings_save.success'),
        message: t('detail.notification.settings_save.success_msg', { name: instance.name })
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('detail.notification.settings_save.failed'),
        message: String(error)
      });
    }
  };

  // 瀏覽並選取此實例專用 Java 執行檔路徑
  const handleBrowseJavaPath = () => {
    setIsJavaSelectorOpen(true);
  };

  // 清除此實例的自訂 Java 路徑（回復使用全域設定）
  const handleClearJavaPath = () => {
    setCustomJava('');
  };

  const handleDeleteInstance = async () => {
    setIsConfirmDeleteOpen(false);
    try {
      await deleteInstance(instance.id);
      addNotification({
        type: 'success',
        title: t('detail.notification.instance_delete.success'),
        message: t('detail.notification.instance_delete.success_msg', { name: instance.name })
      });
      setCurrentView('instances_overview');
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('detail.notification.instance_delete.failed'),
        message: String(error)
      });
    }
  };

  // 整合包更新操作
  const handleUpdateModpackClick = () => {
    setConfirmDeleteTarget({ type: 'modpack_update' });
  };

  const executeModpackUpdate = async () => {
    if (!latestModpackVersion) return;
    try {
      addNotification({ type: 'info', title: t('detail.notification.modpack_update.preparing'), message: t('detail.notification.modpack_update.preparing_msg') });

      const file = latestModpackVersion.files.find((f: any) => f.filename.endsWith('.mrpack'));
      if (!file) throw new Error(t('detail.notification.modpack_update.missing_mrpack'));

      // 下載整合包檔案
      const localPath = await invoke<string>('download_mrpack', { url: file.url });

      // 清理舊模組
      await invoke('delete_instance_file', { instanceId: instance.id, folderName: '', fileName: 'minecraft/mods' });

      // 重新匯入 mrpack
      await invoke('import_mrpack', { instanceId: instance.id, filePath: localPath });

      // 更新整合包設定
      await updateInstanceConfig(
        instance.id,
        instance.name,
        instance.version,
        instance.modloader,
        instance.loaderVersion,
        instance.modrinthProjectId || undefined,
        latestModpackVersion.id
      );

      addNotification({ type: 'success', title: t('detail.notification.modpack_update.success'), message: t('detail.notification.modpack_update.success_msg') });
      setActiveTab('edit');
    } catch (err: any) {
      addNotification({ type: 'error', title: t('detail.notification.modpack_update.failed'), message: err.message || String(err) });
    }
  };

  const renderPlayButton = (position: 'center' | 'right') => {
    const isBtnDisabled = isLaunching || isRunning || isDownloading;

    const phaseText = isRunning
      ? t('detail.btn.running')
      : launchPhase === 'java_check'
        ? t('hud.java_check')
        : launchPhase === 'java_download'
          ? t('detail.status.downloading_java_percent', { progress: Math.round(downloadProgress) })
          : launchPhase === 'files' || isDownloading
            ? t('detail.status.preparing_files_percent', { progress: Math.round(downloadProgress) })
            : launchPhase === 'launching'
              ? t('detail.btn.launching')
              : t('detail.btn.play');

    const showProgress = (isLaunching || isDownloading) && !isRunning;

    return (
      <div className={`${styles.playBtnWrapper} ${position === 'right' ? styles.playBtnWrapperRight : styles.playBtnWrapperCenter}`}>
        {showProgress && (
          <div className={styles.launchProgressBar}>
            <div
              className={styles.launchProgressFill}
              style={{ width: `${Math.max(5, Math.round(downloadProgress))}%` }}
            />
          </div>
        )}
        <div className={styles.playBtnGroup}>
          {isRunning && (
            <button
              className={styles.terminateBtn}
              onClick={() => setIsConfirmKillGameOpen(true)}
            >
              <Square size={20} fill="white" />
              <span>{t('detail.btn.kill')}</span>
            </button>
          )}
          <button
            className={`${styles.playBtn} ${isBtnDisabled ? styles.playBtnActive : ''}`}
            onClick={handlePlay}
            disabled={isBtnDisabled}
          >
            {isBtnDisabled && !isRunning ? <Loader className="animate-spin" size={20} /> : <Play size={20} fill="white" />}
            <span>{phaseText}</span>
          </button>
        </div>
      </div>
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={styles.container}>
      <div className={styles.background}></div>

      <div className={styles.content}>
        {/* 主面板區塊 */}
        <div className={`${styles.mainPanel} ${isAnimating ? styles.animating : ''}`}>
          {/* 啟動進度遮罩 */}
          {(isLaunching || isDownloading) && (
            <div className={styles.hudOverlay}>
              <div className={styles.hudCard}>
                <div className={styles.hudHeader}>
                  <Loader className={`${styles.hudSpinner} animate-spin`} size={24} />
                  <span className={styles.hudTitle}>
                    {isDownloading ? t('detail.status.downloading') : t('detail.status.launching')}
                  </span>
                </div>
                <div className={styles.hudDetail}>
                  {(downloadStatusText ? translateBackendStatus(downloadStatusText, language) : '') || t('detail.status.initializing')}
                </div>
                <div className={styles.hudProgressContainer}>
                  <div className={styles.hudProgressBar}>
                    <div
                      className={styles.hudProgressFill}
                      style={{ width: `${Math.max(3, Math.min(100, downloadProgress))}%` }}
                    />
                  </div>
                  <span className={styles.hudPercent}>{Math.round(downloadProgress)}%</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'edit' && (
            <EditTab
              instance={instance}
              getIconSrc={getIconSrc}
              handleIconClick={handleIconClick}
              isEditingName={isEditingName}
              setIsEditingName={setIsEditingName}
              editedName={editedName}
              setEditedName={setEditedName}
              handleSaveName={handleSaveName}
              handleOpenEditVersion={handleOpenEditVersion}
              loadingScreenshots={loadingScreenshots}
              screenshots={screenshots}
              isScreenshotZoomed={isScreenshotZoomed}
              setIsScreenshotZoomed={setIsScreenshotZoomed}
              activeScreenshotIndex={activeScreenshotIndex}
              setActiveScreenshotIndex={setActiveScreenshotIndex}
              handleOpenActiveScreenshot={handleOpenActiveScreenshot}
              handleCopyActiveScreenshot={handleCopyActiveScreenshot}
              handleDeleteActiveScreenshotClick={handleDeleteActiveScreenshotClick}
              prevActiveRef={prevActiveRef}
              convertFileSrc={convertFileSrc}
            />
          )}

          {activeTab === 'log' && (
            <LogTab
              logs={logs}
              logConsoleRef={logConsoleRef}
              instanceId={instanceId}
              runningInstanceId={isRunning ? instanceId : null}
              crashedInstanceId={isCrashed ? instanceId : null}
              onClearLogs={() => clearLogs(instanceId)}
            />
          )}

          {activeTab === 'mods' && (
            <ModsTab
              mods={mods}
              modsUpdates={modsUpdates}
              isCheckingModsUpdates={isCheckingModsUpdates}
              loadingList={loadingList}
              handleImportMods={handleImportMods}
              setModrinthModalType={setModrinthModalType}
              setIsModrinthModalOpen={setIsModrinthModalOpen}
              handleCheckModsUpdates={handleCheckModsUpdates}
              handleOpenFolder={handleOpenFolder}
              handleToggleMod={handleToggleMod}
              handleUpdateMod={handleUpdateMod}
              handleDeleteMod={handleDeleteMod}
              onOpenModVersionModal={handleOpenModVersionModal}
            />
          )}

          {activeTab === 'resourcepacks' && (
            <ResourcePacksTab
              resourcePacks={resourcePacks}
              rpUpdates={rpUpdates}
              isCheckingRpUpdates={isCheckingRpUpdates}
              loadingList={loadingList}
              handleImportRps={handleImportRps}
              setModrinthModalType={setModrinthModalType}
              setIsModrinthModalOpen={setIsModrinthModalOpen}
              handleCheckRpUpdates={handleCheckRpUpdates}
              handleOpenFolder={handleOpenFolder}
              handleUpdateRp={handleUpdateRp}
              handleDeleteRp={handleDeleteRp}
            />
          )}

          {activeTab === 'shaderpacks' && (
            <ShaderPacksTab
              shaderPacks={shaderPacks}
              loadingList={loadingList}
              handleImportSps={handleImportSps}
              setModrinthModalType={setModrinthModalType}
              setIsModrinthModalOpen={setIsModrinthModalOpen}
              handleOpenFolder={handleOpenFolder}
              handleDeleteSp={handleDeleteSp}
            />
          )}

          {activeTab === 'worlds' && (
            <WorldsTab
              worlds={worlds}
              datapacks={datapacks}
              activeWorldForDatapacks={activeWorldForDatapacks}
              setActiveWorldForDatapacks={setActiveWorldForDatapacks}
              loadingList={loadingList}
              handleImportWorld={handleImportWorld}
              handleOpenFolder={handleOpenFolder}
              handleDeleteWorldClick={handleDeleteWorldClick}
              handleImportDatapacks={handleImportDatapacks}
              setModrinthModalType={setModrinthModalType}
              setIsModrinthModalOpen={setIsModrinthModalOpen}
              handleOpenDatapacksFolder={handleOpenDatapacksFolder}
              handleDeleteDpClick={handleDeleteDpClick}
              formatSize={formatSize}
            />
          )}

          {activeTab === 'servers' && (
            <ServersTab
              servers={servers}
              loadingList={loadingList}
              handleOpenServerModal={handleOpenServerModal}
              handleDeleteServer={handleDeleteServer}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              maxMemory={maxMemory}
              setMaxMemory={setMaxMemory}
              customJava={customJava}
              setCustomJava={setCustomJava}
              jvmArgs={jvmArgs}
              setJvmArgs={setJvmArgs}
              handleSaveSettings={handleSaveSettings}
              handleOpenFolder={handleOpenFolder}
              setIsConfirmDeleteOpen={setIsConfirmDeleteOpen}
              handleBrowseJavaPath={handleBrowseJavaPath}
              handleClearJavaPath={handleClearJavaPath}
            />
          )}

          {activeTab === 'modpack_update' && (
            <ModpackUpdateTab
              isCheckingModpackUpdate={isCheckingModpackUpdate}
              latestModpackVersion={latestModpackVersion}
              instance={instance}
              handleUpdateModpackClick={handleUpdateModpackClick}
            />
          )}
        </div>

        {/* 底部工具列 */}
        <div className={styles.bottomBar}>
          <div className={styles.bottomLeftActions}>
            {activeTab === 'edit' && (
              <button className={styles.actionBtn} onClick={() => handleOpenFolder()}>
                <FolderOpen size={16} />
                <span>{t('detail.btn.open_folder')}</span>
              </button>
            )}
          </div>
          <div className={styles.bottomRightActions}>
            {renderPlayButton('right')}
          </div>
        </div>

      </div>

      {/* 確認與選擇彈窗 */}
      <CustomConfirmModal
        isOpen={isConfirmDeleteOpen}
        title={t('detail.modal.delete_instance.title')}
        message={t('detail.modal.delete_instance.msg', { name: instance.name })}
        onConfirm={handleDeleteInstance}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />

      <CustomConfirmModal
        isOpen={isConfirmDeleteWorldOpen}
        title={t('tabs.worlds.delete.title')}
        message={t('tabs.worlds.delete.confirm', { name: targetDeleteWorld || '' })}
        onConfirm={handleConfirmDeleteWorld}
        onCancel={() => { setIsConfirmDeleteWorldOpen(false); setTargetDeleteWorld(null); }}
      />

      <CustomConfirmModal
        isOpen={isConfirmKillGameOpen}
        title={t('detail.modal.kill_game.title')}
        message={t('detail.modal.kill_game.msg')}
        onConfirm={() => {
          killGame(instance.id);
          setIsConfirmKillGameOpen(false);
        }}
        onCancel={() => setIsConfirmKillGameOpen(false)}
      />

      <ServerEditModal
        isOpen={isServerModalOpen}
        server={editingServer}
        onSave={handleSaveServer}
        onCancel={() => setIsServerModalOpen(false)}
      />

      <ModrinthDownloadModal
        isOpen={isModrinthModalOpen}
        instanceId={instance.id}
        projectType={modrinthModalType}
        gameVersion={instance.version}
        loader={instance.modloader}
        datapackWorldFolder={activeWorldForDatapacks?.folderName}
        onDownloadComplete={() => {
          if (modrinthModalType === 'datapack' && activeWorldForDatapacks) {
            refreshDatapacks(activeWorldForDatapacks.folderName);
          } else if (modrinthModalType === 'shader') {
            invoke<ResourcePackItem[]>('get_installed_shaderpacks', { instanceId }).then(setShaderPacks).catch(console.error);
          } else {
            loadTabData();
          }
          addNotification({ type: 'success', title: t('detail.notification.download_complete.title'), message: t('detail.notification.download_complete.msg') });
        }}
        onClose={() => setIsModrinthModalOpen(false)}
      />

      {confirmDeleteTarget && (
        <CustomConfirmModal
          isOpen={!!confirmDeleteTarget}
          title={
            confirmDeleteTarget.type === 'mod' ? t('detail.modal.delete_mod.title') :
            confirmDeleteTarget.type === 'resourcepack' ? t('detail.modal.delete_rp.title') :
            confirmDeleteTarget.type === 'shaderpack' ? t('detail.modal.delete_sp.title') :
            confirmDeleteTarget.type === 'datapack' ? t('detail.modal.delete_dp.title') :
            confirmDeleteTarget.type === 'server' ? t('detail.modal.delete_server.title') :
            confirmDeleteTarget.type === 'screenshot' ? t('detail.modal.delete_screenshot.title') :
            t('detail.modal.update_modpack.title')
          }
          message={
            confirmDeleteTarget.type === 'mod' ? t('detail.modal.delete_mod.msg', { name: confirmDeleteTarget.fileName || '' }) :
            confirmDeleteTarget.type === 'resourcepack' ? t('detail.modal.delete_rp.msg', { name: confirmDeleteTarget.fileName || '' }) :
            confirmDeleteTarget.type === 'shaderpack' ? t('detail.modal.delete_sp.msg', { name: confirmDeleteTarget.fileName || '' }) :
            confirmDeleteTarget.type === 'datapack' ? t('detail.modal.delete_dp.msg', { name: confirmDeleteTarget.fileName || '' }) :
            confirmDeleteTarget.type === 'server' ? t('detail.modal.delete_server.msg', { name: confirmDeleteTarget.serverName || '' }) :
            confirmDeleteTarget.type === 'screenshot' ? t('detail.modal.delete_screenshot.msg', { name: confirmDeleteTarget.fileName || '' }) :
            t('detail.modal.update_modpack.msg', { version: latestModpackVersion?.version_number || '' })
          }
          onConfirm={async () => {
            const target = confirmDeleteTarget;
            setConfirmDeleteTarget(null);
            
            if (target.type === 'mod' && target.fileName) {
              try {
                await invoke('delete_instance_file', { instanceId: instance.id, folderName: 'mods', fileName: target.fileName });
                loadTabData();
              } catch (err) {
                addNotification({ type: 'error', title: t('detail.notification.delete_mod.failed'), message: String(err) });
              }
            } else if (target.type === 'resourcepack' && target.fileName) {
              try {
                await invoke('delete_instance_file', { instanceId: instance.id, folderName: 'resourcepacks', fileName: target.fileName });
                loadTabData();
              } catch (err) {
                addNotification({ type: 'error', title: t('detail.notification.delete_rp.failed'), message: String(err) });
              }
            } else if (target.type === 'shaderpack' && target.fileName) {
              try {
                await invoke('delete_instance_file', { instanceId: instance.id, folderName: 'shaderpacks', fileName: target.fileName });
                const list = await invoke<ResourcePackItem[]>('get_installed_shaderpacks', { instanceId });
                setShaderPacks(list);
              } catch (err) {
                addNotification({ type: 'error', title: t('detail.notification.delete_sp.failed'), message: String(err) });
              }
            } else if (target.type === 'datapack' && target.fileName && activeWorldForDatapacks) {
              try {
                await invoke('delete_instance_file', {
                  instanceId: instance.id,
                  folderName: `saves/${activeWorldForDatapacks.folderName}/datapacks`,
                  fileName: target.fileName
                });
                refreshDatapacks(activeWorldForDatapacks.folderName);
              } catch (err) {
                addNotification({ type: 'error', title: t('detail.notification.delete_dp.failed'), message: String(err) });
              }
            } else if (target.type === 'server' && target.serverIndex !== undefined) {
              try {
                const updatedServers = servers.filter((_, i) => i !== target.serverIndex);
                await invoke('save_servers', { instanceId: instance.id, servers: updatedServers });
                loadTabData();
              } catch (err) {
                addNotification({ type: 'error', title: t('detail.notification.delete_server.failed'), message: String(err) });
              }
            } else if (target.type === 'screenshot' && target.fileName) {
              try {
                await invoke('delete_instance_file', { instanceId: instance.id, folderName: 'screenshots', fileName: target.fileName });
                loadScreenshots();
              } catch (err) {
                addNotification({ type: 'error', title: t('detail.notification.delete_screenshot.failed'), message: String(err) });
              }
            } else if (target.type === 'modpack_update') {
              executeModpackUpdate();
            }
          }}
          onCancel={() => setConfirmDeleteTarget(null)}
        />
      )}

      <IconEditModal
        isOpen={isIconModalOpen}
        currentIcon={instance.icon || null}
        onSelectLocal={handleSelectLocalIcon}
        onSelectUrl={handleSelectUrlIcon}
        onSelectEmoji={handleSelectEmojiIcon}
        onClear={handleClearIcon}
        onCancel={() => setIsIconModalOpen(false)}
      />

      {/* 版本編輯彈窗 */}
      <VersionEditModal
        isOpen={isEditingVersion}
        onClose={() => setIsEditingVersion(false)}
        instance={instance}
        onSaveComplete={async () => {
          setIsEditingVersion(false);
          await loadInstances();
        }}
      />

      <JavaSelectorModal
        isOpen={isJavaSelectorOpen}
        onClose={() => setIsJavaSelectorOpen(false)}
        onSelect={(path) => setCustomJava(path)}
        currentPath={customJava}
      />

      <ModVersionModal
        isOpen={isModVersionModalOpen}
        onClose={() => {
          setIsModVersionModalOpen(false);
          setActiveModForVersionChange(null);
        }}
        mod={activeModForVersionChange}
        mcVersion={instance.version}
        loader={instance.modloader}
        instanceId={instance.id}
        onUpdateComplete={loadTabData}
      />

    </div>
  );
}
