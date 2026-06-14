
import { Plus, Loader, Trash2, Globe } from 'lucide-react';
import { ServerItem } from '../../../types';
import styles from '../InstanceDetail.module.css';

interface ServersTabProps {
  servers: ServerItem[];
  loadingList: boolean;
  handleOpenServerModal: (server: ServerItem | null, index: number | null) => void;
  handleDeleteServer: (index: number) => void;
}

export function ServersTab({
  servers,
  loadingList,
  handleOpenServerModal,
  handleDeleteServer,
}: ServersTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <button className={styles.primaryBtn} onClick={() => handleOpenServerModal(null, null)}>
          <Plus size={16} />
          <span>新增伺服器</span>
        </button>
      </div>

      <div className={styles.listContainer}>
        {loadingList ? (
          <div className={styles.listSpinner}>
            <Loader className="animate-spin" size={32} />
          </div>
        ) : servers.length > 0 ? (
          <div className={styles.serverGrid}>
            {servers.map((srv, index) => (
              <div key={index} className={styles.serverCard}>
                <div className={styles.serverIcon}>🌐</div>
                <div className={styles.serverInfo}>
                  <div className={styles.serverName}>{srv.name}</div>
                  <div className={styles.serverIp}>{srv.ip}</div>
                  <div className={styles.serverMeta}>
                    資源包: {srv.acceptTextures === 1 ? '啟用' : srv.acceptTextures === 2 ? '停用' : '詢問'}
                  </div>
                </div>
                <div className={styles.serverActions}>
                  <button className={styles.textBtn} onClick={() => handleOpenServerModal(srv, index)}>編輯</button>
                  <button className={styles.deleteIconBtn} onClick={() => handleDeleteServer(index)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyStateContainer}>
            <Globe className={styles.emptyStateIcon} size={48} />
            <div className={styles.emptyStateTitle}>目前無伺服器連線記錄</div>
            <div className={styles.emptyStateDesc}>
              您尚未在此實例新增任何多人遊戲伺服器連線。新增後，您可以更快速地查看並管理伺服器設定。
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={() => handleOpenServerModal(null, null)}>
                <Plus size={14} />
                <span>新增伺服器連線</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
