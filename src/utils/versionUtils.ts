import { convertFileSrc } from '@tauri-apps/api/core';

// 依 Minecraft 版本號取得對應的分組名稱 (例如: 1.20.4 -> 1.20.X)
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

interface InstanceLike {
  id: string;
  icon?: string | null;
}

// 取得實例自訂圖示的本機或網路載入網址
export const getInstanceIconSrc = (
  instance: InstanceLike,
  baseDir: string,
  instancesPath?: string | null
): string | null => {
  if (!instance.icon) return null;

  // 僅接受 HTTPS
  if (instance.icon.startsWith('https://')) return instance.icon;

  // 若長度太短且不含副檔名，視為 Emoji
  if (instance.icon.length <= 4 && !instance.icon.includes('.')) return null;

  const instsDir = instancesPath || `${baseDir}/instances`;
  return convertFileSrc(`${instsDir}/${instance.id}/${instance.icon}`);
};
