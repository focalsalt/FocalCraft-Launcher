
import { useSettingsStore } from '../../../store/settingsStore';
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
}: SettingsTabProps) {
  const settingsConfig = useSettingsStore((state) => state.config);

  const handleRestoreDefaultMemory = () => {
    setMaxMemory(settingsConfig.defaultMaxMemory || 4096);
  };

  const handleRestoreDefaultJvm = () => {
    setJvmArgs(settingsConfig.defaultJvmArgs || '');
  };

  return (
    <div className={styles.settingsCard}>
      <h3 className={styles.settingsSectionTitle}>設定檔細項</h3>

      <div className={styles.formGroup}>
        <div className={styles.formLabelRow}>
          <label>最大分配記憶體 (MB)</label>
          <button type="button" className={styles.formHelperBtn} onClick={handleRestoreDefaultMemory}>
            使用全域預設值 ({settingsConfig.defaultMaxMemory || 4096} MB)
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
        <span className={styles.fieldExplanation}>分配給 Java 虛擬機器 (JVM) 的最大記憶體上限，建議至少設定 2048 MB。</span>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.formLabelRow}>
          <label>自訂本實例 Java 執行路徑</label>
        </div>
        <input
          type="text"
          className={styles.input}
          placeholder="留空則使用全域設定值"
          value={customJava}
          onChange={(e) => setCustomJava(e.target.value)}
        />
        <span className={styles.fieldExplanation}>如果您的模組需要特定 Java 版本，可在此指定特定路徑。留空則自動偵測系統相容版本。</span>
      </div>

      <div className={styles.formGroup}>
        <div className={styles.formLabelRow}>
          <label>自訂 JVM 啟動參數</label>
          <button type="button" className={styles.formHelperBtn} onClick={handleRestoreDefaultJvm}>
            還原預設參數
          </button>
        </div>
        <textarea
          className={styles.textarea}
          value={jvmArgs}
          onChange={(e) => setJvmArgs(e.target.value)}
          placeholder="例如：-XX:+UseG1GC -XX:MaxGCPauseMillis=50"
        />
        <span className={styles.fieldExplanation}>進階 Java 參數設定，例如記憶體回收策略 (Garbage Collection) 優化等。</span>
      </div>

      <div className={`${styles.btnRow} ${styles.settingsBtnRow}`} style={{ marginTop: 24 }}>
        <button className={styles.saveBtn} onClick={handleSaveSettings}>
          儲存設定
        </button>
        <button className={styles.actionBtn} onClick={() => handleOpenFolder()}>
          開啟實例資料夾
        </button>
        <button className={styles.deleteBtn} onClick={() => setIsConfirmDeleteOpen(true)}>
          刪除此實例
        </button>
      </div>
    </div>
  );
}
