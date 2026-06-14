import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useInstanceStore } from '../../store/instanceStore';
import styles from './TopNav.module.css';

export function TopNav() {
  const { currentView, activeDetailTab, setActiveDetailTab } = useAppStore();
  const instances = useInstanceStore((state) => state.instances);

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

    // Run after a tiny timeout to ensure DOM layout is updated and active class is applied
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
                  皮膚
                </button>
                <button
                  className={`${styles.tab} ${activeDetailTab === 'skin_wardrobe' ? styles.active : ''}`}
                  onClick={() => setActiveDetailTab('skin_wardrobe')}
                >
                  皮膚櫃
                </button>
                <button
                  className={`${styles.tab} ${activeDetailTab === 'capes' ? styles.active : ''}`}
                  onClick={() => setActiveDetailTab('capes')}
                >
                  披風
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
                {currentView === 'global_settings' && '全局設定'}
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
          主畫面
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
          紀錄
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'mods' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('mods')}
        >
          模組
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'resourcepacks' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('resourcepacks')}
        >
          資源包
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'shaderpacks' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('shaderpacks')}
        >
          光影包
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'worlds' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('worlds')}
        >
          世界
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'servers' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('servers')}
        >
          伺服器
        </button>
        <button
          className={`${styles.tab} ${activeDetailTab === 'settings' ? styles.active : ''}`}
          onClick={() => setActiveDetailTab('settings')}
        >
          詳細設定
        </button>

        {/* Sliding indicator line */}
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
