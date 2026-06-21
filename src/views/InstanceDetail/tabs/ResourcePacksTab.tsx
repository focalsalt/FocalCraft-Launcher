import { Upload, Download, Loader, FolderOpen, Trash2, Paintbrush } from 'lucide-react';
import { ResourcePackItem } from '../../../types';
import { useI18n } from '../../../utils/i18n';
import styles from '../InstanceDetail.module.css';

interface ResourcePacksTabProps {
  resourcePacks: ResourcePackItem[];
  rpUpdates: Record<string, any>;
  loadingList: boolean;
  handleImportRps: () => void;
  setModrinthModalType: (type: 'mod' | 'resourcepack' | 'shader' | 'datapack') => void;
  setIsModrinthModalOpen: (val: boolean) => void;
  handleOpenFolder: (folderName?: string) => void;
  handleUpdateRp: (rp: ResourcePackItem, update: any) => void;
  handleDeleteRp: (fileName: string) => void;
}

export function ResourcePacksTab({
  resourcePacks,
  rpUpdates,
  loadingList,
  handleImportRps,
  setModrinthModalType,
  setIsModrinthModalOpen,
  handleOpenFolder,
  handleUpdateRp,
  handleDeleteRp,
}: ResourcePacksTabProps) {
  const { t } = useI18n();

  const onDownloadClick = () => {
    setModrinthModalType('resourcepack');
    setIsModrinthModalOpen(true);
  };

  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <div className={styles.btnRow}>
          <button className={styles.primaryBtn} onClick={handleImportRps}>
            <Upload size={16} />
            <span>{t('tabs.rp.btn.import')}</span>
          </button>
          <button className={styles.secBtn} onClick={onDownloadClick}>
            <Download size={16} />
            <span>{t('tabs.rp.btn.download')}</span>
          </button>
        </div>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('resourcepacks')}>
          <FolderOpen size={16} />
          <span>{t('tabs.rp.btn.folder')}</span>
        </button>
      </div>

      <div className={styles.listContainer}>
        {loadingList ? (
          <div className={styles.listSpinner}>
            <Loader className="animate-spin" size={32} />
          </div>
        ) : resourcePacks.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('tabs.rp.label.name_desc')}</th>
                <th>{t('tabs.rp.label.game_version')}</th>
                <th style={{ width: 140, textAlign: 'center' }}>{t('tabs.rp.label.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {resourcePacks.map((rp) => {
                const update = rpUpdates[rp.sha1];
                return (
                  <tr key={rp.fileName}>
                    <td>
                      <div className={styles.fileName}>{rp.name}</div>
                      <span className={styles.fileSub}>{rp.description || t('tabs.rp.no_desc')}</span>
                    </td>
                    <td>{rp.gameVersion}</td>
                    <td>
                      <div className={styles.tableActions}>
                        {update && (
                          <button
                            className={styles.updateBtn}
                            onClick={() => handleUpdateRp(rp, update)}
                            title={t('tabs.mods.update_available', { version: update.version_number })}
                          >
                            {t('tabs.rp.update_available')}
                          </button>
                        )}
                        <button className={styles.deleteIconBtn} onClick={() => handleDeleteRp(rp.fileName)}>
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
            <Paintbrush className={styles.emptyStateIcon} size={48} />
            <div className={styles.emptyStateTitle}>{t('tabs.rp.empty_title')}</div>
            <div className={styles.emptyStateDesc}>
              {t('tabs.rp.empty_desc')}
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={onDownloadClick}>
                <Download size={14} />
                <span>{t('tabs.rp.btn.download_modrinth')}</span>
              </button>
              <button className={styles.secBtn} onClick={handleImportRps}>
                <Upload size={14} />
                <span>{t('tabs.rp.btn.import_manual')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
