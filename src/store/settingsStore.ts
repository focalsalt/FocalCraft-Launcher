import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface GlobalConfig {
  defaultMaxMemory: number | null;
  defaultJvmArgs: string | null;
  customJavaPath: string | null;
  instancesPath: string | null;
  language: string | null;
}

interface SettingsState {
  config: GlobalConfig;
  isLoading: boolean;
  isSaving: boolean;
  loadConfig: () => Promise<void>;
  saveConfig: (newConfig: GlobalConfig) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: {
    defaultMaxMemory: 4096,
    defaultJvmArgs: null,
    customJavaPath: null,
    instancesPath: null,
    language: null,
  },
  isLoading: false,
  isSaving: false,

  // 載入全域設定
  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await invoke<GlobalConfig>('load_global_config');
      set({ config, isLoading: false });
    } catch (err) {
      console.error('Failed to load global config:', err);
      set({ isLoading: false });
    }
  },

  // 儲存全域設定
  saveConfig: async (newConfig) => {
    set({ isSaving: true });
    try {
      await invoke('save_global_config', { config: newConfig });
      set({ config: newConfig, isSaving: false });
    } catch (err) {
      console.error('Failed to save global config:', err);
      set({ isSaving: false });
      throw err;
    }
  },
}));
