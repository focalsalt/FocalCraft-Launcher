import { useState, useEffect } from 'react';
import { Loader, Package } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { marked } from 'marked';
import { useAppStore } from '../../store/appStore';
import { CustomSelect } from '../../components/common/CustomSelect';
import { SafeImage } from '../../components/common/SafeImage';
import { useI18n } from '../../utils/i18n';
import { HeaderState } from './DownloaderModal';
import styles from './ModrinthDownloadModal.module.css'; // 共用相同的樣式定義以保持風格一致

interface Props {
  isOpen: boolean;
  instanceId: string;
  projectType: 'mod' | 'resourcepack' | 'shader' | 'datapack';
  gameVersion: string;
  loader: string;
  datapackWorldFolder?: string;
  onDownloadComplete: () => void;
  onClose: () => void;
  onHeaderStateChange: (state: HeaderState) => void;
}

const CURSEFORGE_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  mod: [
    { value: '', label: 'All (全部)' },
    { value: '4842', label: 'Optimization (優化)' },
    { value: '412', label: 'Technology (科技)' },
    { value: '411', label: 'Magic (魔法)' },
    { value: '17', label: 'Adventure (冒險)' },
    { value: '423', label: 'Cosmetic (裝飾)' },
    { value: '406', label: 'Utility (實用工具)' },
    { value: '4843', label: 'Storage (儲存)' },
    { value: '436', label: 'Food (食物)' },
    { value: '409', label: 'Biomes (生態域)' },
    { value: '413', label: 'Automation (自動化)' }
  ],
  resourcepack: [
    { value: '', label: 'All (全部)' },
    { value: '4310', label: '16x' },
    { value: '4311', label: '32x' },
    { value: '4312', label: '64x' },
    { value: '4315', label: 'Modern (現代)' },
    { value: '4314', label: 'Medieval (中世紀)' },
    { value: '4316', label: 'Futuristic (未來風)' }
  ],
  shader: [
    { value: '', label: 'All (全部)' },
    { value: '6553', label: 'Shaders (光影)' }
  ],
  datapack: [
    { value: '', label: 'All (全部)' },
    { value: '71004', label: 'World Gen (世界生成)' },
    { value: '71003', label: 'Utility (實用工具)' },
    { value: '71001', label: 'Gameplay (遊戲機制)' },
    { value: '71002', label: 'Items (物品擴充)' }
  ]
};

const CURSEFORGE_CLASS_IDS: Record<string, number> = {
  mod: 6,
  resourcepack: 12,
  shader: 6552,
  datapack: 70886,
};

export function CurseForgeDownloadModal({
  isOpen,
  instanceId,
  projectType,
  gameVersion,
  loader,
  datapackWorldFolder,
  onDownloadComplete,
  onClose,
  onHeaderStateChange,
}: Props) {
  const addNotification = useAppStore((state) => state.addNotification);
  const { t, language } = useI18n();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([gameVersion]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [allMinecraftVersions, setAllMinecraftVersions] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [projectBody, setProjectBody] = useState('');
  const [projectVersions, setProjectVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedVersionChangelog, setSelectedVersionChangelog] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const [installedProjectIds, setInstalledProjectIds] = useState<Set<string>>(new Set());
  const [updateProjectIds, setUpdateProjectIds] = useState<Set<string>>(new Set());

  const [selectedProjects, setSelectedProjects] = useState<Map<string, { project: any; version: any | null }>>(new Map());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSelectingConfirm, setIsSelectingConfirm] = useState(false);
  const [confirmMods, setConfirmMods] = useState<any[]>([]);
  const [confirmedSelection, setConfirmedSelection] = useState<Set<string>>(new Set());
  const [installProgress, setInstallProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  // 手動下載模式狀態
  const [isManualMode, setIsManualMode] = useState(false);
  const [blockedItems, setBlockedItems] = useState<any[]>([]);
  const [detectedFiles, setDetectedFiles] = useState<Record<string, string>>({});
  const [importedItems, setImportedItems] = useState<Set<string>>(new Set());

  const categoryOptions = (CURSEFORGE_CATEGORIES[projectType] || []).map(opt => {
    if (language === 'en-US') {
      const cleanedLabel = opt.label.replace(/\s*\([\u4e00-\u9fa5]+\)/g, '');
      return { ...opt, label: cleanedLabel };
    }
    return opt;
  });
  const classId = CURSEFORGE_CLASS_IDS[projectType] || 6;

  // 獲取 Mojang 版本列表
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const manifest = await invoke<any>('get_minecraft_versions');
        const releases = manifest.versions
          .filter((v: any) => v.type === 'release')
          .map((v: any) => v.id);
        
        const filtered = Array.from(new Set([gameVersion, ...releases]))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

        setAllMinecraftVersions(filtered);
      } catch (err) {
        console.error('獲取 Minecraft 版本清單失敗:', err);
        setAllMinecraftVersions([
          gameVersion, '26.2', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2'
        ]);
      }
    };
    fetchVersions();
  }, [gameVersion]);

  // 同步 Header 狀態至 Wrapper modal
  useEffect(() => {
    onHeaderStateChange({
      isSelectingConfirm,
      isManualMode,
      confirmModsCount: isManualMode ? blockedItems.length : confirmMods.length,
      confirmedSelectionSize: isManualMode ? importedItems.size : confirmedSelection.size,
    });
  }, [isSelectingConfirm, isManualMode, confirmMods, confirmedSelection, blockedItems, importedItems, onHeaderStateChange]);

  // 背景下載掃描器
  useEffect(() => {
    if (!isManualMode || blockedItems.length === 0) return;

    const hashes = blockedItems
      .map(item => item.version.files[0]?.hashes?.sha1)
      .filter((h): h is string => typeof h === 'string' && h.trim().length > 0);

    if (hashes.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const matches = await invoke<Record<string, string>>('scan_downloads_for_hashes', { hashes });
        setDetectedFiles(matches);
      } catch (err) {
        console.error('掃描下載資料夾失敗:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isManualMode, blockedItems]);

  // 載入已安裝項目與檢查更新
  useEffect(() => {
    if (!isOpen) {
      setInstalledProjectIds(new Set());
      setUpdateProjectIds(new Set());
      setSelectedProjects(new Map());
      setIsSelectingConfirm(false);
      setConfirmMods([]);
      setConfirmedSelection(new Set());
      setInstallProgress(null);
      setSelectedVersions([gameVersion]);
      setSelectedCategory('');
      setShowFilters(false);
      setQuery('');
      setResults([]);
      setSelectedProject(null);
      setProjectBody('');
      setProjectVersions([]);
      setSelectedVersionId('');
      setSelectedVersionChangelog('');
      setIsManualMode(false);
      setBlockedItems([]);
      setDetectedFiles({});
      setImportedItems(new Set());
      return;
    }

    const checkInstalledAndUpdates = async () => {
      try {
        let localItems: any[] = [];
        if (projectType === 'mod') {
          localItems = await invoke<any[]>('get_installed_mods', { instanceId });
        } else if (projectType === 'resourcepack') {
          localItems = await invoke<any[]>('get_installed_resourcepacks', { instanceId });
        } else if (projectType === 'shader') {
          localItems = await invoke<any[]>('get_installed_shaderpacks', { instanceId });
        } else if (projectType === 'datapack' && datapackWorldFolder) {
          localItems = await invoke<any[]>('get_installed_datapacks', { instanceId, worldFolder: datapackWorldFolder });
        }

        const hashes = localItems.map((item) => item.sha1).filter((h) => h && h.trim() !== '');
        if (hashes.length === 0) {
          setInstalledProjectIds(new Set());
          setUpdateProjectIds(new Set());
          return;
        }

        // 向 Modrinth 查詢本機雜湊以獲取識別碼 (因 CurseForge 不支援雜湊批次反查)
        const resFiles = await fetch('https://api.modrinth.com/v2/version_files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'focal-craft-launcher',
          },
          body: JSON.stringify({ hashes, algorithm: 'sha1' }),
        });

        const installedSet = new Set<string>();
        if (resFiles.ok) {
          const filesData = await resFiles.json();
          Object.values(filesData).forEach((ver: any) => {
            if (ver && ver.project_id) {
              installedSet.add(ver.project_id);
            }
          });
        }
        setInstalledProjectIds(installedSet);
      } catch (err) {
        console.error('載入本機 CurseForge 項目失敗:', err);
      }
    };

    checkInstalledAndUpdates();
  }, [isOpen, instanceId, projectType, gameVersion, loader, datapackWorldFolder]);

  useEffect(() => {
    setResults([]);
    setSelectedProject(null);
    setProjectBody('');
    setProjectVersions([]);
    setSelectedVersionId('');
    setSelectedVersionChangelog('');
    setQuery('');
    setSelectedProjects(new Map());
  }, [projectType]);

  // 搜尋防抖與監聽條件
  useEffect(() => {
    if (!isOpen) return;
    const delayDebounce = setTimeout(() => {
      handleSearch();
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [query, isOpen, selectedVersions, selectedCategory]);

  // 預設選取第一個項目
  useEffect(() => {
    if (results.length > 0) {
      handleSelectProject(results[0]);
    } else {
      setSelectedProject(null);
      setProjectBody('');
      setProjectVersions([]);
      setSelectedVersionId('');
      setSelectedVersionChangelog('');
    }
  }, [results]);

  const handleSearch = async () => {
    setIsSearching(true);
    setHasMore(true);
    try {
      const catIdNum = selectedCategory ? parseInt(selectedCategory, 10) : null;
      const res = await invoke<any>('search_curseforge', {
        query,
        classId,
        gameVersion: selectedVersions[0] || gameVersion,
        categoryId: catIdNum,
        searchIndex: 0,
        pageSize: 20,
      });

      const hits = (res.data || []).map((item: any) => ({
        project_id: item.id.toString(),
        title: item.name,
        description: item.summary || '',
        icon_url: item.logo?.url || '',
        raw: item,
      }));
      setResults(hits);
      if (hits.length < 20) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('搜尋 CurseForge 失敗:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (isSearching || !hasMore) return;
    setIsSearching(true);
    try {
      const currentOffset = results.length;
      const catIdNum = selectedCategory ? parseInt(selectedCategory, 10) : null;
      const res = await invoke<any>('search_curseforge', {
        query,
        classId,
        gameVersion: selectedVersions[0] || gameVersion,
        categoryId: catIdNum,
        searchIndex: currentOffset,
        pageSize: 20,
      });

      const newHits = (res.data || []).map((item: any) => ({
        project_id: item.id.toString(),
        title: item.name,
        description: item.summary || '',
        icon_url: item.logo?.url || '',
        raw: item,
      }));

      if (newHits.length === 0) {
        setHasMore(false);
      } else {
        setResults((prev) => [...prev, ...newHits]);
        if (newHits.length < 20) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('載入更多 CurseForge 失敗:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 15) {
      handleLoadMore();
    }
  };

  const handleSelectProject = async (hit: any) => {
    if (selectedProject?.project_id === hit.project_id) return;
    setSelectedProject(hit);
    setProjectBody(hit.description || '');
    setProjectVersions([]);
    setSelectedVersionId('');
    setSelectedVersionChangelog('');
    setLoadingDetails(true);

    try {
      const desc = await invoke<string>('get_curseforge_project_description', { modId: parseInt(hit.project_id, 10) });
      setProjectBody(desc || hit.description || '');

      const filesData = await invoke<any>('get_curseforge_project_files', { modId: parseInt(hit.project_id, 10) });
      const files = filesData.data || [];

      const compatible = files.filter((v: any) => {
        const matchesVersion = v.gameVersions.includes(selectedVersions[0] || gameVersion);
        const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' ||
          loader.toLowerCase() === 'vanilla' ||
          v.gameVersions.some((gv: string) => gv.toLowerCase() === loader.toLowerCase());
        return matchesVersion && matchesLoader;
      }).map((v: any) => {
        const sha1Hash = v.hashes?.find((h: any) => h.algo === 1)?.value || '';
        return {
          id: v.id.toString(),
          version_number: v.displayName || v.fileName,
          game_versions: v.gameVersions.filter((gv: any) => !['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
          loaders: v.gameVersions.filter((gv: any) => ['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
          changelog: v.releaseNotes || t('downloader.no_changelog'),
          files: [{
            filename: v.fileName,
            url: v.downloadUrl,
            size: v.fileLength,
            hashes: { sha1: sha1Hash },
          }],
          dependencies: v.dependencies || [],
        };
      });

      setProjectVersions(compatible);
      if (compatible.length > 0) {
        const firstVer = compatible[0];
        setSelectedVersionId(firstVer.id);
        setSelectedVersionChangelog(firstVer.changelog || t('downloader.no_changelog'));

        setSelectedProjects((prev) => {
          if (!prev.has(hit.project_id)) return prev;
          const next = new Map(prev);
          next.set(hit.project_id, {
            ...next.get(hit.project_id)!,
            version: firstVer,
          });
          return next;
        });
      }
    } catch (error) {
      console.error('加載專案詳情失敗:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const ver = projectVersions.find((v) => v.id === versionId);
    if (ver) {
      setSelectedVersionChangelog(ver.changelog || t('downloader.no_changelog'));

      setSelectedProjects((prev) => {
        if (!prev.has(selectedProject.project_id)) return prev;
        const next = new Map(prev);
        next.set(selectedProject.project_id, {
          ...next.get(selectedProject.project_id)!,
          version: ver,
        });
        return next;
      });
    }
  };

  const handleToggleSelectProject = (hit: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProjects((prev) => {
      const next = new Map(prev);
      if (next.has(hit.project_id)) {
        next.delete(hit.project_id);
      } else {
        let initialVersion = null;
        if (selectedProject?.project_id === hit.project_id && selectedVersionId) {
          initialVersion = projectVersions.find((v) => v.id === selectedVersionId) || null;
        }
        next.set(hit.project_id, { project: hit, version: initialVersion });
      }
      return next;
    });
  };

  // CurseForge 遞迴解析依賴
  const resolveCurseForgeDependencies = async (
    initialList: { project: any; version: any; isDependency: boolean }[]
  ) => {
    const resolvedMap = new Map<string, { project: any; version: any; isDependency: boolean }>();
    initialList.forEach(item => {
      resolvedMap.set(item.project.project_id, item);
    });

    const queue = [...initialList];
    const checked = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const projectId = current.project.project_id;

      if (checked.has(projectId)) continue;
      checked.add(projectId);

      // CurseForge 檔案的依賴關係 (relationType === 3 表示 Required 依賴)
      const dependencies = current.version?.dependencies || [];
      const requiredDeps = dependencies.filter((dep: any) => dep.relationType === 3);

      if (requiredDeps.length === 0) continue;

      const depModIds = requiredDeps.map((dep: any) => dep.modId);
      
      // 過濾掉已經解析或已安裝的 modId
      const unresolvedModIds = depModIds.filter((mid: number) => {
        const idStr = mid.toString();
        return !resolvedMap.has(idStr) && !installedProjectIds.has(idStr);
      });

      if (unresolvedModIds.length === 0) continue;

      try {
        // 使用我們在 Rust 新增的批次查詢指令
        const batchRes = await invoke<any>('get_curseforge_projects', { modIds: unresolvedModIds });
        const depProjects = batchRes.data || [];

        for (const item of depProjects) {
          const depIdStr = item.id.toString();
          const depFilesData = await invoke<any>('get_curseforge_project_files', { modId: item.id });
          const depFiles = depFilesData.data || [];

          // 過濾出符合遊戲版本和加載器的最合適檔案
          const compatible = depFiles.filter((v: any) => {
            const matchesVersion = v.gameVersions.includes(selectedVersions[0] || gameVersion);
            const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' ||
              loader.toLowerCase() === 'vanilla' ||
              v.gameVersions.some((gv: string) => gv.toLowerCase() === loader.toLowerCase());
            return matchesVersion && matchesLoader;
          }).map((v: any) => {
            const sha1Hash = v.hashes?.find((h: any) => h.algo === 1)?.value || '';
            return {
              id: v.id.toString(),
              version_number: v.displayName || v.fileName,
              game_versions: v.gameVersions.filter((gv: any) => !['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
              loaders: v.gameVersions.filter((gv: any) => ['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
              changelog: v.releaseNotes || t('downloader.no_changelog'),
              files: [{
                filename: v.fileName,
                url: v.downloadUrl,
                size: v.fileLength,
                hashes: { sha1: sha1Hash },
              }],
              dependencies: v.dependencies || [],
            };
          });

          if (compatible.length > 0) {
            const depItem = {
              project: {
                project_id: depIdStr,
                title: item.name,
                icon_url: item.logo?.url || '',
                description: item.summary || '',
              },
              version: compatible[0],
              isDependency: true, // 標記為依賴項
            };
            resolvedMap.set(depIdStr, depItem);
            queue.push(depItem);
          }
        }
      } catch (err) {
        console.error('批次獲取 CurseForge 依賴失敗:', err);
      }
    }

    return Array.from(resolvedMap.values());
  };

  const handleNextStep = async () => {
    setIsTransitioning(true);
    try {
      const initialResolved = await Promise.all(
        Array.from(selectedProjects.values()).map(async (item) => {
          if (item.version) {
            return { project: item.project, version: item.version, isDependency: false };
          }
          const filesData = await invoke<any>('get_curseforge_project_files', { modId: parseInt(item.project.project_id, 10) });
          const files = filesData.data || [];
          const compatible = files.filter((v: any) => {
            const matchesVersion = v.gameVersions.includes(selectedVersions[0] || gameVersion);
            const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' ||
              loader.toLowerCase() === 'vanilla' ||
              v.gameVersions.some((gv: string) => gv.toLowerCase() === loader.toLowerCase());
            return matchesVersion && matchesLoader;
          }).map((v: any) => {
            const sha1Hash = v.hashes?.find((h: any) => h.algo === 1)?.value || '';
            return {
              id: v.id.toString(),
              version_number: v.displayName || v.fileName,
              game_versions: v.gameVersions.filter((gv: any) => !['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
              loaders: v.gameVersions.filter((gv: any) => ['forge', 'fabric', 'quilt', 'neoforge'].includes(gv.toLowerCase())),
              changelog: v.releaseNotes || t('downloader.no_changelog'),
              files: [{
                filename: v.fileName,
                url: v.downloadUrl,
                size: v.fileLength,
                hashes: { sha1: sha1Hash },
              }],
              dependencies: v.dependencies || [],
            };
          });

          if (compatible.length > 0) {
            return { project: item.project, version: compatible[0], isDependency: false };
          }
          return { project: item.project, version: null, isDependency: false };
        })
      );

      const validInitial = initialResolved.filter(item => item.version);

      // 解析依賴
      const fullyResolved = await resolveCurseForgeDependencies(validInitial);

      setConfirmMods(fullyResolved);

      const initialChecked = new Set<string>();
      fullyResolved.forEach((item) => {
        if (item.version) {
          initialChecked.add(item.project.project_id);
        }
      });
      setConfirmedSelection(initialChecked);
      setIsSelectingConfirm(true);
    } catch (err) {
      console.error('加載 CurseForge 版本與依賴失敗:', err);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleConfirmInstall = async () => {
    setIsDownloading(true);
    const folderName =
      projectType === 'mod' ? 'mods' :
        projectType === 'resourcepack' ? 'resourcepacks' :
          projectType === 'shader' ? 'shaderpacks' :
            `saves/${datapackWorldFolder}/datapacks`;

    const toInstall = confirmMods.filter(
      (item) => confirmedSelection.has(item.project.project_id) && item.version
    );

    // 分流：可直接下載與被封鎖（需要手動下載）的檔案
    const blocked = toInstall.filter(item => !item.version.files[0]?.url);
    const allowed = toInstall.filter(item => item.version.files[0]?.url);

    let successCount = 0;
    let failedNames: string[] = [];

    // 下載允許下載的項目
    for (let i = 0; i < allowed.length; i++) {
      const item = allowed[i];
      setInstallProgress({
        current: i + 1,
        total: allowed.length,
        name: item.project.title,
      });

      const ver = item.version;
      const file = ver.files[0];
      if (!file) continue;

      try {
        await invoke('download_and_replace_file', {
          instanceId,
          folderName,
          downloadUrl: file.url,
          newFilename: file.filename,
          oldFilename: null,
        });
        successCount++;

        setInstalledProjectIds((prev) => {
          const next = new Set(prev);
          next.add(item.project.project_id);
          return next;
        });
        setUpdateProjectIds((prev) => {
          const next = new Set(prev);
          next.delete(item.project.project_id);
          return next;
        });
      } catch (err: any) {
        console.error(`下載 ${item.project.title} 失敗:`, err);
        failedNames.push(item.project.title);
      }
    }

    setIsDownloading(false);
    setInstallProgress(null);

    if (successCount > 0) {
      onDownloadComplete();
    }

    if (blocked.length > 0) {
      // 切換至手動下載模式
      setBlockedItems(blocked);
      setIsSelectingConfirm(false);
      setIsManualMode(true);
    } else {
      if (failedNames.length > 0) {
        addNotification({
          type: 'error',
          title: t('downloader.partial_failed') || '安裝失敗',
          message: t('downloader.download_failed', { name: failedNames.join(', ') }) || `安裝 ${failedNames.join(', ')} 失敗`,
        });
      } else {
        onClose();
      }
    }
  };

  const openAllBlockedPages = async () => {
    for (let i = 0; i < blockedItems.length; i++) {
      const item = blockedItems[i];
      const projectId = item.project.project_id;
      const fileId = item.version.id;
      const url = `https://www.curseforge.com/projects/${projectId}/download/${fileId}`;
      await invoke('open_in_browser', { url });
      if (i < blockedItems.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  };

  const handleImportBlockedItem = async (item: any) => {
    const sha1 = item.version.files[0]?.hashes?.sha1;
    const filePath = sha1 ? detectedFiles[sha1] : null;
    if (!filePath) return;

    const folderName =
      projectType === 'mod' ? 'mods' :
        projectType === 'resourcepack' ? 'resourcepacks' :
          projectType === 'shader' ? 'shaderpacks' :
            `saves/${datapackWorldFolder}/datapacks`;

    try {
      await invoke('import_files', { instanceId, folderName, filePaths: [filePath] });
      setImportedItems(prev => {
        const next = new Set(prev);
        next.add(item.project.project_id);
        return next;
      });
      setInstalledProjectIds(prev => {
        const next = new Set(prev);
        next.add(item.project.project_id);
        return next;
      });
      addNotification({
        type: 'success',
        title: t('downloader.import_success_title'),
        message: t('downloader.import_success', { name: item.project.title })
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('downloader.import_failed_title'),
        message: err.message || String(err)
      });
    }
  };

  const handleImportAllDetected = async () => {
    const toImport = blockedItems.filter(item => {
      const sha1 = item.version.files[0]?.hashes?.sha1;
      return sha1 && detectedFiles[sha1] && !importedItems.has(item.project.project_id);
    });

    const filePaths = toImport.map(item => {
      const sha1 = item.version.files[0].hashes.sha1;
      return detectedFiles[sha1];
    });

    if (filePaths.length === 0) return;

    const folderName =
      projectType === 'mod' ? 'mods' :
        projectType === 'resourcepack' ? 'resourcepacks' :
          projectType === 'shader' ? 'shaderpacks' :
            `saves/${datapackWorldFolder}/datapacks`;

    try {
      await invoke('import_files', { instanceId, folderName, filePaths });
      setImportedItems(prev => {
        const next = new Set(prev);
        toImport.forEach(item => next.add(item.project.project_id));
        return next;
      });
      setInstalledProjectIds(prev => {
        const next = new Set(prev);
        toImport.forEach(item => next.add(item.project.project_id));
        return next;
      });
      addNotification({
        type: 'success',
        title: t('downloader.import_success_title'),
        message: t('downloader.import_success_plural', { count: filePaths.length })
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('downloader.import_failed_title'),
        message: err.message || String(err)
      });
    }
  };

  const versionOptions = projectVersions.map((v) => ({
    value: v.id,
    label: `${v.version_number} (${v.game_versions.join(', ')} • ${v.loaders.join(', ')})`,
  }));

  const placeholderText = t('downloader.search.placeholder_prefix', { platform: 'CurseForge' }) + (
    projectType === 'mod' ? ` ${t('downloader.type.mod')}...` :
      projectType === 'resourcepack' ? ` ${t('downloader.type.resourcepack')}...` :
        projectType === 'shader' ? ` ${t('downloader.type.shader')}...` :
          ` ${t('downloader.type.datapack')}...`
  );

  return (
    <div className={styles.container}>
      {isManualMode ? (
        <div className={styles.confirmContainer}>
          <div className={styles.confirmHeader}>
            <button className={styles.cancelBtn} onClick={openAllBlockedPages} type="button">
              {t('downloader.btn.open_all_pages')}
            </button>
          </div>
          <p className={styles.confirmDesc} style={{ margin: '0 0 16px 0', fontSize: '13px' }}>
            {t('downloader.manual_mode_desc')}
          </p>
          <div className={`${styles.confirmList} global-scrollbar`}>
            {blockedItems.map(item => {
              const sha1 = item.version.files[0]?.hashes?.sha1;
              const isDetected = sha1 && !!detectedFiles[sha1];
              const isImported = importedItems.has(item.project.project_id);

              return (
                <div key={item.project.project_id} className={`${styles.confirmItem} ${isDetected && !isImported ? styles.checked : ''}`} style={{ cursor: 'default' }}>
                  <span style={{ fontSize: '18px', display: 'flex', alignItems: 'center' }}><Package size={18} /></span>
                  <div className={styles.confirmItemMain}>
                    <span className={styles.confirmTitle}>{item.project.title}</span>
                    <span className={styles.confirmDesc}>{item.version.files[0]?.filename}</span>
                  </div>
                  <div className={styles.detailHeaderRight} style={{ alignItems: 'center' }}>
                    {isImported ? (
                      <span className={`${styles.tag} ${styles.installedTag}`}>{t('downloader.status.imported')}</span>
                    ) : isDetected ? (
                      <>
                        <span className={`${styles.tag} ${styles.updateTag}`}>{t('downloader.status.detected')}</span>
                        <button
                          className={styles.selectBtn}
                          onClick={() => handleImportBlockedItem(item)}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          {t('downloader.btn.import_now')}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`${styles.tag} ${styles.errorTag}`} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.1)' }}>
                          {t('downloader.status.waiting')}
                        </span>
                        <button
                          className={styles.cancelBtn}
                          onClick={() => {
                            const projectId = item.project.project_id;
                            const fileId = item.version.id;
                            invoke('open_in_browser', { url: `https://www.curseforge.com/projects/${projectId}/download/${fileId}` });
                          }}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          {t('downloader.btn.open_download_page')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.footer}>
            <div className={styles.selectionStatus}>
              {t('downloader.confirm_title', { confirmed: importedItems.size, total: blockedItems.length })}
            </div>
            <div className={styles.footerButtons}>
              <button className={styles.cancelBtn} onClick={onClose}>
                {t('common.close')}
              </button>
              <button
                className={styles.confirmInstallBtn}
                onClick={handleImportAllDetected}
                disabled={blockedItems.filter(item => {
                  const sha1 = item.version.files[0]?.hashes?.sha1;
                  return sha1 && detectedFiles[sha1] && !importedItems.has(item.project.project_id);
                }).length === 0}
              >
                {t('downloader.btn.import_all_detected')}
              </button>
            </div>
          </div>
        </div>
      ) : isSelectingConfirm ? (
        <div className={styles.confirmContainer}>
          <div className={styles.confirmHeader}>
            <span className={styles.modsCountTitle}>
              {t('downloader.confirm_title', { confirmed: confirmedSelection.size, total: confirmMods.length })}
            </span>
          </div>

          <div className={`${styles.confirmList} global-scrollbar`}>
            {confirmMods.map((item) => {
              const isCompatible = !!item.version;
              const isChecked = confirmedSelection.has(item.project.project_id);
              return (
                <div
                  key={item.project.project_id}
                  className={`${styles.confirmItem} ${!isCompatible ? styles.incompatible : ''} ${isChecked && isCompatible ? styles.checked : ''}`}
                  onClick={() => {
                    if (isCompatible) {
                      setConfirmedSelection(prev => {
                        const next = new Set(prev);
                        if (next.has(item.project.project_id)) {
                          next.delete(item.project.project_id);
                        } else {
                          next.add(item.project.project_id);
                        }
                        return next;
                      });
                    }
                  }}
                >
                  <SafeImage
                    src={item.project.icon_url}
                    alt={item.project.title}
                    className={styles.confirmIcon}
                    fallbackEmoji="📦"
                  />

                  <div className={styles.confirmItemMain}>
                    <div className={styles.confirmTitleRow}>
                      <span className={styles.confirmTitle}>{item.project.title}</span>
                      {item.isDependency && (
                        <span className={`${styles.tag} ${styles.dependencyTag}`}>
                          {t('downloader.label.dependency') || '依賴項目'}
                        </span>
                      )}
                    </div>
                    <span className={styles.confirmDesc}>
                      {isCompatible ? (
                        t('downloader.label.compatible_version', { version: item.version.version_number })
                      ) : (
                        <span className={styles.errorText}>{t('downloader.label.no_compatible_modrinth')}</span>
                      )}
                    </span>
                  </div>

                  <div className={styles.confirmItemMeta}>
                    {!isCompatible && (
                      <span className={`${styles.tag} ${styles.errorTag}`}>{t('downloader.label.incompatible')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 下載與安裝進度 Overlay */}
          {isDownloading && installProgress && (
            <div className={styles.hudOverlay}>
              <div className={styles.hudCard}>
                <div className={styles.hudHeader}>
                  <Loader className={`${styles.hudSpinner} animate-spin`} size={24} />
                  <span className={styles.hudTitle}>
                    {t('downloader.status.downloading_index', { current: installProgress.current, total: installProgress.total })}
                  </span>
                </div>
                <div className={styles.hudDetail}>{installProgress.name}</div>
                <div className={styles.hudProgressContainer}>
                  <div className={styles.hudProgressBar}>
                    <div
                      className={styles.hudProgressFill}
                      style={{ width: `${Math.round((installProgress.current / installProgress.total) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.hudPercent}>
                    {Math.round((installProgress.current / installProgress.total) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 確認清單頁底部按鈕 */}
          <div className={styles.footer}>
            <div className={styles.selectionStatus}>
              <span dangerouslySetInnerHTML={{
                __html: t('downloader.status.ready_count', { count: `<strong>${confirmedSelection.size}</strong>` })
              }} />
            </div>
            <div className={styles.footerButtons}>
              <button
                className={styles.cancelBtn}
                onClick={() => setIsSelectingConfirm(false)}
                disabled={isDownloading}
              >
                {t('downloader.btn.back_to_edit') || '返回修改'}
              </button>
              <button
                className={styles.confirmInstallBtn}
                onClick={handleConfirmInstall}
                disabled={isDownloading || confirmedSelection.size === 0}
              >
                {isDownloading ? <Loader className="animate-spin" size={14} /> : null}
                <span>{t('downloader.btn.confirm_download') || '確認並下載'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 左側：搜尋與結果列表 */}
          <div className={styles.leftColumn}>
            <div className={styles.searchArea}>
              <div className={styles.searchBarRow}>
                <div className={styles.searchInputWrapper}>
                  <input
                    type="text"
                    placeholder={placeholderText}
                    className={styles.input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {isSearching && (
                    <div className={styles.searchLoader}>
                      <Loader className="animate-spin" size={18} />
                    </div>
                  )}
                </div>
                <button
                  className={`${styles.filterToggleBtn} ${showFilters ? styles.active : ''}`}
                  onClick={() => setShowFilters(prev => !prev)}
                >
                  {t('downloader.filter.title')}
                </button>
              </div>

              {/* 進階篩選面板 */}
              {showFilters && (
                <div className={styles.filterPanel}>
                  {/* Minecraft 版本篩選 */}
                  <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>{t('downloader.filter.mc_version')}</span>
                    <div className={styles.versionSelectWrapper}>
                      <CustomSelect
                        value={selectedVersions[0] || gameVersion}
                        onChange={(val) => setSelectedVersions([val])}
                        options={allMinecraftVersions.map(ver => ({ value: ver, label: ver }))}
                      />
                    </div>
                  </div>

                  {/* 類型專屬分類篩選 */}
                  <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>{t('category.title') || '分類'}</span>
                    <div className={styles.categorySelectWrapper}>
                      <CustomSelect
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        options={categoryOptions}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 搜尋結果列表 */}
            <div className={`${styles.list} global-scrollbar`} onScroll={handleScroll}>
              {results.length > 0 ? (
                <>
                  {results.map((hit) => {
                    const isSelected = selectedProjects.has(hit.project_id);
                    const isActive = selectedProject?.project_id === hit.project_id;
                    return (
                      <div
                        key={hit.project_id}
                        className={`${styles.card} ${isSelected ? styles.selected : ''} ${isActive ? styles.active : ''}`}
                        onClick={() => handleSelectProject(hit)}
                        onDoubleClick={(e) => handleToggleSelectProject(hit, e)}
                      >
                        <SafeImage
                          src={hit.icon_url}
                          alt={hit.title}
                          className={styles.icon}
                          fallbackEmoji="📦"
                        />
                        <div className={styles.info}>
                          <div className={styles.titleRow}>
                            <div className={styles.title}>{hit.title}</div>
                            {updateProjectIds.has(hit.project_id) ? (
                              <span className={`${styles.tag} ${styles.updateTag}`}>{t('downloader.label.updatable')}</span>
                            ) : installedProjectIds.has(hit.project_id) ? (
                              <span className={`${styles.tag} ${styles.installedTag}`}>{t('downloader.label.installed')}</span>
                            ) : null}
                          </div>
                          <div className={styles.description}>{hit.description}</div>
                        </div>
                      </div>
                    );
                  })}
                  {isSearching && (
                    <div className={styles.loadMoreSpinner}>
                      <Loader className="animate-spin" size={18} />
                      <span>{t('downloader.status.loading') || '讀取中...'}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.placeholder}>
                  {query ? t('downloader.label.no_results') : t('downloader.label.start_search')}
                </div>
              )}
            </div>
          </div>

          {/* 右側：專案詳細資訊 */}
          <div className={styles.rightColumn}>
            {loadingDetails && !selectedProject ? (
              <div className={styles.loadingSpinner}>
                <Loader className="animate-spin" size={32} />
                <span>{t('downloader.status.loading')}</span>
              </div>
            ) : selectedProject ? (
              <div className={styles.detailLayout}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailHeaderLeft}>
                    <SafeImage
                      src={selectedProject.icon_url}
                      alt={selectedProject.title}
                      className={styles.detailIcon}
                      fallbackEmoji="📦"
                    />
                    <div className={styles.detailHeaderInfo}>
                      <h3 className={styles.detailTitle}>{selectedProject.title}</h3>
                      <span className={styles.detailProjectMeta}>
                        {t('downloader.label.project_id', { id: selectedProject.project_id })}
                      </span>
                    </div>
                  </div>

                  <div className={styles.detailHeaderRight}>
                    <div className={styles.versionSelector}>
                      <label className={styles.fieldLabel}>{t('downloader.label.supported_versions')}</label>
                      <CustomSelect
                        value={selectedVersionId}
                        onChange={handleVersionChange}
                        options={versionOptions}
                        disabled={loadingDetails || projectVersions.length === 0}
                        placeholder={projectVersions.length === 0 ? t('downloader.label.no_compatible_versions') : t('downloader.btn.select_version')}
                      />
                    </div>
                    {selectedProjects.has(selectedProject.project_id) ? (
                      <button
                        className={styles.unselectBtn}
                        onClick={() => handleToggleSelectProject(selectedProject)}
                      >
                        {t('downloader.btn.deselect') || '取消選取'}
                      </button>
                    ) : (
                      <button
                        className={styles.selectBtn}
                        onClick={() => handleToggleSelectProject(selectedProject)}
                        disabled={projectVersions.length === 0}
                      >
                        {t('downloader.btn.select_this') || '選取此項目'}
                      </button>
                    )}
                  </div>
                </div>

                <div className={`${styles.detailContent} global-scrollbar`}>
                  <div className={styles.contentSection}>
                    <h4>{t('downloader.label.project_description')}</h4>
                    <div
                      className={styles.projectBody}
                      dangerouslySetInnerHTML={{ __html: marked(projectBody) }}
                    />
                  </div>
                  {selectedVersionChangelog && (
                    <div className={styles.contentSection}>
                      <h4>{t('downloader.label.changelog')}</h4>
                      <div
                        className={styles.changelogBody}
                        dangerouslySetInnerHTML={{ __html: marked(selectedVersionChangelog) }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.placeholder}>
                {t('downloader.status.select_prompt')}
              </div>
            )}

            {/* 搜尋頁底部按鈕 */}
            <div className={styles.footer}>
              <div className={styles.selectionStatus}>
                {selectedProjects.size > 0 ? (
                  <span dangerouslySetInnerHTML={{
                    __html: t('downloader.status.selected_count', { count: `<strong>${selectedProjects.size}</strong>` })
                  }} />
                ) : (
                  <span>{t('downloader.status.select_checkbox_prompt')}</span>
                )}
              </div>
              <div className={styles.footerButtons}>
                <button className={styles.cancelBtn} onClick={onClose}>
                  {t('common.cancel')}
                </button>
                <button
                  className={styles.nextBtn}
                  onClick={handleNextStep}
                  disabled={selectedProjects.size === 0 || isTransitioning}
                >
                  {isTransitioning ? (
                    <>
                      <Loader className="animate-spin" size={14} />
                      <span>{t('downloader.status.parsing')}</span>
                    </>
                  ) : (
                    <span>{t('downloader.btn.next_step_versions')}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
