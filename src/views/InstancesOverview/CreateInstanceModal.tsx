import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useInstanceStore } from '../../store/instanceStore';
import { useAppStore } from '../../store/appStore';
import { CustomTab } from './tabs/CustomTab';
import { ModrinthTab } from './tabs/ModrinthTab';
import { ImportMrpackTab } from './tabs/ImportMrpackTab';
import styles from './CreateInstanceModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ModInfo {
  name: string;
  author: string;
  license: string;
  size: number;
}

interface ModpackInfo {
  name: string;
  versionId: string;
  gameVersion: string;
  modloader: string;
  modloaderVersion: string;
  mods: ModInfo[];
}

import { getMajorVersionGroup } from '../../utils/versionUtils';


export function CreateInstanceModal({ isOpen, onClose }: Props) {
  const { createInstance, importMrpack, downloadingInstanceId, downloadProgress, downloadStatusText, instances } = useInstanceStore();
  const { addNotification, setCurrentView: setAppView } = useAppStore();

  const [activeTab, setActiveTab] = useState<'custom' | 'modrinth' | 'mrpack'>('custom');
  const [platform, setPlatform] = useState<'modrinth' | 'curseforge'>('modrinth');
  const [isManualImportMode, setIsManualImportMode] = useState(false);
  const [blockedModsList, setBlockedModsList] = useState<any[]>([]);
  const [detectedImportFiles, setDetectedImportFiles] = useState<Record<string, string>>({});
  const [importedImportItems, setImportedImportItems] = useState<Set<string>>(new Set());

  // Reset when platform changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedModpack(null);
    setModpackDetails(null);
    setDownloadedMrpackPath('');
    setModpackVersions([]);
    setSelectedModpackVersionId('');
    setIsModpackConfirmed(false);
    setModpackBody('');
    setHasMoreModpacks(true);
    setIsLoadingMore(false);
    setIsSelectingMods(false);
    setSelectedMods(new Set());
  }, [platform]);

  // Background Downloads scanner for blocked files
  useEffect(() => {
    if (!isManualImportMode || blockedModsList.length === 0) return;

    const hashes = blockedModsList
      .map(item => item.sha1)
      .filter((h): h is string => typeof h === 'string' && h.trim().length > 0);

    if (hashes.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const matches = await invoke<Record<string, string>>('scan_downloads_for_hashes', { hashes });
        setDetectedImportFiles(matches);
      } catch (err) {
        console.error('Failed to scan downloads folder:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isManualImportMode, blockedModsList]);

  // Custom tab states
  const [customName, setCustomName] = useState('');
  const [customVersion, setCustomVersion] = useState('1.20.4');
  const [selectedMajorVersion, setSelectedMajorVersion] = useState<string>('');
  const [customModloader, setCustomModloader] = useState<string>('Vanilla');
  const [isDragOverCustom, setIsDragOverCustom] = useState(false);
  const [customLoaderJarPath, setCustomLoaderJarPath] = useState('');
  const [customLoaderJarName, setCustomLoaderJarName] = useState('');
  const [versions, setVersions] = useState<{ id: string; type: string }[]>([]);
  const [majorFilter, setMajorFilter] = useState<'release' | 'history'>('release');
  const [minorFilter, setMinorFilter] = useState<'release' | 'snapshot'>('release');
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [errorLoadingVersions, setErrorLoadingVersions] = useState(false);
  
  // Fabric Loader states
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>('');
  const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false);

  // Modrinth tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModpack, setSelectedModpack] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [modpackDetails, setModpackDetails] = useState<ModpackInfo | null>(null);
  const [downloadedMrpackPath, setDownloadedMrpackPath] = useState<string>('');
  const [modpackVersions, setModpackVersions] = useState<any[]>([]);
  const [selectedModpackVersionId, setSelectedModpackVersionId] = useState<string>('');
  const [isModpackConfirmed, setIsModpackConfirmed] = useState(false);
  const [modpackBody, setModpackBody] = useState('');
  const [hasMoreModpacks, setHasMoreModpacks] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isSelectingMods, setIsSelectingMods] = useState(false);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());

  // Mrpack tab states
  const [mrpackPath, setMrpackPath] = useState('');
  const [mrpackDetails, setMrpackDetails] = useState<ModpackInfo | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Native Tauri Window Drag & Drop Listener
  useEffect(() => {
    if (!isOpen) {
      setIsDragOver(false);
      setIsDragOverCustom(false);
      return;
    }

    let unlistenPromise: Promise<() => void> | undefined;

    try {
      const appWindow = getCurrentWindow();
      unlistenPromise = appWindow.onDragDropEvent((event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          if (activeTab === 'mrpack' && !mrpackPath) {
            setIsDragOver(true);
          } else if (activeTab === 'custom' && customModloader === 'Custom') {
            setIsDragOverCustom(true);
          }
        } else if (event.payload.type === 'drop') {
          setIsDragOver(false);
          setIsDragOverCustom(false);
          if (event.payload.paths && event.payload.paths.length > 0) {
            const droppedPath = event.payload.paths[0];
            if (activeTab === 'mrpack') {
              handleMrpackFileDropped(droppedPath);
            } else if (activeTab === 'custom' && customModloader === 'Custom') {
              handleCustomLoaderDropped(droppedPath);
            }
          }
        } else if (event.payload.type === 'leave') {
          setIsDragOver(false);
          setIsDragOverCustom(false);
        }
      });
    } catch (err) {
      console.error('Failed to register native drag drop:', err);
    }

    return () => {
      if (unlistenPromise) {
        unlistenPromise.then(unlisten => unlisten());
      }
    };
  }, [isOpen, activeTab, mrpackPath, customModloader]);

  // Set default selection of all mods when modpack details are loaded
  useEffect(() => {
    if (modpackDetails && modpackDetails.mods) {
      setSelectedMods(new Set(modpackDetails.mods.map((m) => m.name)));
    } else {
      setSelectedMods(new Set());
    }
  }, [modpackDetails]);

  // Set default selection of all mods when mrpack details are loaded
  useEffect(() => {
    if (mrpackDetails && mrpackDetails.mods) {
      setSelectedMods(new Set(mrpackDetails.mods.map((m) => m.name)));
    } else {
      setSelectedMods(new Set());
    }
  }, [mrpackDetails]);

  // General loading
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Target instance ID being imported
  const [targetImportId, setTargetImportId] = useState<string | null>(null);

  const loadVersions = async () => {
    setLoadingVersions(true);
    setErrorLoadingVersions(false);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 4000)
    );

    try {
      const manifest = await Promise.race([
        invoke<any>('get_minecraft_versions'),
        timeoutPromise
      ]);

      const fetchedVersions = manifest.versions || [];
      setVersions(fetchedVersions);
      if (manifest.latest && manifest.latest.release) {
        const latestRelease = manifest.latest.release;
        setCustomVersion(latestRelease);
        setSelectedMajorVersion(getMajorVersionGroup(latestRelease));
      } else if (fetchedVersions.length > 0) {
        const defaultVer = fetchedVersions[0].id;
        setCustomVersion(defaultVer);
        setSelectedMajorVersion(getMajorVersionGroup(defaultVer));
      }
    } catch (err: any) {
      console.error('Failed to load MC versions, using fallback:', err);
      setErrorLoadingVersions(true);

      const FALLBACK_VERSIONS = [
        { id: '1.20.4', type: 'release' },
        { id: '1.20.1', type: 'release' },
        { id: '1.19.2', type: 'release' },
        { id: '1.16.5', type: 'release' },
        { id: '1.21', type: 'release' },
        { id: '1.20.6', type: 'release' },
        { id: '1.19.4', type: 'release' },
        { id: '1.18.2', type: 'release' },
        { id: '1.12.2', type: 'release' },
        { id: '1.8.9', type: 'release' }
      ];
      setVersions(FALLBACK_VERSIONS);
      setCustomVersion('1.20.4');
      setSelectedMajorVersion('1.20.X');

      addNotification({
        type: 'warning',
        title: '連線逾時',
        message: '無法取得最新 Minecraft 版本資訊，已載入備用版本清單。'
      });
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen]);

  const LIMIT = 20;

  const searchModpacks = async (queryStr: string, offset: number, append: boolean) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setSelectedModpack(null);
      setModpackDetails(null);
      setModpackVersions([]);
      setSelectedModpackVersionId('');
      setIsModpackConfirmed(false);
      setModpackBody('');
    }

    try {
      let hits: any[] = [];
      let totalHits = 0;

      if (platform === 'modrinth') {
        const res = await invoke<any>('search_modrinth_modpacks', {
          query: queryStr,
          offset,
          limit: LIMIT
        });
        hits = res.hits || [];
        totalHits = res.total_hits || 0;
      } else {
        const res = await invoke<any>('search_curseforge', {
          query: queryStr,
          classId: 4471,
          gameVersion: '',
          searchIndex: offset,
          pageSize: LIMIT
        });
        hits = (res.data || []).map((item: any) => ({
          project_id: item.id.toString(),
          title: item.name,
          description: item.summary || '',
          icon_url: item.logo?.url || '',
          raw: item
        }));
        totalHits = res.pagination?.totalCount || 0;
      }

      if (append) {
        setSearchResults(prev => [...prev, ...hits]);
      } else {
        setSearchResults(hits);
      }

      const currentCount = offset + hits.length;
      setHasMoreModpacks(currentCount < totalHits && hits.length > 0);
    } catch (error: any) {
      console.error('Search failed:', error);
      addNotification({
        type: 'error',
        title: '搜尋失敗',
        message: String(error)
      });
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsSearching(false);
      }
    }
  };

  const loadMoreModpacks = async () => {
    if (isLoadingMore || isSearching || !hasMoreModpacks) return;
    const currentOffset = searchResults.length;
    await searchModpacks(searchQuery, currentOffset, true);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 20) {
      if (hasMoreModpacks && !isSearching && !isLoadingMore) {
        loadMoreModpacks();
      }
    }
  };

  // Real-time Modrinth search with debounce and default list loading
  useEffect(() => {
    if (activeTab !== 'modrinth' || !isOpen) return;

    const query = searchQuery;
    if (!query.trim()) {
      searchModpacks('', 0, false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      searchModpacks(query, 0, false);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab, isOpen, platform]);

  // Fetch loader versions when Minecraft version or Modloader changes
  useEffect(() => {
    const isSupportedLoader = customModloader === 'Fabric' || customModloader === 'Forge' || customModloader === 'NeoForge';
    if (isSupportedLoader && customVersion && isOpen) {
      setLoadingLoaderVersions(true);
      invoke<string[]>('get_loader_versions', { modloader: customModloader, gameVersion: customVersion })
        .then((versionsList) => {
          setLoaderVersions(versionsList);
          if (versionsList.length > 0) {
            setSelectedLoaderVersion(versionsList[0]);
          } else {
            setSelectedLoaderVersion('');
          }
        })
        .catch((err) => {
          console.error(`Error fetching loader versions for ${customModloader}:`, err);
          setLoaderVersions([]);
          setSelectedLoaderVersion('');
        })
        .finally(() => {
          setLoadingLoaderVersions(false);
        });
    } else {
      setLoaderVersions([]);
      setSelectedLoaderVersion('');
    }
  }, [customVersion, customModloader, isOpen]);

  const isImporting = downloadingInstanceId !== null && targetImportId === downloadingInstanceId;

  const generateUniqueId = (name: string, instancesList: any[]) => {
    let baseId = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (!baseId) baseId = 'instance';
    
    let id = baseId;
    let counter = 1;
    while (instancesList.some(i => i && i.id === id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }
    return id;
  };

  const handleCustomLoaderDropped = (path: string) => {
    if (!path.toLowerCase().endsWith('.jar')) {
      addNotification({
        type: 'warning',
        title: '格式不符',
        message: '僅支援 .jar 格式的自訂載入器檔案。'
      });
      return;
    }
    const name = path.substring(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
    setCustomLoaderJarPath(path);
    setCustomLoaderJarName(name);
  };

  const handleSelectCustomLoaderJar = async () => {
    try {
      const path = await invoke<string>('select_single_file', {
        title: "選擇自訂 ModLoader JAR 檔案",
        filter: "Java Archive (*.jar)|*.jar"
      });
      if (path === 'CANCELLED') return;
      handleCustomLoaderDropped(path);
    } catch (err) {
      addNotification({ type: 'error', title: '選取檔案失敗', message: String(err) });
    }
  };

  // Custom Creation Handler
  const handleCustomCreate = async () => {
    if (!customName.trim()) {
      addNotification({
        type: 'warning',
        title: '輸入錯誤',
        message: '請輸入實例名稱'
      });
      return;
    }

    if (customModloader === 'Custom' && !customLoaderJarPath) {
      addNotification({
        type: 'warning',
        title: '自訂載入器缺失',
        message: '請先拖放或點選選擇自訂 Loader JAR 檔案。'
      });
      return;
    }

    setIsActionLoading(true);
    try {
      const id = generateUniqueId(customName, instances);
      await createInstance(
        id, 
        customName, 
        customVersion, 
        customModloader, 
        customModloader !== 'Vanilla' && customModloader !== 'Custom' ? selectedLoaderVersion : undefined
      );

      if (customModloader === 'Custom') {
        await invoke('upload_custom_loader_jar', { instanceId: id, sourcePath: customLoaderJarPath });
      }

      addNotification({
        type: 'success',
        title: '實例建立成功',
        message: `已建立實例 ${customName}`
      });
      handleClose();
      setAppView(id); // 切換視圖
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '建立失敗',
        message: String(error)
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Modrinth Search Handler
  const handleModrinthSearch = () => {
    searchModpacks(searchQuery, 0, false);
  };

  const loadModpackVersionDetails = async (versionObj: any) => {
    setLoadingDetails(true);
    setModpackDetails(null);
    try {
      const file = versionObj.files.find((f: any) => f.filename.endsWith('.mrpack') || platform === 'curseforge');
      if (!file) throw new Error('該版本沒有相容的檔案');

      // 下載到本地臨時目錄
      const localPath = await invoke<string>('download_mrpack', { url: file.url });
      setDownloadedMrpackPath(localPath);

      // 解析 mrpack 資訊
      const info = await invoke<ModpackInfo>('parse_mrpack_info', { filePath: localPath });
      setModpackDetails(info);
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '下載或解析版本失敗',
        message: String(error)
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVersionSelect = async (versionId: string) => {
    setSelectedModpackVersionId(versionId);
    const ver = modpackVersions.find((v) => v.id === versionId);
    if (ver) {
      await loadModpackVersionDetails(ver);
    }
  };

  // Modrinth Selection Handler (Browsing stage: only fetch detailed description)
  const handleSelectModpack = async (hit: any) => {
    setSelectedModpack(hit);
    setIsModpackConfirmed(false);
    setIsSelectingMods(false);
    setSelectedMods(new Set());
    setModpackDetails(null);
    setModpackVersions([]);
    setSelectedModpackVersionId('');
    setModpackBody(hit.description || ''); // fallback to summary first

    setLoadingDetails(true);
    try {
      if (platform === 'modrinth') {
        const res = await fetch(`https://api.modrinth.com/v2/project/${hit.project_id}`);
        if (res.ok) {
          const data = await res.json();
          setModpackBody(data.body || data.description || hit.description || '');
        }
      } else {
        const modId = parseInt(hit.project_id, 10);
        const desc = await invoke<string>('get_curseforge_project_description', { modId });
        setModpackBody(desc || hit.description || '');
      }
    } catch (error) {
      console.error('Failed to fetch modpack detailed body:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Confirm Selection Handler (Starts downloading & parsing selected modpack)
  const handleConfirmModpack = async () => {
    if (!selectedModpack) return;
    
    setIsModpackConfirmed(true);
    setIsSelectingMods(false);
    setSelectedMods(new Set());
    setLoadingDetails(true);
    setModpackDetails(null);
    setModpackVersions([]);
    setSelectedModpackVersionId('');

    try {
      if (platform === 'modrinth') {
        // 獲取所有版本
        const res = await fetch(`https://api.modrinth.com/v2/project/${selectedModpack.project_id}/version`);
        if (!res.ok) throw new Error('無法取得 Modpack 版本列表');
        
        const versionsList = await res.json();
        // 過濾出含有 .mrpack 的版本
        const validVersions = versionsList.filter((v: any) => 
          v.files.some((f: any) => f.filename.endsWith('.mrpack'))
        );

        setModpackVersions(validVersions);

        if (validVersions.length === 0) {
          throw new Error('此 Modpack 沒有提供相容的 .mrpack 檔案');
        }

        // 預設選取第一個版本並載入
        const defaultVersion = validVersions[0];
        setSelectedModpackVersionId(defaultVersion.id);
        await loadModpackVersionDetails(defaultVersion);
      } else {
        const modId = parseInt(selectedModpack.project_id, 10);
        const filesData = await invoke<any>('get_curseforge_project_files', { modId });
        const files = filesData.data || [];
        
        const compatible = files.map((v: any) => {
          return {
            id: v.id.toString(),
            version_number: v.displayName || v.fileName,
            game_versions: v.gameVersions.filter((gv: any) => !['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
            loaders: v.gameVersions.filter((gv: any) => ['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
            changelog: v.releaseNotes || '無更新日誌描述',
            files: [{
              filename: v.fileName,
              url: v.downloadUrl,
              size: v.fileLength,
            }]
          };
        });

        setModpackVersions(compatible);

        if (compatible.length === 0) {
          throw new Error('此 Modpack 沒有可用的版本');
        }

        const defaultVersion = compatible[0];
        setSelectedModpackVersionId(defaultVersion.id);
        await loadModpackVersionDetails(defaultVersion);
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '解析 Modpack 失敗',
        message: String(error)
      });
      setIsModpackConfirmed(false);
      setLoadingDetails(false);
    }
  };

  // Local Mrpack File Select Handler
  const handleLoadMrpackPath = async (path: string) => {
    setMrpackPath(path);
    setIsSelectingMods(false);
    setSelectedMods(new Set());
    setLoadingDetails(true);
    setMrpackDetails(null);

    try {
      const info = await invoke<ModpackInfo>('parse_mrpack_info', { filePath: path });
      setMrpackDetails(info);
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '解析 mrpack 失敗',
        message: String(error)
      });
      setMrpackPath('');
      setMrpackDetails(null);
      setIsSelectingMods(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectLocalMrpack = async () => {
    try {
      const path = await invoke<string>('select_mrpack_file');
      if (path === 'CANCELLED') {
        setMrpackPath('');
        setMrpackDetails(null);
        setIsSelectingMods(false);
        return;
      }
      await handleLoadMrpackPath(path);
    } catch (error: any) {
      if (error !== 'CANCELLED') {
        addNotification({
          type: 'error',
          title: '選取檔案失敗',
          message: String(error)
        });
      }
    }
  };

  const handleMrpackFileDropped = (path: string) => {
    const isPack = path.toLowerCase().endsWith('.mrpack') || path.toLowerCase().endsWith('.zip');
    if (!isPack) {
      addNotification({
        type: 'warning',
        title: '格式不符',
        message: '僅支援 .mrpack 與 .zip 格式的整合包檔案。'
      });
      return;
    }
    handleLoadMrpackPath(path);
  };

  const toggleAllMods = (checked: boolean, modsList: any[]) => {
    if (checked) {
      setSelectedMods(new Set(modsList.map((m) => m.name)));
    } else {
      setSelectedMods(new Set());
    }
  };

  const toggleModSelection = (name: string) => {
    setSelectedMods((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Modpack Import Confirm Handler
  const handleImportModpack = async (info: ModpackInfo, mrpackFilePath: string) => {
    setIsActionLoading(true);
    const id = generateUniqueId(info.name, instances);
    setTargetImportId(id);

    try {
      // 1. 建立實例
      await createInstance(
        id,
        info.name,
        info.gameVersion,
        info.modloader,
        info.modloaderVersion,
        selectedModpack?.icon_url || undefined,
        selectedModpack?.project_id || undefined,
        selectedModpackVersionId || undefined
      );
      
      // 2. 導入 mrpack 檔案裡的 Mods 與 Overrides
      const selectedModsArray = Array.from(selectedMods);
      const blocked = await importMrpack(id, mrpackFilePath, selectedModsArray);

      if (blocked && blocked.length > 0) {
        setBlockedModsList(blocked);
        setIsManualImportMode(true);
        addNotification({
          type: 'warning',
          title: '部分檔案下載被封鎖',
          message: `此整合包中有 ${blocked.length} 個模組被 CurseForge 封鎖直接下載，請手動下載。`
        });
      } else {
        addNotification({
          type: 'success',
          title: 'Modpack 匯入完成',
          message: `已成功匯入 ${info.name}`
        });
        handleClose();
        setAppView(id); // 切換視圖
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '匯入失敗',
        message: String(error)
      });
      setTargetImportId(null);
    } finally {
      setIsActionLoading(false);
    }
  };

  const openAllBlockedPages = async () => {
    for (let i = 0; i < blockedModsList.length; i++) {
      const item = blockedModsList[i];
      const projectId = item.projectId;
      const fileId = item.fileId;
      const url = `https://www.curseforge.com/projects/${projectId}/download/${fileId}`;
      await invoke('open_in_browser', { url });
      if (i < blockedModsList.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  };

  const handleImportSingleBlocked = async (item: any) => {
    const filePath = detectedImportFiles[item.sha1];
    if (!filePath) return;
    if (!targetImportId) return;

    try {
      await invoke('import_files', { 
        instanceId: targetImportId, 
        folderName: 'mods', 
        filePaths: [filePath] 
      });
      setImportedImportItems(prev => {
        const next = new Set(prev);
        next.add(item.sha1);
        return next;
      });
      addNotification({ 
        type: 'success', 
        title: '導入成功', 
        message: `已成功導入 ${item.fileName}` 
      });
    } catch (err: any) {
      addNotification({ 
        type: 'error', 
        title: '導入失敗', 
        message: err.message || String(err) 
      });
    }
  };

  const handleImportAllDetected = async () => {
    if (!targetImportId) return;
    const toImport = blockedModsList.filter(item => {
      return detectedImportFiles[item.sha1] && !importedImportItems.has(item.sha1);
    });

    const filePaths = toImport.map(item => detectedImportFiles[item.sha1]);
    if (filePaths.length === 0) return;

    try {
      await invoke('import_files', { 
        instanceId: targetImportId, 
        folderName: 'mods', 
        filePaths 
      });
      setImportedImportItems(prev => {
        const next = new Set(prev);
        toImport.forEach(item => next.add(item.sha1));
        return next;
      });
      addNotification({ 
        type: 'success', 
        title: '導入成功', 
        message: `成功導入 ${filePaths.length} 個檔案` 
      });
    } catch (err: any) {
      addNotification({ 
        type: 'error', 
        title: '導入失敗', 
        message: err.message || String(err) 
      });
    }
  };

  const handleFinishManualImport = () => {
    const remaining = blockedModsList.filter(item => !importedImportItems.has(item.sha1)).length;
    if (remaining > 0) {
      if (!confirm(`尚有 ${remaining} 個檔案未導入。確定要完成並關閉嗎？`)) {
        return;
      }
    }
    const finalId = targetImportId;
    handleClose();
    if (finalId) {
      setAppView(finalId);
    }
  };

  const handleClose = () => {
    if (isImporting) return; // 正在匯入時禁止關閉
    // 重設狀態
    setCustomName('');
    setCustomLoaderJarPath('');
    setCustomLoaderJarName('');
    setIsDragOverCustom(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedModpack(null);
    setModpackDetails(null);
    setDownloadedMrpackPath('');
    setMrpackPath('');
    setMrpackDetails(null);
    setTargetImportId(null);
    setModpackVersions([]);
    setSelectedModpackVersionId('');
    setIsModpackConfirmed(false);
    setModpackBody('');
    setHasMoreModpacks(true);
    setIsLoadingMore(false);
    setIsSelectingMods(false);
    setSelectedMods(new Set());
    setIsManualImportMode(false);
    setBlockedModsList([]);
    setDetectedImportFiles({});
    setImportedImportItems(new Set());
    setPlatform('modrinth');
    onClose();
  };

  // Group and memoize major versions based on majorFilter, minorFilter and versions
  const majorVersionsData = useMemo(() => {
    // 1. Group ALL versions first
    const firstRelease = versions.find((v) => v.type === 'release');
    let activeGroup = '1.21.X';
    if (firstRelease) {
      const g = getMajorVersionGroup(firstRelease.id);
      const match = g.match(/^(\d+)\.(\d+)\.X$/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        activeGroup = `${major}.${minor + 1}.X`;
      } else {
        activeGroup = g;
      }
    }

    const allGroups: string[] = [];
    const allGroupMap: Record<string, typeof versions> = {};

    versions.forEach((v) => {
      let g = '';

      if (v.type === 'release') {
        g = getMajorVersionGroup(v.id);
        activeGroup = g;
      } else if (v.id.match(/^\d+w/)) {
        g = activeGroup;
      } else {
        g = getMajorVersionGroup(v.id);
        if (g === '其他測試版本' && activeGroup) {
          g = activeGroup;
        }
      }

      if (!allGroupMap[g]) {
        allGroupMap[g] = [];
        allGroups.push(g);
      }
      allGroupMap[g].push(v);
    });

    // 2. Filter groups and items based on majorFilter and minorFilter
    const groups: string[] = [];
    const groupMap: Record<string, typeof versions> = {};

    const isStandardGroup = (groupName: string): boolean => {
      return /^\d+\.\d+\.X$/.test(groupName);
    };

    allGroups.forEach((g) => {
      const isStd = isStandardGroup(g);
      
      if (majorFilter === 'release') {
        if (!isStd) return; // skip historic groups
        
        // Filter minor versions by minorFilter
        const filteredItems = allGroupMap[g].filter((v) => {
          if (minorFilter === 'release') {
            return v.type === 'release';
          } else {
            return v.type !== 'release';
          }
        });
        
        if (filteredItems.length > 0) {
          groups.push(g);
          groupMap[g] = filteredItems;
        }
      } else {
        // history
        if (isStd) return; // skip standard groups
        
        // Historic groups keep all items
        groups.push(g);
        groupMap[g] = allGroupMap[g];
      }
    });

    return { groups, groupMap };
  }, [versions, majorFilter, minorFilter]);

  // Sync selected major version and minor version when the available grouped versions change
  useEffect(() => {
    if (majorVersionsData.groups.length > 0) {
      if (!selectedMajorVersion || !majorVersionsData.groups.includes(selectedMajorVersion)) {
        const defaultGroup = majorVersionsData.groups[0];
        setSelectedMajorVersion(defaultGroup);
        
        const defaultMinor = majorVersionsData.groupMap[defaultGroup]?.[0]?.id;
        if (defaultMinor) {
          setCustomVersion(defaultMinor);
        }
      } else {
        // If the selected major version is still valid, check if the custom version is still in the available options
        const availableMinors = majorVersionsData.groupMap[selectedMajorVersion] || [];
        const isCurrentVersionValid = availableMinors.some((v) => v.id === customVersion);
        if (!isCurrentVersionValid && availableMinors.length > 0) {
          setCustomVersion(availableMinors[0].id);
        }
      }
    }
  }, [majorVersionsData, selectedMajorVersion, customVersion]);

  const handleMajorVersionChange = (majorVer: string) => {
    setSelectedMajorVersion(majorVer);
    const minors = majorVersionsData.groupMap[majorVer] || [];
    if (minors.length > 0) {
      setCustomVersion(minors[0].id);
    }
  };

  const majorVersionOptions = majorVersionsData.groups.map((g) => ({
    value: g,
    label: g
  }));

  const minorVersions = majorVersionsData.groupMap[selectedMajorVersion] || [];
  const minorVersionOptions = minorVersions.map((v) => ({
    value: v.id,
    label: `${v.id} ${v.type !== 'release' ? `(${v.type})` : ''}`
  }));

  const modloaderOptions = [
    { value: 'Vanilla', label: 'Vanilla (原版)' },
    { value: 'Fabric', label: 'Fabric' },
    { value: 'Forge', label: 'Forge' },
    { value: 'NeoForge', label: 'NeoForge' },
    { value: 'Custom', label: '自訂 ModLoader' }
  ];

  const loaderVersionOptions = loaderVersions.map((v) => ({
    value: v,
    label: v
  }));

  const modpackVersionOptions = modpackVersions.map((v: any) => ({
    value: v.id,
    label: `${v.version_number} (${v.game_versions.join(', ')} • ${v.loaders.join(', ')})`
  }));

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${activeTab !== 'custom' ? styles.wideModal : ''}`}>
        <div className={styles.header}>
          <h2>建立新實例</h2>
          <button className={styles.closeButton} onClick={handleClose} disabled={isImporting}>
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'custom' ? styles.active : ''}`}
            onClick={() => !isImporting && setActiveTab('custom')}
            disabled={isImporting}
          >
            自訂建立
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'modrinth' ? styles.active : ''}`}
            onClick={() => !isImporting && setActiveTab('modrinth')}
            disabled={isImporting}
          >
            線上整合包
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'mrpack' ? styles.active : ''}`}
            onClick={() => !isImporting && setActiveTab('mrpack')}
            disabled={isImporting}
          >
            匯入本機包
          </button>
        </div>

        <div 
          key={activeTab} 
          className={`${styles.content} ${activeTab === 'custom' ? styles.customTabContent : ''} ${styles.tabContentActive}`}
        >
          {isImporting ? (
            <div className={styles.progressContainer}>
              <div className={styles.progressLabel}>
                <span className={styles.progressText}>正在匯入 Modpack 檔案...</span>
                <span className={styles.progressPercent}>{Math.round(downloadProgress)}%</span>
              </div>
              <div className={styles.progressBarOuter}>
                <div className={styles.progressBarInner} style={{ width: `${downloadProgress}%` }}></div>
              </div>
              <div className={styles.progressDetail}>{downloadStatusText}</div>
            </div>
          ) : isManualImportMode ? (
            <div className={styles.manualContainer}>
              <div className={styles.manualHeader}>
                <span className={styles.manualTitle}>⚠️ 防封鎖手動下載模式</span>
                <button 
                  className={styles.openPageBtn}
                  onClick={openAllBlockedPages}
                  type="button"
                >
                  一鍵開啟所有下載頁面
                </button>
              </div>
              <p className={styles.manualDesc}>
                由於 CurseForge 限制第三方直接下載部分模組，請點擊「開啟下載頁」下載模組檔案（下載後檔案將位於本機的「下載 (Downloads)」資料夾）。
                啟動器將會自動在背景掃描該資料夾，並在比對雜湊值成功後提示導入。
              </p>
              <div className={`${styles.manualList} global-scrollbar`}>
                {blockedModsList.map(item => {
                  const sha1 = item.sha1;
                  const isDetected = sha1 && !!detectedImportFiles[sha1];
                  const isImported = importedImportItems.has(sha1);
                  
                  return (
                    <div key={item.fileId} className={`${styles.manualItem} ${isDetected && !isImported ? styles.detected : ''}`}>
                      <span className={styles.manualItemIcon}>📦</span>
                      <div className={styles.manualItemMain}>
                        <span className={styles.manualItemTitle}>{item.fileName}</span>
                        <span className={styles.manualItemFile}>SHA-1: {item.sha1}</span>
                      </div>
                      <div className={styles.manualItemActions}>
                        {isImported ? (
                          <span className={styles.importedTag}>已導入</span>
                        ) : isDetected ? (
                          <button 
                            className={styles.importBtn}
                            onClick={() => handleImportSingleBlocked(item)}
                            type="button"
                          >
                            導入檔案
                          </button>
                        ) : (
                          <div className={`${styles.manualItemStatus} ${styles.waiting}`}>
                            等待下載
                          </div>
                        )}
                        {!isImported && (
                          <button 
                            className={styles.openPageBtn}
                            onClick={() => invoke('open_in_browser', { url: `https://www.curseforge.com/projects/${item.projectId}/download/${item.fileId}` })}
                            type="button"
                          >
                            下載頁
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'custom' && (
                <CustomTab
                  customName={customName}
                  setCustomName={setCustomName}
                  minorFilter={minorFilter}
                  majorFilter={majorFilter}
                  setMajorFilter={setMajorFilter}
                  setMinorFilter={setMinorFilter}
                  errorLoadingVersions={errorLoadingVersions}
                  loadVersions={loadVersions}
                  loadingVersions={loadingVersions}
                  selectedMajorVersion={selectedMajorVersion}
                  handleMajorVersionChange={handleMajorVersionChange}
                  majorVersionOptions={majorVersionOptions}
                  customVersion={customVersion}
                  setCustomVersion={setCustomVersion}
                  minorVersionOptions={minorVersionOptions}
                  customModloader={customModloader}
                  setCustomModloader={setCustomModloader}
                  modloaderOptions={modloaderOptions}
                  selectedLoaderVersion={selectedLoaderVersion}
                  setSelectedLoaderVersion={setSelectedLoaderVersion}
                  loaderVersionOptions={loaderVersionOptions}
                  loadingLoaderVersions={loadingLoaderVersions}
                  isDragOverCustom={isDragOverCustom}
                  customLoaderJarName={customLoaderJarName}
                  handleSelectCustomLoaderJar={handleSelectCustomLoaderJar}
                />
              )}

              {activeTab === 'modrinth' && (
                <ModrinthTab
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedModpack={selectedModpack}
                  setSelectedModpack={setSelectedModpack}
                  setModpackDetails={setModpackDetails}
                  setModpackVersions={setModpackVersions}
                  setSelectedModpackVersionId={setSelectedModpackVersionId}
                  setIsModpackConfirmed={setIsModpackConfirmed}
                  setModpackBody={setModpackBody}
                  handleModrinthSearch={handleModrinthSearch}
                  isSearching={isSearching}
                  searchResults={searchResults}
                  handleScroll={handleScroll}
                  handleSelectModpack={handleSelectModpack}
                  isLoadingMore={isLoadingMore}
                  loadingDetails={loadingDetails}
                  isModpackConfirmed={isModpackConfirmed}
                  modpackBody={modpackBody}
                  isSelectingMods={isSelectingMods}
                  setIsSelectingMods={setIsSelectingMods}
                  selectedModpackVersionId={selectedModpackVersionId}
                  handleVersionSelect={handleVersionSelect}
                  modpackVersionOptions={modpackVersionOptions}
                  modpackDetails={modpackDetails}
                  selectedMods={selectedMods}
                  toggleAllMods={toggleAllMods}
                  toggleModSelection={toggleModSelection}
                  platform={platform}
                  setPlatform={setPlatform}
                />
              )}

              {activeTab === 'mrpack' && (
                <ImportMrpackTab
                  mrpackPath={mrpackPath}
                  handleSelectLocalMrpack={handleSelectLocalMrpack}
                  loadingDetails={loadingDetails}
                  mrpackDetails={mrpackDetails}
                  isSelectingMods={isSelectingMods}
                  setIsSelectingMods={setIsSelectingMods}
                  selectedMods={selectedMods}
                  toggleAllMods={toggleAllMods}
                  toggleModSelection={toggleModSelection}
                  isDragOver={isDragOver}
                />
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {isManualImportMode ? (
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className={styles.openPageBtn} 
                onClick={handleImportAllDetected}
                disabled={!blockedModsList.some(item => detectedImportFiles[item.sha1] && !importedImportItems.has(item.sha1))}
                type="button"
              >
                導入所有已偵測檔案
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={styles.createButton} 
                  onClick={handleFinishManualImport}
                  type="button"
                >
                  完成
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'mrpack' && mrpackDetails && (
                <button 
                  className={styles.reselectFooterButton} 
                  onClick={handleSelectLocalMrpack}
                  disabled={isActionLoading || isImporting}
                  type="button"
                >
                  重新選擇檔案
                </button>
              )}
              
              <button className={styles.cancelButton} onClick={handleClose} disabled={isActionLoading || isImporting} type="button">
                取消
              </button>
              
              {activeTab === 'custom' && (
                <button 
                  className={styles.createButton} 
                  onClick={handleCustomCreate}
                  disabled={
                    isActionLoading || 
                    !customName.trim() || 
                    (customModloader !== 'Vanilla' && (!selectedLoaderVersion || loadingLoaderVersions))
                  }
                  type="button"
                >
                  建立
                </button>
              )}

              {activeTab === 'modrinth' && selectedModpack && !isModpackConfirmed && (
                <button 
                  className={styles.createButton} 
                  onClick={handleConfirmModpack}
                  disabled={loadingDetails}
                  type="button"
                >
                  選擇此整合包
                </button>
              )}

              {activeTab === 'modrinth' && modpackDetails && isModpackConfirmed && !isSelectingMods && (
                <button 
                  className={styles.createButton} 
                  onClick={() => setIsSelectingMods(true)}
                  disabled={loadingDetails}
                  type="button"
                >
                  下一步 (選擇模組)
                </button>
              )}

              {activeTab === 'modrinth' && modpackDetails && isModpackConfirmed && isSelectingMods && (
                <button 
                  className={styles.createButton} 
                  onClick={() => handleImportModpack(modpackDetails, downloadedMrpackPath)}
                  disabled={isActionLoading || isImporting || selectedMods.size === 0}
                  type="button"
                >
                  確認並匯入
                </button>
              )}

              {activeTab === 'mrpack' && mrpackDetails && !isSelectingMods && (
                <button 
                  className={styles.createButton} 
                  onClick={() => setIsSelectingMods(true)}
                  disabled={loadingDetails}
                  type="button"
                >
                  下一步 (選擇模組)
                </button>
              )}

              {activeTab === 'mrpack' && mrpackDetails && isSelectingMods && (
                <button 
                  className={styles.createButton} 
                  onClick={() => handleImportModpack(mrpackDetails, mrpackPath)}
                  disabled={isActionLoading || isImporting || selectedMods.size === 0}
                  type="button"
                >
                  確認並匯入
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


