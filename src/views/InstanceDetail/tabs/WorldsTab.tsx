import { Upload, Download, Loader, FolderOpen, Trash2, ChevronLeft, Layers, Compass } from 'lucide-react';
import { WorldItem, ResourcePackItem } from '../../../types';
import { useI18n } from '../../../utils/i18n';
import styles from '../InstanceDetail.module.css';

interface WorldsTabProps {
  worlds: WorldItem[];
  datapacks: ResourcePackItem[];
  activeWorldForDatapacks: WorldItem | null;
  setActiveWorldForDatapacks: (world: WorldItem | null) => void;
  loadingList: boolean;
  handleImportWorld: () => void;
  handleOpenFolder: (folderName?: string) => void;
  handleDeleteWorldClick: (folderName: string) => void;
  handleImportDatapacks: () => void;
  setModrinthModalType: (type: 'mod' | 'resourcepack' | 'shader' | 'datapack') => void;
  setIsModrinthModalOpen: (val: boolean) => void;
  handleOpenDatapacksFolder: () => void;
  handleDeleteDpClick: (fileName: string) => void;
  formatSize: (bytes: number) => string;
}

export function WorldsTab({
  worlds,
  datapacks,
  activeWorldForDatapacks,
  setActiveWorldForDatapacks,
  loadingList,
  handleImportWorld,
  handleOpenFolder,
  handleDeleteWorldClick,
  handleImportDatapacks,
  setModrinthModalType,
  setIsModrinthModalOpen,
  handleOpenDatapacksFolder,
  handleDeleteDpClick,
  formatSize,
}: WorldsTabProps) {
  const { t } = useI18n();

  const onDownloadDatapackClick = () => {
    setModrinthModalType('datapack');
    setIsModrinthModalOpen(true);
  };

  if (activeWorldForDatapacks) {
    return (
      <div className={styles.tabContainer}>
        <div className={styles.subpageHeader}>
          <button className={styles.backBtn} onClick={() => setActiveWorldForDatapacks(null)}>
            <ChevronLeft size={16} />
            <span>{t('tabs.worlds.btn.back')}</span>
          </button>
          <h2>{t('tabs.worlds.datapacks_title', { name: activeWorldForDatapacks.name })}</h2>
        </div>

        <div className={styles.sectionHeader}>
          <div className={styles.btnRow}>
            <button className={styles.primaryBtn} onClick={handleImportDatapacks}>
              <Upload size={16} />
              <span>{t('tabs.worlds.btn.import_dp')}</span>
            </button>
            <button className={styles.secBtn} onClick={onDownloadDatapackClick}>
              <Download size={16} />
              <span>{t('tabs.worlds.btn.download_dp')}</span>
            </button>
          </div>
          <button className={styles.actionBtn} onClick={handleOpenDatapacksFolder}>
            <FolderOpen size={16} />
            <span>{t('tabs.worlds.btn.folder_dp')}</span>
          </button>
        </div>

        <div className={styles.listContainer}>
          {loadingList ? (
            <div className={styles.listSpinner}>
              <Loader className="animate-spin" size={32} />
            </div>
          ) : datapacks.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('tabs.worlds.label.name_desc_dp')}</th>
                  <th>{t('tabs.worlds.label.version_dp')}</th>
                  <th style={{ width: 140, textAlign: 'center' }}>{t('tabs.mods.label.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {datapacks.map((dp) => (
                  <tr key={dp.fileName}>
                    <td>
                      <div className={styles.fileName}>{dp.name}</div>
                      <span className={styles.fileSub}>{dp.description || t('tabs.worlds.no_desc_dp')}</span>
                    </td>
                    <td>{dp.gameVersion || t('tabs.worlds.generic_version')}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button className={styles.deleteIconBtn} onClick={() => handleDeleteDpClick(dp.fileName)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyStateContainer}>
              <Layers className={styles.emptyStateIcon} size={48} />
              <div className={styles.emptyStateTitle}>{t('tabs.worlds.empty_title_dp')}</div>
              <div className={styles.emptyStateDesc}>
                {t('tabs.worlds.empty_desc_dp')}
              </div>
              <div className={styles.btnRow}>
                <button className={styles.primaryBtn} onClick={onDownloadDatapackClick}>
                  <Download size={14} />
                  <span>{t('tabs.worlds.btn.download_dp_modrinth')}</span>
                </button>
                <button className={styles.secBtn} onClick={handleImportDatapacks}>
                  <Upload size={14} />
                  <span>{t('tabs.worlds.btn.import_dp_manual')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <button className={styles.primaryBtn} onClick={handleImportWorld}>
          <Upload size={16} />
          <span>{t('tabs.worlds.btn.import_world')}</span>
        </button>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('saves')}>
          <FolderOpen size={16} />
          <span>{t('tabs.worlds.btn.folder_world')}</span>
        </button>
      </div>

      <div className={styles.listContainer}>
        {loadingList ? (
          <div className={styles.listSpinner}>
            <Loader className="animate-spin" size={32} />
          </div>
        ) : worlds.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('tabs.worlds.label.world_name')}</th>
                <th>{t('tabs.worlds.label.world_size')}</th>
                <th style={{ width: 120, textAlign: 'center' }}>{t('tabs.mods.label.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {worlds.map((world) => (
                <tr key={world.folderName}>
                  <td>
                    <div className={styles.fileName}>{world.name}</div>
                    <span className={styles.fileSub}>{t('tabs.worlds.label.world_folder', { name: world.folderName })}</span>
                  </td>
                  <td>{formatSize(world.sizeBytes)}</td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        className={styles.deleteIconBtn}
                        onClick={() => setActiveWorldForDatapacks(world)}
                        title={t('tabs.worlds.tooltip.manage_dp')}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Layers size={16} />
                      </button>
                      <button className={styles.deleteIconBtn} onClick={() => handleDeleteWorldClick(world.folderName)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyStateContainer}>
            <Compass className={styles.emptyStateIcon} size={48} />
            <div className={styles.emptyStateTitle}>{t('tabs.worlds.empty_title_world')}</div>
            <div className={styles.emptyStateDesc}>
              {t('tabs.worlds.empty_desc_world')}
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={handleImportWorld}>
                <Upload size={14} />
                <span>{t('tabs.worlds.btn.import_world_manual')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
