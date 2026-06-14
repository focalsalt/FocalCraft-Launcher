
import { Upload, Download, RefreshCw, Loader, FolderOpen, ArrowUpCircle, Trash2, Puzzle } from 'lucide-react';
import { ModItem } from '../../../types';
import styles from '../InstanceDetail.module.css';

interface ModsTabProps {
  mods: ModItem[];
  modsUpdates: Record<string, any>;
  isCheckingModsUpdates: boolean;
  loadingList: boolean;
  handleImportMods: () => void;
  setModrinthModalType: (type: 'mod' | 'resourcepack' | 'shader' | 'datapack') => void;
  setIsModrinthModalOpen: (val: boolean) => void;
  handleCheckModsUpdates: () => void;
  handleOpenFolder: (folderName?: string) => void;
  handleToggleMod: (mod: ModItem, enabled: boolean) => void;
  handleUpdateMod: (mod: ModItem, update: any) => void;
  handleDeleteMod: (fileName: string) => void;
}

export function ModsTab({
  mods,
  modsUpdates,
  isCheckingModsUpdates,
  loadingList,
  handleImportMods,
  setModrinthModalType,
  setIsModrinthModalOpen,
  handleCheckModsUpdates,
  handleOpenFolder,
  handleToggleMod,
  handleUpdateMod,
  handleDeleteMod,
}: ModsTabProps) {
  const onDownloadClick = () => {
    setModrinthModalType('mod');
    setIsModrinthModalOpen(true);
  };

  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <div className={styles.btnRow}>
          <button className={styles.primaryBtn} onClick={handleImportMods}>
            <Upload size={16} />
            <span>匯入模組</span>
          </button>
          <button className={styles.secBtn} onClick={onDownloadClick}>
            <Download size={16} />
            <span>下載模組</span>
          </button>
          <button className={styles.secBtn} onClick={handleCheckModsUpdates} disabled={isCheckingModsUpdates || mods.length === 0}>
            {isCheckingModsUpdates ? <Loader className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            <span>一鍵檢查更新</span>
          </button>
        </div>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder('mods')}>
          <FolderOpen size={16} />
          <span>開啟模組資料夾</span>
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
                <th>名稱</th>
                <th>版本</th>
                <th>環境</th>
                <th style={{ width: 140, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {mods.map((mod) => {
                const update = modsUpdates[mod.sha1];
                return (
                  <tr key={mod.fileName} className={!mod.enabled ? styles.disabledMod : ''}>
                    <td>
                      <div className={styles.modNameCol}>
                        <label className={styles.switch} title={mod.enabled ? '已啟用' : '已停用'}>
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
                        {mod.environment === 'client' ? '個人端' : mod.environment === 'server' ? '伺服端' : '雙端'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        {update && (
                          <button
                            className={styles.updateIconBtn}
                            onClick={() => handleUpdateMod(mod, update)}
                            title={`有可用更新: ${update.version_number}`}
                          >
                            <ArrowUpCircle size={18} />
                          </button>
                        )}
                        <button className={styles.deleteIconBtn} onClick={() => handleDeleteMod(mod.fileName)}>
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
            <div className={styles.emptyStateTitle}>目前無安裝模組</div>
            <div className={styles.emptyStateDesc}>
              這個實例尚未安裝任何遊戲模組 (Mods)。您可以點選下方的下載按鈕來安裝熱門模組，或點選匯入自行上傳。
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={onDownloadClick}>
                <Download size={14} />
                <span>從 Modrinth 下載</span>
              </button>
              <button className={styles.secBtn} onClick={handleImportMods}>
                <Upload size={14} />
                <span>手動匯入模組</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
