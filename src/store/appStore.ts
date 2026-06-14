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
  currentView: 'instances_overview', // Default view
  notifications: [],
  activeDetailTab: 'edit',
  
  setCurrentView: (view) => set({
    currentView: view,
    activeDetailTab: view === 'account_info' ? 'skins' : 'edit'
  }),
  setActiveDetailTab: (tab) => set({ activeDetailTab: tab }),
  
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }]
    }));
    
    // Auto remove notification after duration (default 5s)
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, notification.duration || 5000);
  },
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  }))
}));

