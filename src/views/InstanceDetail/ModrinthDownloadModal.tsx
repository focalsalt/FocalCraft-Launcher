import { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { marked } from 'marked';
import { useAppStore } from '../../store/appStore';
import { CustomSelect } from '../../components/common/CustomSelect';
import { SafeImage } from '../../components/common/SafeImage';
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
}

const RECOMMEND_CATEGORIES: Record<string, { label: string; value: string }[]> = {
  mod: [
    { label: '全部', value: '' },
    { label: '優化', value: 'optimization' },
    { label: '科技', value: 'technology' },
    { label: '魔法', value: 'magic' },
    { label: '冒險', value: 'adventure' },
    { label: '裝飾', value: 'decoration' },
    { label: '工具', value: 'utility' },
  ],
  resourcepack: [
    { label: '全部', value: '' },
    { label: '16x', value: '16x' },
    { label: '32x', value: '32x' },
    { label: 'PvP', value: 'pvp' },
    { label: '寫實', value: 'realistic' },
    { label: '中世紀', value: 'medieval' },
    { label: '現代風', value: 'modern' },
  ],
  shader: [
    { label: '全部', value: '' },
    { label: '真實光源', value: 'realistic' },
    { label: '效能輕量', value: 'performance' },
    { label: 'OptiFine', value: 'optifine' },
    { label: 'Iris', value: 'iris' },
  ],
  datapack: [
    { label: '全部', value: '' },
    { label: '世界生成', value: 'worldgen' },
    { label: '實用工具', value: 'utility' },
    { label: '遊戲機制', value: 'gameplay' },
    { label: '魔法', value: 'magic' },
  ],
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
}: Props) {
  const addNotification = useAppStore((state) => state.addNotification);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([gameVersion]);
  const [selectedLoader, setSelectedLoader] = useState<string>(loader);
  const [selectedCategory, setSelectedCategory] = useState<string>( '');
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);

  const categoriesList = RECOMMEND_CATEGORIES[projectType] || [];

  const popularVersions = Array.from(new Set([
    gameVersion,
    '1.21.1',
    '1.21',
    '1.20.6',
    '1.20.4',
    '1.20.2',
    '1.20.1',
    '1.19.4',
    '1.19.2',
    '1.18.2',
    '1.16.5',
    '1.12.2'
  ])).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [projectBody, setProjectBody] = useState('');
  const [projectVersions, setProjectVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedVersionChangelog, setSelectedVersionChangelog] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const [installedProjectIds, setInstalledProjectIds] = useState<Set<string>>(new Set());
  const [updateProjectIds, setUpdateProjectIds] = useState<Set<string>>(new Set());

  // New Selection & Multiple Download States
  const [selectedProjects, setSelectedProjects] = useState<Map<string, { project: any, version: any | null }>>(new Map());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSelectingConfirm, setIsSelectingConfirm] = useState(false);
  const [confirmMods, setConfirmMods] = useState<any[]>([]);
  const [confirmedSelection, setConfirmedSelection] = useState<Set<string>>(new Set());
  const [installProgress, setInstallProgress] = useState<{ current: number, total: number, name: string } | null>(null);

  // CurseForge & Manual Download States
  const [platform, setPlatform] = useState<'modrinth' | 'curseforge'>('modrinth');
  const [isManualMode, setIsManualMode] = useState(false);
  const [blockedItems, setBlockedItems] = useState<any[]>([]);
  const [detectedFiles, setDetectedFiles] = useState<Record<string, string>>({});
  const [importedItems, setImportedItems] = useState<Set<string>>(new Set());

  // Load installed items and check for updates
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
      setIsCategoriesExpanded(false);
      setQuery('');
      setResults([]);
      setSelectedProject(null);
      setProjectBody('');
      setProjectVersions([]);
      setSelectedVersionId('');
      setSelectedVersionChangelog('');
      
      // Reset CurseForge/Manual download states
      setPlatform('modrinth');
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

        // 1. Resolve project_ids of local files from Modrinth
        const resFiles = await fetch('https://api.modrinth.com/v2/version_files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'focal-craft-launcher'
          },
          body: JSON.stringify({
            hashes,
            algorithm: 'sha1'
          })
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

        // 2. Check for updates on Modrinth
        const loaders = projectType === 'mod' ? [loader.toLowerCase()] : [];
        const resUpdates = await fetch('https://api.modrinth.com/v2/version_files/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'focal-craft-launcher'
          },
          body: JSON.stringify({
            hashes,
            algorithm: 'sha1',
            loaders,
            game_versions: [gameVersion]
          })
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
        console.error('Failed to check installed items and updates:', err);
      }
    };

    checkInstalledAndUpdates();
  }, [isOpen, instanceId, projectType, gameVersion, loader]);

  const CURSEFORGE_CLASS_IDS: Record<string, number> = {
    mod: 6,
    resourcepack: 12,
    shader: 6552,
    datapack: 70886,
  };

  // Reset when platform changes
  useEffect(() => {
    setResults([]);
    setSelectedProject(null);
    setProjectBody('');
    setProjectVersions([]);
    setSelectedVersionId('');
    setSelectedVersionChangelog('');
    setQuery('');
    setSelectedProjects(new Map());
  }, [platform]);

  // Background Downloads scanner for blocked files
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
        console.error('Failed to scan downloads folder:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isManualMode, blockedItems]);

  // Search when modal opens, query, versions, loader or category changes (debounced)
  useEffect(() => {
    if (!isOpen) return;

    const delayDebounce = setTimeout(() => {
      handleSearch();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query, isOpen, selectedVersions, selectedLoader, selectedCategory, platform]);

  // Select the first item by default if results change
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

  if (!isOpen) return null;

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      if (platform === 'modrinth') {
        const res = await invoke<any>('search_modrinth', {
          query,
          projectType,
          gameVersions: selectedVersions,
          loader: projectType === 'mod' ? (selectedLoader === 'all' ? null : selectedLoader) : null,
          category: selectedCategory || null,
          offset: 0,
          limit: 20,
        });
        setResults(res.hits || []);
      } else {
        const classId = CURSEFORGE_CLASS_IDS[projectType] || 6;
        const versionStr = selectedVersions[0] || gameVersion;
        const res = await invoke<any>('search_curseforge', {
          query,
          classId,
          gameVersion: versionStr,
          searchIndex: 0,
          pageSize: 20,
        });
        const hits = (res.data || []).map((item: any) => ({
          project_id: item.id.toString(),
          title: item.name,
          description: item.summary || '',
          icon_url: item.logo?.url || '',
          raw: item
        }));
        setResults(hits);
      }
    } catch (err) {
      console.error('Failed to search:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProject = async (hit: any) => {
    setSelectedProject(hit);
    setProjectBody(hit.description || '');
    setProjectVersions([]);
    setSelectedVersionId('');
    setSelectedVersionChangelog('');
    setLoadingDetails(true);

    try {
      if (platform === 'modrinth') {
        // 1. Fetch detailed project description
        const projRes = await fetch(`https://api.modrinth.com/v2/project/${hit.project_id}`);
        if (projRes.ok) {
          const data = await projRes.json();
          setProjectBody(data.body || data.description || hit.description || '');
        }

        // 2. Fetch versions
        const verRes = await fetch(`https://api.modrinth.com/v2/project/${hit.project_id}/version`);
        if (verRes.ok) {
          const versions = await verRes.json();
          const compatible = versions.filter((v: any) => {
            const matchesVersion = v.game_versions.includes(gameVersion);
            const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' || 
              loader.toLowerCase() === 'vanilla' || 
              v.loaders.some((l: string) => l.toLowerCase() === loader.toLowerCase());
            return matchesVersion && matchesLoader && v.files.length > 0;
          });

          setProjectVersions(compatible);
          if (compatible.length > 0) {
            const firstVer = compatible[0];
            setSelectedVersionId(firstVer.id);
            setSelectedVersionChangelog(firstVer.changelog || '無更新日誌描述');

            setSelectedProjects((prev) => {
              if (!prev.has(hit.project_id)) return prev;
              const next = new Map(prev);
              next.set(hit.project_id, {
                ...next.get(hit.project_id)!,
                version: firstVer
              });
              return next;
            });
          }
        }
      } else {
        const modId = parseInt(hit.project_id, 10);
        const desc = await invoke<string>('get_curseforge_project_description', { modId });
        setProjectBody(desc || hit.description || '');

        const filesData = await invoke<any>('get_curseforge_project_files', { modId });
        const files = filesData.data || [];
        
        const compatible = files.filter((v: any) => {
          const matchesVersion = v.gameVersions.includes(gameVersion);
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
            changelog: v.releaseNotes || '無更新日誌描述',
            files: [{
              filename: v.fileName,
              url: v.downloadUrl,
              size: v.fileLength,
              hashes: { sha1: sha1Hash }
            }]
          };
        });

        setProjectVersions(compatible);
        if (compatible.length > 0) {
          const firstVer = compatible[0];
          setSelectedVersionId(firstVer.id);
          setSelectedVersionChangelog(firstVer.changelog || '無更新日誌描述');

          setSelectedProjects((prev) => {
            if (!prev.has(hit.project_id)) return prev;
            const next = new Map(prev);
            next.set(hit.project_id, {
              ...next.get(hit.project_id)!,
              version: firstVer
            });
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Failed to load project details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const ver = projectVersions.find((v) => v.id === versionId);
    if (ver) {
      setSelectedVersionChangelog(ver.changelog || '無更新日誌描述');

      setSelectedProjects((prev) => {
        if (!prev.has(selectedProject.project_id)) return prev;
        const next = new Map(prev);
        next.set(selectedProject.project_id, {
          ...next.get(selectedProject.project_id)!,
          version: ver
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

  const handleNextStep = async () => {
    setIsTransitioning(true);
    try {
      const resolved = await Promise.all(
        Array.from(selectedProjects.values()).map(async (item) => {
          if (item.version) {
            return item;
          }
          if (platform === 'modrinth') {
            const res = await fetch(`https://api.modrinth.com/v2/project/${item.project.project_id}/version`);
            if (res.ok) {
              const versions = await res.json();
              const compatible = versions.filter((v: any) => {
                const matchesVersion = v.game_versions.includes(gameVersion);
                const matchesLoader = projectType === 'resourcepack' || projectType === 'shader' || projectType === 'datapack' || 
                  loader.toLowerCase() === 'vanilla' || 
                  v.loaders.some((l: string) => l.toLowerCase() === loader.toLowerCase());
                return matchesVersion && matchesLoader && v.files.length > 0;
              });
              if (compatible.length > 0) {
                return { ...item, version: compatible[0] };
              }
            }
          } else {
            const modId = parseInt(item.project.project_id, 10);
            const filesData = await invoke<any>('get_curseforge_project_files', { modId });
            const files = filesData.data || [];
            
            const compatible = files.filter((v: any) => {
              const matchesVersion = v.gameVersions.includes(gameVersion);
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
                changelog: v.releaseNotes || '無更新日誌描述',
                files: [{
                  filename: v.fileName,
                  url: v.downloadUrl,
                  size: v.fileLength,
                  hashes: { sha1: sha1Hash }
                }]
              };
            });

            if (compatible.length > 0) {
              return { ...item, version: compatible[0] };
            }
          }
          return { ...item, version: null };
        })
      );

      setSelectedProjects((prev) => {
        const next = new Map(prev);
        resolved.forEach((item) => {
          next.set(item.project.project_id, item);
        });
        return next;
      });

      setConfirmMods(resolved);
      const initialChecked = new Set<string>();
      resolved.forEach((item) => {
        if (item.version) {
          initialChecked.add(item.project.project_id);
        }
      });
      setConfirmedSelection(initialChecked);
      setIsSelectingConfirm(true);
    } catch (err) {
      console.error('Failed to resolve mod versions:', err);
    } finally {
      setIsTransitioning(false);
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
      addNotification({ type: 'success', title: '導入成功', message: `已成功導入 ${item.project.title}` });
    } catch (err: any) {
      addNotification({ type: 'error', title: '導入失敗', message: err.message || String(err) });
    }
  };

  const handleImportAllDetected = async () => {
    const folderName = 
      projectType === 'mod' ? 'mods' : 
      projectType === 'resourcepack' ? 'resourcepacks' : 
      projectType === 'shader' ? 'shaderpacks' : 
      `saves/${datapackWorldFolder}/datapacks`;

    const toImport = blockedItems.filter(item => {
      const sha1 = item.version.files[0]?.hashes?.sha1;
      return sha1 && detectedFiles[sha1] && !importedItems.has(item.project.project_id);
    });

    const filePaths = toImport.map(item => detectedFiles[item.version.files[0].hashes.sha1]);

    if (filePaths.length === 0) return;

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
      addNotification({ type: 'success', title: '導入成功', message: `成功導入 ${filePaths.length} 個檔案` });
    } catch (err: any) {
      addNotification({ type: 'error', title: '導入失敗', message: err.message || String(err) });
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

    const blocked = toInstall.filter(item => !item.version.files[0]?.url);
    const allowed = toInstall.filter(item => item.version.files[0]?.url);

    let successCount = 0;
    let failedNames: string[] = [];

    // Download allowed files first
    for (let i = 0; i < allowed.length; i++) {
      const item = allowed[i];
      setInstallProgress({
        current: i + 1,
        total: allowed.length,
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

        // Update local states immediately
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
        console.error(`下載安裝 ${item.project.title} 失敗:`, err);
        failedNames.push(item.project.title);
      }
    }

    setIsDownloading(false);
    setInstallProgress(null);

    if (blocked.length > 0) {
      // Transition to Manual Mode
      setBlockedItems(blocked);
      setIsSelectingConfirm(false);
      setIsManualMode(true);
      if (successCount > 0) {
        addNotification({
          type: 'success',
          title: '已下載部分檔案',
          message: `已成功下載 ${successCount} 個允許直接下載的項目。其餘項目被 CurseForge 封鎖，請手動下載。`
        });
      }
    } else {
      onDownloadComplete();

      if (failedNames.length > 0) {
        addNotification({
          type: 'warning',
          title: '部分下載失敗',
          message: `成功: ${successCount} 個，失敗: ${failedNames.length} 個 (${failedNames.join(', ')})`
        });
      }

      if (successCount > 0) {
        setSelectedProjects(new Map());
        setIsSelectingConfirm(false);
        onClose(); // Automatically close on success
      }
    }
  };

  const placeholderText = 
    projectType === 'mod' ? `搜尋 ${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'} 模組...` : 
    projectType === 'resourcepack' ? `搜尋 ${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'} 資源包...` : 
    projectType === 'shader' ? `搜尋 ${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'} 光影包...` : 
    `搜尋 ${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'} 資料包...`;

  const versionOptions = projectVersions.map((v) => ({
    value: v.id,
    label: `${v.version_number} (${v.game_versions.join(', ')} • ${v.loaders.join(', ')})`
  }));

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{
            projectType === 'mod' ? `下載模組 (${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'})` :
            projectType === 'resourcepack' ? `下載資源包 (${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'})` :
            projectType === 'shader' ? `下載光影包 (${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'})` :
            `下載資料包 (${platform === 'modrinth' ? 'Modrinth' : 'CurseForge'})`
          }</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {isManualMode ? (
          <div className={styles.manualContainer}>
            <div className={styles.manualHeader}>
              <span className={styles.manualTitle}>⚠️ 防封鎖手動下載模式</span>
              <button 
                className={styles.openPageBtn}
                onClick={openAllBlockedPages}
              >
                一鍵開啟所有下載頁面
              </button>
            </div>
            <p className={styles.manualDesc}>
              由於 CurseForge 限制第三方直接下載部分模組，請點擊「開啟下載頁」下載模組檔案（下載後檔案將位於本機的「下載 (Downloads)」資料夾）。
              啟動器將會自動在背景掃描該資料夾，並在比對雜湊值成功後提示導入。
            </p>
            <div className={`${styles.manualList} global-scrollbar`}>
              {blockedItems.map(item => {
                const sha1 = item.version.files[0]?.hashes?.sha1;
                const isDetected = sha1 && !!detectedFiles[sha1];
                const isImported = importedItems.has(item.project.project_id);
                
                return (
                  <div key={item.project.project_id} className={`${styles.manualItem} ${isDetected && !isImported ? styles.detected : ''}`}>
                    <span className={styles.manualItemIcon}>📦</span>
                    <div className={styles.manualItemMain}>
                      <span className={styles.manualItemTitle}>{item.project.title}</span>
                      <span className={styles.manualItemFile}>{item.version.files[0]?.filename}</span>
                    </div>
                    <div className={styles.manualItemActions}>
                      {isImported ? (
                        <span className={styles.importedTag}>已導入</span>
                      ) : isDetected ? (
                        <>
                          <span className={`${styles.manualItemStatus} ${styles.found}`}>已偵測到檔案</span>
                          <button 
                            className={styles.importBtn}
                            onClick={() => handleImportBlockedItem(item)}
                          >
                            立即導入
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`${styles.manualItemStatus} ${styles.waiting}`}>等待下載...</span>
                          <button 
                            className={styles.openPageBtn}
                            onClick={() => {
                              const projectId = item.project.project_id;
                              const fileId = item.version.id;
                              invoke('open_in_browser', { url: `https://www.curseforge.com/projects/${projectId}/download/${fileId}` });
                            }}
                          >
                            開啟下載頁
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isSelectingConfirm ? (
          <div className={styles.confirmContainer}>
            <div className={styles.confirmHeader}>
              <span className={styles.modsCountTitle}>
                📥 確認下載清單 ({confirmedSelection.size} / {confirmMods.length} 個)
              </span>
              <div className={styles.toggleAllContainer}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={
                      confirmMods.filter(m => m.version).length > 0 &&
                      confirmedSelection.size === confirmMods.filter(m => m.version).length
                    }
                    ref={(el) => {
                      if (el) {
                        const compatibleCount = confirmMods.filter(m => m.version).length;
                        el.indeterminate = confirmedSelection.size > 0 && confirmedSelection.size < compatibleCount;
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const compatible = confirmMods.filter(m => m.version).map(m => m.project.project_id);
                        setConfirmedSelection(new Set(compatible));
                      } else {
                        setConfirmedSelection(new Set());
                      }
                    }}
                  />
                  <span>全選</span>
                </label>
              </div>
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
                    <label className={styles.checkboxLabel} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isChecked && isCompatible}
                        disabled={!isCompatible}
                        onChange={() => {
                          setConfirmedSelection(prev => {
                            const next = new Set(prev);
                            if (next.has(item.project.project_id)) {
                              next.delete(item.project.project_id);
                            } else {
                              next.add(item.project.project_id);
                            }
                            return next;
                          });
                        }}
                      />
                    </label>

                    <SafeImage 
                      src={item.project.icon_url} 
                      alt={item.project.title} 
                      className={styles.confirmIcon} 
                      fallbackEmoji="📦"
                    />

                    <div className={styles.confirmItemMain}>
                      <span className={styles.confirmTitle}>{item.project.title}</span>
                      <span className={styles.confirmDesc}>
                        {isCompatible ? (
                          `相容版本: ${item.version.version_number}`
                        ) : (
                          <span className={styles.errorText}>找不到相容當前遊戲版本的 Modrinth 檔案</span>
                        )}
                      </span>
                    </div>

                    <div className={styles.confirmItemMeta}>
                      {isCompatible ? (
                        <span className={styles.sizeText}>
                          {item.version.files[0] ? `${(item.version.files[0].size / 1024 / 1024).toFixed(2)} MB` : '未知大小'}
                        </span>
                      ) : (
                        <span className={`${styles.tag} ${styles.errorTag}`}>不相容</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.container}>
            {/* Left Column: Search & List */}
            <div className={styles.leftColumn}>
              <div className={styles.platformTabs}>
                <button 
                  className={`${styles.platformTab} ${platform === 'modrinth' ? styles.active : ''}`}
                  onClick={() => setPlatform('modrinth')}
                  type="button"
                >
                  Modrinth
                </button>
                <button 
                  className={`${styles.platformTab} ${platform === 'curseforge' ? styles.active : ''}`}
                  onClick={() => setPlatform('curseforge')}
                  type="button"
                >
                  CurseForge
                </button>
              </div>
              <div className={styles.searchArea}>
                <div className={styles.searchBarRow}>
                  <input 
                    type="text" 
                    placeholder={placeholderText} 
                    className={styles.input} 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button 
                    className={`${styles.filterToggleBtn} ${showFilters ? styles.active : ''}`}
                    onClick={() => setShowFilters(prev => !prev)}
                  >
                    篩選條件
                  </button>
                  {isSearching && (
                    <div className={styles.searchLoader}>
                      <Loader className="animate-spin" size={18} />
                    </div>
                  )}
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
                  <div className={styles.filterPanel}>
                    <div className={styles.filterGroup}>
                      <span className={styles.filterLabel}>Minecraft 版本篩選 (多選)</span>
                      <div className={styles.checkboxGroup}>
                        {popularVersions.map(ver => {
                          const isChecked = selectedVersions.includes(ver);
                          return (
                            <label key={ver} className={styles.checkboxLabel}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedVersions(prev => {
                                    if (prev.includes(ver)) {
                                      if (prev.length === 1) return prev;
                                      return prev.filter(v => v !== ver);
                                    } else {
                                      return [...prev, ver];
                                    }
                                  });
                                }}
                              />
                              <span>{ver}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {projectType === 'mod' && (
                      <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>載入器篩選 (Loader)</span>
                        <div className={styles.loaderSelectWrapper}>
                          <CustomSelect
                            value={selectedLoader}
                            onChange={(val) => setSelectedLoader(val)}
                            options={[
                              { value: 'all', label: '全部' },
                              { value: 'Fabric', label: 'Fabric' },
                              { value: 'Forge', label: 'Forge' },
                              { value: 'NeoForge', label: 'NeoForge' },
                              { value: 'Quilt', label: 'Quilt' }
                            ]}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommend Categories tag wrapper (collapsible) */}
                <div className={styles.categoriesWrapper}>
                  <div className={`${styles.categoriesRow} ${isCategoriesExpanded ? styles.expanded : styles.collapsed}`}>
                    {categoriesList.map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        className={`${styles.categoryTag} ${selectedCategory === cat.value ? styles.active : ''}`}
                        onClick={() => setSelectedCategory(cat.value)}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {categoriesList.length > 5 && (
                    <button 
                      type="button"
                      className={styles.categoriesToggleBtn}
                      onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                    >
                      {isCategoriesExpanded ? '收合' : '更多'}
                    </button>
                  )}
                </div>
              </div>

              <div key={platform} className={`${styles.list} global-scrollbar`}>
                {results.length > 0 ? (
                  results.map((hit) => {
                    const isSelected = selectedProject?.project_id === hit.project_id;
                    const isChecked = selectedProjects.has(hit.project_id);
                    return (
                      <div 
                        key={hit.project_id} 
                        className={`${styles.card} ${isSelected ? styles.selected : ''}`}
                        onClick={() => handleSelectProject(hit)}
                      >
                        <label className={styles.cardCheckbox} onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleToggleSelectProject(hit)}
                          />
                        </label>

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
                              <span className={`${styles.tag} ${styles.updateTag}`}>可更新</span>
                            ) : installedProjectIds.has(hit.project_id) ? (
                              <span className={`${styles.tag} ${styles.installedTag}`}>已安裝</span>
                            ) : null}
                          </div>
                          <div className={styles.description}>{hit.description}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.placeholder}>
                    {query ? '無符合條件的結果' : '輸入關鍵字開始搜尋'}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Detailed View */}
            <div className={styles.rightColumn}>
              {loadingDetails && !selectedProject ? (
                <div className={styles.loadingSpinner}>
                  <Loader className="animate-spin" size={32} />
                  <span>讀取中...</span>
                </div>
              ) : selectedProject ? (
                <div className={styles.detailLayout}>
                  {/* Header */}
                  <div className={styles.detailHeader}>
                    <SafeImage 
                      src={selectedProject.icon_url} 
                      alt={selectedProject.title} 
                      className={styles.detailIcon} 
                      fallbackEmoji="📦"
                    />
                    <div className={styles.detailHeaderInfo}>
                      <h3 className={styles.detailTitle}>{selectedProject.title}</h3>
                      <span className={styles.detailProjectMeta}>專案 ID: {selectedProject.project_id}</span>
                    </div>
                  </div>

                  {/* Installation & Version Selection */}
                  <div className={styles.installationBar}>
                    <div className={styles.versionSelector}>
                      <label className={styles.fieldLabel}>適用版本</label>
                      <CustomSelect
                        value={selectedVersionId}
                        onChange={handleVersionChange}
                        options={versionOptions}
                        disabled={loadingDetails || projectVersions.length === 0}
                        placeholder={projectVersions.length === 0 ? '無相容的版本' : '選擇版本'}
                      />
                    </div>
                    {selectedProjects.has(selectedProject.project_id) ? (
                      <button 
                        className={styles.unselectBtn} 
                        onClick={() => handleToggleSelectProject(selectedProject)}
                      >
                        <span>取消選取</span>
                      </button>
                    ) : (
                      <button 
                        className={styles.selectBtn} 
                        onClick={() => handleToggleSelectProject(selectedProject)}
                        disabled={projectVersions.length === 0}
                      >
                        <span>選取此項目</span>
                      </button>
                    )}
                  </div>

                  {/* Body Tabs / Changelog */}
                  <div className={`${styles.detailContent} global-scrollbar`}>
                    <div className={styles.contentSection}>
                      <h4>詳細說明</h4>
                      <div 
                        className={styles.projectBody}
                        dangerouslySetInnerHTML={{ 
                          __html: platform === 'modrinth' 
                            ? (marked.parse(projectBody) as string) 
                            : projectBody 
                        }}
                      />
                    </div>

                    {selectedVersionId && (
                      <div className={styles.contentSection}>
                        <h4>更新日誌 (Changelog)</h4>
                        <div 
                          className={styles.changelogBody}
                          dangerouslySetInnerHTML={{ 
                            __html: platform === 'modrinth' 
                              ? (marked.parse(selectedVersionChangelog) as string) 
                              : selectedVersionChangelog 
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.placeholder}>
                  <span>請選擇一個項目以查看詳細資訊</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          {isManualMode ? (
            <>
              <div className={styles.selectionStatus}>
                <span>已導入 <strong>{importedItems.size}</strong> / {blockedItems.length} 個檔案</span>
              </div>
              <div className={styles.footerButtons}>
                <button 
                  className={styles.cancelBtn} 
                  onClick={onClose}
                >
                  關閉
                </button>
                <button 
                  className={styles.confirmInstallBtn} 
                  onClick={handleImportAllDetected}
                  disabled={blockedItems.filter(item => {
                    const sha1 = item.version.files[0]?.hashes?.sha1;
                    return sha1 && detectedFiles[sha1] && !importedItems.has(item.project.project_id);
                  }).length === 0}
                >
                  一鍵導入已偵測檔案
                </button>
              </div>
            </>
          ) : !isSelectingConfirm ? (
            <>
              <div className={styles.selectionStatus}>
                {selectedProjects.size > 0 ? (
                  <span>已選取 <strong>{selectedProjects.size}</strong> 個項目</span>
                ) : (
                  <span>請在左側勾選或右側選取要下載的項目</span>
                )}
              </div>
              <div className={styles.footerButtons}>
                <button 
                  className={styles.cancelBtn} 
                  onClick={onClose}
                >
                  取消
                </button>
                <button 
                  className={styles.nextBtn} 
                  onClick={handleNextStep}
                  disabled={selectedProjects.size === 0 || isTransitioning}
                >
                  {isTransitioning ? (
                    <>
                      <Loader className="animate-spin" size={14} />
                      <span>解析中...</span>
                    </>
                  ) : (
                    <span>下一步 (選擇版本)</span>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.selectionStatus}>
                <span>已選取 <strong>{confirmedSelection.size}</strong> 個項目準備下載</span>
              </div>
              <div className={styles.footerButtons}>
                <button 
                  className={styles.cancelBtn} 
                  onClick={() => setIsSelectingConfirm(false)}
                  disabled={isDownloading}
                >
                  返回修改
                </button>
                <button 
                  className={styles.confirmInstallBtn} 
                  onClick={handleConfirmInstall}
                  disabled={isDownloading || confirmedSelection.size === 0}
                >
                  {isDownloading ? (
                    <>
                      <Loader className="animate-spin" size={14} />
                      <span>下載中...</span>
                    </>
                  ) : (
                    <span>確認並下載</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {installProgress && (
        <div className={styles.progressOverlay}>
          <div className={styles.progressCard}>
            <Loader className="animate-spin" size={32} />
            <div className={styles.progressText}>
              正在下載項目 ({installProgress.current} / {installProgress.total})
            </div>
            <div className={styles.progressName}>{installProgress.name}</div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${(installProgress.current / installProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
