import { useInstanceStore } from '../../store/instanceStore';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useI18n } from '../../utils/i18n';
import { getInstanceIconSrc } from '../../utils/versionUtils';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Package } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CreateInstanceModal } from './CreateInstanceModal';
import { CustomConfirmModal } from '../../components/common/CustomConfirmModal';
import { SafeImage } from '../../components/common/SafeImage';
import { InstanceCard } from './InstanceCard';
import styles from './InstancesOverview.module.css';

export function InstancesOverview() {
  const instances = useInstanceStore((state) => state.instances);
  const instanceStates = useInstanceStore((state) => state.instanceStates);
  const deleteInstance = useInstanceStore((state) => state.deleteInstance);
  const updateInstanceConfig = useInstanceStore((state) => state.updateInstanceConfig);
  const saveInstanceOrder = useInstanceStore((state) => state.saveInstanceOrder);
  const { setCurrentView, addNotification } = useAppStore();
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [baseDir, setBaseDir] = useState('');
  const settingsConfig = useSettingsStore((state) => state.config);

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<any | null>(null);

  // 拖放狀態
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragStartIndex, setDragStartIndex] = useState<number>(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [mouseStartPos, setMouseStartPos] = useState({ x: 0, y: 0 });
  const [mouseCurrentPos, setMouseCurrentPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    invoke<string>('init_app_dirs').then(setBaseDir).catch(console.error);
  }, []);

  const handleCreateNew = () => {
    setIsModalOpen(true);
  };

  // 拖曳游標處理
  useEffect(() => {
    if (isMouseDragging) {
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isMouseDragging]);

  // 拖放排序滑鼠事件
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!activeDragId) return;

      setMouseCurrentPos({ x: e.clientX, y: e.clientY });

      if (!isMouseDragging) {
        const dx = e.clientX - mouseStartPos.x;
        const dy = e.clientY - mouseStartPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 8) {
          setIsMouseDragging(true);
        }
      }
    };

    const handleGlobalMouseUp = async () => {
      if (!activeDragId) return;

      if (isMouseDragging) {
        // 放置排序
        if (hoveredIndex !== -1 && hoveredIndex !== dragStartIndex) {
          const order = instances.filter(i => i && i.id).map(i => i.id);
          const sourceId = activeDragId;
          const targetId = order[hoveredIndex];

          const fromIndex = order.indexOf(sourceId);
          const toIndex = order.indexOf(targetId);
          if (fromIndex !== -1 && toIndex !== -1) {
            order.splice(fromIndex, 1);
            order.splice(toIndex, 0, sourceId);
            await saveInstanceOrder(order);
          }
        }
      } else {
        // 切換頁面
        setCurrentView(activeDragId);
      }

      // 重設狀態
      setActiveDragId(null);
      setDragStartIndex(-1);
      setHoveredIndex(-1);
      setIsMouseDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [activeDragId, isMouseDragging, mouseStartPos, dragStartIndex, hoveredIndex, instances, saveInstanceOrder, setCurrentView]);

  const handleCardMouseDown = (e: React.MouseEvent, id: string, index: number) => {
    if (e.button !== 0) return; // 僅限左鍵
    const target = e.target as HTMLElement;
    // 過濾拖曳觸發
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('.' + styles.cardName)
    ) {
      return;
    }

    setActiveDragId(id);
    setDragStartIndex(index);
    setMouseStartPos({ x: e.clientX, y: e.clientY });
    setMouseCurrentPos({ x: e.clientX, y: e.clientY });
    setIsMouseDragging(false);
    setHoveredIndex(index);
  };

  const handleCardMouseEnter = (index: number) => {
    if (activeDragId) {
      setHoveredIndex(index);
    }
  };

  // 刪除處理
  const handleDeleteClick = (e: React.MouseEvent, instance: any) => {
    e.stopPropagation();
    const instState = instanceStates[instance.id];
    if (instState?.isRunning) {
      addNotification({
        type: 'warning',
        title: t('overview.notification.cannot_delete.title'),
        message: t('overview.notification.cannot_delete.msg')
      });
      return;
    }
    setDeleteConfirmTarget(instance);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    try {
      await deleteInstance(deleteConfirmTarget.id);
      addNotification({
        type: 'success',
        title: t('overview.notification.deleted.title'),
        message: t('overview.notification.deleted.msg', { name: deleteConfirmTarget.name })
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('overview.notification.delete_failed.title'),
        message: String(err)
      });
    } finally {
      setDeleteConfirmTarget(null);
    }
  };

  // 重新命名處理
  const handleRename = async (id: string, newName: string) => {
    const instance = instances.find(i => i.id === id);
    if (!instance) return;
    try {
      await updateInstanceConfig(
        id,
        newName,
        instance.version,
        instance.modloader,
        instance.loaderVersion || undefined,
        instance.modrinthProjectId || undefined,
        instance.modrinthVersionId || undefined
      );
      addNotification({
        type: 'success',
        title: t('overview.notification.rename.title'),
        message: t('overview.notification.rename.msg', { name: newName })
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('overview.notification.rename_failed.title'),
        message: String(err)
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{t('overview.title')}</h1>
        <button className={styles.addButton} onClick={handleCreateNew}>
          <Plus size={20} />
          <span>{t('overview.create')}</span>
        </button>
      </div>

      {instances.filter(i => i && i.id).length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Package size={56} strokeWidth={1.2} />
          </div>
          <h2 className={styles.emptyTitle}>{t('overview.empty.title')}</h2>
          <p className={styles.emptyDesc} style={{ whiteSpace: 'pre-wrap' }}>
            {t('overview.empty.desc')}
          </p>
          <button className={styles.addButton} onClick={handleCreateNew}>
            <Plus size={18} />
            <span>{t('overview.empty.create')}</span>
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {instances.filter(i => i && i.id).map((instance, index) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              index={index}
              baseDir={baseDir}
              instancesPath={settingsConfig.instancesPath || undefined}
              instState={instanceStates[instance.id]}
              activeDragId={activeDragId}
              isMouseDragging={isMouseDragging}
              hoveredIndex={hoveredIndex}
              dragStartIndex={dragStartIndex}
              onCardMouseDown={handleCardMouseDown}
              onCardMouseEnter={handleCardMouseEnter}
              onDeleteClick={handleDeleteClick}
              onRename={handleRename}
            />
          ))}
        </div>
      )}

      <CreateInstanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <CustomConfirmModal
        isOpen={!!deleteConfirmTarget}
        title={t('overview.delete.title')}
        message={t('overview.delete.confirm', { name: deleteConfirmTarget?.name || '' })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmTarget(null)}
      />

      {/* 拖曳浮動預覽 */}
      {isMouseDragging && activeDragId && (() => {
        const draggedInstance = instances.find(i => i.id === activeDragId);
        if (!draggedInstance) return null;
        const iconSrc = getInstanceIconSrc(draggedInstance, baseDir, settingsConfig.instancesPath);
        return (
          <div
            className={styles.dragPreview}
            style={{
              position: 'fixed',
              left: mouseCurrentPos.x - 100,
              top: mouseCurrentPos.y - 70,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div className={styles.iconPlaceholder}>
              {draggedInstance.icon && iconSrc ? (
                <SafeImage 
                  src={iconSrc} 
                  alt="Icon" 
                  className={styles.instanceIcon} 
                  fallbackEmoji="📦"
                />
              ) : (
                <div className={styles.emojiIcon}>
                  {draggedInstance.icon || '📦'}
                </div>
              )}
            </div>
            <div className={styles.cardInfo}>
              <div className={styles.cardName}>{draggedInstance.name}</div>
              <div className={styles.cardVersion}>
                {draggedInstance.version || t('overview.unknown_version')} • {draggedInstance.modloader === 'Custom' ? t('overview.custom') : (draggedInstance.modloader || 'Vanilla')}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
