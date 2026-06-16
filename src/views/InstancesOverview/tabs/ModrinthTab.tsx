import { Loader } from 'lucide-react';
import { marked } from 'marked';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SafeImage } from '../../../components/common/SafeImage';
import { useI18n } from '../../../utils/i18n';
import styles from '../CreateInstanceModal.module.css';

interface ModrinthTabProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedModpack: any;
  setSelectedModpack: (val: any) => void;
  setModpackDetails: (val: any) => void;
  setModpackVersions: (val: any[]) => void;
  setSelectedModpackVersionId: (val: string) => void;
  setIsModpackConfirmed: (val: boolean) => void;
  setModpackBody: (val: string) => void;
  handleModrinthSearch: () => void;
  isSearching: boolean;
  searchResults: any[];
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleSelectModpack: (hit: any) => void;
  isLoadingMore: boolean;
  loadingDetails: boolean;
  isModpackConfirmed: boolean;
  modpackBody: string;
  isSelectingMods: boolean;
  setIsSelectingMods: (val: boolean) => void;
  selectedModpackVersionId: string;
  handleVersionSelect: (val: string) => void;
  modpackVersionOptions: { value: string; label: string }[];
  modpackDetails: any;
  selectedMods: Set<string>;
  toggleAllMods: (checked: boolean, mods: any[]) => void;
  toggleModSelection: (name: string) => void;
  platform: 'modrinth' | 'curseforge';
  setPlatform: (val: 'modrinth' | 'curseforge') => void;
}

export function ModrinthTab({
  searchQuery,
  setSearchQuery,
  selectedModpack,
  setSelectedModpack,
  setModpackDetails,
  setModpackVersions,
  setSelectedModpackVersionId,
  setIsModpackConfirmed,
  setModpackBody,
  handleModrinthSearch,
  isSearching,
  searchResults,
  handleScroll,
  handleSelectModpack,
  isLoadingMore,
  loadingDetails,
  isModpackConfirmed,
  modpackBody,
  isSelectingMods,
  setIsSelectingMods,
  selectedModpackVersionId,
  handleVersionSelect,
  modpackVersionOptions,
  modpackDetails,
  selectedMods,
  toggleAllMods,
  toggleModSelection,
  platform,
  setPlatform,
}: ModrinthTabProps) {
  const { t } = useI18n();
  return (
    <div className={styles.twoColumnLayout}>
      <div className={styles.leftColumn}>
        {!isModpackConfirmed && (
          <div className={styles.platformTabs}>
            <button 
              className={`${styles.platformTab} ${platform === 'modrinth' ? styles.active : ''}`}
              onClick={() => setPlatform('modrinth')}
              type="button"
            >
              Modrinth
            </button>
            <button 
              className={`${styles.platformTab} ${platform === 'curseforge' ? styles.active : ''}`}
              onClick={() => setPlatform('curseforge')}
              type="button"
            >
              CurseForge
            </button>
          </div>
        )}

        <div className={styles.searchArea}>
          <input 
            type="text" 
            placeholder={platform === 'modrinth' ? t('create.search.placeholder_mr') : t('create.search.placeholder_cf')}
            className={styles.input} 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (selectedModpack) {
                setSelectedModpack(null);
                setModpackDetails(null);
                setModpackVersions([]);
                setSelectedModpackVersionId('');
                setIsModpackConfirmed(false);
                setModpackBody('');
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleModrinthSearch()}
          />
          {isSearching && (
            <div className={styles.searchLoader}>
              <Loader className="animate-spin" size={18} />
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.modpackList} onScroll={handleScroll}>
            {searchResults.map((hit) => (
              <div 
                key={hit.project_id} 
                className={`${styles.modpackCard} ${selectedModpack?.project_id === hit.project_id ? styles.selected : ''}`}
                onClick={() => handleSelectModpack(hit)}
              >
                <SafeImage 
                  src={hit.icon_url} 
                  alt={hit.title} 
                  className={styles.modpackIcon} 
                  fallbackEmoji="📦"
                />
                <div className={styles.modpackInfo}>
                  <div className={styles.modpackTitle}>{hit.title}</div>
                  <div className={styles.modpackDesc}>{hit.description}</div>
                </div>
              </div>
            ))}
            {isLoadingMore && (
              <div className={styles.loadingMoreSpinner}>
                <Loader className="animate-spin" size={16} />
                <span>{t('create.status.loading_more')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.rightColumn}>
        {loadingDetails && !isModpackConfirmed ? (
          <div className={styles.loadingSpinner}>
            <Loader className="animate-spin" size={32} />
            <span>{t('create.status.loading_details')}</span>
          </div>
        ) : selectedModpack ? (
          <div className={styles.modpackDetailLayout}>
            {!isModpackConfirmed ? (
              <>
                <div className={styles.detailTopSection}>
                  <div className={styles.detailHeader}>
                    <SafeImage 
                      src={selectedModpack.icon_url} 
                      alt={selectedModpack.title} 
                      className={styles.detailIcon} 
                      fallbackEmoji="📦"
                    />
                    <div className={styles.detailHeaderInfo}>
                      <h3 className={styles.detailTitle}>{selectedModpack.title}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('create.label.project_id', { id: selectedModpack.project_id })}</span>
                    </div>
                  </div>
                </div>
                
                <div 
                  className={styles.detailBody}
                  dangerouslySetInnerHTML={{ __html: platform === 'modrinth' ? (marked.parse(modpackBody) as string) : modpackBody }}
                />
              </>
            ) : (
              <>
                {!isSelectingMods ? (
                  <>
                    <div className={styles.detailTopSection}>
                      <button 
                        className={styles.backToDescButton}
                        onClick={() => setIsModpackConfirmed(false)}
                        type="button"
                      >
                        {t('create.btn.back_to_desc')}
                      </button>
                      
                      <div className={styles.versionSelectorContainer}>
                        <label className={styles.fieldLabel}>{t('create.label.select_version')}</label>
                        <CustomSelect
                          value={selectedModpackVersionId}
                          onChange={handleVersionSelect}
                          options={modpackVersionOptions}
                          disabled={loadingDetails}
                          placeholder={t('create.label.select_version')}
                          direction="down"
                        />
                      </div>
                    </div>

                    <div className={styles.detailBottomSection}>
                      {loadingDetails ? (
                        <div className={styles.loadingSpinnerSmall}>
                          <Loader className="animate-spin" size={24} />
                          <span>{t('create.status.loading_version_details')}</span>
                        </div>
                      ) : modpackDetails ? (
                        <div className={styles.versionSummaryCard}>
                          <div className={styles.licenseHeader}>
                            <span className={styles.modsCountTitle}>📦 {t('create.mrpack.info_title')}</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>{t('create.label.version')}</span>
                            <span className={styles.value}>{modpackDetails.gameVersion}</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>{t('create.mrpack.loader_type')}</span>
                            <span className={styles.value}>{modpackDetails.modloader}</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>{t('create.label.loader_version')}</span>
                            <span className={styles.value}>{modpackDetails.modloaderVersion || t('overview.unknown_version')}</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>{t('create.mrpack.mods_count')}</span>
                            <span className={styles.value}>{t('create.mrpack.mods_count_val', { count: modpackDetails.mods.length })}</span>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.placeholderTextSmall}>
                          <span>{t('create.status.load_version_details_failed')}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  modpackDetails && (
                    <div className={styles.licenseConfirmContainer}>
                      <div className={styles.backToDescRow}>
                        <button 
                          type="button"
                          className={styles.backToDescButton}
                          onClick={() => setIsSelectingMods(false)}
                        >
                          {t('create.btn.back_to_versions')}
                        </button>
                      </div>
                      <div className={styles.licenseHeader}>
                        <span className={styles.modsCountTitle}>
                          🛠️ {t('create.mrpack.select_mods_title', { selected: selectedMods.size, total: modpackDetails.mods.length })}
                        </span>
                        <div className={styles.toggleAllContainer}>
                          <label className={styles.checkboxLabel}>
                            <input 
                              type="checkbox"
                              checked={selectedMods.size === modpackDetails.mods.length}
                              ref={(el) => {
                                if (el) el.indeterminate = selectedMods.size > 0 && selectedMods.size < modpackDetails.mods.length;
                              }}
                              onChange={(e) => toggleAllMods(e.target.checked, modpackDetails.mods)}
                            />
                            <span>{t('create.mrpack.select_all')}</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className={styles.modList}>
                        {modpackDetails.mods.map((mod: any, i: number) => {
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
                  )
                )}
              </>
            )}
          </div>
        ) : (
          <div className={styles.placeholderText}>
            <span>{t('create.status.select_modpack_placeholder')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
