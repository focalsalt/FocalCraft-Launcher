
import { Loader, AlertTriangle, Check } from 'lucide-react';
import { Instance } from '../../../types';
import styles from '../InstanceDetail.module.css';

interface ModpackUpdateTabProps {
  isCheckingModpackUpdate: boolean;
  latestModpackVersion: any;
  instance: Instance;
  handleUpdateModpackClick: () => void;
}

export function ModpackUpdateTab({
  isCheckingModpackUpdate,
  latestModpackVersion,
  instance,
  handleUpdateModpackClick,
}: ModpackUpdateTabProps) {
  return (
    <div className={styles.tabContainerCenter}>
      {isCheckingModpackUpdate ? (
        <div className={styles.loadingContainer}>
          <Loader className="animate-spin" size={48} />
          <span>正在檢查 Modrinth 整合包更新...</span>
        </div>
      ) : latestModpackVersion ? (
        <div className={styles.updateCheckCard}>
          <div className={styles.updateCheckHeader}>
            <h2>整合包更新管理</h2>
            <span className={styles.projectPill}>Modrinth Project</span>
          </div>

          <div className={styles.updateDetails}>
            <div className={styles.detailRow}>
              <span className={styles.label}>當前整合包版本 ID</span>
              <span className={styles.value}>{instance.modrinthVersionId || '未知'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>最新可用版本</span>
              <span className={styles.value}>{latestModpackVersion.version_number}</span>
            </div>
          </div>

          {instance.modrinthVersionId !== latestModpackVersion.id ? (
            <div className={styles.updateActionArea}>
              <div className={styles.alertBox}>
                <AlertTriangle size={18} />
                <span>偵測到新版本！更新會覆蓋並清空現有 mods 目錄以避免相容衝突。</span>
              </div>
              <button className={styles.primaryBtnLarge} onClick={handleUpdateModpackClick}>
                立即更新整合包
              </button>
            </div>
          ) : (
            <div className={styles.successBox}>
              <Check size={18} />
              <span>目前整合包已是最新版本！</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.placeholder}>無法取得整合包更新資料</div>
      )}
    </div>
  );
}
