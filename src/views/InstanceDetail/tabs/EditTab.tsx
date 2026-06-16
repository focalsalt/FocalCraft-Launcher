import React from 'react';
import { Edit2, ChevronLeft, ChevronRight, FolderOpen, Trash2, Copy, Loader } from 'lucide-react';
import { Instance } from '../../../types';
import { SafeImage } from '../../../components/common/SafeImage';
import { useI18n } from '../../../utils/i18n';
import styles from '../InstanceDetail.module.css';

interface EditTabProps {
  instance: Instance;
  getIconSrc: () => string | null;
  handleIconClick: () => void;
  isEditingName: boolean;
  setIsEditingName: (val: boolean) => void;
  editedName: string;
  setEditedName: (val: string) => void;
  handleSaveName: () => void;
  handleOpenEditVersion: () => void;
  loadingScreenshots: boolean;
  screenshots: string[];
  isScreenshotZoomed: boolean;
  setIsScreenshotZoomed: React.Dispatch<React.SetStateAction<boolean>>;
  activeScreenshotIndex: number;
  setActiveScreenshotIndex: React.Dispatch<React.SetStateAction<number>>;
  handleOpenActiveScreenshot: () => void;
  handleCopyActiveScreenshot: () => void;
  handleDeleteActiveScreenshotClick: () => void;
  prevActiveRef: React.RefObject<number>;
  convertFileSrc: (path: string) => string;
}

export function EditTab({
  instance,
  getIconSrc,
  handleIconClick,
  isEditingName,
  setIsEditingName,
  editedName,
  setEditedName,
  handleSaveName,
  handleOpenEditVersion,
  loadingScreenshots,
  screenshots,
  isScreenshotZoomed,
  setIsScreenshotZoomed,
  activeScreenshotIndex,
  setActiveScreenshotIndex,
  handleOpenActiveScreenshot,
  handleCopyActiveScreenshot,
  handleDeleteActiveScreenshotClick,
  prevActiveRef,
  convertFileSrc,
}: EditTabProps) {
  const { t } = useI18n();
  const iconSrc = getIconSrc();

  return (
    <div className={styles.editTabContainer}>
      <div className={styles.editHeader}>
        <div className={styles.editTitleArea}>
          <div className={styles.iconManagerSmall} onClick={handleIconClick} title={t('tabs.edit.change_icon')}>
            {instance.icon && iconSrc ? (
              <SafeImage 
                src={iconSrc} 
                alt="Icon" 
                className={styles.smallIcon} 
                fallbackEmoji="📦"
              />
            ) : (
              <div className={styles.smallIconPlaceholder}>
                {instance.icon || '📦'}
              </div>
            )}
            <div className={styles.iconOverlaySmall}>{t('tabs.edit.change')}</div>
          </div>

          <div className={styles.nameArea}>
            {isEditingName ? (
              <input
                type="text"
                className={styles.nameInput}
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
              />
            ) : (
              <h1 onClick={() => setIsEditingName(true)} title={t('tabs.edit.rename_tooltip')}>
                {instance.name}
                <Edit2 size={18} className={styles.editIcon} />
              </h1>
            )}
          </div>
        </div>

        <div className={styles.editVersionArea} onClick={handleOpenEditVersion} title={t('tabs.edit.edit_version_tooltip')}>
          <span>Minecraft {instance.version} • {instance.modloader} {instance.loaderVersion ? `(${instance.loaderVersion})` : ''}</span>
          <Edit2 size={12} style={{ marginLeft: 6, opacity: 0.8 }} />
        </div>
      </div>

      <div className={styles.screenshotsSection}>
        {loadingScreenshots ? (
          <div className={styles.screenshotsSpinner}>
            <Loader className="animate-spin" size={24} />
            <span>{t('tabs.edit.loading_screenshots')}</span>
          </div>
        ) : screenshots.length > 0 ? (
          <>
            <div className={styles.screenshotCarouselContainer}>
              {screenshots.length === 1 ? (
                <div className={styles.carouselStageSingle}>
                  <div
                    className={`${styles.carouselItem} ${styles.active} ${isScreenshotZoomed ? styles.zoomed : ''}`}
                    onClick={() => setIsScreenshotZoomed(prev => !prev)}
                    title={t('tabs.edit.screenshot_action_tooltip')}
                  >
                    <img src={convertFileSrc(screenshots[0])} alt="Screenshot" className={styles.screenshotImage} />
                  </div>
                </div>
              ) : (
                (() => {
                  const N = screenshots.length;
                  const prevActive = prevActiveRef.current ?? 0;
                  const getDiff = (idx: number, activeIdx: number, total: number) => {
                    let d = idx - activeIdx;
                    if (d < -total / 2) d += total;
                    if (d > total / 2) d -= total;
                    return d;
                  };

                  const itemsToRender = screenshots
                    .map((path, i) => {
                      const newDiff = getDiff(i, activeScreenshotIndex, N);
                      const oldDiff = getDiff(i, prevActive, N);

                      if (Math.abs(newDiff) > 2) return null;

                      const isWrapping = Math.abs(newDiff - oldDiff) > 1;

                      let transform = '';
                      let opacity = 0;
                      let zIndex = 1;
                      let filter = 'blur(0.09375rem)';
                      let pointerEvents: 'auto' | 'none' = 'none';
                      let className = styles.carouselItem;

                      if (newDiff === 0) {
                        transform = isScreenshotZoomed ? 'translate(-50%, -50%) scale(1.08)' : 'translate(-50%, -50%) scale(1)';
                        opacity = 1;
                        zIndex = 10;
                        filter = 'none';
                        pointerEvents = 'auto';
                        className = `${styles.carouselItem} ${styles.active} ${isScreenshotZoomed ? styles.zoomed : ''}`;
                      } else if (newDiff === -1) {
                        transform = 'translate(-170%, -50%) scale(0.85)';
                        opacity = 0.4;
                        zIndex = 5;
                        filter = 'blur(0.03125rem)';
                        pointerEvents = 'auto';
                        className = `${styles.carouselItem} ${styles.prev}`;
                      } else if (newDiff === 1) {
                        transform = 'translate(70%, -50%) scale(0.85)';
                        opacity = 0.4;
                        zIndex = 5;
                        filter = 'blur(0.03125rem)';
                        pointerEvents = 'auto';
                        className = `${styles.carouselItem} ${styles.next}`;
                      } else if (newDiff === -2) {
                        transform = 'translate(-290%, -50%) scale(0.7)';
                        opacity = 0;
                        zIndex = 1;
                        filter = 'blur(0.09375rem)';
                        pointerEvents = 'none';
                      } else if (newDiff === 2) {
                        transform = 'translate(190%, -50%) scale(0.7)';
                        opacity = 0;
                        zIndex = 1;
                        filter = 'blur(0.09375rem)';
                        pointerEvents = 'none';
                      }

                      const itemStyle: React.CSSProperties = {
                        transform,
                        opacity,
                        zIndex,
                        filter,
                        pointerEvents,
                      };

                      if (isWrapping) {
                        itemStyle.transition = 'none';
                      }

                      return {
                        path,
                        index: i,
                        className,
                        style: itemStyle,
                        onClick: () => {
                          if (newDiff === 0) {
                            setIsScreenshotZoomed((prev) => !prev);
                          } else if (newDiff === -1) {
                            setActiveScreenshotIndex((prev) => (prev - 1 + N) % N);
                          } else if (newDiff === 1) {
                            setActiveScreenshotIndex((prev) => (prev + 1) % N);
                          }
                        }
                      };
                    })
                    .filter((item): item is NonNullable<typeof item> => item !== null);

                  return (
                    <div className={styles.carouselWrapper}>
                      <button
                        className={`${styles.carouselArrow} ${styles.left}`}
                        onClick={() => setActiveScreenshotIndex((prev) => (prev - 1 + N) % N)}
                        title={t('tabs.edit.prev_image')}
                      >
                        <ChevronLeft size={20} />
                      </button>

                      <div className={styles.carouselStage}>
                        {itemsToRender.map((item) => (
                          <div
                            key={item.path}
                            className={item.className}
                            style={item.style}
                            onClick={item.onClick}
                            title={item.style.zIndex === 10 ? t('tabs.edit.screenshot_action_tooltip') : ''}
                          >
                            <img
                              src={convertFileSrc(item.path)}
                              alt={`Screenshot ${item.index}`}
                              className={styles.screenshotImage}
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        className={`${styles.carouselArrow} ${styles.right}`}
                        onClick={() => setActiveScreenshotIndex((prev) => (prev + 1) % N)}
                        title={t('tabs.edit.next_image')}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  );
                })()
              )}
            </div>
            <div className={`${styles.screenshotActions} ${isScreenshotZoomed ? styles.active : ''}`}>
              <button onClick={handleOpenActiveScreenshot} title={t('tabs.edit.open_file')}>
                <FolderOpen size={16} />
                <span>{t('tabs.edit.open_file')}</span>
              </button>
              <button onClick={handleCopyActiveScreenshot} title={t('tabs.edit.copy_file')}>
                <Copy size={16} />
                <span>{t('tabs.edit.copy_file')}</span>
              </button>
              <button onClick={handleDeleteActiveScreenshotClick} className={styles.deleteBtn} title={t('tabs.edit.delete_file')}>
                <Trash2 size={16} />
                <span>{t('tabs.edit.delete_file')}</span>
              </button>
            </div>
          </>
        ) : (
          <div className={styles.screenshotPlaceholder}>
            <span>{t('tabs.edit.no_screenshots')}</span>
            <span className={styles.placeholderTip}>{t('tabs.edit.screenshots_tip')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
