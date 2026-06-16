import { Plus, Loader, Trash2, Globe } from 'lucide-react';
import { ServerItem } from '../../../types';
import { useI18n } from '../../../utils/i18n';
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
  const { t } = useI18n();

  return (
    <div className={styles.tabContainer}>
      <div className={styles.sectionHeader}>
        <button className={styles.primaryBtn} onClick={() => handleOpenServerModal(null, null)}>
          <Plus size={16} />
          <span>{t('tabs.servers.btn.add')}</span>
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
                    {t('tabs.servers.label.accept_textures', {
                      status: srv.acceptTextures === 1 
                        ? t('tabs.servers.accept_textures.enabled') 
                        : srv.acceptTextures === 2 
                        ? t('tabs.servers.accept_textures.disabled') 
                        : t('tabs.servers.accept_textures.prompt')
                    })}
                  </div>
                </div>
                <div className={styles.serverActions}>
                  <button className={styles.textBtn} onClick={() => handleOpenServerModal(srv, index)}>
                    {t('tabs.servers.btn.edit')}
                  </button>
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
            <div className={styles.emptyStateTitle}>{t('tabs.servers.empty_title')}</div>
            <div className={styles.emptyStateDesc}>
              {t('tabs.servers.empty_desc')}
            </div>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={() => handleOpenServerModal(null, null)}>
                <Plus size={14} />
                <span>{t('tabs.servers.btn.add_connection')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
