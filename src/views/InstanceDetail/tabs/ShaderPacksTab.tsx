import { Upload, Download, Loader, FolderOpen, Trash2, Sparkles } from 'lucide-react';
import { ResourcePackItem } from '../../../types';
import { useI18n } from '../../../utils/i18n';
import styles from '../InstanceDetail.module.css';

interface ShaderPacksTabProps {
  shaderPacks: ResourcePackItem[];
  loadingList: boolean;
  handleImportSps: () => void;
  setModrinthModalType: (type: 'mod' | 'resourcepack' | 'shader' | 'datapack') => void;
  setIsModrinthModalOpen: (val: boolean) => void;
  handleOpenFolder: (folderName?: string) => void;
  handleDeleteSp: (fileName: string) => void;
}

export function ShaderPacksTab({
  shaderPacks,
  loadingList,
  handleImportSps,
  setModrinthModalType,
  setIsModrinthModalOpen,
  handleOpenFolder,
  handleDeleteSp,
}: ShaderPacksTabProps) {
  const { t } = useI18n();

  const onDownloadClick = () => {
    setModrinthModalType('shader');
    setIsModrinthModalOpen(true);
  };

  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <div className={styles.btnRow}>
          <button className={styles.primaryBtn} onClick={handleImportSps}>
            <Upload size={16} />
            <span>{t('tabs.sp.btn.import')}</span>
          </button>
          <button className={styles.secBtn} onClick={onDownloadClick}>
            <Download size={16} />
            <span>{t('tabs.sp.btn.download')}</span>
          </button>
        </div>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('shaderpacks')}>
          <FolderOpen size={16} />
          <span>{t('tabs.sp.btn.folder')}</span>
        </button>
      </div>

      <div className={styles.listContainer}>
        {loadingList ? (
          <div className={styles.listSpinner}>
            <Loader className="animate-spin" size={32} />
          </div>
        ) : shaderPacks.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('tabs.sp.label.name')}</th>
                <th>{t('tabs.sp.label.type')}</th>
                <th style={{ width: 140, textAlign: 'center' }}>{t('tabs.sp.label.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {shaderPacks.map((sp) => (
                <tr key={sp.fileName}>
                  <td>
                    <div className={styles.fileName}>{sp.name}</div>
                    <span className={styles.fileSub}>{sp.fileName}</span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.bothBadge}`}>
                      {sp.description || t('tabs.sp.default_desc')}
                    </span>
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button className={styles.deleteIconBtn} onClick={() => handleDeleteSp(sp.fileName)}>
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
            <Sparkles className={styles.emptyStateIcon} size={48} />
            <div className={styles.emptyStateTitle}>{t('tabs.sp.empty_title')}</div>
            <div className={styles.emptyStateDesc}>
              {t('tabs.sp.empty_desc')}
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={onDownloadClick}>
                <Download size={14} />
                <span>{t('tabs.sp.btn.download_modrinth')}</span>
              </button>
              <button className={styles.secBtn} onClick={handleImportSps}>
                <Upload size={14} />
                <span>{t('tabs.sp.btn.import_manual')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
