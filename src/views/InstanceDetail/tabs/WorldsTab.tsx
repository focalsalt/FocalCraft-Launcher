
import { Upload, Download, Loader, FolderOpen, Trash2, ChevronLeft, Layers, Compass } from 'lucide-react';
import { WorldItem, ResourcePackItem } from '../../../types';
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
  const onDownloadDatapackClick = () => {
    setModrinthModalType('datapack');
    setIsModrinthModalOpen(true);
  };

  // 1. World Datapacks subpage
  if (activeWorldForDatapacks) {
    return (
      <div className={styles.tabContainer}>
        <div className={styles.subpageHeader}>
          <button className={styles.backBtn} onClick={() => setActiveWorldForDatapacks(null)}>
            <ChevronLeft size={16} />
            <span>返回世界列表</span>
          </button>
          <h2>{activeWorldForDatapacks.name} - 資料包管理</h2>
        </div>

        <div className={styles.sectionHeader}>
          <div className={styles.btnRow}>
            <button className={styles.primaryBtn} onClick={handleImportDatapacks}>
              <Upload size={16} />
              <span>匯入資料包</span>
            </button>
            <button className={styles.secBtn} onClick={onDownloadDatapackClick}>
              <Download size={16} />
              <span>下載資料包</span>
            </button>
          </div>
          <button className={styles.actionBtn} onClick={handleOpenDatapacksFolder}>
            <FolderOpen size={16} />
            <span>開啟資料包資料夾</span>
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
                  <th>名稱與說明</th>
                  <th>適用版本</th>
                  <th style={{ width: 140, textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {datapacks.map((dp) => (
                  <tr key={dp.fileName}>
                    <td>
                      <div className={styles.fileName}>{dp.name}</div>
                      <span className={styles.fileSub}>{dp.description || '無描述資訊'}</span>
                    </td>
                    <td>{dp.gameVersion || '通用'}</td>
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
              <div className={styles.emptyStateTitle}>目前無安裝資料包</div>
              <div className={styles.emptyStateDesc}>
                資料包 (Datapacks) 可以自訂該世界的遊戲規則、合成表、結構與生態域。
              </div>
              <div className={styles.btnRow}>
                <button className={styles.primaryBtn} onClick={onDownloadDatapackClick}>
                  <Download size={14} />
                  <span>從 Modrinth 下載</span>
                </button>
                <button className={styles.secBtn} onClick={handleImportDatapacks}>
                  <Upload size={14} />
                  <span>手動匯入資料包</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Worlds listing main view
  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <button className={styles.primaryBtn} onClick={handleImportWorld}>
          <Upload size={16} />
          <span>匯入世界存檔</span>
        </button>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('saves')}>
          <FolderOpen size={16} />
          <span>開啟存檔資料夾</span>
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
                <th>名稱</th>
                <th>檔案大小</th>
                <th style={{ width: 120, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {worlds.map((world) => (
                <tr key={world.folderName}>
                  <td>
                    <div className={styles.fileName}>{world.name}</div>
                    <span className={styles.fileSub}>資料夾: {world.folderName}</span>
                  </td>
                  <td>{formatSize(world.sizeBytes)}</td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        className={styles.deleteIconBtn}
                        onClick={() => setActiveWorldForDatapacks(world)}
                        title="管理資料包 (Datapacks)"
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
            <div className={styles.emptyStateTitle}>目前無任何世界存檔</div>
            <div className={styles.emptyStateDesc}>
              這個實例尚未建立任何單人遊戲世界存檔。您可以啟動遊戲建立新世界，或從外部匯入現有的存檔世界。
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={handleImportWorld}>
                <Upload size={14} />
                <span>匯入世界存檔</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
