import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';
import { invoke } from '@tauri-apps/api/core';
import { Loader, FolderOpen, RefreshCw, Trash2, Save } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import styles from './GlobalSettings.module.css';

export function GlobalSettings() {
  const { config, loadConfig, saveConfig, isSaving, isLoading } = useSettingsStore();
  const { addNotification } = useAppStore();

  const [defaultMaxMemory, setDefaultMaxMemory] = useState(4096);
  const [defaultJvmArgs, setDefaultJvmArgs] = useState('');
  const [customJavaPath, setCustomJavaPath] = useState('');
  const [instancesPath, setInstancesPath] = useState('');
  const [baseDir, setBaseDir] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');



  // Load app base dir and config
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

  // Sync state with loaded config
  useEffect(() => {
    setDefaultMaxMemory(config.defaultMaxMemory || 4096);
    setDefaultJvmArgs(config.defaultJvmArgs || '');
    setCustomJavaPath(config.customJavaPath || '');
    setInstancesPath(config.instancesPath || '');
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
          title: '選取目錄失敗',
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
          title: '選取 Java 失敗',
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
      };

      await saveConfig(newConfig);

      addNotification({
        type: 'success',
        title: '設定儲存成功',
        message: '全局設定已成功更新。'
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: '儲存設定失敗',
        message: String(err)
      });
    }
  };

  const displayInstancesPath = instancesPath || (baseDir ? `${baseDir}\\instances` : '載入中...');

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader className="animate-spin" size={48} />
        <span>載入設定中...</span>
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
            <h3>正在儲存設定與遷移資料...</h3>
            <p>這可能需要幾分鐘的時間，請勿關閉啟動器。</p>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.scrollArea}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>📂 儲存路徑與檔案管理</h2>
            <div className={styles.formGroup}>
              <label>實例儲存路徑</label>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  className={styles.input}
                  value={displayInstancesPath}
                  readOnly
                />
                <button className={styles.btnIcon} onClick={handleBrowseInstancesPath} title="瀏覽資料夾">
                  <FolderOpen size={18} />
                  <span>瀏覽</span>
                </button>
                {instancesPath && (
                  <button className={styles.btnIconSec} onClick={handleRestoreDefaultInstancesPath} title="恢復預設路徑">
                    <RefreshCw size={18} />
                    <span>恢復預設</span>
                  </button>
                )}
              </div>
              <span className={styles.helpText}>
                所有建立的 Minecraft 實例、模組包及存檔都會存放在此路徑。變更此路徑時，系統將自動無損移轉現有檔案。
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>☕ Java 執行環境</h2>
            <div className={styles.formGroup}>
              <label>自訂全域 Java 執行路徑 (java.exe / javaw.exe)</label>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="留空將自動偵測相容的 Java 版本"
                  value={customJavaPath}
                  onChange={(e) => setCustomJavaPath(e.target.value)}
                />
                <button className={styles.btnIcon} onClick={handleBrowseJavaPath} title="選取 Java 執行檔">
                  <FolderOpen size={18} />
                  <span>瀏覽</span>
                </button>
                {customJavaPath && (
                  <button className={styles.btnIconSec} onClick={handleClearJavaPath} title="清除路徑">
                    <Trash2 size={18} />
                    <span>清除</span>
                  </button>
                )}
              </div>
              <span className={styles.helpText}>
                手動指定 Java 的執行路徑。即使指定了此路徑，啟動遊戲前仍會比對版本需求，不符時將安全 fallback 至系統偵測的版本。
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>⚙️ 預設啟動與記憶體設定</h2>

            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label>預設最大記憶體分配</label>
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
                新建立實例時預設分配的最大 RAM 容量。
              </span>
            </div>

            <div className={styles.formGroup}>
              <label>預設 JVM 啟動參數</label>
              <textarea
                className={styles.textarea}
                placeholder="例如：-XX:+UseG1GC -XX:MaxGCPauseMillis=50"
                value={defaultJvmArgs}
                onChange={(e) => setDefaultJvmArgs(e.target.value)}
              />
              <span className={styles.helpText}>
                新建立實例時預設寫入的 JVM 最佳化參數。
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>ℹ️ 關於 (About)</h2>
            <div className={styles.aboutRow}>
              <div className={styles.aboutInfo}>
                <div className={styles.appName}>Focal Craft Launcher</div>
                <div className={styles.appVersion}>版本：v{appVersion}</div>
                <div className={styles.appDesc}>一個安全、快速、現代化的 Minecraft 啟動器。</div>
              </div>
            </div>
          </div>

        </div>

        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={handleSave}>
            <Save size={18} />
            <span>儲存全域設定</span>
          </button>
        </div>
      </div>


    </div>
  );
}
