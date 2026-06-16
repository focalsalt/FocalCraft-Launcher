import { useSettingsStore } from '../store/settingsStore';
import { zhTW } from '../i18n/zh-TW';
import { enUS } from '../i18n/en-US';

export const translations = {
  'zh-TW': zhTW,
  'en-US': enUS,
};

export type Language = 'zh-TW' | 'en-US';
export type TranslationKeys = keyof typeof zhTW;

/**
 * 取得當前合適的語系 (支援自動判定)
 */
export function getActiveLanguage(configLanguage: string | null): Language {
  if (configLanguage && (configLanguage === 'zh-TW' || configLanguage === 'en-US')) {
    return configLanguage as Language;
  }
  
  // 自動判定系統語系
  const sysLang = navigator.language || '';
  if (sysLang.toLowerCase().startsWith('zh')) {
    return 'zh-TW';
  }
  return 'en-US';
}

/**
 * 前端多國語言 Hook
 */
export function useI18n() {
  const configLang = useSettingsStore((state) => state.config.language);
  const activeLang = getActiveLanguage(configLang);
  const currentTranslations = translations[activeLang] || translations['zh-TW'];

  const t = (key: TranslationKeys, params?: Record<string, string | number>) => {
    let value = currentTranslations[key] || translations['zh-TW'][key] || String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }
    return value;
  };

  return { t, language: activeLang, rawLanguageSetting: configLang };
}

/**
 * 動態將後端發送的中文進度詳細資訊 (detail) 翻譯為英文 (若當前語系為英文)
 */
export function translateBackendStatus(detail: string, lang: Language): string {
  if (lang === 'zh-TW') {
    return detail;
  }

  // 1. JRE 下載與解壓
  if (detail.startsWith('準備下載 JRE')) {
    const ver = detail.replace(/[^\d]/g, '');
    return `Preparing to download JRE ${ver}...`;
  }
  if (detail.startsWith('已下載') && detail.includes('MB')) {
    // 已下載 12.3 MB / 50.0 MB
    const numbers = detail.match(/[\d.]+/g);
    if (numbers && numbers.length >= 2) {
      return `Downloaded ${numbers[0]} MB / ${numbers[1]} MB`;
    }
    return detail.replace('已下載', 'Downloaded');
  }
  if (detail === '正在解壓縮 JRE，這可能需要一點時間...') {
    return 'Extracting JRE, this may take a moment...';
  }
  if (detail.startsWith('找不到 java.exe')) {
    return 'java.exe not found. Extraction failed or architecture incompatible.';
  }

  // 2. 檔案準備與安裝
  if (detail === '正在準備遊戲檔案...') {
    return 'Preparing game files...';
  }
  if (detail.startsWith('正在下載') && detail.includes('安裝檔')) {
    // 正在下載 Fabric 安裝檔...
    const name = detail.replace('正在下載', '').replace('安裝檔...', '').trim();
    return `Downloading ${name} installer...`;
  }
  if (detail.startsWith('正在執行') && detail.includes('安裝程序')) {
    // 正在執行 Fabric 安裝程序 (背景執行)...
    const name = detail.replace('正在執行', '').replace('安裝程序 (背景執行)...', '').trim();
    return `Running ${name} installer in background...`;
  }
  if (detail.startsWith('下載') && detail.includes('安裝檔失敗')) {
    // 下載 Fabric 安裝檔失敗: ...
    const err = detail.substring(detail.indexOf(':') + 1).trim();
    return `Failed to download installer: ${err}`;
  }

  // 3. 整合包匯入
  if (detail.startsWith('開始匯入') && detail.includes('整合包')) {
    // 開始匯入 CurseForge 整合包，共 45 個檔案...
    const numbers = detail.match(/\d+/);
    const count = numbers ? numbers[0] : '';
    const packType = detail.includes('CurseForge') ? 'CurseForge' : (detail.includes('Modrinth') ? 'Modrinth' : '');
    return `Importing ${packType} modpack, ${count} files in total...`;
  }
  if (detail.startsWith('正在下載整合包檔案')) {
    // 正在下載整合包檔案 (1/45): ...
    const match = detail.match(/\((\d+)\/(\d+)\):\s*(.*)/);
    if (match) {
      return `Downloading modpack file (${match[1]}/${match[2]}): ${match[3]}`;
    }
    return detail.replace('正在下載整合包檔案', 'Downloading modpack files');
  }
  if (detail.startsWith('正在解壓 overrides')) {
    return 'Extracting overrides...';
  }
  if (detail === '正在重新整理本地實例列表...') {
    return 'Refreshing local instances...';
  }

  // 4. 啟動狀態
  if (detail === '正在初始化啟動會話...') {
    return 'Initializing launch session...';
  }
  if (detail === '正在啟動遊戲...') {
    return 'Launching game...';
  }
  if (detail.startsWith('使用自訂 Java')) {
    const ver = detail.replace('使用自訂 Java', '').trim();
    return `Using custom Java ${ver}`;
  }
  if (detail === '正在掃描系統 Java...') {
    return 'Scanning system Javas...';
  }
  if (detail.startsWith('找不到 Java') && detail.includes('準備下載')) {
    const ver = detail.replace(/[^\d]/g, '');
    return `Java ${ver} not found, preparing download...`;
  }
  if (detail.startsWith('Java') && detail.includes('下載與安裝完成')) {
    return detail.replace('下載與安裝完成', 'download and installation complete');
  }
  if (detail.startsWith('啟動失敗')) {
    return detail.replace('啟動失敗', 'Launch failed');
  }

  return detail;
}
