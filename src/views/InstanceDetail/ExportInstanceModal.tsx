import { useState, useEffect } from 'react';
import { X, Loader, Save } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../utils/i18n';
import { useAppStore } from '../../store/appStore';
import { Checkbox } from '../../components/common/Checkbox';
import styles from './ExportInstanceModal.module.css';

interface ModItem {
  fileName: string;
  name: string;
  version: string;
  enabled: boolean;
}

interface Props {
  isOpen: boolean;
  instanceId: string;
  instanceName: string;
  onClose: () => void;
}

export function ExportInstanceModal({ isOpen, instanceId, instanceName, onClose }: Props) {
  const { t } = useI18n();
  const { addNotification } = useAppStore();

  const [exportType, setExportType] = useState<'multimc' | 'modrinth' | 'curseforge'>('multimc');
  const [mods, setMods] = useState<ModItem[]>([]);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [destPath, setDestPath] = useState('');
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchMods = async () => {
      setIsLoadingMods(true);
      try {
        const list = await invoke<ModItem[]>('get_installed_mods', { instanceId });
        setMods(list);
        // Default to all mods checked
        setSelectedMods(new Set(list.map(m => m.fileName)));
      } catch (err) {
        console.error('Failed to load mods for export:', err);
      } finally {
        setIsLoadingMods(false);
      }
    };
    fetchMods();
    setDestPath('');
  }, [isOpen, instanceId]);

  if (!isOpen) return null;

  const handleSelectDestPath = async () => {
    try {
      const ext = exportType === 'modrinth' ? '.mrpack' : '.zip';
      const defaultName = `${instanceName}_Export${ext}`;
      const path = await invoke<string>('select_export_zip_path', { defaultName });
      if (path && path !== 'CANCELLED') {
        setDestPath(path);
      }
    } catch (err) {
      console.error('Failed to select export path:', err);
    }
  };

  const handleToggleMod = (fileName: string) => {
    const next = new Set(selectedMods);
    if (next.has(fileName)) {
      next.delete(fileName);
    } else {
      next.add(fileName);
    }
    setSelectedMods(next);
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedMods(new Set(mods.map(m => m.fileName)));
    } else {
      setSelectedMods(new Set());
    }
  };

  const handleExport = async () => {
    if (!destPath) {
      addNotification({
        type: 'warning',
        title: t('notification.warning'),
        message: t('export.select_dest'),
      });
      return;
    }

    setIsExporting(true);
    try {
      await invoke('export_instance', {
        instanceId,
        exportType,
        selectedMods: Array.from(selectedMods),
        destZipPath: destPath,
      });
      addNotification({
        type: 'success',
        title: t('notification.success'),
        message: t('export.success'),
      });
      onClose();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('export.failed', { error: '' }),
        message: String(err),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    { value: 'multimc', label: 'MultiMC / PrismLauncher (.zip)' },
    { value: 'modrinth', label: 'Modrinth (.mrpack)' },
    { value: 'curseforge', label: 'CurseForge (.zip)' },
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{t('export.title')}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={isExporting}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Format selection */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t('export.format')}</label>
            <div className={styles.formatSelector}>
              {formatOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.formatBtn} ${exportType === opt.value ? styles.activeFormat : ''}`}
                  onClick={() => {
                    setExportType(opt.value as any);
                    setDestPath(''); // Clear dest path as file extension changes
                  }}
                  disabled={isExporting}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dest path */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t('export.select_dest')}</label>
            <div className={styles.pathPicker}>
              <input
                type="text"
                className={styles.pathInput}
                value={destPath}
                readOnly
                placeholder={t('export.select_dest')}
              />
              <button
                type="button"
                className="btn-outline"
                onClick={handleSelectDestPath}
                disabled={isExporting}
                style={{ height: '38px', padding: '0 16px' }}
              >
                <Save size={16} />
                <span>{t('settings.btn.browse')}</span>
              </button>
            </div>
          </div>

          {/* Mods checklist */}
          <div className={styles.section} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className={styles.listHeader}>
              <span className={styles.sectionLabel}>
                {t('export.select_mods', { selected: selectedMods.size, total: mods.length })}
              </span>
              {mods.length > 0 && (
                <Checkbox
                  checked={selectedMods.size === mods.length}
                  indeterminate={selectedMods.size > 0 && selectedMods.size < mods.length}
                  onChange={handleToggleAll}
                  disabled={isExporting}
                  label={t('create.mrpack.select_all')}
                />
              )}
            </div>

            <div className={styles.modsList}>
              {isLoadingMods ? (
                <div className={styles.loading}>
                  <Loader className="animate-spin" size={24} />
                  <span>{t('create.custom.loading')}</span>
                </div>
              ) : mods.length === 0 ? (
                <div className={styles.empty}>{t('tabs.mods.empty')}</div>
              ) : (
                mods.map((mod) => {
                  const isChecked = selectedMods.has(mod.fileName);
                  return (
                    <div
                      key={mod.fileName}
                      className={`${styles.modItem} ${isChecked ? styles.checkedMod : ''}`}
                      onClick={() => !isExporting && handleToggleMod(mod.fileName)}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={isExporting}
                        className={styles.modItemCheckbox}
                      />
                      <div className={styles.modInfo}>
                        <div className={styles.modName}>{mod.name || mod.fileName}</div>
                        <div className={styles.modVersion}>v{mod.version}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className="btn-text" onClick={onClose} disabled={isExporting}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-filled"
            onClick={handleExport}
            disabled={isExporting || isLoadingMods}
          >
            {isExporting ? (
              <>
                <Loader className="animate-spin" size={16} />
                <span>{t('detail.btn.launching')}</span>
              </>
            ) : (
              <span>{t('export.start')}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
