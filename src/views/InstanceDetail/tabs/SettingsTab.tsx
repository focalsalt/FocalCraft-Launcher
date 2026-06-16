import { useSettingsStore } from '../../../store/settingsStore';
import { useI18n } from '../../../utils/i18n';
import { FolderOpen, Trash2 } from 'lucide-react';
import styles from '../InstanceDetail.module.css';

interface SettingsTabProps {
  maxMemory: number;
  setMaxMemory: (val: number) => void;
  customJava: string;
  setCustomJava: (val: string) => void;
  jvmArgs: string;
  setJvmArgs: (val: string) => void;
  handleSaveSettings: () => void;
  handleOpenFolder: () => void;
  setIsConfirmDeleteOpen: (val: boolean) => void;
  handleBrowseJavaPath: () => void;
  handleClearJavaPath: () => void;
}

export function SettingsTab({
  maxMemory,
  setMaxMemory,
  customJava,
  setCustomJava,
  jvmArgs,
  setJvmArgs,
  handleSaveSettings,
  handleOpenFolder,
  setIsConfirmDeleteOpen,
  handleBrowseJavaPath,
  handleClearJavaPath,
}: SettingsTabProps) {
  const settingsConfig = useSettingsStore((state) => state.config);
  const { t } = useI18n();

  const handleRestoreDefaultMemory = () => {
    setMaxMemory(settingsConfig.defaultMaxMemory || 4096);
  };

  const handleRestoreDefaultJvm = () => {
    setJvmArgs(settingsConfig.defaultJvmArgs || '');
  };

  return (
    <div className={styles.settingsCard}>
      <h3 className={styles.settingsSectionTitle}>{t('tabs.inst_settings.title')}</h3>

      <div className={styles.formGroup}>
        <div className={styles.formLabelRow}>
          <label>{t('tabs.inst_settings.label.max_mem')}</label>
          <button type="button" className={styles.formHelperBtn} onClick={handleRestoreDefaultMemory}>
            {t('tabs.inst_settings.btn.use_global', { mem: settingsConfig.defaultMaxMemory || 4096 })}
          </button>
        </div>
        <div className={styles.sliderGroup}>
          <input
            type="range"
            min="1024"
            max="16384"
            step="512"
            value={maxMemory}
            onChange={(e) => setMaxMemory(parseInt(e.target.value))}
            className={styles.memorySlider}
          />
          <input
            type="number"
            min="1024"
            max="32768"
            step="512"
            value={maxMemory}
            onChange={(e) => setMaxMemory(parseInt(e.target.value) || 1024)}
            className={styles.numInput}
          />
        </div>
        <span className={styles.fieldExplanation}>{t('tabs.inst_settings.help.max_mem')}</span>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.formLabelRow}>
          <label>{t('tabs.inst_settings.label.java_path')}</label>
        </div>
        {/* Java 路徑輸入框與瀏覽/清除按鈕 */}
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={styles.input}
            placeholder={t('tabs.inst_settings.placeholder.java_path')}
            value={customJava}
            onChange={(e) => setCustomJava(e.target.value)}
          />
          <button type="button" className={styles.btnIcon} onClick={handleBrowseJavaPath} title={t('settings.btn.browse')}>
            <FolderOpen size={16} />
            <span>{t('settings.btn.browse')}</span>
          </button>
          {customJava && (
            <button type="button" className={styles.btnIconSec} onClick={handleClearJavaPath} title={t('tabs.settings.btn.clear')}>
              <Trash2 size={16} />
              <span>{t('tabs.settings.btn.clear')}</span>
            </button>
          )}
        </div>
        <span className={styles.fieldExplanation}>{t('tabs.inst_settings.help.java_path')}</span>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.formLabelRow}>
          <label>{t('tabs.inst_settings.label.jvm_args')}</label>
          <button type="button" className={styles.formHelperBtn} onClick={handleRestoreDefaultJvm}>
            {t('tabs.inst_settings.btn.restore_jvm')}
          </button>
        </div>
        <textarea
          className={styles.textarea}
          value={jvmArgs}
          onChange={(e) => setJvmArgs(e.target.value)}
          placeholder={t('settings.placeholder.jvm_args')}
        />
        <span className={styles.fieldExplanation}>{t('tabs.inst_settings.help.jvm_args')}</span>
      </div>

      <div className={`${styles.btnRow} ${styles.settingsBtnRow}`} style={{ marginTop: 24 }}>
        <button className={styles.saveBtn} onClick={handleSaveSettings}>
          {t('tabs.inst_settings.btn.save')}
        </button>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder()}>
          {t('tabs.inst_settings.btn.folder')}
        </button>
        <button className={styles.deleteBtn} onClick={() => setIsConfirmDeleteOpen(true)}>
          {t('tabs.inst_settings.btn.delete')}
        </button>
      </div>
    </div>
  );
}
