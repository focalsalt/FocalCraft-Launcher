
import { Upload, Download, RefreshCw, Loader, FolderOpen, Trash2, Paintbrush } from 'lucide-react';
import { ResourcePackItem } from '../../../types';
import styles from '../InstanceDetail.module.css';

interface ResourcePacksTabProps {
  resourcePacks: ResourcePackItem[];
  rpUpdates: Record<string, any>;
  isCheckingRpUpdates: boolean;
  loadingList: boolean;
  handleImportRps: () => void;
  setModrinthModalType: (type: 'mod' | 'resourcepack' | 'shader' | 'datapack') => void;
  setIsModrinthModalOpen: (val: boolean) => void;
  handleCheckRpUpdates: () => void;
  handleOpenFolder: (folderName?: string) => void;
  handleUpdateRp: (rp: ResourcePackItem, update: any) => void;
  handleDeleteRp: (fileName: string) => void;
}

export function ResourcePacksTab({
  resourcePacks,
  rpUpdates,
  isCheckingRpUpdates,
  loadingList,
  handleImportRps,
  setModrinthModalType,
  setIsModrinthModalOpen,
  handleCheckRpUpdates,
  handleOpenFolder,
  handleUpdateRp,
  handleDeleteRp,
}: ResourcePacksTabProps) {
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
            <span>匯入資源包</span>
          </button>
          <button className={styles.secBtn} onClick={onDownloadClick}>
            <Download size={16} />
            <span>下載資源包</span>
          </button>
          <button className={styles.secBtn} onClick={handleCheckRpUpdates} disabled={isCheckingRpUpdates || resourcePacks.length === 0}>
            {isCheckingRpUpdates ? <Loader className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            <span>一鍵檢查更新</span>
          </button>
        </div>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('resourcepacks')}>
          <FolderOpen size={16} />
          <span>開啟資源包資料夾</span>
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
                <th>名稱與說明</th>
                <th>適用版本</th>
                <th style={{ width: 140, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {resourcePacks.map((rp) => {
                const update = rpUpdates[rp.sha1];
                return (
                  <tr key={rp.fileName}>
                    <td>
                      <div className={styles.fileName}>{rp.name}</div>
                      <span className={styles.fileSub}>{rp.description || '無描述資訊'}</span>
                    </td>
                    <td>{rp.gameVersion}</td>
                    <td>
                      <div className={styles.tableActions}>
                        {update && (
                          <button
                            className={styles.updateBtn}
                            onClick={() => handleUpdateRp(rp, update)}
                            title={`有可用更新: ${update.version_number}`}
                          >
                            有可用更新
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
            <div className={styles.emptyStateTitle}>目前無安裝資源包</div>
            <div className={styles.emptyStateDesc}>
              資源包 (Resource Packs) 能改變遊戲內的方塊紋理、介面與音效。您可以下載熱門資源包或手動匯入您的檔案。
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={onDownloadClick}>
                <Download size={14} />
                <span>從 Modrinth 下載</span>
              </button>
              <button className={styles.secBtn} onClick={handleImportRps}>
                <Upload size={14} />
                <span>手動匯入資源包</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
