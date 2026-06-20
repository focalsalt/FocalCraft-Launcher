import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useInstanceStore } from '../../store/instanceStore';
import { useI18n } from '../../utils/i18n';
import styles from './TopNav.module.css';

export function TopNav() {
  const { currentView, activeDetailTab, setActiveDetailTab } = useAppStore();
  const instances = useInstanceStore((state) => state.instances);
  const { t } = useI18n();

  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });

  const isInstanceView = instances.some(i => i && i.id === currentView);
  const instance = instances.find(i => i && i.id === currentView);

  useEffect(() => {
    const updateIndicator = () => {
      if (!tabsRef.current) return;
      const activeEl = tabsRef.current.querySelector(`.${styles.tab}.${styles.active}`) as HTMLElement;
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          opacity: 1
        });
      } else {
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };

    // 延遲以套用 active 樣式
    const timer = setTimeout(updateIndicator, 0);
    window.addEventListener('resize', updateIndicator);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeDetailTab, currentView, instances]);

  if (!isInstanceView || !instance) {
    return (
      <>
        {currentView !== 'instances_overview' && (
          <div className={styles.topnav}>
            {currentView === 'account_info' ? (
              <div className={styles.tabs} ref={tabsRef}>
                 <button
                   className={`${styles.tab} ${activeDetailTab === 'skins' ? styles.active : ''}`}
                   onClick={() => setActiveDetailTab('skins')}
                 >
                   {t('nav.skins')}
                 </button>
                <button
                   className={`${styles.tab} ${activeDetailTab === 'skin_wardrobe' ? styles.active : ''}`}
                   onClick={() => setActiveDetailTab('skin_wardrobe')}
                 >
                   {t('nav.skin_wardrobe')}
                 </button>
                <button
                   className={`${styles.tab} ${activeDetailTab === 'capes' ? styles.active : ''}`}
                   onClick={() => setActiveDetailTab('capes')}
                 >
                   {t('nav.capes')}
                 </button>
                <div
                   className={styles.indicator}
                   style={{
                     transform: `translateX(${indicatorStyle.left}px)`,
                     width: `${indicatorStyle.width}px`,
                     opacity: indicatorStyle.opacity
                   }}
                 />
              </div>
            ) : (
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentView === 'global_settings' && t('nav.settings')}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.topnav}>
      <div className={styles.tabs} ref={tabsRef}>
        <button
          className={`${styles.tab} ${activeDetailTab === 'edit' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('edit')}
        >
          {t('nav.main')}
        </button>
        {instance.modrinthProjectId && (
          <button
            className={`${styles.tab} ${activeDetailTab === 'modpack_update' ? styles.active : ''}`}
            onClick={() => setActiveDetailTab('modpack_update')}
          >
            Modrinth
          </button>
        )}
        <button
          className={`${styles.tab} ${activeDetailTab === 'log' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('log')}
        >
          {t('nav.logs')}
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'mods' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('mods')}
        >
          {t('nav.mods')}
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'resourcepacks' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('resourcepacks')}
        >
          {t('nav.resourcepacks')}
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'shaderpacks' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('shaderpacks')}
        >
          {t('nav.shaderpacks')}
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'worlds' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('worlds')}
        >
          {t('nav.worlds')}
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'servers' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('servers')}
        >
          {t('nav.servers')}
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'settings' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('settings')}
        >
          {t('nav.detail_settings')}
        </button>

        {/* 指示器 */}
        <div
          className={styles.indicator}
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: `${indicatorStyle.width}px`,
            opacity: indicatorStyle.opacity
          }}
        />
      </div>
    </div>
  );
}
