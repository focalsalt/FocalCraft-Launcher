import { useInstanceStore } from '../../store/instanceStore';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getInstanceIconSrc } from '../../utils/versionUtils';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Package, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CreateInstanceModal } from './CreateInstanceModal';
import { CustomConfirmModal } from '../../components/common/CustomConfirmModal';
import { SafeImage } from '../../components/common/SafeImage';
import styles from './InstancesOverview.module.css';

export function InstancesOverview() {
  const instances = useInstanceStore((state) => state.instances);
  const instanceStates = useInstanceStore((state) => state.instanceStates);
  const deleteInstance = useInstanceStore((state) => state.deleteInstance);
  const updateInstanceConfig = useInstanceStore((state) => state.updateInstanceConfig);
  const saveInstanceOrder = useInstanceStore((state) => state.saveInstanceOrder);
  const { setCurrentView, addNotification } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [baseDir, setBaseDir] = useState('');
  const settingsConfig = useSettingsStore((state) => state.config);

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Mouse Drag and Drop states
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

  // Drag cursor & select handler
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

  // Global mouse handlers for card drag and drop reordering
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
        // Drop reorder
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
        // Navigate
        setCurrentView(activeDragId);
      }

      // Reset states
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
    if (e.button !== 0) return; // Left click only
    const target = e.target as HTMLElement;
    // Don't drag if clicking custom buttons, input controls or renaming text
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

  // Delete handlers
  const handleDeleteClick = (e: React.MouseEvent, instance: any) => {
    e.stopPropagation();
    const instState = instanceStates[instance.id];
    if (instState?.isRunning) {
      addNotification({
        type: 'warning',
        title: '無法刪除實例',
        message: '該實例目前正在運行中，請先關閉遊戲。'
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
        title: '實例已刪除',
        message: `已成功刪除實例: ${deleteConfirmTarget.name}`
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: '刪除實例失敗',
        message: String(err)
      });
    } finally {
      setDeleteConfirmTarget(null);
    }
  };

  // Inline rename handlers
  const handleStartRename = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveRename = async (id: string, instance: any) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    if (editName.trim() === instance.name) {
      setEditingId(null);
      return;
    }
    try {
      await updateInstanceConfig(
        id,
        editName.trim(),
        instance.version,
        instance.modloader,
        instance.loaderVersion || undefined,
        instance.modrinthProjectId || undefined,
        instance.modrinthVersionId || undefined
      );
      addNotification({
        type: 'success',
        title: '名稱已變更',
        message: `實例名稱已變更為: ${editName.trim()}`
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: '變更名稱失敗',
        message: String(err)
      });
    } finally {
      setEditingId(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string, instance: any) => {
    if (e.key === 'Enter') {
      handleSaveRename(id, instance);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>實例總覽</h1>
        <button className={styles.addButton} onClick={handleCreateNew}>
          <Plus size={20} />
          <span>建立新實例</span>
        </button>
      </div>

      {instances.filter(i => i && i.id).length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Package size={56} strokeWidth={1.2} />
          </div>
          <h2 className={styles.emptyTitle}>尚無任何實例</h2>
          <p className={styles.emptyDesc}>
            建立您的第一個 Minecraft 實例，開始遊戲旅程。<br />
            支援 Vanilla、Fabric 以及從 Modrinth / CurseForge 下載安裝或手動匯入整合包。
          </p>
          <button className={styles.addButton} onClick={handleCreateNew}>
            <Plus size={18} />
            <span>建立第一個實例</span>
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {instances.filter(i => i && i.id).map((instance, index) => {
            const iconSrc = getInstanceIconSrc(instance, baseDir, settingsConfig.instancesPath);
            const instState = instanceStates[instance.id];
            const isRunning = instState?.isRunning;
            const isDownloading = instState?.isDownloading || instState?.isLaunching;
            const isCrashed = instState?.isCrashed;
            const isDragging = instance.id === activeDragId && isMouseDragging;
            const isHoveredDrop = index === hoveredIndex && isMouseDragging && index !== dragStartIndex;

            return (
              <div
                key={instance.id}
                className={`${styles.card} ${isRunning ? styles.cardRunning : ''} ${isCrashed ? styles.cardCrashed : ''} ${isDragging ? styles.cardDragging : ''} ${isHoveredDrop ? styles.cardHoveredDrop : ''}`}
                onMouseDown={(e) => !isRunning && !isDownloading && handleCardMouseDown(e, instance.id, index)}
                onMouseEnter={() => handleCardMouseEnter(index)}
              >
                {/* Delete Button */}
                {!isRunning && !isDownloading && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteClick(e, instance)}
                    title="刪除實例"
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                {/* Status Badge */}
                {isRunning && <span className={`${styles.statusBadge} ${styles.runningBadge}`} title="遊戲執行中">●</span>}
                {isDownloading && !isRunning && (
                  <span className={`${styles.statusBadge} ${styles.downloadingBadge}`} title="下載/啟動中">
                    <span className={styles.spinnerDot} />
                  </span>
                )}
                {isCrashed && !isRunning && !isDownloading && (
                  <span className={`${styles.statusBadge} ${styles.crashedBadge}`} title="遊戲已崩潰">!</span>
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
                  {editingId === instance.id ? (
                    <input
                      type="text"
                      className={styles.cardNameInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveRename(instance.id, instance)}
                      onKeyDown={(e) => handleRenameKeyDown(e, instance.id, instance)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <div 
                      className={styles.cardName}
                      onClick={(e) => handleStartRename(e, instance.id, instance.name)}
                      title="點擊以重新命名"
                    >
                      {instance.name || '未命名實例'}
                    </div>
                  )}
                  <div className={styles.cardVersion}>
                    {instance.version || '未知版本'} • {instance.modloader === 'Custom' ? '自訂' : (instance.modloader || 'Vanilla')} {instance.loaderVersion ? `(${instance.loaderVersion})` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateInstanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <CustomConfirmModal
        isOpen={!!deleteConfirmTarget}
        title="刪除實例"
        message={`您確定要永久刪除實例 "${deleteConfirmTarget?.name}" 嗎？此操作將會刪除該實例的所有遊戲檔案且無法復原。`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmTarget(null)}
      />

      {/* Floating Drag Preview */}
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
                {draggedInstance.version || '未知版本'} • {draggedInstance.modloader === 'Custom' ? '自訂' : (draggedInstance.modloader || 'Vanilla')}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
