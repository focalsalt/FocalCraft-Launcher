import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../../utils/i18n';
import { getInstanceIconSrc } from '../../utils/versionUtils';
import { SafeImage } from '../../components/common/SafeImage';
import styles from './InstancesOverview.module.css';

interface InstanceCardProps {
  instance: {
    id: string;
    name: string;
    icon?: string;
    version?: string;
    modloader?: string;
    loaderVersion?: string;
  };
  index: number;
  baseDir: string;
  instancesPath?: string;
  instState?: {
    isRunning?: boolean;
    isDownloading?: boolean;
    isLaunching?: boolean;
    isCrashed?: boolean;
  };
  activeDragId: string | null;
  isMouseDragging: boolean;
  hoveredIndex: number;
  dragStartIndex: number;
  onCardMouseDown: (e: React.MouseEvent, id: string, index: number) => void;
  onCardMouseEnter: (index: number) => void;
  onDeleteClick: (e: React.MouseEvent, instance: any) => void;
  onRename: (id: string, newName: string) => Promise<void>;
}

export function InstanceCard({
  instance,
  index,
  baseDir,
  instancesPath,
  instState,
  activeDragId,
  isMouseDragging,
  hoveredIndex,
  dragStartIndex,
  onCardMouseDown,
  onCardMouseEnter,
  onDeleteClick,
  onRename
}: InstanceCardProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [localEditName, setLocalEditName] = useState(instance.name || '');

  const iconSrc = getInstanceIconSrc(instance, baseDir, instancesPath);
  const isRunning = instState?.isRunning;
  const isDownloading = instState?.isDownloading || instState?.isLaunching;
  const isCrashed = instState?.isCrashed;
  const isDragging = instance.id === activeDragId && isMouseDragging;
  const isHoveredDrop = index === hoveredIndex && isMouseDragging && index !== dragStartIndex;

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setLocalEditName(instance.name || '');
  };

  const handleSaveRename = async () => {
    const trimmed = localEditName.trim();
    if (!trimmed || trimmed === instance.name) {
      setIsEditing(false);
      return;
    }
    await onRename(instance.id, trimmed);
    setIsEditing(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`${styles.card} ${isRunning ? styles.cardRunning : ''} ${isCrashed ? styles.cardCrashed : ''} ${isDragging ? styles.cardDragging : ''} ${isHoveredDrop ? styles.cardHoveredDrop : ''}`}
      onMouseDown={(e) => !isRunning && !isDownloading && onCardMouseDown(e, instance.id, index)}
      onMouseEnter={() => onCardMouseEnter(index)}
    >
      {/* 刪除按鈕 */}
      {!isRunning && !isDownloading && (
        <button
          className={styles.deleteBtn}
          onClick={(e) => onDeleteClick(e, instance)}
          title={t('overview.delete.tooltip')}
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* 狀態標籤 */}
      {isRunning && <span className={`${styles.statusBadge} ${styles.runningBadge}`} title={t('overview.status.running')}>●</span>}
      {isDownloading && !isRunning && (
        <span className={`${styles.statusBadge} ${styles.downloadingBadge}`} title={t('overview.status.loading')}>
          <span className={`${styles.spinnerDot} animate-spin`} />
        </span>
      )}
      {isCrashed && !isRunning && !isDownloading && (
        <span className={`${styles.statusBadge} ${styles.crashedBadge}`} title={t('overview.status.crashed')}>!</span>
      )}

      <div className={styles.iconPlaceholder}>
        {instance.icon && iconSrc ? (
          <SafeImage 
            src={iconSrc} 
            alt="Icon" 
            className={styles.instanceIcon} 
            fallbackEmoji="📦"
          />
        ) : (
          <div className={styles.emojiIcon}>
            {instance.icon || '📦'}
          </div>
        )}
      </div>
      <div className={styles.cardInfo}>
        {isEditing ? (
          <input
            type="text"
            className={styles.cardNameInput}
            value={localEditName}
            onChange={(e) => setLocalEditName(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <div 
            className={styles.cardName}
            onClick={handleStartRename}
            title={t('overview.rename.tooltip')}
          >
            {instance.name || t('overview.unnamed')}
          </div>
        )}
        <div className={styles.cardVersion}>
          {instance.version || t('overview.unknown_version')} • {instance.modloader === 'Custom' ? t('overview.custom') : (instance.modloader || 'Vanilla')} {instance.loaderVersion ? `(${instance.loaderVersion})` : ''}
        </div>
      </div>
    </div>
  );
}
