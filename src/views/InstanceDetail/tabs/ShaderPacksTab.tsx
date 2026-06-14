
import { Upload, Download, Loader, FolderOpen, Trash2, Sparkles } from 'lucide-react';
import { ResourcePackItem } from '../../../types';
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
            <span>匯入光影包</span>
          </button>
          <button className={styles.secBtn} onClick={onDownloadClick}>
            <Download size={16} />
            <span>下載光影包</span>
          </button>
        </div>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('shaderpacks')}>
          <FolderOpen size={16} />
          <span>開啟光影包資料夾</span>
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
                <th>名稱</th>
                <th>類型</th>
                <th style={{ width: 140, textAlign: 'center' }}>操作</th>
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
                      {sp.description || '光影包'}
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
            <div className={styles.emptyStateTitle}>目前無安裝光影包</div>
            <div className={styles.emptyStateDesc}>
              光影包 (Shaders) 能大幅提升遊戲畫面的光影效果、動態水面與真實雲朵。請點選下載尋找您喜愛的光影包。
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={onDownloadClick}>
                <Download size={14} />
                <span>從 Modrinth 下載</span>
              </button>
              <button className={styles.secBtn} onClick={handleImportSps}>
                <Upload size={14} />
                <span>手動匯入光影包</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
