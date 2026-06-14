import { Loader } from 'lucide-react';
import { marked } from 'marked';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SafeImage } from '../../../components/common/SafeImage';
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
            placeholder={platform === 'modrinth' ? "搜尋 Modrinth 整合包..." : "搜尋 CurseForge 整合包..."}
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
                <span>正在載入更多整合包...</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.rightColumn}>
        {loadingDetails && !isModpackConfirmed ? (
          <div className={styles.loadingSpinner}>
            <Loader className="animate-spin" size={32} />
            <span>正在讀取 Modpack 詳細說明...</span>
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
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>專案 ID: {selectedModpack.project_id}</span>
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
                        ← 返回詳細敘述
                      </button>
                      
                      <div className={styles.versionSelectorContainer}>
                        <label className={styles.fieldLabel}>選擇整合包版本</label>
                        <CustomSelect
                          value={selectedModpackVersionId}
                          onChange={handleVersionSelect}
                          options={modpackVersionOptions}
                          disabled={loadingDetails}
                          placeholder="選擇整合包版本"
                          direction="down"
                        />
                      </div>
                    </div>

                    <div className={styles.detailBottomSection}>
                      {loadingDetails ? (
                        <div className={styles.loadingSpinnerSmall}>
                          <Loader className="animate-spin" size={24} />
                          <span>正在讀取版本內容...</span>
                        </div>
                      ) : modpackDetails ? (
                        <div className={styles.versionSummaryCard}>
                          <div className={styles.licenseHeader}>
                            <span className={styles.modsCountTitle}>📦 整合包版本資訊</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>遊戲版本</span>
                            <span className={styles.value}>{modpackDetails.gameVersion}</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>載入器類型</span>
                            <span className={styles.value}>{modpackDetails.modloader}</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>載入器版本</span>
                            <span className={styles.value}>{modpackDetails.modloaderVersion || '未知'}</span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.label}>包含的 Mod 總數</span>
                            <span className={styles.value}>{modpackDetails.mods.length} 個</span>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.placeholderTextSmall}>
                          <span>無法載入此版本的詳細資訊</span>
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
                          ← 返回版本選擇
                        </button>
                      </div>
                      <div className={styles.licenseHeader}>
                        <span className={styles.modsCountTitle}>
                          🛠️ 選擇要安裝的 Mod ({selectedMods.size} / {modpackDetails.mods.length} 個)
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
                            <span>全選</span>
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
                                <span className={styles.modAuthor}>作者: {mod.author}</span>
                              </div>
                              <span className={styles.modLicense}>{mod.license}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className={styles.disclaimerText}>
                        * 您已選取 {selectedMods.size} 個模組。未勾選的模組將不會被下載與安裝。
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        ) : (
          <div className={styles.placeholderText}>
            <span>請選擇一個整合包以查看詳細資訊</span>
          </div>
        )}
      </div>
    </div>
  );
}
