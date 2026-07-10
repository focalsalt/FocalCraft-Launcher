import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useInstanceStore, getInitialInstanceState } from '../../store/instanceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useI18n } from '../../utils/i18n';
import { getInstanceIconSrc } from '../../utils/versionUtils';
import { invoke } from '@tauri-apps/api/core';
import { LayoutGrid, Settings, User, Loader, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { AccountDropdown } from './AccountDropdown';
import { useAccountStore } from '../../store/accountStore';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { marked } from 'marked';
import { CustomConfirmModal } from '../common/CustomConfirmModal';
import styles from './Sidebar.module.css';

function isVersionGreater(v1: string, v2: string): boolean {
  const clean1 = v1.replace(/^v/, '');
  const clean2 = v2.replace(/^v/, '');

  const parts1 = clean1.split('.').map(Number);
  const parts2 = clean2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  return false;
}

function filterChangelog(body: string, currentVersion: string): string {
  if (!body) return '';
  const headerRegex = /^(#{1,6})\s+v?(\d+\.\d+\.\d+)/gm;
  const sections: { version: string; content: string }[] = [];
  let lastIndex = 0;
  let match;
  let currentVer = '';

  while ((match = headerRegex.exec(body)) !== null) {
    const matchIndex = match.index;
    if (currentVer) {
      sections.push({
        version: currentVer,
        content: body.slice(lastIndex, matchIndex)
      });
    }
    currentVer = match[2];
    lastIndex = matchIndex;
  }

  if (currentVer) {
    sections.push({
      version: currentVer,
      content: body.slice(lastIndex)
    });
  }

  if (sections.length === 0) return body;

  const filteredSections = sections.filter(sec => isVersionGreater(sec.version, currentVersion));
  if (filteredSections.length === 0) return body;

  return filteredSections.map(sec => sec.content).join('\n\n').trim();
}

export function Sidebar() {
  const { currentView, setCurrentView, addNotification, setActiveDetailTab } = useAppStore();
  const { t } = useI18n();

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    instanceId: string;
  } | null>(null);
  const [instanceToDelete, setInstanceToDelete] = useState<any>(null);

  const deleteInstance = useInstanceStore((state) => state.deleteInstance);
  const launchInstance = useInstanceStore((state) => state.launchInstance);
  const instanceStates = useInstanceStore((state) => state.instanceStates);
  const clearLogs = useInstanceStore((state) => state.clearLogs);
  const selectedAccountId = useAccountStore((state) => state.selectedAccountId);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      instanceId
    });
  };

  const handleContextMenuLaunch = async (instanceId: string) => {
    setContextMenu(null);
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return;

    if (!selectedAccountId) {
      addNotification({
        type: 'warning',
        title: t('detail.notification.cannot_launch.title'),
        message: t('detail.notification.cannot_launch.login_first')
      });
      return;
    }

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    if (!selectedAccount) {
      addNotification({
        type: 'error',
        title: t('detail.notification.cannot_launch.title'),
        message: t('detail.notification.cannot_launch.account_missing')
      });
      return;
    }

    addNotification({
      type: 'info',
      title: t('detail.btn.launching'),
      message: t('detail.notification.preparing_launch', { name: instance.name })
    });

    const accountJson = JSON.stringify({
      id: selectedAccount.id,
      mcId: selectedAccount.mcId,
      mcAccessToken: selectedAccount.mcAccessToken
    });

    setCurrentView(instanceId);
    setActiveDetailTab('log');
    clearLogs(instanceId);

    try {
      await launchInstance(instanceId, accountJson);
    } catch (error: any) {
      // handled in store
    }
  };

  const handleContextMenuOpenFolder = async (instanceId: string) => {
    setContextMenu(null);
    try {
      const instsDir = settingsConfig.instancesPath || `${baseDir}/instances`;
      const targetPath = `${instsDir}/${instanceId}`;
      await invoke('open_in_browser', { url: targetPath });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('detail.notification.cannot_open_folder'),
        message: String(error)
      });
    }
  };

  const handleContextMenuDelete = (instanceId: string) => {
    setContextMenu(null);
    const instance = instances.find(i => i.id === instanceId);
    if (instance) {
      const instState = instanceStates[instanceId] || getInitialInstanceState();
      if (instState.isRunning || instState.isLaunching || instState.isDownloading) {
        addNotification({
          type: 'warning',
          title: t('overview.notification.cannot_delete.title'),
          message: t('overview.notification.cannot_delete.msg')
        });
        return;
      }
      setInstanceToDelete(instance);
    }
  };

  const handleConfirmDelete = async () => {
    if (!instanceToDelete) return;
    const id = instanceToDelete.id;
    const name = instanceToDelete.name;
    setInstanceToDelete(null);
    try {
      await deleteInstance(id);
      addNotification({
        type: 'success',
        title: t('detail.notification.instance_delete.success'),
        message: t('detail.notification.instance_delete.success_msg', { name })
      });
      if (currentView === id) {
        setCurrentView('instances_overview');
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('detail.notification.instance_delete.failed'),
        message: String(error)
      });
    }
  };

  // 檢查更新
  const handleCheckUpdate = async (silent: boolean = false) => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      const update = await check();
      if (update && update.available) {
        setUpdateInfo(update);
        setIsUpdateModalOpen(true);
      } else {
        if (!silent) {
          addNotification({
            type: 'info',
            title: t('sidebar.check_updates'),
            message: t('sidebar.latest_version')
          });
        }
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      if (!silent) {
        addNotification({
          type: 'error',
          title: t('sidebar.check_failed'),
          message: String(err)
        });
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // 套用更新
  const handleApplyUpdate = async () => {
    if (!updateInfo || isUpdating) return;
    setIsUpdating(true);
    setUpdateError('');
    try {
      addNotification({
        type: 'info',
        title: t('sidebar.downloading_update'),
        message: t('sidebar.downloading_update_msg')
      });
      await updateInfo.downloadAndInstall();
      addNotification({
        type: 'success',
        title: t('sidebar.download_complete'),
        message: t('sidebar.download_complete_msg')
      });
      setTimeout(async () => {
        try {
          await relaunch();
        } catch (err) {
          console.error('Relaunch failed:', err);
          setIsUpdating(false);
          setUpdateError('Relaunch failed, please restart the app manually.');
        }
      }, 1500);
    } catch (err) {
      console.error('Failed to download and install update:', err);
      setIsUpdating(false);
      setUpdateError(String(err));
      addNotification({
        type: 'error',
        title: t('sidebar.update_failed'),
        message: String(err)
      });
    }
  };

  const instances = useInstanceStore((state) => state.instances);
  const accounts = useAccountStore((state) => state.accounts);
  const [baseDir, setBaseDir] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const settingsConfig = useSettingsStore((state) => state.config);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });

  // 初始化路徑與版本
  useEffect(() => {
    invoke<string>('init_app_dirs').then(setBaseDir).catch(console.error);
    getVersion().then(v => setAppVersion(v.replace(/^(\d+)\.(\d+)\./, '$1$2.'))).catch(console.error);
  }, []);

  const checkUpdateRef = useRef(handleCheckUpdate);
  useEffect(() => {
    checkUpdateRef.current = handleCheckUpdate;
  });

  // 排程檢查更新
  useEffect(() => {
    checkUpdateRef.current(true);

    let timeoutId: ReturnType<typeof setTimeout>;

    const getMsUntilNextSchedule = (): number => {
      const now = new Date();

      const time0 = new Date(now);
      time0.setHours(0, 0, 0, 0);

      const time12 = new Date(now);
      time12.setHours(12, 0, 0, 0);

      const timeNextDay0 = new Date(now);
      timeNextDay0.setDate(now.getDate() + 1);
      timeNextDay0.setHours(0, 0, 0, 0);

      const candidates = [time0, time12, timeNextDay0];
      const futureCandidates = candidates.filter(t => t.getTime() > now.getTime());

      futureCandidates.sort((a, b) => a.getTime() - b.getTime());
      return futureCandidates[0].getTime() - now.getTime();
    };

    const scheduleNextCheck = () => {
      const ms = getMsUntilNextSchedule();
      timeoutId = setTimeout(async () => {
        try {
          await checkUpdateRef.current(true);
        } catch (e) {
          console.error('Scheduled update check failed:', e);
        }
        scheduleNextCheck();
      }, ms);
    };

    scheduleNextCheck();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // 指示器定位
  useEffect(() => {
    const updateIndicator = () => {
      if (!sidebarRef.current) return;
      const activeEl = sidebarRef.current.querySelector(
        `.${styles.navItem}.${styles.active}`
      ) as HTMLElement;
      if (activeEl) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        setIndicatorStyle({
          top: elRect.top - sidebarRect.top,
          height: elRect.height,
          opacity: 1
        });
      } else {
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };

    const timer = setTimeout(updateIndicator, 0);
    window.addEventListener('resize', updateIndicator);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [currentView, instances, accounts]);

  return (
    <>
      <div className={styles.sidebar} ref={sidebarRef}>
        {/* 頂部導覽 */}
        <div className={styles.navTop}>
          <AccountDropdown />
          <div className={styles.navTopItems}>
            {accounts.length > 0 && (
              <button
                className={`${styles.navItem} ${currentView === 'account_info' ? styles.active : ''}`}
                onClick={() => setCurrentView('account_info')}
              >
                <User className={styles.navItemIcon} />
                <span>{t('account.title')}</span>
              </button>
            )}
            <button
              className={`${styles.navItem} ${currentView === 'instances_overview' ? styles.active : ''}`}
              onClick={() => setCurrentView('instances_overview')}
            >
              <LayoutGrid className={styles.navItemIcon} />
              <span>{t('overview.title')}</span>
            </button>
          </div>
        </div>

        {/* 實例列表 */}
        <div className={styles.navInstances}>
          <div className={styles.sectionTitle}>{t('sidebar.my_instances')}</div>
          {instances.filter(i => i && i.id).map(instance => {
            const iconSrc = getInstanceIconSrc(instance, baseDir, settingsConfig.instancesPath);
            return (
              <button
                key={instance.id}
                className={`${styles.navItem} ${currentView === instance.id ? styles.active : ''}`}
                onClick={() => setCurrentView(instance.id)}
                onContextMenu={(e) => handleContextMenu(e, instance.id)}
              >
                {instance.icon && iconSrc ? (
                  <img
                    src={iconSrc}
                    alt="Icon"
                    className={styles.sidebarCustomIcon}
                  />
                ) : (
                  <span className={styles.sidebarEmojiIcon}>
                    {instance.icon || '📦'}
                  </span>
                )}
                <div className={styles.instanceInfo}>
                  <span className={styles.instanceName}>
                    {instance.name || t('overview.unnamed')}
                  </span>
                  <span className={styles.instanceVersion}>
                    {instance.version || t('overview.unknown_version')} ({instance.modloader === 'Custom' ? t('overview.custom') : instance.modloader})
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 底部設定 */}
        <div className={styles.navBottom}>
          <button
            className={`${styles.navItem} ${currentView === 'global_settings' ? styles.active : ''}`}
            onClick={() => setCurrentView('global_settings')}
          >
            <Settings className={styles.navItemIcon} />
            <span>{t('nav.settings')}</span>
          </button>

          {/* 版本與更新 */}
          <div className={styles.versionContainer}>
            <span className={styles.versionText}>{t('settings.about.version', { version: appVersion })}</span>
            <button
              className={styles.updateCheckBtn}
              onClick={() => handleCheckUpdate(false)}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? t('sidebar.checking_updates') : t('sidebar.check_updates')}
            </button>
          </div>
        </div>

        {/* 滑動指示器 */}
        <div
          className={styles.slidingIndicator}
          style={{
            transform: `translateY(${indicatorStyle.top}px)`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.opacity
          }}
        />
      </div>

      {/* 更新彈窗 */}
      {isUpdateModalOpen && updateInfo && (
        <div className={styles.modalOverlay}>
          <div className={styles.updateModal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <ArrowUpCircle size={20} className={styles.updateIcon} />
                <span>{t('sidebar.new_version', { version: updateInfo.version })}</span>
              </div>
            </div>

            <div className={styles.modalBody}>
              {updateInfo.date && (
                <div className={styles.updateDate}>{t('sidebar.release_date', { date: updateInfo.date })}</div>
              )}
              <div className={styles.notesTitle}>{t('sidebar.changelog')}</div>
              <div
                className={styles.updateNotes}
                dangerouslySetInnerHTML={{
                  __html: updateInfo.body
                    ? (marked.parse(filterChangelog(updateInfo.body, appVersion)) as string)
                    : t('sidebar.no_changelog')
                }}
              />
              {updateError && (
                <div className={styles.errorMessage}>
                  <AlertTriangle className={styles.warningIcon} size={16} />
                  <span>{t('sidebar.update_error', { error: updateError })}</span>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              {!isUpdating ? (
                <>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => setIsUpdateModalOpen(false)}
                  >
                    {t('sidebar.btn.later')}
                  </button>
                  <button
                    className={styles.confirmBtn}
                    onClick={handleApplyUpdate}
                  >
                    {t('sidebar.btn.update')}
                  </button>
                </>
              ) : (
                <div className={styles.updatingStatus}>
                  <Loader className="animate-spin" size={18} />
                  <span>{t('sidebar.updating_status')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`${styles.contextMenuItem} ${styles.launchItem}`}
            onClick={() => handleContextMenuLaunch(contextMenu.instanceId)}
          >
            {t('sidebar.context.launch')}
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={() => handleContextMenuOpenFolder(contextMenu.instanceId)}
          >
            {t('sidebar.context.open_folder')}
          </button>
          <button
            className={`${styles.contextMenuItem} ${styles.deleteItem}`}
            onClick={() => handleContextMenuDelete(contextMenu.instanceId)}
          >
            {t('sidebar.context.delete')}
          </button>
        </div>
      )}

      {instanceToDelete && (
        <CustomConfirmModal
          isOpen={!!instanceToDelete}
          title={t('detail.modal.delete_instance.title')}
          message={t('detail.modal.delete_instance.msg', { name: instanceToDelete.name })}
          onConfirm={handleConfirmDelete}
          onCancel={() => setInstanceToDelete(null)}
        />
      )}
    </>
  );
}
