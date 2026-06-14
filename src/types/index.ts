export type ViewState = 'instances_overview' | 'global_settings' | string;

export interface Instance {
  id: string;
  name: string;
  version: string;
  modloader: 'Vanilla' | 'Fabric' | 'Forge' | 'Quilt' | 'NeoForge' | 'Custom';
  icon?: string;
  lastPlayed?: number;
  playTime?: number;
  jvmArgs?: string;
  maxMemory?: number;
  loaderVersion?: string;
  modrinthProjectId?: string;
  modrinthVersionId?: string;
  javaPath?: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

export interface Account {
  id: string;
  mcId: string;
  avatarUrl: string;
  msRefreshToken: string;
  mcAccessToken: string;
  tokenExpiresAt: number;
}

export type DetailTabType = 'edit' | 'log' | 'mods' | 'resourcepacks' | 'shaderpacks' | 'worlds' | 'servers' | 'settings' | 'modpack_update' | 'skins' | 'skin_wardrobe' | 'capes';

export interface MojangSkin {
  id: string;
  state: 'ACTIVE' | 'INACTIVE';
  url: string;
  variant: 'CLASSIC' | 'SLIM';
}

export interface MojangCape {
  id: string;
  state: 'ACTIVE' | 'INACTIVE';
  url: string;
  alias: string;
}

export interface MojangProfile {
  id: string;
  name: string;
  skins: MojangSkin[];
  capes: MojangCape[];
}


export interface ModItem {
  fileName: string;
  name: string;
  version: string;
  environment: string;
  sha1: string;
  enabled: boolean;
}

export interface ResourcePackItem {
  fileName: string;
  name: string;
  description: string;
  packFormat: number;
  gameVersion: string;
  sha1: string;
}

export interface WorldItem {
  folderName: string;
  name: string;
  sizeBytes: number;
  datapacks: string[];
}

export interface ServerItem {
  name: string;
  ip: string;
  acceptTextures?: number;
}

export interface InstanceStateDetail {
  isDownloading: boolean;
  isLaunching: boolean;
  isRunning: boolean;
  isCrashed: boolean;
  downloadProgress: number;
  downloadStatusText: string;
  launchPhase: 'idle' | 'java_check' | 'java_download' | 'files' | 'launching';
}



