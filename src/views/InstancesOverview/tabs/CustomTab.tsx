
import { CustomSelect } from '../../../components/common/CustomSelect';
import { Upload } from 'lucide-react';
import styles from '../CreateInstanceModal.module.css';

interface CustomTabProps {
  customName: string;
  setCustomName: (val: string) => void;
  minorFilter: 'release' | 'snapshot';
  majorFilter: 'release' | 'history';
  setMajorFilter: (val: 'release' | 'history') => void;
  setMinorFilter: (val: 'release' | 'snapshot') => void;
  errorLoadingVersions: boolean;
  loadVersions: () => void;
  loadingVersions: boolean;
  selectedMajorVersion: string;
  handleMajorVersionChange: (val: string) => void;
  majorVersionOptions: { value: string; label: string }[];
  customVersion: string;
  setCustomVersion: (val: string) => void;
  minorVersionOptions: { value: string; label: string }[];
  customModloader: string;
  setCustomModloader: (val: string) => void;
  modloaderOptions: { value: string; label: string }[];
  selectedLoaderVersion: string;
  setSelectedLoaderVersion: (val: string) => void;
  loaderVersionOptions: { value: string; label: string }[];
  loadingLoaderVersions: boolean;
  isDragOverCustom: boolean;
  customLoaderJarName: string;
  handleSelectCustomLoaderJar: () => void;
}

export function CustomTab({
  customName,
  setCustomName,
  minorFilter,
  majorFilter,
  setMajorFilter,
  setMinorFilter,
  errorLoadingVersions,
  loadVersions,
  loadingVersions,
  selectedMajorVersion,
  handleMajorVersionChange,
  majorVersionOptions,
  customVersion,
  setCustomVersion,
  minorVersionOptions,
  customModloader,
  setCustomModloader,
  modloaderOptions,
  selectedLoaderVersion,
  setSelectedLoaderVersion,
  loaderVersionOptions,
  loadingLoaderVersions,
  isDragOverCustom,
  customLoaderJarName,
  handleSelectCustomLoaderJar,
}: CustomTabProps) {
  return (
    <>
      <div className={styles.formGroup}>
        <label>實例名稱</label>
        <input 
          type="text" 
          placeholder="例如：我的生存伺服器" 
          className={styles.input} 
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
        />
      </div>
      
      <div className={styles.formGroup}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label>Minecraft 版本 (大版本 / {minorFilter === 'snapshot' ? '快照版本' : '小版本'})</label>
          {errorLoadingVersions && (
            <button 
              onClick={loadVersions} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#ff5252', 
                cursor: 'pointer', 
                fontSize: '12px',
                textDecoration: 'underline',
                padding: 0
              }}
            >
              載入失敗，點擊重試
            </button>
          )}
        </div>
        
        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>大版本篩選</span>
            <div className={styles.filterSegmentedControl}>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${majorFilter === 'release' ? styles.active : ''}`}
                onClick={() => setMajorFilter('release')}
              >
                只顯示正式版
              </button>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${majorFilter === 'history' ? styles.active : ''}`}
                onClick={() => setMajorFilter('history')}
              >
                只顯示歷史版
              </button>
            </div>
          </div>
          
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{minorFilter === 'snapshot' ? '快照篩選' : '小版本篩選'}</span>
            <div className={styles.filterSegmentedControl}>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${minorFilter === 'release' ? styles.active : ''}`}
                onClick={() => setMinorFilter('release')}
                disabled={majorFilter !== 'release'}
              >
                只顯示正式版
              </button>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${minorFilter === 'snapshot' ? styles.active : ''}`}
                onClick={() => setMinorFilter('snapshot')}
                disabled={majorFilter !== 'release'}
              >
                只顯示快照版
              </button>
            </div>
          </div>
        </div>

        <div className={styles.versionSelectRow}>
          <div className={styles.majorVersionCol}>
            <CustomSelect
              value={selectedMajorVersion}
              onChange={handleMajorVersionChange}
              options={majorVersionOptions}
              disabled={loadingVersions}
              placeholder={loadingVersions ? '載入中...' : '大版本'}
              direction="up"
            />
          </div>
          <div className={styles.minorVersionCol}>
            <CustomSelect
              value={customVersion}
              onChange={setCustomVersion}
              options={minorVersionOptions}
              disabled={loadingVersions || !selectedMajorVersion}
              placeholder={minorFilter === 'snapshot' ? '快照版本' : '小版本'}
              direction="up"
            />
          </div>
        </div>
      </div>
      
      <div className={styles.formGroup}>
        <label>Modloader</label>
        <CustomSelect
          value={customModloader}
          onChange={(val) => setCustomModloader(val)}
          options={modloaderOptions}
          direction="up"
        />
      </div>
      
      {customModloader !== 'Vanilla' && customModloader !== 'Custom' && (
        <div className={styles.formGroup}>
          <label>{customModloader} Loader 版本</label>
          <CustomSelect
            value={selectedLoaderVersion}
            onChange={setSelectedLoaderVersion}
            options={loaderVersionOptions}
            disabled={loadingLoaderVersions}
            placeholder={loadingLoaderVersions ? '正在載入版本清單...' : '無可用版本'}
            direction="up"
          />
        </div>
      )}

      {customModloader === 'Custom' && (
        <div className={styles.formGroup}>
          <label>自訂 Loader JAR 檔案</label>
          <div 
            className={`${styles.dropzone} ${isDragOverCustom ? styles.dropzoneActive : ''}`}
            onClick={handleSelectCustomLoaderJar}
          >
            <Upload size={24} className={styles.dropzoneIcon} />
            <div className={styles.dropzoneText}>
              {customLoaderJarName ? `已選取：${customLoaderJarName}` : '拖放自訂 Loader JAR 檔案至此，或點擊選擇檔案'}
            </div>
            <div className={styles.dropzoneSub}>
              僅支援 .jar 格式檔案
            </div>
          </div>
        </div>
      )}
    </>
  );
}
