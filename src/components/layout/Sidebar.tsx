import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useInstanceStore } from '../../store/instanceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getInstanceIconSrc } from '../../utils/versionUtils';
import { invoke } from '@tauri-apps/api/core';
import { LayoutGrid, Settings, User, Loader, ArrowUpCircle } from 'lucide-react';
import { AccountDropdown } from './AccountDropdown';
import { useAccountStore } from '../../store/accountStore';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { marked } from 'marked';
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
  const { currentView, setCurrentView, addNotification } = useAppStore();

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

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
            title: '檢查更新',
            message: '目前已是最新版本。'
          });
        }
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      if (!silent) {
        addNotification({
          type: 'error',
          title: '檢查更新失敗',
          message: String(err)
        });
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateInfo || isUpdating) return;
    setIsUpdating(true);
    setUpdateError('');
    try {
      addNotification({
        type: 'info',
        title: '下載更新',
        message: '開始下載更新，請稍候...'
      });
      await updateInfo.downloadAndInstall();
      addNotification({
        type: 'success',
        title: '下載更新完成',
        message: '即將重新啟動應用程式以套用更新。'
      });
      setTimeout(async () => {
        try {
          await relaunch();
        } catch (err) {
          console.error('Relaunch failed:', err);
          setIsUpdating(false);
          setUpdateError('重啟失敗，請手動重啟應用程式。');
        }
      }, 1500);
    } catch (err) {
      console.error('Failed to download and install update:', err);
      setIsUpdating(false);
      setUpdateError(String(err));
      addNotification({
        type: 'error',
        title: '更新安裝失敗',
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

  useEffect(() => {
    invoke<string>('init_app_dirs').then(setBaseDir).catch(console.error);
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  const checkUpdateRef = useRef(handleCheckUpdate);
  useEffect(() => {
    checkUpdateRef.current = handleCheckUpdate;
  });

  useEffect(() => {
    // 啟動時自動檢查更新（靜音模式，只有有更新時才彈窗提示）
    checkUpdateRef.current(true);

    let timeoutId: ReturnType<typeof setTimeout>;

    const getMsUntilNextSchedule = (): number => {
      const now = new Date();
      
      // 今天 00:00
      const time0 = new Date(now);
      time0.setHours(0, 0, 0, 0);
      
      // 今天 12:00
      const time12 = new Date(now);
      time12.setHours(12, 0, 0, 0);
      
      // 明天 00:00
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


  useEffect(() => {
    const updateIndicator = () => {
      if (!sidebarRef.current) return;
      // Search across all nav item zones in the sidebar
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
        {/* Top fixed zone: Account + 實例總覽 */}
        <div className={styles.navTop}>
          <AccountDropdown />
          <div className={styles.navTopItems}>
            {accounts.length > 0 && (
              <button
                className={`${styles.navItem} ${currentView === 'account_info' ? styles.active : ''}`}
                onClick={() => setCurrentView('account_info')}
              >
                <User className={styles.navItemIcon} />
                <span>帳號資訊</span>
              </button>
            )}
            <button
              className={`${styles.navItem} ${currentView === 'instances_overview' ? styles.active : ''}`}
              onClick={() => setCurrentView('instances_overview')}
            >
              <LayoutGrid className={styles.navItemIcon} />
              <span>實例總覽</span>
            </button>
          </div>
        </div>

        {/* Middle scrollable zone: instance list */}
        <div className={styles.navInstances}>
          <div className={styles.sectionTitle}>我的實例</div>
          {instances.filter(i => i && i.id).map(instance => {
            const iconSrc = getInstanceIconSrc(instance, baseDir, settingsConfig.instancesPath);
            return (
              <button
                key={instance.id}
                className={`${styles.navItem} ${currentView === instance.id ? styles.active : ''}`}
                onClick={() => setCurrentView(instance.id)}
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
                    {instance.name || '未命名實例'}
                  </span>
                  <span className={styles.instanceVersion}>
                    {instance.version || '未知版本'} ({instance.modloader === 'Custom' ? '自訂' : instance.modloader})
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom fixed zone: 全局設定 */}
        <div className={styles.navBottom}>
          <button
            className={`${styles.navItem} ${currentView === 'global_settings' ? styles.active : ''}`}
            onClick={() => setCurrentView('global_settings')}
          >
            <Settings className={styles.navItemIcon} />
            <span>全局設定</span>
          </button>

          {/* 版本號與檢查更新 */}
          <div className={styles.versionContainer}>
            <span className={styles.versionText}>版本：v{appVersion}</span>
            <button
              className={styles.updateCheckBtn}
              onClick={() => handleCheckUpdate(false)}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? '檢查中...' : '檢查更新'}
            </button>
          </div>
        </div>

        {/* Sliding Indicator Line — positioned relative to whole sidebar */}
        <div
          className={styles.slidingIndicator}
          style={{
            transform: `translateY(${indicatorStyle.top}px)`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.opacity
          }}
        />
      </div>

      {isUpdateModalOpen && updateInfo && (
        <div className={styles.modalOverlay}>
          <div className={styles.updateModal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <ArrowUpCircle size={20} className={styles.updateIcon} />
                <span>發現新版本：v{updateInfo.version}</span>
              </div>
            </div>
            
            <div className={styles.modalBody}>
              {updateInfo.date && (
                <div className={styles.updateDate}>發布日期：{updateInfo.date}</div>
              )}
              <div className={styles.notesTitle}>更新日誌：</div>
              <div 
                className={styles.updateNotes}
                dangerouslySetInnerHTML={{ 
                  __html: updateInfo.body 
                    ? (marked.parse(filterChangelog(updateInfo.body, appVersion)) as string) 
                    : '<p>無更新日誌。</p>' 
                }}
              />
              {updateError && (
                <div className={styles.errorMessage}>
                  ⚠️ 更新錯誤：{updateError}
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
                    稍後再說
                  </button>
                  <button 
                    className={styles.confirmBtn} 
                    onClick={handleApplyUpdate}
                  >
                    立即更新並重啟
                  </button>
                </>
              ) : (
                <div className={styles.updatingStatus}>
                  <Loader className={`${styles.spinIcon} animate-spin`} size={18} />
                  <span>正在下載並安裝更新，請勿關閉程式...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
