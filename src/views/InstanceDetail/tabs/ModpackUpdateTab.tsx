import { Loader, AlertTriangle, Check } from 'lucide-react';
import { Instance } from '../../../types';
import { useI18n } from '../../../utils/i18n';
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
  const { t } = useI18n();

  return (
    <div className={styles.tabContainerCenter}>
      {isCheckingModpackUpdate ? (
        <div className={styles.loadingContainer}>
          <Loader className="animate-spin" size={48} />
          <span>{t('tabs.modpack_update.checking')}</span>
        </div>
      ) : latestModpackVersion ? (
        <div className={styles.updateCheckCard}>
          <div className={styles.updateCheckHeader}>
            <h2>{t('tabs.modpack_update.title')}</h2>
            <span className={styles.projectPill}>{t('tabs.modpack_update.pill')}</span>
          </div>

          <div className={styles.updateDetails}>
            <div className={styles.detailRow}>
              <span className={styles.label}>{t('tabs.modpack_update.label.curr_id')}</span>
              <span className={styles.value}>{instance.modrinthVersionId || t('tabs.modpack_update.unknown')}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>{t('tabs.modpack_update.label.latest')}</span>
              <span className={styles.value}>{latestModpackVersion.version_number}</span>
            </div>
          </div>

          {instance.modrinthVersionId !== latestModpackVersion.id ? (
            <div className={styles.updateActionArea}>
              <div className={styles.alertBox}>
                <AlertTriangle size={18} />
                <span>{t('tabs.modpack_update.detect_new')}</span>
              </div>
              <button className={styles.primaryBtnLarge} onClick={handleUpdateModpackClick}>
                {t('tabs.modpack_update.btn.update')}
              </button>
            </div>
          ) : (
            <div className={styles.successBox}>
              <Check size={18} />
              <span>{t('tabs.modpack_update.already_latest')}</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.placeholder}>{t('tabs.modpack_update.failed')}</div>
      )}
    </div>
  );
}
