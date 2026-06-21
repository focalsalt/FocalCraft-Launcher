import { Upload, Download, Loader, FolderOpen, ArrowUpCircle, Trash2, Puzzle, Check, RefreshCw } from 'lucide-react';
import { ModItem } from '../../../types';
import { useI18n } from '../../../utils/i18n';
import styles from '../InstanceDetail.module.css';

interface ModsTabProps {
  mods: ModItem[];
  modsUpdates: Record<string, any>;
  isCheckingModsUpdates: boolean;
  loadingList: boolean;
  handleImportMods: () => void;
  setModrinthModalType: (type: 'mod' | 'resourcepack' | 'shader' | 'datapack') => void;
  setIsModrinthModalOpen: (val: boolean) => void;
  handleOpenFolder: (folderName?: string) => void;
  handleToggleMod: (mod: ModItem, enabled: boolean) => void;
  handleUpdateMod: (mod: ModItem, update: any) => void;
  handleDeleteMod: (fileName: string) => void;
  onOpenModVersionModal: (mod: ModItem) => void;
  onOpenBatchUpdateModal: () => void;
  modloader: string;
}

export function ModsTab({
  mods,
  modsUpdates,
  isCheckingModsUpdates,
  loadingList,
  handleImportMods,
  setModrinthModalType,
  setIsModrinthModalOpen,
  handleOpenFolder,
  handleToggleMod,
  handleUpdateMod,
  handleDeleteMod,
  onOpenModVersionModal,
  onOpenBatchUpdateModal,
  modloader,
}: ModsTabProps) {
  const { t } = useI18n();

  const onDownloadClick = () => {
    setModrinthModalType('mod');
    setIsModrinthModalOpen(true);
  };

  const updateCount = Object.keys(modsUpdates).length;

  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <div className={styles.btnRow}>
          <button className={styles.primaryBtn} onClick={handleImportMods}>
            <Upload size={16} />
            <span>{t('tabs.mods.btn.import')}</span>
          </button>
          <button className={styles.secBtn} onClick={onDownloadClick} disabled={modloader === 'Vanilla'}>
            <Download size={16} />
            <span>{t('tabs.mods.btn.download')}</span>
          </button>

          {mods.length > 0 && (
            <div
              className={`${styles.updateStatusInfo} ${updateCount > 0 && !isCheckingModsUpdates ? styles.updateStatusInfoClickable : ''}`}
              onClick={updateCount > 0 && !isCheckingModsUpdates ? onOpenBatchUpdateModal : undefined}
              role={updateCount > 0 && !isCheckingModsUpdates ? "button" : undefined}
              tabIndex={updateCount > 0 && !isCheckingModsUpdates ? 0 : undefined}
            >
              {isCheckingModsUpdates ? (
                <>
                  <Loader className="animate-spin" size={15} style={{ color: 'var(--main-color)' }} />
                  <span>{t('tabs.mods.status.checking')}</span>
                </>
              ) : updateCount > 0 ? (
                <>
                  <ArrowUpCircle size={16} style={{ color: 'var(--warning-orange)' }} />
                  <span style={{ color: 'var(--warning-orange)', fontWeight: 600 }}>
                    {t('tabs.mods.status.updates_available', { count: updateCount })}
                  </span>
                </>
              ) : (
                <>
                  <Check size={16} style={{ color: 'var(--accent-green)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{t('tabs.mods.status.up_to_date')}</span>
                </>
              )}
            </div>
          )}
        </div>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('mods')}>
          <FolderOpen size={16} />
          <span>{t('tabs.mods.btn.folder')}</span>
        </button>
      </div>

      <div className={styles.listContainer}>
        {loadingList ? (
          <div className={styles.listSpinner}>
            <Loader className="animate-spin" size={32} />
          </div>
        ) : mods.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('tabs.mods.label.name')}</th>
                <th>{t('tabs.mods.label.version')}</th>
                <th>{t('tabs.mods.label.env')}</th>
                <th style={{ width: 140, textAlign: 'center' }}>{t('tabs.mods.label.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {mods.map((mod) => {
                const update = modsUpdates[mod.sha1];
                return (
                  <tr key={mod.fileName} className={!mod.enabled ? styles.disabledMod : ''}>
                    <td>
                      <div className={styles.modNameCol}>
                        <label className={styles.switch} title={mod.enabled ? t('tabs.mods.status.enabled') : t('tabs.mods.status.disabled')}>
                          <input
                            type="checkbox"
                            checked={mod.enabled}
                            onChange={(e) => handleToggleMod(mod, e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                        <div>
                          <div className={styles.fileName}>{mod.name}</div>
                          <span className={styles.fileSub}>{mod.fileName}</span>
                        </div>
                      </div>
                    </td>
                    <td>{mod.version}</td>
                    <td>
                      <span className={`${styles.badge} ${mod.environment === 'client' ? styles.clientBadge : mod.environment === 'server' ? styles.serverBadge : styles.bothBadge}`}>
                        {mod.environment === 'client' ? t('tabs.mods.env.client') : mod.environment === 'server' ? t('tabs.mods.env.server') : t('tabs.mods.env.both')}
                      </span>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          className={styles.updateIconBtn}
                          onClick={() => update && handleUpdateMod(mod, update)}
                          disabled={!mod.enabled || !update}
                          style={{ visibility: update ? 'visible' : 'hidden' }}
                          title={update ? t('tabs.mods.update_available', { version: update.version_number }) : ''}
                        >
                          <ArrowUpCircle size={18} />
                        </button>
                        <button
                          className={styles.deleteIconBtn}
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={() => onOpenModVersionModal(mod)}
                          disabled={!mod.enabled}
                          title={t('mod_version.title')}
                        >
                          <RefreshCw size={15} />
                        </button>
                        <button
                          className={styles.deleteIconBtn}
                          onClick={() => handleDeleteMod(mod.fileName)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyStateContainer}>
            <Puzzle className={styles.emptyStateIcon} size={48} />
            <div className={styles.emptyStateTitle}>{t('tabs.mods.empty_title')}</div>
            <div className={styles.emptyStateDesc}>
              {t('tabs.mods.empty_desc')}
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={onDownloadClick} disabled={modloader === 'Vanilla'}>
                <Download size={14} />
                <span>{t('tabs.mods.btn.download_modrinth')}</span>
              </button>
              <button className={styles.secBtn} onClick={handleImportMods}>
                <Upload size={14} />
                <span>{t('tabs.mods.btn.import_manual')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
