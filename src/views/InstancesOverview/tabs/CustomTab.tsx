import { CustomSelect } from '../../../components/common/CustomSelect';
import { Upload } from 'lucide-react';
import { useI18n } from '../../../utils/i18n';
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
  const { t } = useI18n();

  return (
    <>
      <div className={styles.formGroup}>
        <label>{t('create.label.name')}</label>
        <input 
          type="text" 
          placeholder={t('create.custom.placeholder.name')} 
          className={styles.input} 
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
        />
      </div>
      
      <div className={styles.formGroup}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label>
            {t('create.custom.version_title', { 
              minor: minorFilter === 'snapshot' ? t('create.custom.snapshot') : t('create.custom.minor') 
            })}
          </label>
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
              {t('create.custom.load_failed_retry')}
            </button>
          )}
        </div>
        
        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t('create.custom.major_filter')}</span>
            <div className={styles.filterSegmentedControl}>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${majorFilter === 'release' ? styles.active : ''}`}
                onClick={() => setMajorFilter('release')}
              >
                {t('create.custom.show_releases')}
              </button>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${majorFilter === 'history' ? styles.active : ''}`}
                onClick={() => setMajorFilter('history')}
              >
                {t('create.custom.show_history')}
              </button>
            </div>
          </div>
          
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>
              {minorFilter === 'snapshot' ? t('create.custom.snapshot_filter') : t('create.custom.minor_filter')}
            </span>
            <div className={styles.filterSegmentedControl}>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${minorFilter === 'release' ? styles.active : ''}`}
                onClick={() => setMinorFilter('release')}
                disabled={majorFilter !== 'release'}
              >
                {t('create.custom.show_releases')}
              </button>
              <button
                type="button"
                className={`${styles.filterSegmentButton} ${minorFilter === 'snapshot' ? styles.active : ''}`}
                onClick={() => setMinorFilter('snapshot')}
                disabled={majorFilter !== 'release'}
              >
                {t('create.custom.show_snapshots')}
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
              placeholder={loadingVersions ? t('create.custom.loading') : t('create.custom.major')}
              direction="up"
            />
          </div>
          <div className={styles.minorVersionCol}>
            <CustomSelect
              value={customVersion}
              onChange={setCustomVersion}
              options={minorVersionOptions}
              disabled={loadingVersions || !selectedMajorVersion}
              placeholder={minorFilter === 'snapshot' ? t('create.custom.snapshot') : t('create.custom.minor')}
              direction="up"
            />
          </div>
        </div>
      </div>
      
      <div className={styles.formGroup}>
        <label>{t('create.label.modloader')}</label>
        <CustomSelect
          value={customModloader}
          onChange={(val) => setCustomModloader(val)}
          options={modloaderOptions}
          direction="up"
        />
      </div>
      
      {customModloader !== 'Vanilla' && customModloader !== 'Custom' && (
        <div className={styles.formGroup}>
          <label>{t('create.custom.loader_version_title', { loader: customModloader })}</label>
          <CustomSelect
            value={selectedLoaderVersion}
            onChange={setSelectedLoaderVersion}
            options={loaderVersionOptions}
            disabled={loadingLoaderVersions}
            placeholder={loadingLoaderVersions ? t('create.custom.loading_loader') : t('create.custom.no_loader_versions')}
            direction="up"
          />
        </div>
      )}

      {customModloader === 'Custom' && (
        <div className={styles.formGroup}>
          <label>{t('create.custom.custom_loader_title')}</label>
          <div 
            className={`${styles.dropzone} ${isDragOverCustom ? styles.dropzoneActive : ''}`}
            onClick={handleSelectCustomLoaderJar}
          >
            <Upload size={24} className={styles.dropzoneIcon} />
            <div className={styles.dropzoneText}>
              {customLoaderJarName ? t('create.custom.loader_selected', { name: customLoaderJarName }) : t('create.custom.dropzone_text')}
            </div>
            <div className={styles.dropzoneSub}>
              {t('create.custom.dropzone_sub')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
