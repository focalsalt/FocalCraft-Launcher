import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../utils/i18n';
import { X, Loader, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import styles from './ModVersionModal.module.css';

interface ModItem {
  fileName: string;
  name: string;
  version: string;
  environment: string;
  sha1: string;
  enabled: boolean;
}

interface ModVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mod: ModItem | null;
  mcVersion: string;
  loader: string;
  instanceId: string;
  onUpdateComplete: () => void;
}

export function ModVersionModal({
  isOpen,
  onClose,
  mod,
  mcVersion,
  loader,
  instanceId,
  onUpdateComplete,
}: ModVersionModalProps) {
  const { t } = useI18n();
  const { addNotification } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [errorText, setErrorText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen && mod) {
      loadModData();
    }
  }, [isOpen, mod, mcVersion, loader]);

  const loadModData = async () => {
    if (!mod) return;
    setIsLoading(true);
    setErrorText('');
    setProjectInfo(null);
    setVersions([]);

    try {
      let projectId = '';

      // 1. 嘗試以 SHA-1 雜湊搜尋專案檔案
      if (mod.sha1) {
        try {
          const res = await fetch(`https://api.modrinth.com/v2/version_file/${mod.sha1}?algorithm=sha1`, {
            headers: { 'User-Agent': 'focal-craft-launcher' }
          });
          if (res.ok) {
            const fileData = await res.json();
            projectId = fileData.project_id;
          }
        } catch (e) {
          console.warn('Lookup by hash failed, will try search:', e);
        }
      }

      // 2. 如果雜湊搜尋失敗，嘗試以名稱搜尋
      if (!projectId) {
        const queryName = mod.name || mod.fileName.replace(/\.jar$/i, '').replace(/[-_]\d.*/, '');
        const searchRes = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(queryName)}&facets=[[%22project_type:mod%22]]`, {
          headers: { 'User-Agent': 'focal-craft-launcher' }
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.hits && searchData.hits.length > 0) {
            projectId = searchData.hits[0].project_id;
          }
        }
      }

      if (!projectId) {
        throw new Error(t('mod_version.loading_failed'));
      }

      // 3. 獲取專案詳情
      const projRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}`, {
        headers: { 'User-Agent': 'focal-craft-launcher' }
      });
      if (!projRes.ok) throw new Error('Failed to fetch project info');
      const projData = await projRes.ok ? await projRes.json() : null;
      setProjectInfo(projData);

      // 4. 獲取所有版本列表
      const verRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`, {
        headers: { 'User-Agent': 'focal-craft-launcher' }
      });
      if (!verRes.ok) throw new Error('Failed to fetch project versions');
      const verData = await verRes.json();

      // 5. 過濾符合當前 Minecraft 版本與載入器的版本
      const compat = verData.filter((v: any) => {
        const matchesMc = v.game_versions.includes(mcVersion);
        const matchesLoader = v.loaders.some(
          (l: string) => l.toLowerCase() === loader.toLowerCase()
        );
        return matchesMc && matchesLoader;
      });

      setVersions(compat);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || t('mod_version.loading_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVersion = async (versionObj: any) => {
    if (!mod) return;
    const file = versionObj.files.find((f: any) => f.primary) || versionObj.files[0];
    if (!file) return;

    setIsUpdating(true);
    try {
      addNotification({
        type: 'info',
        title: t('detail.notification.mod_update.downloading', { name: '' }).split('...')[0],
        message: t('detail.notification.mod_update.downloading', { name: mod.name })
      });

      await invoke('download_and_replace_file', {
        instanceId,
        folderName: 'mods',
        downloadUrl: file.url,
        newFilename: file.filename,
        oldFilename: mod.fileName,
      });

      addNotification({
        type: 'success',
        title: t('detail.notification.mod_update.success', { name: '' }).split(' ')[1] || t('notification.success'),
        message: t('detail.notification.mod_update.success', { name: mod.name })
      });
      onUpdateComplete();
      onClose();
    } catch (err: any) {
      console.error(err);
      addNotification({
        type: 'error',
        title: t('detail.notification.mod_update.failed'),
        message: String(err)
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{t('mod_version.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <Loader className="animate-spin" size={36} />
              <span>{t('mod_version.loading')}</span>
            </div>
          ) : errorText ? (
            <div className={styles.errorContainer}>
              <AlertCircle size={32} color="#ef4444" />
              <span>{errorText}</span>
              <button className={styles.retryBtn} onClick={loadModData}>
                <RefreshCw size={14} />
                <span>{t('create.custom.load_failed_retry')}</span>
              </button>
            </div>
          ) : (
            <>
              {projectInfo && (
                <div className={styles.projectHeader}>
                  {projectInfo.icon_url && (
                    <img
                      className={styles.projectIcon}
                      src={projectInfo.icon_url}
                      alt={projectInfo.title}
                    />
                  )}
                  <div className={styles.projectDetails}>
                    <div className={styles.projectTitle}>{projectInfo.title}</div>
                    <div className={styles.projectDesc}>{projectInfo.description}</div>
                  </div>
                </div>
              )}

              <div className={styles.listSection}>
                <div className={styles.sectionLabel}>
                  {t('create.label.select_mod_version')} ({versions.length})
                </div>

                {versions.length === 0 ? (
                  <div className={styles.emptyContainer}>
                    <p>{t('mod_version.no_compatible')}</p>
                  </div>
                ) : (
                  <div className={`${styles.list} global-scrollbar`}>
                    {versions.map((version) => {
                      const isCurrent = version.files.some(
                        (f: any) => f.hashes.sha1 === mod?.sha1
                      ) || version.version_number === mod?.version;

                      return (
                        <div
                          key={version.id}
                          className={`${styles.item} ${isCurrent ? styles.activeItem : ''}`}
                        >
                          <div className={styles.itemInfo}>
                            <div className={styles.itemTitleRow}>
                              <span className={styles.itemTitle}>{version.version_number}</span>
                              <span className={`${styles.badge} ${styles[version.version_type] || ''}`}>
                                {version.version_type}
                              </span>
                              {isCurrent && (
                                <span className={styles.currentTag}>
                                  <Check size={12} />
                                  <span>{t('mod_version.current')}</span>
                                </span>
                              )}
                            </div>
                            <div className={styles.itemDetail}>
                              <span>{version.name}</span>
                              <span>
                                {new Date(version.date_published).toLocaleDateString()} • {version.downloads.toLocaleString()} downloads
                              </span>
                            </div>
                          </div>
                          <button
                            className={styles.changeBtn}
                            onClick={() => handleSelectVersion(version)}
                            disabled={isCurrent || isUpdating}
                          >
                            {isUpdating ? <Loader className="animate-spin" size={14} /> : t('mod_version.btn.change')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isUpdating}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
