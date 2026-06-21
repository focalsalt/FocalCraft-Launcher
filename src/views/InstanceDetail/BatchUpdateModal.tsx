import { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { ModItem } from '../../types';
import { useI18n } from '../../utils/i18n';
import styles from './BatchUpdateModal.module.css';

interface BatchUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  mods: ModItem[];
  modsUpdates: Record<string, any>;
  onConfirmUpdates: (selected: Array<{ mod: ModItem; updateObj: any }>) => void;
}

export function BatchUpdateModal({
  isOpen,
  onClose,
  mods,
  modsUpdates,
  onConfirmUpdates
}: BatchUpdateModalProps) {
  const { t } = useI18n();

  // Find all mods that actually have updates available
  const updateableMods = mods.filter(m => m.sha1 && modsUpdates[m.sha1]);

  // Keep track of selected mod SHA1s
  const [selectedSha1s, setSelectedSha1s] = useState<Set<string>>(new Set());

  // Reset/Initialize selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSha1s(new Set(updateableMods.map(m => m.sha1)));
    }
  }, [isOpen, mods, modsUpdates]);

  if (!isOpen) return null;

  const isAllSelected = updateableMods.length > 0 && selectedSha1s.size === updateableMods.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSha1s(new Set());
    } else {
      setSelectedSha1s(new Set(updateableMods.map(m => m.sha1)));
    }
  };

  const handleToggleMod = (sha1: string) => {
    const next = new Set(selectedSha1s);
    if (next.has(sha1)) {
      next.delete(sha1);
    } else {
      next.add(sha1);
    }
    setSelectedSha1s(next);
  };

  const handleConfirm = () => {
    const selectedList = updateableMods
      .filter(m => selectedSha1s.has(m.sha1))
      .map(m => ({ mod: m, updateObj: modsUpdates[m.sha1] }));
    onConfirmUpdates(selectedList);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{t('detail.modal.batch_update.title')}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {updateableMods.length > 0 && (
          <div className={styles.selectAllRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
              />
              <span className={styles.checkboxText}>{t('detail.modal.batch_update.select_all')}</span>
            </label>
            <span className={styles.countInfo}>
              {selectedSha1s.size} / {updateableMods.length}
            </span>
          </div>
        )}

        <div className={styles.body}>
          {updateableMods.length === 0 ? (
            <div className={styles.emptyText}>
              {t('tabs.mods.status.up_to_date')}
            </div>
          ) : (
            <div className={styles.list}>
              {updateableMods.map((mod) => {
                const update = modsUpdates[mod.sha1];
                const isSelected = selectedSha1s.has(mod.sha1);
                return (
                  <div
                    key={mod.fileName}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                    onClick={() => handleToggleMod(mod.sha1)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by item onClick
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className={styles.modInfo}>
                      <div className={styles.modName}>{mod.name}</div>
                      <div className={styles.modFile}>{mod.fileName}</div>
                    </div>
                    <div className={styles.versionCompare}>
                      <span className={styles.oldVer}>{mod.version}</span>
                      <ArrowRight size={14} className={styles.arrow} />
                      <span className={styles.newVer}>{update.version_number}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={selectedSha1s.size === 0}
          >
            {t('detail.modal.batch_update.update_btn', { count: selectedSha1s.size })}
          </button>
        </div>
      </div>
    </div>
  );
}
