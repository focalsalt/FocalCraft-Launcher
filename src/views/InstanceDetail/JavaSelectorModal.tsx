import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../utils/i18n';
import { X, Loader, FolderOpen, Trash2 } from 'lucide-react';
import styles from './JavaSelectorModal.module.css';

interface JavaEnv {
  path: string;
  version: string;
  major: number;
}

interface JavaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  currentPath: string;
}

export function JavaSelectorModal({
  isOpen,
  onClose,
  onSelect,
  currentPath,
}: JavaSelectorModalProps) {
  const { t } = useI18n();
  const [detectedJavas, setDetectedJavas] = useState<JavaEnv[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      scanJava();
    }
  }, [isOpen]);

  const scanJava = async () => {
    setIsLoading(true);
    try {
      const list = await invoke<JavaEnv[]>('detect_java');
      setDetectedJavas(list || []);
    } catch (err) {
      console.error('Failed to detect Java:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSelect = async () => {
    try {
      const selected = await invoke<string>('select_java_file');
      if (selected && selected !== 'CANCELLED') {
        onSelect(selected);
        onClose();
      }
    } catch (err) {
      if (err !== 'CANCELLED') {
        console.error('Failed to manually select Java:', err);
      }
    }
  };

  const handleClear = () => {
    onSelect('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{t('java_selector.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <Loader className="animate-spin" size={32} />
              <span>{t('java_selector.loading')}</span>
            </div>
          ) : detectedJavas.length === 0 ? (
            <div className={styles.emptyContainer}>
              <p>{t('java_selector.no_detected')}</p>
            </div>
          ) : (
            <div className={styles.listSection}>
              <span className={styles.sectionLabel}>{t('java_selector.detected_title')}</span>
              <div className={styles.list}>
                {detectedJavas.map((java, idx) => {
                  const isCurrent = currentPath === java.path;
                  return (
                    <button
                      key={idx}
                      className={`${styles.item} ${isCurrent ? styles.activeItem : ''}`}
                      onClick={() => {
                        onSelect(java.path);
                        onClose();
                      }}
                    >
                      <div className={styles.itemInfo}>
                        <div className={styles.itemTitle}>
                          Java {java.major || t('java_selector.unknown')}
                        </div>
                        <div className={styles.itemDetail}>
                          <span>{t('java_selector.version')}{java.version}</span>
                          <span>{t('java_selector.path')}{java.path}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {currentPath && (
              <button className={styles.clearBtn} onClick={handleClear}>
                <Trash2 size={16} />
                <span>{t('java_selector.clear_path')}</span>
              </button>
            )}
          </div>
          <div className={styles.footerRight}>
            <button className={styles.manualBtn} onClick={handleManualSelect}>
              <FolderOpen size={16} />
              <span>{t('java_selector.manual_select')}</span>
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
