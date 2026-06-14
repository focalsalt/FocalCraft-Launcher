import { Upload, Loader } from 'lucide-react';
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
              {isDragOver ? '放開以匯入整合包...' : '點擊選擇或拖曳 .mrpack / .zip 檔案至此'}
            </div>
            <div className={styles.filePickerSub}>支援 Modrinth (.mrpack) 與 CurseForge (.zip) 格式的 Minecraft 整合包檔案</div>
          </div>
        </div>
      ) : (
        <div className={styles.rightColumn}>
          {loadingDetails ? (
            <div className={styles.loadingSpinner}>
              <Loader className="animate-spin" size={32} />
              <span>正在解析整合包內容...</span>
            </div>
          ) : mrpackDetails ? (
            <div className={styles.modpackDetailLayout}>
              <div className={styles.detailTopSection}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailIconPlaceholder}>📦</div>
                  <div className={styles.detailHeaderInfo}>
                    <h3 className={styles.detailTitle}>{mrpackDetails.name}</h3>
                    <p className={styles.detailDesc}>本機匯入的整合包檔案</p>
                  </div>
                </div>
              </div>

            <div className={styles.detailBottomSection}>
              {!isSelectingMods ? (
                <div className={styles.versionSummaryCard}>
                  <div className={styles.licenseHeader}>
                    <span className={styles.modsCountTitle}>📦 整合包資訊</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>遊戲版本</span>
                    <span className={styles.value}>{mrpackDetails.gameVersion}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>載入器類型</span>
                    <span className={styles.value}>{mrpackDetails.modloader}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>載入器版本</span>
                    <span className={styles.value}>{mrpackDetails.modloaderVersion || '未知'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>包含的 Mod 總數</span>
                    <span className={styles.value}>{mrpackDetails.mods.length} 個</span>
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
                      ← 返回整合包資訊
                    </button>
                  </div>
                  <div className={styles.licenseHeader}>
                    <span className={styles.modsCountTitle}>
                      🛠️ 選擇要安裝的 Mod ({selectedMods.size} / {mrpackDetails.mods.length} 個)
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
                        <span>全選</span>
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
              )}
            </div>
          </div>
        ) : (
          <div className={styles.placeholderText}>
            <span>請選擇本機的 .mrpack 或 .zip 檔案以查看詳細資訊</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
