import styles from './CustomConfirmModal.module.css';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'update';
}

export function CustomConfirmModal({ isOpen, title, message, onConfirm, onCancel, type = 'danger' }: Props) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${type === 'update' ? styles.typeUpdate : ''}`}>
        <div className={styles.header}>
          <h3>{title}</h3>
        </div>
        <div className={styles.body}>
          <p>{message}</p>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            取消
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            確認
          </button>
        </div>
      </div>
    </div>
  );
}
