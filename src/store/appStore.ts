import { create } from 'zustand';
import { ViewState, AppNotification, DetailTabType } from '../types';

interface AppState {
  currentView: ViewState;
  notifications: AppNotification[];
  activeDetailTab: DetailTabType;
  setCurrentView: (view: ViewState) => void;
  setActiveDetailTab: (tab: DetailTabType) => void;
  addNotification: (notification: Omit<AppNotification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'instances_overview', // 預設視圖
  notifications: [],
  activeDetailTab: 'edit',
  
  // 切換目前視圖
  setCurrentView: (view) => set({
    currentView: view,
    activeDetailTab: view === 'account_info' ? 'skins' : 'edit'
  }),

  // 設定詳細頁標籤
  setActiveDetailTab: (tab) => set({ activeDetailTab: tab }),
  
  // 新增通知 (預設 5 秒後移除)
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }]
    }));
    
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, notification.duration || 5000);
  },
  
  // 移除通知
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  }))
}));
