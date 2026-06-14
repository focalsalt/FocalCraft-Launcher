import { useInstanceStore } from '../../store/instanceStore';
import styles from './LaunchHUD.module.css';
import { Loader, CheckCircle, X } from 'lucide-react';

export function LaunchHUD() {
  const instanceStates = useInstanceStore((state) => state.instanceStates);
  const instances = useInstanceStore((state) => state.instances);
  const cancelLaunch = useInstanceStore((state) => state.cancelLaunch);

  // Find the active instance - launching or downloading
  const activeId = Object.entries(instanceStates).find(([, s]) => 
    s.isDownloading || s.isLaunching
  )?.[0];

  if (!activeId) return null;

  const activeState = instanceStates[activeId];
  const instance = instances.find(i => i.id === activeId);
  const instanceName = instance?.name || '未知實例';

  const progress = activeState.downloadProgress ?? 0;
  const statusText = activeState.downloadStatusText || '';
  const phase = activeState.launchPhase;

  const getPhaseLabel = () => {
    switch (phase) {
      case 'java_check': return '檢查 Java...';
      case 'java_download': return '下載 Java...';
      case 'files': return statusText || '準備遊戲檔案...';
      case 'launching': return '啟動遊戲中...';
      default: return statusText || '處理中...';
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
              : <Loader size={16} className={styles.spinnerIcon} />
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
                title="取消啟動"
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
