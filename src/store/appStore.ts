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
  currentView: 'instances_overview', // 預設檢視畫面
  notifications: [],
  activeDetailTab: 'edit',
  
  // 切換目前檢視畫面
  setCurrentView: (view) => set({
    currentView: view,
    activeDetailTab: view === 'account_info' ? 'skins' : 'edit'
  }),

  // 設定詳細資訊頁的當前標籤頁
  setActiveDetailTab: (tab) => set({ activeDetailTab: tab }),
  
  // 新增全域通知 (預設 5 秒後自動移除)
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
  
  // 移除指定 ID 的通知
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  }))
}));
