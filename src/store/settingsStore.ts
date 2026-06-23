import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface GlobalConfig {
  defaultMaxMemory: number | null;
  defaultJvmArgs: string | null;
  instancesPath: string | null;
  language: string | null;
  mainColor: string | null;
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
    instancesPath: null,
    language: null,
    mainColor: null,
  },
  isLoading: false,
  isSaving: false,

  // 載入設定
  loadConfig: async () => {
    set({ isLoading: true });
    try {
      const config = await invoke<GlobalConfig>('load_global_config');
      set({ config, isLoading: false });
      applyThemeColor(config.mainColor);
    } catch (err) {
      console.error('Failed to load global config:', err);
      set({ isLoading: false });
    }
  },

  // 儲存設定
  saveConfig: async (newConfig) => {
    set({ isSaving: true });
    try {
      await invoke('save_global_config', { config: newConfig });
      set({ config: newConfig, isSaving: false });
      applyThemeColor(newConfig.mainColor);
    } catch (err) {
      console.error('Failed to save global config:', err);
      set({ isSaving: false });
      throw err;
    }
  },
}));

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function adjustColorLightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace("#", ""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
}

export function applyThemeColor(mainColor: string | null) {
  const root = document.documentElement;
  if (mainColor && mainColor.trim() !== '') {
    if (/^#[0-9A-Fa-f]{6}$/.test(mainColor)) {
      const rgb = hexToRgb(mainColor);
      if (rgb) {
        const hover = adjustColorLightness(mainColor, 10);
        const hoverRgb = hexToRgb(hover);
        const active = adjustColorLightness(mainColor, -10);
        const activeRgb = hexToRgb(active);

        const clamp = (val: number) => Math.max(0, Math.min(255, val));

        const lightRgb = `${clamp(rgb.r + ((255 - rgb.r) * 0.7))}, ${clamp(rgb.g + ((255 - rgb.g) * 0.7))}, ${clamp(rgb.b + ((255 - rgb.b) * 0.7))}`;
        const darkRgb = `${clamp(rgb.r - (rgb.r * 0.7))}, ${clamp(rgb.g - (rgb.g * 0.7))}, ${clamp(rgb.b - (rgb.b * 0.7))}`;

        root.style.setProperty('--main-color', mainColor);
        root.style.setProperty('--main-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        root.style.setProperty('--main-color-rgb-light', lightRgb);
        root.style.setProperty('--main-color-rgb-dark', darkRgb);
        root.style.setProperty('--main-color-light', `rgb(${lightRgb})`);
        root.style.setProperty('--main-color-dark', `rgb(${darkRgb})`);

        // Calculate contrast text color (YIQ formula)
        const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        const mainColorText = yiq >= 186 ? '#111111' : '#ffffff';
        root.style.setProperty('--main-color-text', mainColorText);

        if (hoverRgb) {
          root.style.setProperty('--main-color-hover', hover);
          root.style.setProperty('--main-color-hover-rgb', `${hoverRgb.r}, ${hoverRgb.g}, ${hoverRgb.b}`);
        }
        if (activeRgb) {
          root.style.setProperty('--main-color-active', active);
          root.style.setProperty('--main-color-active-rgb', `${activeRgb.r}, ${activeRgb.g}, ${activeRgb.b}`);
        }
        return;
      }
    }
  }

  // Fallback to default
  root.style.removeProperty('--main-color');
  root.style.removeProperty('--main-color-rgb');
  root.style.removeProperty('--main-color-rgb-light');
  root.style.removeProperty('--main-color-rgb-dark');
  root.style.removeProperty('--main-color-light');
  root.style.removeProperty('--main-color-dark');
  root.style.removeProperty('--main-color-hover');
  root.style.removeProperty('--main-color-hover-rgb');
  root.style.removeProperty('--main-color-active');
  root.style.removeProperty('--main-color-active-rgb');
  root.style.removeProperty('--main-color-text');
}
