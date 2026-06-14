import { useState, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useInstanceStore } from '../../store/instanceStore';
import { useAppStore } from '../../store/appStore';
import { CustomSelect } from '../../components/common/CustomSelect';
import { getMajorVersionGroup } from '../../utils/versionUtils';
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

export function VersionEditModal({ isOpen, onClose, instance, onSaveComplete }: Props) {
  const updateInstanceConfig = useInstanceStore((state) => state.updateInstanceConfig);
  const addNotification = useAppStore((state) => state.addNotification);

  // Use stable primitive deps to avoid object reference churn when
  // the parent re-renders and passes a new `instance` object from find()
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

  useEffect(() => {
    if (!isOpen) {
      setIsDragOverCustom(false);
      return;
    }

    // Reset local states to current instance values when modal opens
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

  // Fetch loader versions when Minecraft version or Modloader changes
  useEffect(() => {
    const isSupportedLoader = loaderType === 'Fabric' || loaderType === 'Forge' || loaderType === 'NeoForge';
    if (isSupportedLoader && mcVersion && isOpen) {
      setLoadingLoaderVersions(true);
      invoke<string[]>('get_loader_versions', { modloader: loaderType, gameVersion: mcVersion })
        .then((versionsList) => {
          setLoaderVersionsList(versionsList);
          // If the current loader version of the instance is in the fetched list and loaderType matches instance.modloader, use it.
          // Otherwise default to the first one in the list.
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

  // Native Tauri Window Drag & Drop Listener for Custom Loader
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
        title: '自訂載入器缺失',
        message: '請先拖放或點選選擇自訂 Loader JAR 檔案。'
      });
      return;
    }

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
        title: '實例版本已更新',
        message: '實例核心版本與載入器已成功修改。'
      });
      onSaveComplete();
    } catch (err) {
      addNotification({
        type: 'error',
        title: '更新實例版本失敗',
        message: String(err)
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.versionEditOverlay}>
      <div className={styles.versionEditModal}>
        <div className={styles.versionEditHeader}>
          <h3>修改實例核心版本</h3>
          <button onClick={onClose} className={styles.closeBtn}><X size={18} /></button>
        </div>
        <div className={styles.versionEditBody}>
          <div className={styles.formGroup}>
            <label>Minecraft 版本 (大版本 / {minorFilterForEdit === 'snapshot' ? '快照版本' : '小版本'})</label>
            
            <div className={styles.filtersRow}>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>大版本篩選</span>
                <div className={styles.filterSegmentedControl}>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${majorFilterForEdit === 'release' ? styles.active : ''}`}
                    onClick={() => setMajorFilterForEdit('release')}
                  >
                    只顯示正式版
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${majorFilterForEdit === 'history' ? styles.active : ''}`}
                    onClick={() => setMajorFilterForEdit('history')}
                  >
                    只顯示歷史版
                  </button>
                </div>
              </div>
              
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>{minorFilterForEdit === 'snapshot' ? '快照篩選' : '小版本篩選'}</span>
                <div className={styles.filterSegmentedControl}>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${minorFilterForEdit === 'release' ? styles.active : ''}`}
                    onClick={() => setMinorFilterForEdit('release')}
                    disabled={majorFilterForEdit !== 'release'}
                  >
                    只顯示正式版
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterSegmentButton} ${minorFilterForEdit === 'snapshot' ? styles.active : ''}`}
                    onClick={() => setMinorFilterForEdit('snapshot')}
                    disabled={majorFilterForEdit !== 'release'}
                  >
                    只顯示快照版
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.versionSelectRow}>
              <div className={styles.majorVersionCol}>
                <CustomSelect
                  value={selectedMajorVersionForEdit}
                  onChange={handleMajorVersionChangeForEdit}
                  options={majorVersionsDataForEdit.groups.map((g: string) => ({ value: g, label: g }))}
                  disabled={loadingVersions}
                  placeholder={loadingVersions ? "載入中..." : "大版本"}
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
                  placeholder={loadingVersions ? "載入中..." : (minorFilterForEdit === 'snapshot' ? '快照版本' : '小版本')}
                />
              </div>
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <label>載入器 (Modloader)</label>
            <CustomSelect
              value={loaderType}
              onChange={handleLoaderTypeChangeForEdit}
              options={[
                { value: 'Vanilla', label: 'Vanilla (原版)' },
                { value: 'Fabric', label: 'Fabric' },
                { value: 'Forge', label: 'Forge' },
                { value: 'NeoForge', label: 'NeoForge' },
                { value: 'Custom', label: '自訂 ModLoader' }
              ]}
            />
          </div>
          
          {loaderType !== 'Vanilla' && loaderType !== 'Custom' && (
            <div className={styles.formGroup}>
              <label>{loaderType} Loader 版本</label>
              <CustomSelect
                value={loaderVersion}
                onChange={setLoaderVersion}
                options={loaderVersionsList.map(v => ({ value: v, label: v }))}
                disabled={loadingLoaderVersions}
                placeholder={loadingLoaderVersions ? "載入中..." : `請選擇 ${loaderType} Loader 版本`}
              />
            </div>
          )}

          {loaderType === 'Custom' && (
            <div className={styles.formGroup}>
              <label>自訂 Loader JAR 檔案</label>
              <div 
                className={`${styles.dropzone} ${isDragOverCustom ? styles.dropzoneActive : ''}`}
                onClick={handleSelectCustomLoaderJar}
              >
                <Upload size={24} className={styles.dropzoneIcon} />
                <div className={styles.dropzoneText}>
                  {customLoaderJarName ? `已選取：${customLoaderJarName}` : '拖放自訂 Loader JAR 檔案至此，或點擊選擇檔案'}
                </div>
                <div className={styles.dropzoneSub}>
                  僅支援 .jar 格式檔案
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={styles.versionEditFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.saveBtn} onClick={handleSaveVersion}>儲存核心變更</button>
        </div>
      </div>
    </div>
  );
}
