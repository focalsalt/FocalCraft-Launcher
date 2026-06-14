import { useState, useEffect } from 'react';
import { X, Upload, Link, RotateCcw, Smile } from 'lucide-react';
import styles from './IconEditModal.module.css';

interface Props {
  isOpen: boolean;
  currentIcon: string | null;
  onSelectLocal: () => Promise<void>;
  onSelectUrl: (url: string) => Promise<void>;
  onSelectEmoji: (emoji: string) => Promise<void>;
  onClear: () => Promise<void>;
  onCancel: () => void;
}

const PRESET_EMOJIS = [
  // Blocks & Items
  '📦', '🧱', '🌲', '💎', '🍎', '🍖', '🧪', '⚔️', '🛡️', '⛏️', '🧭', '🗺️',
  // Mobs & Animals
  '💀', '🧟', '🕷️', '🐷', '🐑', '🐔', '🐺', '🐱', '🐉', '👾',
  // Magic & Tech & Status
  '⭐', '🔥', '⚡', '🍀', '🔮', '⚙️', '🔑', '🔔', '🏆', '🚀', '❤️', '💥'
];

export function IconEditModal({
  isOpen,
  currentIcon,
  onSelectLocal,
  onSelectUrl,
  onSelectEmoji,
  onClear,
  onCancel
}: Props) {
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [activeTab, setActiveTab] = useState<'preset' | 'url' | 'local'>('preset');

  useEffect(() => {
    if (isOpen) {
      if (currentIcon && currentIcon.startsWith('https://')) {
        setUrlInput(currentIcon);
        setActiveTab('url');
      } else if (currentIcon && currentIcon.length <= 4 && !currentIcon.includes('.')) {
        setUrlInput('');
        setActiveTab('preset');
      } else {
        setUrlInput('');
        setActiveTab('preset');
      }
    }
  }, [isOpen, currentIcon]);

  if (!isOpen) return null;

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed || !trimmed.startsWith('https://')) {
      setUrlError('請輸入以 https:// 開頭的有效網址');
      return;
    }
    setUrlError('');
    onSelectUrl(trimmed);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>自訂實例圖示</h2>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className={styles.tabHeader}>
          <button 
            type="button" 
            className={`${styles.tabBtn} ${activeTab === 'preset' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('preset')}
          >
            <Smile size={16} />
            <span>內建圖示</span>
          </button>
          <button 
            type="button" 
            className={`${styles.tabBtn} ${activeTab === 'local' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('local')}
          >
            <Upload size={16} />
            <span>本機上傳</span>
          </button>
          <button 
            type="button" 
            className={`${styles.tabBtn} ${activeTab === 'url' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('url')}
          >
            <Link size={16} />
            <span>網路網址</span>
          </button>
        </div>

        <div className={styles.body}>
          {/* 1. PRESET EMOJI TAB */}
          {activeTab === 'preset' && (
            <div className={styles.presetSection}>
              <p className={styles.sectionTitle}>請選擇一個內建圖示：</p>
              <div className={styles.emojiGrid}>
                {PRESET_EMOJIS.map((emoji) => (
                  <button 
                    key={emoji}
                    type="button"
                    className={`${styles.emojiBtn} ${currentIcon === emoji ? styles.selectedEmoji : ''}`}
                    onClick={() => onSelectEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. LOCAL FILE UPLOAD TAB */}
          {activeTab === 'local' && (
            <div className={styles.localSection}>
              <div className={styles.uploadArea} onClick={onSelectLocal}>
                <Upload size={40} className={styles.uploadIcon} />
                <p className={styles.uploadTitle}>點擊選擇本機圖片檔案</p>
                <p className={styles.uploadSub}>支援 PNG, JPG, JPEG, WEBP 格式</p>
              </div>
            </div>
          )}

          {/* 3. URL IMPORT TAB */}
          {activeTab === 'url' && (
            <form className={styles.urlForm} onSubmit={handleUrlSubmit}>
              <div className={styles.formGroup}>
                <label>請輸入網路圖片網址</label>
                <div className={styles.inputRow}>
                  <input
                    type="text"
                    className={`${styles.input} ${urlError ? styles.inputError : ''}`}
                    placeholder="https://example.com/icon.png"
                    value={urlInput}
                    onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                    required
                  />
                  <button type="submit" className={styles.saveBtn}>
                    套用
                  </button>
                </div>
                {urlError && <span className={styles.fieldError}>{urlError}</span>}
              </div>
            </form>
          )}
        </div>

        <div className={styles.footer}>
          {currentIcon && (
            <button type="button" className={styles.clearBtn} onClick={onClear}>
              <RotateCcw size={14} />
              <span>重設為預設圖示</span>
            </button>
          )}
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
