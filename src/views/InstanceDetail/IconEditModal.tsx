import { useState, useEffect } from 'react';
import { X, Upload, Link, RotateCcw, Smile } from 'lucide-react';
import { useI18n } from '../../utils/i18n';
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
  '📦', '🧱', '🌲', '💎', '🍎', '🍖', '🧪', '⚔️', '🛡️', '⛏️', '🧭', '🗺️',
  '💀', '🧟', '🕷️', '🐷', '🐑', '🐔', '🐺', '🐱', '🐉', '👾',
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
  const { t } = useI18n();

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
      setUrlError(t('icon_edit.url_invalid'));
      return;
    }
    setUrlError('');
    onSelectUrl(trimmed);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{t('icon_edit.title')}</h2>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        {/* 分頁切換 */}
        <div className={styles.tabHeader}>
          <button 
            type="button" 
            className={`${styles.tabBtn} ${activeTab === 'preset' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('preset')}
          >
            <Smile size={16} />
            <span>{t('icon_edit.tab.preset')}</span>
          </button>
          <button 
            type="button" 
            className={`${styles.tabBtn} ${activeTab === 'local' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('local')}
          >
            <Upload size={16} />
            <span>{t('icon_edit.tab.local')}</span>
          </button>
          <button 
            type="button" 
            className={`${styles.tabBtn} ${activeTab === 'url' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('url')}
          >
            <Link size={16} />
            <span>{t('icon_edit.tab.url')}</span>
          </button>
        </div>

        <div className={styles.body}>
          {/* 內建圖示分頁 */}
          {activeTab === 'preset' && (
            <div className={styles.presetSection}>
              <p className={styles.sectionTitle}>{t('icon_edit.preset.prompt')}</p>
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

          {/* 本機上傳分頁 */}
          {activeTab === 'local' && (
            <div className={styles.localSection}>
              <div className={styles.uploadArea} onClick={onSelectLocal}>
                <Upload size={40} className={styles.uploadIcon} />
                <p className={styles.uploadTitle}>{t('icon_edit.local.prompt')}</p>
                <p className={styles.uploadSub}>{t('icon_edit.local.supported')}</p>
              </div>
            </div>
          )}

          {/* 網路網址分頁 */}
          {activeTab === 'url' && (
            <form className={styles.urlForm} onSubmit={handleUrlSubmit}>
              <div className={styles.formGroup}>
                <label>{t('icon_edit.url.prompt')}</label>
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
                    {t('common.apply')}
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
              <span>{t('icon_edit.btn.reset')}</span>
            </button>
          )}
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
