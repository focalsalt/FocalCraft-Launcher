import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';
import { useI18n } from '../../utils/i18n';
import { invoke } from '@tauri-apps/api/core';
import { Loader, FolderOpen, RefreshCw, Trash2, Save } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { CustomSelect } from '../../components/common/CustomSelect';
import styles from './GlobalSettings.module.css';

export function GlobalSettings() {
  const { config, loadConfig, saveConfig, isSaving, isLoading } = useSettingsStore();
  const { addNotification } = useAppStore();
  const { t } = useI18n();

  const [defaultMaxMemory, setDefaultMaxMemory] = useState(4096);
  const [defaultJvmArgs, setDefaultJvmArgs] = useState('');
  const [customJavaPath, setCustomJavaPath] = useState('');
  const [instancesPath, setInstancesPath] = useState('');
  const [language, setLanguage] = useState<string | null>(null);
  const [baseDir, setBaseDir] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');

  // 載入應用程式目錄與設定
  useEffect(() => {
    const init = async () => {
      try {
        const path = await invoke<string>('init_app_dirs');
        setBaseDir(path);
      } catch (err) {
        console.error('Failed to get app dirs:', err);
      }
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (err) {
        console.error('Failed to get app version:', err);
      }
      await loadConfig();
    };
    init();
  }, []);

  // 同步設定狀態
  useEffect(() => {
    setDefaultMaxMemory(config.defaultMaxMemory || 4096);
    setDefaultJvmArgs(config.defaultJvmArgs || '');
    setCustomJavaPath(config.customJavaPath || '');
    setInstancesPath(config.instancesPath || '');
    setLanguage(config.language || null);
  }, [config]);

  const handleBrowseInstancesPath = async () => {
    try {
      const selected = await invoke<string>('select_directory');
      if (selected && selected !== 'CANCELLED') {
        setInstancesPath(selected);
      }
    } catch (err) {
      if (err !== 'CANCELLED') {
        addNotification({
          type: 'error',
          title: t('settings.notification.browse_failed.title'),
          message: String(err)
        });
      }
    }
  };

  const handleRestoreDefaultInstancesPath = () => {
    setInstancesPath('');
  };

  const handleBrowseJavaPath = async () => {
    try {
      const selected = await invoke<string>('select_java_file');
      if (selected && selected !== 'CANCELLED') {
        setCustomJavaPath(selected);
      }
    } catch (err) {
      if (err !== 'CANCELLED') {
        addNotification({
          type: 'error',
          title: t('settings.notification.browse_java_failed.title'),
          message: String(err)
        });
      }
    }
  };

  const handleClearJavaPath = () => {
    setCustomJavaPath('');
  };

  const handleSave = async () => {
    try {
      const newConfig = {
        defaultMaxMemory,
        defaultJvmArgs: defaultJvmArgs.trim() || null,
        customJavaPath: customJavaPath.trim() || null,
        instancesPath: instancesPath.trim() || null,
        language,
      };

      await saveConfig(newConfig);

      addNotification({
        type: 'success',
        title: t('settings.notification.save_success.title'),
        message: t('settings.notification.save_success.msg')
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('settings.notification.save_failed.title'),
        message: String(err)
      });
    }
  };

  const displayInstancesPath = instancesPath || (baseDir ? `${baseDir}\\instances` : '...');

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader className="animate-spin" size={48} />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.background}></div>

      {isSaving && (
        <div className={styles.migrationOverlay}>
          <div className={styles.migrationBox}>
            <Loader className="animate-spin" size={48} />
            <h3>{t('settings.overlay.saving')}</h3>
            <p>{t('settings.overlay.saving_help')}</p>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.scrollArea}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.card.storage')}</h2>
            <div className={styles.formGroup}>
              <label>{t('settings.label.storage_path')}</label>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  className={styles.input}
                  value={displayInstancesPath}
                  readOnly
                />
                <button className={styles.btnIcon} onClick={handleBrowseInstancesPath} title={t('settings.btn.browse')}>
                  <FolderOpen size={18} />
                  <span>{t('settings.btn.browse')}</span>
                </button>
                {instancesPath && (
                  <button className={styles.btnIconSec} onClick={handleRestoreDefaultInstancesPath} title={t('settings.btn.restore')}>
                    <RefreshCw size={18} />
                    <span>{t('settings.btn.restore')}</span>
                  </button>
                )}
              </div>
              <span className={styles.helpText}>
                {t('settings.help.storage_path')}
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.card.java')}</h2>
            <div className={styles.formGroup}>
              <label>{t('settings.label.java_path')}</label>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={t('settings.placeholder.java_path')}
                  value={customJavaPath}
                  onChange={(e) => setCustomJavaPath(e.target.value)}
                />
                <button className={styles.btnIcon} onClick={handleBrowseJavaPath} title={t('settings.btn.browse')}>
                  <FolderOpen size={18} />
                  <span>{t('settings.btn.browse')}</span>
                </button>
                {customJavaPath && (
                  <button className={styles.btnIconSec} onClick={handleClearJavaPath} title="Clear">
                    <Trash2 size={18} />
                    <span>{t('tabs.settings.btn.clear')}</span>
                  </button>
                )}
              </div>
              <span className={styles.helpText}>
                {t('settings.help.java_path')}
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.card.launch')}</h2>

            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label>{t('settings.label.max_memory')}</label>
              </div>
              <div className={styles.sliderGroup}>
                <input
                  type="range"
                  min="1024"
                  max="16384"
                  step="512"
                  value={defaultMaxMemory}
                  onChange={(e) => setDefaultMaxMemory(parseInt(e.target.value))}
                  className={styles.slider}
                />
                <input
                  type="number"
                  min="1024"
                  max="32768"
                  step="512"
                  value={defaultMaxMemory}
                  onChange={(e) => setDefaultMaxMemory(parseInt(e.target.value) || 1024)}
                  className={styles.numInput}
                />
              </div>
              <span className={styles.helpText}>
                {t('settings.help.max_memory')}
              </span>
            </div>

            <div className={styles.formGroup}>
              <label>{t('settings.label.jvm_args')}</label>
              <textarea
                className={styles.textarea}
                placeholder={t('settings.placeholder.jvm_args')}
                value={defaultJvmArgs}
                onChange={(e) => setDefaultJvmArgs(e.target.value)}
              />
              <span className={styles.helpText}>
                {t('settings.help.jvm_args')}
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.card.language')}</h2>
            <div className={styles.formGroup}>
              <label style={{ marginBottom: '8px', display: 'block' }}>{t('settings.label.language')}</label>
              <CustomSelect
                value={language || ''}
                onChange={(val) => setLanguage(val || null)}
                options={[
                  { value: '', label: t('settings.lang.auto') },
                  { value: 'zh-TW', label: t('settings.lang.zh_tw') },
                  { value: 'en-US', label: t('settings.lang.en_us') }
                ]}
              />
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.card.about')}</h2>
            <div className={styles.aboutRow}>
              <div className={styles.aboutInfo}>
                <div className={styles.appName}>Focal Craft Launcher</div>
                <div className={styles.appVersion}>{t('settings.about.version', { version: appVersion })}</div>
                <div className={styles.appDesc}>{t('settings.about.desc')}</div>
              </div>
            </div>
          </div>

        </div>

        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={handleSave}>
            <Save size={18} />
            <span>{t('settings.btn.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
