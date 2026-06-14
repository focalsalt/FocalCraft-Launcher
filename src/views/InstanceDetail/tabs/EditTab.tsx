import React from 'react';
import { Edit2, ChevronLeft, ChevronRight, FolderOpen, Trash2, Copy, Loader } from 'lucide-react';
import { Instance } from '../../../types';
import { SafeImage } from '../../../components/common/SafeImage';
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
  const iconSrc = getIconSrc();

  return (
    <div className={styles.editTabContainer}>
      <div className={styles.editHeader}>
        <div className={styles.editTitleArea}>
          <div className={styles.iconManagerSmall} onClick={handleIconClick} title="點擊更換圖示">
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
            <div className={styles.iconOverlaySmall}>更換</div>
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
              <h1 onClick={() => setIsEditingName(true)} title="點擊更名">
                {instance.name}
                <Edit2 size={18} className={styles.editIcon} />
              </h1>
            )}
          </div>
        </div>

        <div className={styles.editVersionArea} onClick={handleOpenEditVersion} title="點擊編輯版本">
          <span>Minecraft {instance.version} • {instance.modloader} {instance.loaderVersion ? `(${instance.loaderVersion})` : ''}</span>
          <Edit2 size={12} style={{ marginLeft: 6, opacity: 0.8 }} />
        </div>
      </div>

      <div className={styles.screenshotsSection}>
        {loadingScreenshots ? (
          <div className={styles.screenshotsSpinner}>
            <Loader className="animate-spin" size={24} />
            <span>讀取螢幕截圖中...</span>
          </div>
        ) : screenshots.length > 0 ? (
          <>
            <div className={styles.screenshotCarouselContainer}>
              {screenshots.length === 1 ? (
                <div className={styles.carouselStageSingle}>
                  <div
                    className={`${styles.carouselItem} ${styles.active} ${isScreenshotZoomed ? styles.zoomed : ''}`}
                    onClick={() => setIsScreenshotZoomed(prev => !prev)}
                    title="點擊切換動作選單"
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
                        title="上一張"
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
                            title={item.style.zIndex === 10 ? "點擊切換動作選單" : "點擊切換圖片"}
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
                        title="下一張"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  );
                })()
              )}
            </div>
            <div className={`${styles.screenshotActions} ${isScreenshotZoomed ? styles.active : ''}`}>
              <button onClick={handleOpenActiveScreenshot} title="開啟檔案">
                <FolderOpen size={16} />
                <span>開啟</span>
              </button>
              <button onClick={handleCopyActiveScreenshot} title="複製到剪貼簿">
                <Copy size={16} />
                <span>複製</span>
              </button>
              <button onClick={handleDeleteActiveScreenshotClick} className={styles.deleteBtn} title="刪除截圖">
                <Trash2 size={16} />
                <span>刪除</span>
              </button>
            </div>
          </>
        ) : (
          <div className={styles.screenshotPlaceholder}>
            <span>目前尚無螢幕截圖</span>
            <span className={styles.placeholderTip}>（可在遊戲中按下 F2 進行截圖）</span>
          </div>
        )}
      </div>
    </div>
  );
}
