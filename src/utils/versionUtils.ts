import { convertFileSrc } from '@tauri-apps/api/core';

// 取得版本號的主分組名稱
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

// 取得實例自訂圖示路徑
export const getInstanceIconSrc = (
  instance: InstanceLike,
  baseDir: string,
  instancesPath?: string | null
): string | null => {
  if (!instance.icon) return null;

  // 網路 URL
  if (instance.icon.startsWith('https://')) return instance.icon;

  // 過濾 Emoji
  if (instance.icon.length <= 4 && !instance.icon.includes('.')) return null;

  const instsDir = instancesPath || `${baseDir}/instances`;
  return convertFileSrc(`${instsDir}/${instance.id}/${instance.icon}`);
};

// 比較兩個版本號語意大小
export const compareVersions = (a: string, b: string): number => {
  const getSegments = (version: string) => {
    return version
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '.')
      .split('.')
      .filter(s => s !== '');
  };

  const segmentsA = getSegments(a);
  const segmentsB = getSegments(b);
  const maxLength = Math.max(segmentsA.length, segmentsB.length);

  for (let i = 0; i < maxLength; i++) {
    const segA = segmentsA[i];
    const segB = segmentsB[i];

    if (segA === undefined) return -1;
    if (segB === undefined) return 1;

    const numA = parseInt(segA, 10);
    const numB = parseInt(segB, 10);
    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) {
      if (numA !== numB) {
        return numA - numB;
      }
    } else if (isNumA) {
      return 1;
    } else if (isNumB) {
      return -1;
    } else {
      if (segA !== segB) {
        return segA.localeCompare(segB);
      }
    }
  }

  return 0;
};

// 依據發布類型、語意版本與發布日期對模組版本列表進行排序（最新相容版本排最前）
export const sortModVersions = (versions: any[]): any[] => {
  return [...versions].sort((a: any, b: any) => {
    const typePriority = { release: 3, beta: 2, alpha: 1 } as Record<string, number>;
    const priorityA = typePriority[a.version_type] || 0;
    const priorityB = typePriority[b.version_type] || 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    const semverCompare = compareVersions(a.version_number, b.version_number);
    if (semverCompare !== 0) {
      return -semverCompare;
    }
    return new Date(b.date_published).getTime() - new Date(a.date_published).getTime();
  });
};

// 清理模組名稱或檔案名稱以供 Modrinth 搜尋
export const cleanQueryName = (name: string): string => {
  if (!name) return '';
  let q = name.trim();
  // 移除 .jar 或 .jar.disabled 尾碼
  q = q.replace(/\.jar(\.disabled)?$/i, '');
  // 移除版本號格式（匹配以空格、連字號、底線或加號開頭，後跟 v、mc 或數字的模式）
  q = q.replace(/[+\-_ ]+(v?\d|mc\d).*/i, '');
  // 移除常見的載入器尾碼
  q = q.replace(/[+\-_ ]+(fabric|forge|neoforge|quilt)$/i, '');
  return q.trim();
};

