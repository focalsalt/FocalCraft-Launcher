import { convertFileSrc } from '@tauri-apps/api/core';

// ==========================================
// Minecraft 版本分組工具
// ==========================================

/**
 * 將 Minecraft 版本 ID 分類為版本群組字串
 * 例如: "1.20.4" -> "1.20.X", "b1.7.3" -> "Beta 測試版 (Beta)"
 */
export const getMajorVersionGroup = (verId: string): string => {
  if (verId.startsWith('b1.')) return 'Beta 測試版 (Beta)';
  if (verId.startsWith('a1.')) return 'Alpha 測試版 (Alpha)';
  if (verId.startsWith('inf-')) return 'Infdev';
  if (verId.startsWith('rd-')) return 'Pre-Classic';
  if (verId.startsWith('c0.')) return 'Classic';

  const dotMatch = verId.match(/^(\d+)\.(\d+)/);
  if (dotMatch) {
    return `${dotMatch[1]}.${dotMatch[2]}.X`;
  }

  return '其他測試版本';
};

// ==========================================
// 實例圖示工具
// ==========================================

interface InstanceLike {
  id: string;
  icon?: string | null;
}

/**
 * 計算實例圖示的可顯示 URL 或 null（表示顯示 Emoji）
 * @param instance 實例物件（需含 id, icon）
 * @param baseDir  App 的 base 目錄（來自 init_app_dirs）
 * @param instancesPath 自訂實例路徑（來自 settingsConfig.instancesPath）
 */
export const getInstanceIconSrc = (
  instance: InstanceLike,
  baseDir: string,
  instancesPath?: string | null
): string | null => {
  if (!instance.icon) return null;

  // 僅接受 HTTPS（不接受 HTTP 以避免混合內容安全警告）
  if (instance.icon.startsWith('https://')) return instance.icon;

  // 過濾掉非圖片的短字串（Emoji 等）
  if (instance.icon.length <= 4 && !instance.icon.includes('.')) return null;

  const instsDir = instancesPath || `${baseDir}/instances`;
  return convertFileSrc(`${instsDir}/${instance.id}/${instance.icon}`);
};
