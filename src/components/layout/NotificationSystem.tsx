import { useAppStore } from '../../store/appStore';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import styles from './NotificationSystem.module.css';

const IconMap = {
  info: <Info size={20} className={`${styles.icon} ${styles.info}`} />,
  success: <CheckCircle size={20} className={`${styles.icon} ${styles.success}`} />,
  warning: <AlertTriangle size={20} className={`${styles.icon} ${styles.warning}`} />,
  error: <XCircle size={20} className={`${styles.icon} ${styles.error}`} />
};

export function NotificationSystem() {
  const { notifications, removeNotification } = useAppStore();

  return (
    <div className={styles.container}>
      {notifications.map((notification) => (
        <div key={notification.id} className={styles.notification}>
          {IconMap[notification.type]}
          <div className={styles.content}>
            <div className={styles.title}>{notification.title}</div>
            <div className={styles.message}>{notification.message}</div>
          </div>
          <button 
            className={styles.closeButton}
            onClick={() => removeNotification(notification.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
