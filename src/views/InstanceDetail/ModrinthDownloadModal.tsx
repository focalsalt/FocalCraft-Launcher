import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { marked } from 'marked';
import { useAppStore } from '../../store/appStore';
import { CustomSelect } from '../../components/common/CustomSelect';
import { CustomMultiSelect } from '../../components/common/CustomMultiSelect';
import { SafeImage } from '../../components/common/SafeImage';
import { useI18n } from '../../utils/i18n';
import { HeaderState } from './DownloaderModal';
import styles from './ModrinthDownloadModal.module.css';

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

// 根據不同類型動態顯示對應的分類選項
const MODRINTH_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  mod: [
    { value: '', label: 'All (全部)' },
    { value: 'optimization', label: 'Optimization (優化)' },
    { value: 'technology', label: 'Technology (科技)' },
    { value: 'magic', label: 'Magic (魔法)' },
    { value: 'adventure', label: 'Adventure (冒險)' },
    { value: 'decoration', label: 'Decoration (裝飾)' },
    { value: 'utility', label: 'Utility (實用工具)' },
    { value: 'gameplay', label: 'Gameplay (遊戲機制)' },
    { value: 'library', label: 'Library (函式庫)' },
    { value: 'cursed', label: 'Cursed (詛咒)' },
    { value: 'economy', label: 'Economy (經濟)' },
    { value: 'equipment', label: 'Equipment (裝備)' },
    { value: 'food', label: 'Food (食物)' },
    { value: 'management', label: 'Management (管理)' },
    { value: 'minigame', label: 'Minigame (小遊戲)' },
    { value: 'mobs', label: 'Mobs (生物)' },
    { value: 'social', label: 'Social (社群)' },
    { value: 'storage', label: 'Storage (儲存)' },
    { value: 'transportation', label: 'Transportation (運輸)' },
    { value: 'worldgen', label: 'World Generation (世界生成)' }
  ],
  resourcepack: [
    { value: '', label: 'All (全部)' },
    { value: '16x', label: '16x' },
    { value: '32x', label: '32x' },
    { value: 'pvp', label: 'PvP' },
    { value: 'realistic', label: 'Realistic (寫實)' },
    { value: 'medieval', label: 'Medieval (中世紀)' },
    { value: 'modern', label: 'Modern (現代風)' },
    { value: 'font', label: 'Font (字體)' },
    { value: '3d', label: '3D' },
    { value: 'animated', label: 'Animated (動畫)' },
    { value: 'sci-fi', label: 'Sci-Fi (科幻)' },
    { value: '8x', label: '8x' },
    { value: '64x', label: '64x' },
    { value: '128x', label: '128x' },
    { value: '256x+', label: '256x+' }
  ],
  shader: [
    { value: '', label: 'All (全部)' },
    { value: 'realistic', label: 'Realistic (真實)' },
    { value: 'performance', label: 'Performance (效能輕量)' },
    { value: 'fantasy', label: 'Fantasy (奇幻)' },
    { value: 'toon', label: 'Toon (卡通)' },
    { value: 'vanilla', label: 'Vanilla (原版風)' }
  ],
  datapack: [
    { value: '', label: 'All (全部)' },
    { value: 'worldgen', label: 'World Generation (世界生成)' },
    { value: 'utility', label: 'Utility (實用工具)' },
    { value: 'gameplay', label: 'Gameplay (遊戲機制)' },
    { value: 'magic', label: 'Magic (魔法)' },
    { value: 'technology', label: 'Technology (科技)' },
    { value: 'adventure', label: 'Adventure (冒險)' },
    { value: 'challenge', label: 'Challenge (挑戰)' }
  ]
};

export function ModrinthDownloadModal({
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
  const [selectedLoader, setSelectedLoader] = useState<string>(loader);
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

  const categoryOptions = (MODRINTH_CATEGORIES[projectType] || []).map(opt => {
    if (language === 'en-US') {
      const cleanedLabel = opt.label.replace(/\s*\([\u4e00-\u9fa5]+\)/g, '');
      return { ...opt, label: cleanedLabel };
    }
    return opt;
  });

  // 獲取 Mojang 版本列表
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const manifest = await invoke<any>('get_minecraft_versions');
        const releases = manifest.versions
          .filter((v: any) => v.type === 'release')
          .map((v: any) => v.id);
        
        // 確保包含當前的 gameVersion，並過濾 1.0 至 26.2 之間的所有版本
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
      isManualMode: false,
      confirmModsCount: confirmMods.length,
      confirmedSelectionSize: confirmedSelection.size,
    });
  }, [isSelectingConfirm, confirmMods, confirmedSelection, onHeaderStateChange]);

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
      setSelectedLoader(loader);
      setSelectedCategory('');
      setShowFilters(false);
      setQuery('');
      setResults([]);
      setSelectedProject(null);
      setProjectBody('');
      setProjectVersions([]);
      setSelectedVersionId('');
      setSelectedVersionChangelog('');
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

        // 從 Modrinth 檢查更新
        const loaders = projectType === 'mod' ? [loader.toLowerCase()] : [];
        const resUpdates = await fetch('https://api.modrinth.com/v2/version_files/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'focal-craft-launcher',
          },
          body: JSON.stringify({
            hashes,
            algorithm: 'sha1',
            loaders,
            game_versions: [gameVersion],
          }),
        });

        const updateSet = new Set<string>();
        if (resUpdates.ok) {
          const updatesData = await resUpdates.json();
          const localHashesSet = new Set(hashes);
          Object.values(updatesData).forEach((ver: any) => {
            if (ver && ver.project_id && ver.files) {
              const hasSameHash = ver.files.some((f: any) => f.hashes?.sha1 && localHashesSet.has(f.hashes.sha1));
              if (!hasSameHash) {
                updateSet.add(ver.project_id);
              }
            }
          });
        }
        setUpdateProjectIds(updateSet);
      } catch (err) {
        console.error('檢查已安裝與更新項目失敗:', err);
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
  }, [query, isOpen, selectedVersions, selectedLoader, selectedCategory]);

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
      const res = await invoke<any>('search_modrinth', {
        query,
        projectType,
        gameVersions: selectedVersions,
        loader: projectType === 'mod' ? (selectedLoader === 'all' ? null : selectedLoader) : null,
        category: selectedCategory || null,
        offset: 0,
        limit: 20,
      });
      const hits = res.hits || [];
      setResults(hits);
      if (hits.length < 20) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('搜尋 Modrinth 失敗:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (isSearching || !hasMore) return;
    setIsSearching(true);
    try {
      const currentOffset = results.length;
      const res = await invoke<any>('search_modrinth', {
        query,
        projectType,
        gameVersions: selectedVersions,
        loader: projectType === 'mod' ? (selectedLoader === 'all' ? null : selectedLoader) : null,
        category: selectedCategory || null,
        offset: currentOffset,
        limit: 20,
      });
      const newHits = res.hits || [];
      if (newHits.length === 0) {
        setHasMore(false);
      } else {
        setResults((prev) => [...prev, ...newHits]);
        if (newHits.length < 20) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('載入更多 Modrinth 失敗:', err);
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
      const res = await fetch(`https://api.modrinth.com/v2/project/${hit.project_id}`);
      if (res.ok) {
        const detail = await res.json();
        setProjectBody(detail.body || detail.description || '');
      }

      const verRes = await fetch(`https://api.modrinth.com/v2/project/${hit.project_id}/version`);
      if (verRes.ok) {
        const versions = await verRes.json();
        const compatible = versions.filter((v: any) => {
          const matchesVersion = v.game_versions.some((gv: string) => selectedVersions.includes(gv));
          const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' ||
            selectedLoader.toLowerCase() === 'all' ||
            v.loaders.some((l: string) => l.toLowerCase() === selectedLoader.toLowerCase());
          return matchesVersion && matchesLoader && v.files.length > 0;
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

  // 遞迴解析依賴
  const resolveDependencies = async (
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

      const dependencies = current.version?.dependencies || [];
      const requiredDeps = dependencies.filter((dep: any) => dep.dependency_type === 'required' && dep.project_id);

      for (const dep of requiredDeps) {
        const depProjectId = dep.project_id;
        
        // 若已解析或已安裝，則跳過
        if (resolvedMap.has(depProjectId) || installedProjectIds.has(depProjectId)) {
          continue;
        }

        try {
          // 查詢專案詳細資訊
          const projRes = await fetch(`https://api.modrinth.com/v2/project/${depProjectId}`);
          if (!projRes.ok) continue;
          const projectData = await projRes.json();

          // 查詢版本清單並過濾相容版本
          const verRes = await fetch(`https://api.modrinth.com/v2/project/${depProjectId}/version`);
          if (!verRes.ok) continue;
          const versions = await verRes.json();

          const compatible = versions.filter((v: any) => {
            const matchesVersion = v.game_versions.some((gv: string) => selectedVersions.includes(gv));
            const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' ||
              selectedLoader.toLowerCase() === 'all' ||
              v.loaders.some((l: string) => l.toLowerCase() === selectedLoader.toLowerCase());
            return matchesVersion && matchesLoader && v.files.length > 0;
          });

          if (compatible.length > 0) {
            const depVer = compatible[0];
            const depItem = {
              project: {
                project_id: depProjectId,
                title: projectData.title,
                icon_url: projectData.icon_url,
                description: projectData.description || '',
              },
              version: depVer,
              isDependency: true, // 標記為自動解析的依賴
            };
            resolvedMap.set(depProjectId, depItem);
            queue.push(depItem);
          }
        } catch (err) {
          console.error(`解析依賴項 ${depProjectId} 失敗:`, err);
        }
      }
    }

    return Array.from(resolvedMap.values());
  };

  const handleNextStep = async () => {
    setIsTransitioning(true);
    try {
      // 確保使用者選取的所有專案都已經解析出對應的相容版本
      const initialResolved = await Promise.all(
        Array.from(selectedProjects.values()).map(async (item) => {
          if (item.version) {
            return { project: item.project, version: item.version, isDependency: false };
          }
          const res = await fetch(`https://api.modrinth.com/v2/project/${item.project.project_id}/version`);
          if (res.ok) {
            const versions = await res.json();
            const compatible = versions.filter((v: any) => {
              const matchesVersion = v.game_versions.some((gv: string) => selectedVersions.includes(gv));
              const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' ||
                selectedLoader.toLowerCase() === 'all' ||
                v.loaders.some((l: string) => l.toLowerCase() === selectedLoader.toLowerCase());
              return matchesVersion && matchesLoader && v.files.length > 0;
            });
            if (compatible.length > 0) {
              return { project: item.project, version: compatible[0], isDependency: false };
            }
          }
          return { project: item.project, version: null, isDependency: false };
        })
      );

      // 過濾掉找不到相容版本的專案
      const validInitial = initialResolved.filter(item => item.version);

      // 解析依賴
      const fullyResolved = await resolveDependencies(validInitial);

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
      console.error('加載模組版本與依賴失敗:', err);
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

    let successCount = 0;
    let failedNames: string[] = [];

    for (let i = 0; i < toInstall.length; i++) {
      const item = toInstall[i];
      setInstallProgress({
        current: i + 1,
        total: toInstall.length,
        name: item.project.title,
      });

      const ver = item.version;
      const file = ver.files.find((f: any) => f.primary) || ver.files[0];
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
        console.error(`安裝 ${item.project.title} 失敗:`, err);
        failedNames.push(item.project.title);
      }
    }

    setIsDownloading(false);
    setInstallProgress(null);

    if (successCount > 0) {
      onDownloadComplete();
    }

    if (failedNames.length > 0) {
      addNotification({
        type: 'error',
        title: t('downloader.partial_failed') || '安裝失敗',
        message: t('downloader.download_failed', { name: failedNames.join(', ') }) || `安裝 ${failedNames.join(', ')} 失敗`,
      });
    } else {
      onClose();
    }
  };

  const versionOptions = projectVersions.map((v) => ({
    value: v.id,
    label: `${v.version_number} (${v.game_versions.join(', ')} • ${v.loaders.join(', ')})`,
  }));

  const placeholderText = t('downloader.search.placeholder_prefix', { platform: 'Modrinth' }) + (
    projectType === 'mod' ? ` ${t('downloader.type.mod')}...` :
      projectType === 'resourcepack' ? ` ${t('downloader.type.resourcepack')}...` :
        projectType === 'shader' ? ` ${t('downloader.type.shader')}...` :
          ` ${t('downloader.type.datapack')}...`
  );

  return (
    <div className={styles.container}>
      {isSelectingConfirm ? (
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
                      <CustomMultiSelect
                        value={selectedVersions}
                        onChange={setSelectedVersions}
                        options={allMinecraftVersions.map(ver => ({ value: ver, label: ver }))}
                      />
                    </div>
                  </div>

                  {/* 模組加載器篩選 */}
                  {projectType === 'mod' && (
                    <div className={styles.filterGroup}>
                      <span className={styles.filterLabel}>{t('downloader.filter.loader')}</span>
                      <div className={styles.loaderSelectWrapper}>
                        <CustomSelect
                          value={selectedLoader}
                          onChange={setSelectedLoader}
                          options={[
                            { value: 'all', label: t('downloader.filter.loader_all') },
                            { value: 'Fabric', label: 'Fabric' },
                            { value: 'Forge', label: 'Forge' },
                            { value: 'NeoForge', label: 'NeoForge' },
                            { value: 'Quilt', label: 'Quilt' }
                          ]}
                        />
                      </div>
                    </div>
                  )}

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
