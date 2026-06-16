import { useInstanceStore } from '../../store/instanceStore';
import { useI18n, translateBackendStatus } from '../../utils/i18n';
import styles from './LaunchHUD.module.css';
import { Loader, CheckCircle, X } from 'lucide-react';

export function LaunchHUD() {
  const instanceStates = useInstanceStore((state) => state.instanceStates);
  const instances = useInstanceStore((state) => state.instances);
  const cancelLaunch = useInstanceStore((state) => state.cancelLaunch);
  const { t, language } = useI18n();

  // 尋找進行中實例（下載或啟動中）
  const activeId = Object.entries(instanceStates).find(([, s]) => 
    s.isDownloading || s.isLaunching
  )?.[0];

  if (!activeId) return null;

  const activeState = instanceStates[activeId];
  const instance = instances.find(i => i.id === activeId);
  const instanceName = instance?.name || t('overview.unnamed');

  const progress = activeState.downloadProgress ?? 0;
  const statusText = activeState.downloadStatusText || '';
  const phase = activeState.launchPhase;

  const translatedStatusText = statusText ? translateBackendStatus(statusText, language) : '';

  const getPhaseLabel = () => {
    switch (phase) {
      case 'java_check': return t('hud.java_check');
      case 'java_download': return t('hud.java_download');
      case 'files': return translatedStatusText || t('hud.preparing_files');
      case 'launching': return t('hud.launching_game');
      default: return translatedStatusText || t('hud.processing');
    }
  };

  const isLaunching = phase === 'launching';
  const isDone = progress >= 100 && !isLaunching;

  const handleCancel = () => {
    cancelLaunch(activeId);
  };

  return (
    <div className={`${styles.hud} ${styles.visible}`}>
      <div className={styles.hudContent}>
        <div className={styles.hudHeader}>
          <div className={styles.hudIcon}>
            {isDone
              ? <CheckCircle size={16} className={styles.doneIcon} />
              : <Loader size={16} className={`${styles.spinnerIcon} animate-spin`} />
            }
          </div>
          <div className={styles.hudText}>
            <div className={styles.hudTitle}>{instanceName}</div>
            <div className={styles.hudStatus}>{getPhaseLabel()}</div>
          </div>
          <div className={styles.hudRight}>
            {!isLaunching && (
              <span className={styles.hudPercent}>{Math.round(progress)}%</span>
            )}
            {!isDone && (
              <button
                className={styles.cancelBtn}
                onClick={handleCancel}
                title={t('hud.btn.cancel')}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        {!isLaunching && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
