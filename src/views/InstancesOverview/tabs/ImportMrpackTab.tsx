import { Upload, Loader } from 'lucide-react';
import { useI18n } from '../../../utils/i18n';
import styles from '../CreateInstanceModal.module.css';

interface ImportMrpackTabProps {
  mrpackPath: string;
  handleSelectLocalMrpack: () => void;
  loadingDetails: boolean;
  mrpackDetails: any;
  isSelectingMods: boolean;
  setIsSelectingMods: (val: boolean) => void;
  selectedMods: Set<string>;
  toggleAllMods: (checked: boolean, mods: any[]) => void;
  toggleModSelection: (name: string) => void;
  isDragOver: boolean;
}

export function ImportMrpackTab({
  mrpackPath,
  handleSelectLocalMrpack,
  loadingDetails,
  mrpackDetails,
  isSelectingMods,
  setIsSelectingMods,
  selectedMods,
  toggleAllMods,
  toggleModSelection,
  isDragOver,
}: ImportMrpackTabProps) {
  const { t } = useI18n();

  return (
    <div className={styles.twoColumnLayout}>
      {!mrpackPath ? (
        <div className={styles.leftColumn} style={{ flex: '1 1 100%', width: '100%', maxWidth: '100%' }}>
          <div 
            className={`${styles.filePickerArea} ${isDragOver ? styles.dragOver : ''}`} 
            onClick={handleSelectLocalMrpack}
          >
            <Upload className={styles.filePickerIcon} size={40} />
            <div className={styles.filePickerText}>
              {isDragOver ? t('create.mrpack.drop_release') : t('create.mrpack.dropzone_text')}
            </div>
            <div className={styles.filePickerSub}>
              {t('create.mrpack.dropzone_sub')}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.rightColumn}>
          {loadingDetails ? (
            <div className={styles.loadingSpinner}>
              <Loader className="animate-spin" size={32} />
              <span>{t('create.mrpack.parsing')}</span>
            </div>
          ) : mrpackDetails ? (
            <div className={styles.modpackDetailLayout}>
              <div className={styles.detailTopSection}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailIconPlaceholder}>📦</div>
                  <div className={styles.detailHeaderInfo}>
                    <h3 className={styles.detailTitle}>{mrpackDetails.name}</h3>
                    <p className={styles.detailDesc}>{t('create.mrpack.local_pack')}</p>
                  </div>
                </div>
              </div>

              <div className={styles.detailBottomSection}>
                {!isSelectingMods ? (
                  <div className={styles.versionSummaryCard}>
                    <div className={styles.licenseHeader}>
                      <span className={styles.modsCountTitle}>{t('create.mrpack.info_title')}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>{t('create.label.version')}</span>
                      <span className={styles.value}>{mrpackDetails.gameVersion}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>{t('create.mrpack.loader_type')}</span>
                      <span className={styles.value}>{mrpackDetails.modloader}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>{t('create.label.loader_version')}</span>
                      <span className={styles.value}>{mrpackDetails.modloaderVersion || t('overview.unknown_version')}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>{t('create.mrpack.mods_count')}</span>
                      <span className={styles.value}>{t('create.mrpack.mods_count_val', { count: mrpackDetails.mods.length })}</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.licenseConfirmContainer}>
                    <div className={styles.backToDescRow}>
                      <button 
                        type="button"
                        className={styles.backToDescButton}
                        onClick={() => setIsSelectingMods(false)}
                      >
                        {t('create.mrpack.back_to_info')}
                      </button>
                    </div>
                    <div className={styles.licenseHeader}>
                      <span className={styles.modsCountTitle}>
                        {t('create.mrpack.select_mods_title', { selected: selectedMods.size, total: mrpackDetails.mods.length })}
                      </span>
                      <div className={styles.toggleAllContainer}>
                        <label className={styles.checkboxLabel}>
                          <input 
                            type="checkbox"
                            checked={selectedMods.size === mrpackDetails.mods.length}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedMods.size > 0 && selectedMods.size < mrpackDetails.mods.length;
                            }}
                            onChange={(e) => toggleAllMods(e.target.checked, mrpackDetails.mods)}
                          />
                          <span>{t('create.mrpack.select_all')}</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className={styles.modList}>
                      {mrpackDetails.mods.map((mod: any, i: number) => {
                        const isChecked = selectedMods.has(mod.name);
                        return (
                          <div 
                            key={i} 
                            className={`${styles.modItemSelectable} ${isChecked ? styles.checked : ''}`}
                            onClick={() => toggleModSelection(mod.name)}
                          >
                            <label className={styles.checkboxLabel} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => toggleModSelection(mod.name)}
                              />
                            </label>
                            <div className={styles.modMain}>
                              <span className={styles.modName}>{mod.name}</span>
                              <span className={styles.modAuthor}>{t('create.mrpack.author', { author: mod.author })}</span>
                            </div>
                            <span className={styles.modLicense}>{mod.license}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.disclaimerText}>
                      {t('create.mrpack.disclaimer', { count: selectedMods.size })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.placeholderText}>
              <span>{t('create.mrpack.placeholder')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
