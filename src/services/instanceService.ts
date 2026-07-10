import { invoke } from '@tauri-apps/api/core';
import { Instance } from '../types';

export interface JavaInstallInfo {
  path: string;
  version: string;
  major: number;
}

export const instanceService = {
  // 獲取所有實例
  async getInstances(): Promise<Instance[]> {
    return await invoke<Instance[]>('get_instances');
  },

  // 監聽實例目錄
  async watchInstancesDir(): Promise<void> {
    await invoke('watch_instances_dir');
  },

  // 建立實例
  async createInstance(
    id: string,
    name: string,
    version: string,
    modloader: string,
    loaderVersion: string,
    icon: string,
    modrinthProjectId?: string | null,
    modrinthVersionId?: string | null
  ): Promise<Instance> {
    return await invoke<Instance>('create_instance', {
      id,
      name,
      version,
      modloader,
      loaderVersion,
      icon,
      modrinthProjectId,
      modrinthVersionId
    });
  },

  // 刪除實例
  async deleteInstance(id: string): Promise<void> {
    await invoke('delete_instance', { id });
  },

  // 更新實例設定
  async updateInstanceSettings(id: string, jvmArgs: string, maxMemory: number, javaPath: string | null): Promise<void> {
    await invoke('update_instance_settings', { id, jvmArgs, maxMemory, javaPath: javaPath || null });
  },

  // 更新實例配置
  async updateInstanceConfig(
    id: string,
    name: string,
    version: string,
    modloader: string,
    loaderVersion: string,
    modrinthProjectId?: string | null,
    modrinthVersionId?: string | null
  ): Promise<void> {
    await invoke('update_instance_config', {
      id,
      name,
      version,
      modloader,
      loaderVersion,
      modrinthProjectId,
      modrinthVersionId
    });
  },

  // 匯入整合包
  async importPack(instanceId: string, filePath: string, selectedMods: string[] | null): Promise<any[]> {
    return await invoke<any[]>('import_pack', { instanceId, filePath, selectedMods: selectedMods || null });
  },

  // 初始化啟動會話
  async initLaunchSession(instanceId: string): Promise<void> {
    await invoke('init_launch_session', { instanceId });
  },

  // 獲取實例需要的 Java 版本
  async getRequiredJavaVersion(instanceId: string): Promise<number> {
    return await invoke<number>('get_required_java_version', { instanceId });
  },

  // 探測系統 JRE
  async detectJava(): Promise<JavaInstallInfo[]> {
    return await invoke<JavaInstallInfo[]>('detect_java');
  },

  // 下載與安裝指定 Java
  async downloadJava(majorVersion: number, instanceId: string): Promise<string> {
    return await invoke<string>('download_java', { majorVersion, instanceId });
  },

  // 安裝實例遊戲檔案
  async installInstanceFiles(instanceId: string, javaPath: string): Promise<void> {
    await invoke('install_instance_files', { instanceId, javaPath });
  },

  // 啟動實例
  async launchInstance(instanceId: string, javaPath: string, accountJson: string): Promise<void> {
    await invoke('launch_instance', { instanceId, javaPath, accountJson });
  },

  // 保存實例排序
  async saveInstanceOrder(order: string[]): Promise<void> {
    await invoke('save_instance_order', { order });
  },

  // 監控實例目錄變動
  async watchInstanceFolders(instanceId: string): Promise<void> {
    await invoke('watch_instance_folders', { instanceId });
  },

  // 取消監控
  async unwatchInstanceFolders(): Promise<void> {
    await invoke('unwatch_instance_folders');
  },

  // 取消啟動會話
  async cancelLaunchSession(instanceId: string): Promise<void> {
    await invoke('cancel_launch_session', { instanceId });
  },

  // 強制關閉遊戲進程
  async killLaunchSession(instanceId: string): Promise<void> {
    await invoke('kill_launch_session', { instanceId });
  }
};
