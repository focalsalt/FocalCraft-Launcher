import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useAppStore } from '../../store/appStore';
import { useAccountStore } from '../../store/accountStore';
import { InstancesOverview } from '../../views/InstancesOverview/InstancesOverview';
import { InstanceDetail } from '../../views/InstanceDetail/InstanceDetail';
import { GlobalSettings } from '../../views/GlobalSettings/GlobalSettings';
import { AccountInfoView } from '../../views/AccountInfo/AccountInfoView';
import { useInstanceStore } from '../../store/instanceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { NotificationSystem } from './NotificationSystem';
import { LaunchHUD } from './LaunchHUD';

export function MainLayout() {
  const { currentView } = useAppStore();
  const { loadAccounts, selectedAccountId } = useAccountStore();
  const initInstances = useInstanceStore((state) => state.init);
  const loadInstances = useInstanceStore((state) => state.loadInstances);
  const { loadConfig } = useSettingsStore();

  useEffect(() => {
    loadAccounts();
    initInstances().then(() => {
      loadInstances();
    });
    loadConfig();

    // 每 5 分鐘定時刷新 Token
    const intervalId = setInterval(() => {
      useAccountStore.getState().checkAndRefreshTokens();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadAccounts, initInstances, loadInstances, loadConfig]);


  const renderContent = () => {
    if (currentView === 'instances_overview') {
      return <InstancesOverview />;
    }

    if (currentView === 'global_settings') {
      return <GlobalSettings />;
    }

    if (currentView === 'account_info') {
      return <AccountInfoView key={selectedAccountId || 'none'} />;
    }

    // 預設詳細頁
    return <InstanceDetail instanceId={currentView} />;
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TopNav />
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {renderContent()}
        </div>
      </div>
      <NotificationSystem />
      <LaunchHUD />
    </div>
  );
}
