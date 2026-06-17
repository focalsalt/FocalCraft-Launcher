import { useState, useEffect, useMemo } from 'react';
import { X, Upload, Loader } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useInstanceStore } from '../../store/instanceStore';
import { useAppStore } from '../../store/appStore';
import { CustomSelect } from '../../components/common/CustomSelect';
import { getMajorVersionGroup } from '../../utils/versionUtils';
import { useI18n, translateVersionGroup } from '../../utils/i18n';
import styles from './InstanceDetail.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  instance: {
    id: string;
    name: string;
    version: string;
    modloader: string;
    loaderVersion?: string | null;
    modrinthProjectId?: string | null;
    modrinthVersionId?: string | null;
  };
  onSaveComplete: () => void;
}

interface ModToUpdate {
  localMod: any;
  project_id: string;
  compatibleVersions: any[];
  selectedVersionId: string;
  shouldUpdate: boolean;
}

interface ModToDisable {
  localMod: any;
  shouldDisable: boolean;
}

export function VersionEditModal({ isOpen, onClose, instance, onSaveComplete }: Props) {
  const updateInstanceConfig = useInstanceStore((state) => state.updateInstanceConfig);
  const addNotification = useAppStore((state) => state.addNotification);
  const { t } = useI18n();

  const instId       = instance.id;
  const instVersion  = instance.version;
  const instLoader   = instance.modloader;
  const instLoaderV  = instance.loaderVersion ?? '';

  const [mcVersion, setMcVersion] = useState(instance.version);
  const [loaderType, setLoaderType] = useState(instance.modloader);
  const [loaderVersion, setLoaderVersion] = useState(instance.loaderVersion || '');
  const [loaderVersionsList, setLoaderVersionsList] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [majorFilterForEdit, setMajorFilterForEdit] = useState<'release' | 'history'>('release');
  const [minorFilterForEdit, setMinorFilterForEdit] = useState<'release' | 'snapshot'>('release');
  const [rawVersions, setRawVersions] = useState<{ id: string; type: string }[]>([]);
  const [selectedMajorVersionForEdit, setSelectedMajorVersionForEdit] = useState<string>('');

  const [customLoaderJarPath, setCustomLoaderJarPath] = useState('');
  const [customLoaderJarName, setCustomLoaderJarName] = useState('');
  const [isDragOverCustom, setIsDragOverCustom] = useState(false);
  const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false);

  // 相容性檢查步驟與狀態
  const [step, setStep] = useState<'form' | 'checking' | 'compatibility' | 'updating'>('form');
  const [modsToUpdate, setModsToUpdate] = useState<ModToUpdate[]>([]);
  const [modsToDisable, setModsToDisable] = useState<ModToDisable[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setIsDragOverCustom(false);
      return;
    }

    setMcVersion(instance.version);
    setLoaderType(instance.modloader);
    setLoaderVersion(instance.loaderVersion || '');
    if (instance.modloader === 'Custom') {
      setCustomLoaderJarName('custom_loader.jar');
      setCustomLoaderJarPath('EXISTING');
    } else {
      setCustomLoaderJarName('');
      setCustomLoaderJarPath('');
    }
    setLoadingVersions(true);
    setStep('form');
    setModsToUpdate([]);
    setModsToDisable([]);

    const initVersions = async () => {
      try {
        const manifest = await invoke<any>('get_minecraft_versions');
        const fetchedVersions = manifest.versions || [];
        setRawVersions(fetchedVersions);

        const currentVer = instance.version;
        const isReleaseType = fetchedVersions.find((v: any) => v.id === currentVer)?.type === 'release';
        const majorGroup = getMajorVersionGroup(currentVer);
        const isStd = /^\d+\.\d+\.X$/.test(majorGroup);

        if (isStd) {
          setMajorFilterForEdit('release');
          setMinorFilterForEdit(isReleaseType ? 'release' : 'snapshot');
        } else {
          setMajorFilterForEdit('history');
        }
        setSelectedMajorVersionForEdit(majorGroup);
      } catch (err) {
        console.error('Failed to initialize versions manifest:', err);
      } finally {
        setLoadingVersions(false);
      }
    };

    initVersions();
  }, [isOpen, instId, instVersion, instLoader, instLoaderV]);

  // 當版本或載入器變更時取得版本列表
  useEffect(() => {
    const isSupportedLoader = loaderType === 'Fabric' || loaderType === 'Forge' || loaderType === 'NeoForge';
    if (isSupportedLoader && mcVersion && isOpen) {
      setLoadingLoaderVersions(true);
      invoke<string[]>('get_loader_versions', { modloader: loaderType, gameVersion: mcVersion })
        .then((versionsList) => {
          setLoaderVersionsList(versionsList);
          if (loaderType === instance.modloader && versionsList.includes(instance.loaderVersion || '')) {
            setLoaderVersion(instance.loaderVersion || '');
          } else if (versionsList.length > 0) {
            setLoaderVersion(versionsList[0]);
          } else {
            setLoaderVersion('');
          }
        })
        .catch((err) => {
          console.error(`Error fetching loader versions for ${loaderType}:`, err);
          setLoaderVersionsList([]);
          setLoaderVersion('');
        })
        .finally(() => {
          setLoadingLoaderVersions(false);
        });
    } else {
      setLoaderVersionsList([]);
      setLoaderVersion('');
    }
  }, [mcVersion, loaderType, isOpen, instVersion, instLoader, instLoaderV]);

  // 監聽拖放自訂載入器事件
  useEffect(() => {
    if (!isOpen) {
      setIsDragOverCustom(false);
      return;
    }

    let unlistenPromise: Promise<() => void> | undefined;

    try {
      const appWindow = getCurrentWindow();
      unlistenPromise = appWindow.onDragDropEvent((event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          if (loaderType === 'Custom') {
            setIsDragOverCustom(true);
          }
        } else if (event.payload.type === 'drop') {
          setIsDragOverCustom(false);
          if (event.payload.paths && event.payload.paths.length > 0) {
            const droppedPath = event.payload.paths[0];
            if (loaderType === 'Custom') {
              handleCustomLoaderDropped(droppedPath);
            }
          }
        } else if (event.payload.type === 'leave') {
          setIsDragOverCustom(false);
        }
      });
    } catch (err) {
      console.error('Failed to register native drag drop in VersionEditModal:', err);
    }

    return () => {
      if (unlistenPromise) {
        unlistenPromise.then(unlisten => unlisten());
      }
    };
  }, [isOpen, loaderType]);

  const handleCustomLoaderDropped = (path: string) => {
    if (!path.toLowerCase().endsWith('.jar')) {
      addNotification({
        type: 'warning',
        title: t('version_edit.notification.invalid_format.title'),
        message: t('version_edit.notification.invalid_format.msg')
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
        title: t('version_edit.custom_loader_label'),
        filter: "Java Archive (*.jar)|*.jar"
      });
      if (path === 'CANCELLED') return;
      handleCustomLoaderDropped(path);
    } catch (err) {
      addNotification({ type: 'error', title: t('version_edit.notification.select_file_failed'), message: String(err) });
    }
  };

  const handleMcVersionChangeForEdit = (ver: string) => {
    setMcVersion(ver);
  };

  const handleLoaderTypeChangeForEdit = (type: string) => {
    setLoaderType(type);
  };

  const majorVersionsDataForEdit = useMemo(() => {
    const firstRelease = rawVersions.find((v) => v.type === 'release');
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
    const allGroupMap: Record<string, typeof rawVersions> = {};

    rawVersions.forEach((v) => {
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

    const groups: string[] = [];
    const groupMap: Record<string, typeof rawVersions> = {};

    const isStandardGroup = (groupName: string): boolean => {
      return /^\d+\.\d+\.X$/.test(groupName);
    };

    allGroups.forEach((g) => {
      const isStd = isStandardGroup(g);
      
      if (majorFilterForEdit === 'release') {
        if (!isStd) return;
        
        const filteredItems = allGroupMap[g].filter((v) => {
          if (minorFilterForEdit === 'release') {
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
        if (isStd) return;
        groups.push(g);
        groupMap[g] = allGroupMap[g];
      }
    });

    return { groups, groupMap };
  }, [rawVersions, majorFilterForEdit, minorFilterForEdit]);

  useEffect(() => {
    if (majorVersionsDataForEdit.groups.length > 0) {
      if (!selectedMajorVersionForEdit || !majorVersionsDataForEdit.groups.includes(selectedMajorVersionForEdit)) {
        const defaultGroup = majorVersionsDataForEdit.groups[0];
        setSelectedMajorVersionForEdit(defaultGroup);
        
        const defaultMinor = majorVersionsDataForEdit.groupMap[defaultGroup]?.[0]?.id;
        if (defaultMinor) {
          handleMcVersionChangeForEdit(defaultMinor);
        }
      } else {
        const availableMinors = majorVersionsDataForEdit.groupMap[selectedMajorVersionForEdit] || [];
        const isCurrentVersionValid = availableMinors.some((v) => v.id === mcVersion);
        if (!isCurrentVersionValid && availableMinors.length > 0) {
          handleMcVersionChangeForEdit(availableMinors[0].id);
        }
      }
    }
  }, [majorVersionsDataForEdit, selectedMajorVersionForEdit, mcVersion]);

  const handleMajorVersionChangeForEdit = (majorVer: string) => {
    setSelectedMajorVersionForEdit(majorVer);
    const minors = majorVersionsDataForEdit.groupMap[majorVer] || [];
    if (minors.length > 0) {
      handleMcVersionChangeForEdit(minors[0].id);
    }
  };

  const handleSaveVersion = async () => {
    if (loaderType === 'Custom' && !customLoaderJarPath) {
      addNotification({
        type: 'warning',
        title: t('version_edit.notification.missing_loader.title'),
        message: t('version_edit.notification.missing_loader.msg')
      });
      return;
    }

    const isVersionOrLoaderChanged = mcVersion !== instance.version || loaderType !== instance.modloader || loaderVersion !== (instance.loaderVersion ?? '');

    if (!isVersionOrLoaderChanged) {
      onClose();
      return;
    }

    if (loaderType === 'Custom') {
      await executeDirectSave();
      return;
    }

    setStep('checking');
    try {
      const installedMods = await invoke<any[]>('get_installed_mods', { instanceId: instance.id });
      const enabledMods = installedMods.filter(m => m.enabled);

      if (enabledMods.length === 0) {
        await executeDirectSave();
        return;
      }

      const hashes = enabledMods.map(m => m.sha1).filter(h => h && h.trim() !== '');
      let fileLookupResponse: Record<string, any> = {};

      if (hashes.length > 0) {
        const res = await fetch('https://api.modrinth.com/v2/version_files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'focal-craft-launcher' },
          body: JSON.stringify({
            hashes,
            algorithm: 'sha1',
          })
        });

        if (res.ok) {
          fileLookupResponse = await res.json();
        }
      }

      const toUpdate: ModToUpdate[] = [];
      const toDisable: ModToDisable[] = [];

      const matchedMods = enabledMods.filter(mod => mod.sha1 && fileLookupResponse[mod.sha1]);
      const unmatchedMods = enabledMods.filter(mod => !mod.sha1 || !fileLookupResponse[mod.sha1]);

      const projectIds = Array.from(new Set(matchedMods.map(m => fileLookupResponse[m.sha1].project_id)));

      const projectVersionsMap: Record<string, any[]> = {};
      await Promise.all(
        projectIds.map(async (projectId) => {
          try {
            const verRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`);
            if (verRes.ok) {
              const versions = await verRes.json();
              projectVersionsMap[projectId] = versions;
            }
          } catch (err) {
            console.error(`Failed to fetch versions for project ${projectId}:`, err);
          }
        })
      );

      for (const mod of matchedMods) {
        const fileInfo = fileLookupResponse[mod.sha1];
        const projectId = fileInfo.project_id;
        const allVersions = projectVersionsMap[projectId] || [];

        const compatibleVersions = allVersions.filter((v: any) => {
          const matchesVersion = v.game_versions.includes(mcVersion);
          const matchesLoader = loaderType === 'Vanilla' ? true : v.loaders.map((l: string) => l.toLowerCase()).includes(loaderType.toLowerCase());
          return matchesVersion && matchesLoader && v.files.length > 0;
        });

        if (compatibleVersions.length > 0) {
          const defaultVersion = compatibleVersions[0];
          const defaultFile = defaultVersion.files.find((f: any) => f.primary) || defaultVersion.files[0];
          const isAlreadyLatestCompatible = defaultFile && defaultFile.hashes.sha1 === mod.sha1;

          toUpdate.push({
            localMod: mod,
            project_id: projectId,
            compatibleVersions,
            selectedVersionId: defaultVersion.id,
            shouldUpdate: !isAlreadyLatestCompatible,
          });
        } else {
          toDisable.push({
            localMod: mod,
            shouldDisable: true,
          });
        }
      }

      for (const mod of unmatchedMods) {
        toDisable.push({
          localMod: mod,
          shouldDisable: true,
        });
      }

      if (toUpdate.length === 0 && toDisable.length === 0) {
        await executeDirectSave();
      } else {
        setModsToUpdate(toUpdate);
        setModsToDisable(toDisable);
        setStep('compatibility');
      }
    } catch (err) {
      console.error('Failed to run compatibility check:', err);
      await executeDirectSave();
    }
  };

  const executeDirectSave = async () => {
    try {
      let finalLoaderVersion = undefined;
      if (loaderType === 'Fabric' || loaderType === 'Forge' || loaderType === 'NeoForge') {
        finalLoaderVersion = loaderVersion;
      } else if (loaderType === 'Custom') {
        finalLoaderVersion = instance.loaderVersion || undefined;
      }

      await updateInstanceConfig(
        instance.id,
        instance.name,
        mcVersion,
        loaderType,
        finalLoaderVersion,
        instance.modrinthProjectId || undefined,
        instance.modrinthVersionId || undefined
      );

      if (loaderType === 'Custom' && customLoaderJarPath && customLoaderJarPath !== 'EXISTING') {
        await invoke('upload_custom_loader_jar', { instanceId: instance.id, sourcePath: customLoaderJarPath });
      }

      addNotification({
        type: 'success',
        title: t('version_edit.notification.success.title'),
        message: t('version_edit.notification.success.msg')
      });
      onSaveComplete();
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('version_edit.notification.failed.title'),
        message: String(err)
      });
      setStep('form');
    }
  };

  const executeMigration = async () => {
    setStep('updating');
    try {
      // 1. 更新實例版本
      let finalLoaderVersion = undefined;
      if (loaderType === 'Fabric' || loaderType === 'Forge' || loaderType === 'NeoForge') {
        finalLoaderVersion = loaderVersion;
      } else if (loaderType === 'Custom') {
        finalLoaderVersion = instance.loaderVersion || undefined;
      }

      await updateInstanceConfig(
        instance.id,
        instance.name,
        mcVersion,
        loaderType,
        finalLoaderVersion,
        instance.modrinthProjectId || undefined,
        instance.modrinthVersionId || undefined
      );

      if (loaderType === 'Custom' && customLoaderJarPath && customLoaderJarPath !== 'EXISTING') {
        await invoke('upload_custom_loader_jar', { instanceId: instance.id, sourcePath: customLoaderJarPath });
      }

      // 2. 更新相容模組
      for (const item of modsToUpdate) {
        if (!item.shouldUpdate) continue;

        const selectedVer = item.compatibleVersions.find((v: any) => v.id === item.selectedVersionId);
        if (!selectedVer) continue;

        const file = selectedVer.files.find((f: any) => f.primary) || selectedVer.files[0];
        if (file) {
          await invoke('download_and_replace_file', {
            instanceId: instance.id,
            folderName: 'mods',
            downloadUrl: file.url,
            newFilename: file.filename,
            oldFilename: item.localMod.fileName
          });
        }
      }

      // 3. 停用不相容模組
      for (const item of modsToDisable) {
        if (item.shouldDisable) {
          await invoke('toggle_mod', {
            instanceId: instance.id,
            fileName: item.localMod.fileName,
            enabled: false
          });
        }
      }

      addNotification({
        type: 'success',
        title: t('version_edit.notification.migration_success.title'),
        message: t('version_edit.notification.migration_success.msg')
      });
      onSaveComplete();
    } catch (err) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('version_edit.notification.migration_failed.title'),
        message: String(err)
      });
      setStep('form');
    }
  };

  if (!isOpen) return null;

  if (step === 'checking') {
    return (
      <div className={styles.versionEditOverlay}>
        <div className={styles.versionEditModal} style={{ width: '400px', padding: '40px 20px', alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Loader className="animate-spin" size={48} style={{ color: 'var(--accent-green)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', color: 'white' }}>{t('version_edit.checking')}</h3>
        </div>
      </div>
    );
  }

  if (step === 'updating') {
    return (
      <div className={styles.versionEditOverlay}>
        <div className={styles.versionEditModal} style={{ width: '400px', padding: '40px 20px', alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Loader className="animate-spin" size={48} style={{ color: 'var(--accent-green)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', color: 'white' }}>{t('version_edit.updating')}</h3>
        </div>
      </div>
    );
  }

  if (step === 'compatibility') {
    return (
      <div className={styles.versionEditOverlay}>
        <div className={styles.versionEditModal} style={{ width: '560px', maxWidth: '90%' }}>
          <div className={styles.versionEditHeader}>
            <h3>{t('version_edit.compatibility.title')}</h3>
            <button onClick={onClose} className={styles.closeBtn}><X size={18} /></button>
          </div>
          <div className={styles.versionEditBody} style={{ gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {t('version_edit.compatibility.desc')}
            </p>

            <div className="global-scrollbar" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
              {modsToUpdate.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '8px', verticalAlign: 'middle' }}>●</span>
                    {t('version_edit.compatibility.to_update', { count: modsToUpdate.length })}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {modsToUpdate.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', fontSize: '12px' }}>
                        <label className={styles.checkboxLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', color: 'white', fontWeight: 505, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                          <input
                            type="checkbox"
                            checked={item.shouldUpdate}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setModsToUpdate(prev => prev.map(m => m.localMod.fileName === item.localMod.fileName ? { ...m, shouldUpdate: checked } : m));
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ opacity: item.shouldUpdate ? 1 : 0.6 }}>
                            {item.localMod.name || item.localMod.fileName}
                          </span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{item.localMod.version} →</span>
                          <div className={styles.compactSelectWrapper} style={{ width: '180px' }}>
                            <CustomSelect
                              value={item.selectedVersionId}
                              onChange={(val) => {
                                setModsToUpdate(prev => prev.map(m => m.localMod.fileName === item.localMod.fileName ? { ...m, selectedVersionId: val } : m));
                              }}
                              options={item.compatibleVersions.map((v: any) => ({
                                value: v.id,
                                label: v.version_number
                              }))}
                              disabled={!item.shouldUpdate}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {modsToDisable.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '8px', verticalAlign: 'middle' }}>●</span>
                    {t('version_edit.compatibility.to_disable', { count: modsToDisable.length })}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {modsToDisable.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', fontSize: '12px' }}>
                        <label className={styles.checkboxLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', color: 'white', fontWeight: 505, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                          <input
                            type="checkbox"
                            checked={!item.shouldDisable}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setModsToDisable(prev => prev.map(m => m.localMod.fileName === item.localMod.fileName ? { ...m, shouldDisable: !checked } : m));
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ textDecoration: item.shouldDisable ? 'line-through' : 'none', opacity: item.shouldDisable ? 0.6 : 1 }}>
                            {item.localMod.name || item.localMod.fileName}
                          </span>
                        </label>
                        <span style={{ color: item.shouldDisable ? '#ef4444' : 'var(--accent-green)', fontSize: '11px', backgroundColor: item.shouldDisable ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--accent-green-rgb), 0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                          {item.shouldDisable ? t('version_edit.compatibility.no_updates') : t('version_edit.compatibility.keep_enabled')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={styles.versionEditFooter}>
            <button className={styles.cancelBtn} onClick={() => setStep('form')}>{t('version_edit.compatibility.cancel')}</button>
            <button className={styles.saveBtn} onClick={executeMigration} style={{ backgroundColor: 'var(--accent-green)', boxShadow: '0 4px 12px rgba(var(--accent-green-rgb), 0.2)' }}>
              {t('version_edit.compatibility.confirm')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.versionEditOverlay}>
      <div className={styles.versionEditModal}>
        <div className={styles.versionEditHeader}>
          <h3>{t('version_edit.title')}</h3>
          <button onClick={onClose} className={styles.closeBtn}><X size={18} /></button>
        </div>
        <div className={styles.versionEditBody}>
          <div className={styles.formGroup}>
            <label>
              {t('version_edit.mc_version_label', {
                type: minorFilterForEdit === 'snapshot'
                  ? t('version_edit.snapshot_version')
                  : t('version_edit.minor_version')
              })}
            </label>
            
            <div className={styles.filtersRow}>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>{t('version_edit.major_filter')}</span>
                <div className={styles.filterSegmentedControl}>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${majorFilterForEdit === 'release' ? styles.active : ''}`}
                    onClick={() => setMajorFilterForEdit('release')}
                  >
                    {t('version_edit.show_releases')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${majorFilterForEdit === 'history' ? styles.active : ''}`}
                    onClick={() => setMajorFilterForEdit('history')}
                  >
                    {t('version_edit.show_history')}
                  </button>
                </div>
              </div>
              
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>
                  {minorFilterForEdit === 'snapshot'
                    ? t('version_edit.snapshot_filter')
                    : t('version_edit.minor_filter')}
                </span>
                <div className={styles.filterSegmentedControl}>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${minorFilterForEdit === 'release' ? styles.active : ''}`}
                    onClick={() => setMinorFilterForEdit('release')}
                    disabled={majorFilterForEdit !== 'release'}
                  >
                    {t('version_edit.show_releases')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${minorFilterForEdit === 'snapshot' ? styles.active : ''}`}
                    onClick={() => setMinorFilterForEdit('snapshot')}
                    disabled={majorFilterForEdit !== 'release'}
                  >
                    {t('version_edit.show_snapshots')}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.versionSelectRow}>
              <div className={styles.majorVersionCol}>
                <CustomSelect
                  value={selectedMajorVersionForEdit}
                  onChange={handleMajorVersionChangeForEdit}
                  options={majorVersionsDataForEdit.groups.map((g: string) => ({ value: g, label: translateVersionGroup(g, t) }))}
                  disabled={loadingVersions}
                  placeholder={loadingVersions ? t('version_edit.loading') : t('version_edit.major_placeholder')}
                />
              </div>
              <div className={styles.minorVersionCol}>
                <CustomSelect
                  value={mcVersion}
                  onChange={handleMcVersionChangeForEdit}
                  options={(majorVersionsDataForEdit.groupMap[selectedMajorVersionForEdit] || []).map((v: any) => ({
                    value: v.id,
                    label: `${v.id} ${v.type !== 'release' ? `(${v.type})` : ''}`
                  }))}
                  disabled={loadingVersions || !selectedMajorVersionForEdit}
                  placeholder={loadingVersions ? t('version_edit.loading') : (minorFilterForEdit === 'snapshot' ? t('version_edit.snapshot_version') : t('version_edit.minor_version'))}
                />
              </div>
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <label>{t('version_edit.loader_label')}</label>
            <CustomSelect
              value={loaderType}
              onChange={handleLoaderTypeChangeForEdit}
              options={[
                { value: 'Vanilla', label: t('version_edit.loader.vanilla') },
                { value: 'Fabric', label: 'Fabric' },
                { value: 'Forge', label: 'Forge' },
                { value: 'NeoForge', label: 'NeoForge' },
                { value: 'Custom', label: t('version_edit.loader.custom') }
              ]}
            />
          </div>
          
          {loaderType !== 'Vanilla' && loaderType !== 'Custom' && (
            <div className={styles.formGroup}>
              <label>{t('version_edit.loader_version_label', { loader: loaderType })}</label>
              <CustomSelect
                value={loaderVersion}
                onChange={setLoaderVersion}
                options={loaderVersionsList.map(v => ({ value: v, label: v }))}
                disabled={loadingLoaderVersions}
                placeholder={loadingLoaderVersions ? t('version_edit.loading') : t('version_edit.loader_version_placeholder', { loader: loaderType })}
              />
            </div>
          )}

          {loaderType === 'Custom' && (
            <div className={styles.formGroup}>
              <label>{t('version_edit.custom_loader_label')}</label>
              <div 
                className={`${styles.dropzone} ${isDragOverCustom ? styles.dropzoneActive : ''}`}
                onClick={handleSelectCustomLoaderJar}
              >
                <Upload size={24} className={styles.dropzoneIcon} />
                <div className={styles.dropzoneText}>
                  {customLoaderJarName ? t('version_edit.custom_loader_selected', { name: customLoaderJarName }) : t('version_edit.custom_loader_dropzone')}
                </div>
                <div className={styles.dropzoneSub}>
                  {t('version_edit.custom_loader_sub')}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={styles.versionEditFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>{t('version_edit.cancel')}</button>
          <button className={styles.saveBtn} onClick={handleSaveVersion}>{t('version_edit.save')}</button>
        </div>
      </div>
    </div>
  );
}
