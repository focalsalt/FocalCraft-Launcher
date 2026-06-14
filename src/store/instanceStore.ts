import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { Instance, InstanceStateDetail } from '../types';
import { useSettingsStore } from './settingsStore';
import { useAppStore } from './appStore';
import { useAccountStore } from './accountStore';

interface ProgressPayload {
  instanceId?: string;
  status: string;
  progress: number;
  detail: string;
}

interface GameStatusPayload {
  instanceId: string;
  status: 'running' | 'exited';
  exitCode?: number;
  crashed?: boolean;
}

export type LaunchPhase =
  | 'idle'
  | 'java_check'
  | 'java_download'
  | 'files'
  | 'launching';

export const getInitialInstanceState = (): InstanceStateDetail => ({
  isDownloading: false,
  isLaunching: false,
  isRunning: false,
  isCrashed: false,
  downloadProgress: 0,
  downloadStatusText: '',
  launchPhase: 'idle',
});

interface InstanceState {
  instances: Instance[];
  downloadingInstanceId: string | null;
  launchingInstanceId: string | null;
  runningInstanceId: string | null;
  crashedInstanceId: string | null;
  downloadProgress: number;
  downloadStatusText: string;
  launchPhase: LaunchPhase;
  initialized: boolean;
  instanceStates: Record<string, InstanceStateDetail>;

  init: () => Promise<void>;
  loadInstances: () => Promise<void>;
  createInstance: (
    id: string,
    name: string,
    version: string,
    modloader: string,
    loaderVersion?: string,
    icon?: string,
    modrinthProjectId?: string,
    modrinthVersionId?: string
  ) => Promise<Instance>;
  deleteInstance: (id: string) => Promise<void>;
  updateInstanceSettings: (id: string, jvmArgs: string | undefined, maxMemory: number | undefined, javaPath?: string) => Promise<void>;
  updateInstanceConfig: (
    id: string,
    name: string,
    version: string,
    modloader: string,
    loaderVersion?: string,
    modrinthProjectId?: string,
    modrinthVersionId?: string
  ) => Promise<void>;
  importMrpack: (instanceId: string, filePath: string, selectedMods?: string[]) => Promise<any[]>;
  launchInstance: (id: string, accountJson: string) => Promise<void>;
  saveInstanceOrder: (order: string[]) => Promise<void>;
  watchInstanceFolders: (instanceId: string) => Promise<void>;
  unwatchInstanceFolders: () => Promise<void>;
  cancelLaunch: (instanceId: string) => void;
  killGame: (instanceId: string) => Promise<void>;
  instanceLogs: Record<string, string[]>;
  setLogs: (instanceId: string, logs: string[]) => void;
  clearLogs: (instanceId: string) => void;
}


export const useInstanceStore = create<InstanceState>((set, get) => ({
  instances: [],
  downloadingInstanceId: null,
  launchingInstanceId: null,
  runningInstanceId: null,
  crashedInstanceId: null,
  downloadProgress: 0,
  downloadStatusText: '',
  launchPhase: 'idle',
  initialized: false,
  instanceStates: {},
  instanceLogs: {},

  setLogs: (instanceId, logs) => set(state => ({
    instanceLogs: { ...state.instanceLogs, [instanceId]: logs }
  })),

  clearLogs: (instanceId) => set(state => ({
    instanceLogs: { ...state.instanceLogs, [instanceId]: [] }
  })),

  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    // Listen to game logs
    await listen<any>('game-log', (event) => {
      const { instanceId, text } = event.payload;
      if (instanceId) {
        set((state) => {
          const logs = state.instanceLogs[instanceId] || [];
          return {
            instanceLogs: {
              ...state.instanceLogs,
              [instanceId]: [...logs, text]
            }
          };
        });
      }
    });

    // Listen to download progress
    await listen<ProgressPayload>('download-progress', (event) => {
      const targetId = event.payload.instanceId;
      if (targetId) {
        set((state) => {
          const s = state.instanceStates[targetId] || getInitialInstanceState();
          return {
            instanceStates: {
              ...state.instanceStates,
              [targetId]: {
                ...s,
                downloadProgress: event.payload.progress,
                downloadStatusText: event.payload.detail
              }
            }
          };
        });
      } else {
        // Fallback to active launching/downloading instance ID
        const activeId = get().downloadingInstanceId || get().launchingInstanceId;
        if (activeId) {
          set((state) => {
            const s = state.instanceStates[activeId] || getInitialInstanceState();
            return {
              instanceStates: {
                ...state.instanceStates,
                [activeId]: {
                  ...s,
                  downloadProgress: event.payload.progress,
                  downloadStatusText: event.payload.detail
                }
              }
            };
          });
        }
      }

      // Legacy global fields for backward compatibility
      set({
        downloadProgress: event.payload.progress,
        downloadStatusText: event.payload.detail
      });
    });

    // Listen to game status
    await listen<GameStatusPayload>('game-status', (event) => {
      const { instanceId, status, exitCode, crashed } = event.payload;
      const isCrash = !!(crashed && exitCode !== 0);

      set((state) => {
        const s = state.instanceStates[instanceId] || getInitialInstanceState();
        return {
          instanceStates: {
            ...state.instanceStates,
            [instanceId]: {
              ...s,
              isRunning: status === 'running',
              isLaunching: false,
              isDownloading: false,
              isCrashed: status === 'exited' && isCrash,
              launchPhase: 'idle',
              downloadProgress: 0,
              downloadStatusText: ''
            }
          }
        };
      });

      if (status === 'running') {
        set({
          runningInstanceId: instanceId,
          launchingInstanceId: null,
          crashedInstanceId: null,
          launchPhase: 'idle',
          downloadProgress: 0,
          downloadStatusText: ''
        });
      } else if (status === 'exited') {
        set({
          runningInstanceId: null,
          launchingInstanceId: null,
          crashedInstanceId: isCrash ? instanceId : null,
          launchPhase: 'idle',
          downloadProgress: 0,
          downloadStatusText: ''
        });
        console.log(`Game exited with code: ${exitCode}`);

        // Bug #5: Crash notification + auto switch to Log tab
        if (isCrash) {
          useAppStore.getState().addNotification({
            type: 'error',
            title: '遊戲崩潰',
            message: `遊戲異常退出（錯誤碼 ${exitCode}），請至「遊戲日誌」查看原因。`
          });
          useAppStore.getState().setActiveDetailTab('log');
        }
      }
    });
  },

  loadInstances: async () => {
    try {
      const list = await invoke<Instance[]>('get_instances');
      set({ instances: list });
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  },

  createInstance: async (id, name, version, modloader, loaderVersion, icon, modrinthProjectId, modrinthVersionId) => {
    try {
      const created = await invoke<Instance>('create_instance', {
        id,
        name,
        version,
        modloader,
        loaderVersion,
        icon,
        modrinthProjectId,
        modrinthVersionId,
      });
      await get().loadInstances();
      return created;
    } catch (error) {
      console.error('Failed to create instance:', error);
      throw error;
    }
  },

  deleteInstance: async (id) => {
    try {
      await invoke('delete_instance', { id });
      set(state => {
        const nextStates = { ...state.instanceStates };
        delete nextStates[id];
        return {
          instances: state.instances.filter(i => i.id !== id),
          instanceStates: nextStates
        };
      });
    } catch (error) {
      console.error('Failed to delete instance:', error);
      throw error;
    }
  },

  updateInstanceSettings: async (id, jvmArgs, maxMemory, javaPath) => {
    try {
      await invoke('update_instance_settings', { id, jvmArgs, maxMemory, javaPath: javaPath || null });
      await get().loadInstances();
    } catch (error) {
      console.error('Failed to update instance settings:', error);
      throw error;
    }
  },

  updateInstanceConfig: async (id, name, version, modloader, loaderVersion, modrinthProjectId, modrinthVersionId) => {
    try {
      await invoke('update_instance_config', {
        id,
        name,
        version,
        modloader,
        loaderVersion,
        modrinthProjectId,
        modrinthVersionId
      });
      await get().loadInstances();
    } catch (error) {
      console.error('Failed to update instance config:', error);
      throw error;
    }
  },

  importMrpack: async (instanceId, filePath, selectedMods?: string[]) => {
    set((state) => {
      const s = state.instanceStates[instanceId] || getInitialInstanceState();
      return {
        downloadingInstanceId: instanceId,
        downloadProgress: 0,
        downloadStatusText: '正在匯入 Modpack...',
        instanceStates: {
          ...state.instanceStates,
          [instanceId]: {
            ...s,
            isDownloading: true,
            downloadProgress: 0,
            downloadStatusText: '正在匯入 Modpack...'
          }
        }
      };
    });
    try {
      const blocked = await invoke<any[]>('import_mrpack', { instanceId, filePath, selectedMods: selectedMods || null });
      await get().loadInstances();
      return blocked || [];
    } catch (error) {
      console.error('Failed to import mrpack:', error);
      throw error;
    } finally {
      set((state) => {
        const s = state.instanceStates[instanceId] || getInitialInstanceState();
        return {
          downloadingInstanceId: null,
          instanceStates: {
            ...state.instanceStates,
            [instanceId]: {
              ...s,
              isDownloading: false
            }
          }
        };
      });
    }
  },

  launchInstance: async (id, accountJson) => {
    // Prevent duplicate launch on the same instance
    const current = get().instanceStates[id] || getInitialInstanceState();
    if (current.isLaunching || current.isRunning) return;

    // Immediately mark as launching to prevent duplicate clicks
    set((state) => {
      const s = state.instanceStates[id] || getInitialInstanceState();
      return {
        launchingInstanceId: id,
        crashedInstanceId: null,
        launchPhase: 'java_check',
        downloadProgress: 0,
        downloadStatusText: '正在初始化啟動會話...',
        instanceLogs: {
          ...state.instanceLogs,
          [id]: []
        },
        instanceStates: {
          ...state.instanceStates,
          [id]: {
            ...s,
            isLaunching: true,
            isCrashed: false,
            launchPhase: 'java_check',
            downloadProgress: 0,
            downloadStatusText: '正在初始化啟動會話...'
          }
        }
      };
    });

    const logInfo = (text: string) => {
      emit('game-log', {
        instanceId: id,
        text: `[Launcher] ${text}`,
        stream: 'stdout'
      });
    };

    try {
      // Reset session in backend
      await invoke('init_launch_session', { instanceId: id });
      const instance = get().instances.find(i => i.id === id);
      if (!instance) throw new Error('找不到該實例');

      logInfo(`=== 準備啟動實例: ${instance.name} ===`);
      
      // === Phase 0: Microsoft credential check and refresh ===
      logInfo('正在驗證微軟登入狀態與憑證效期...');
      const originalAccount = JSON.parse(accountJson);
      const accountStore = useAccountStore.getState();
      let account = accountStore.accounts.find(a => a.id === originalAccount.id);
      
      if (!account) {
        throw new Error('找不到該帳號的登入資訊！');
      }
      
      const now = Date.now();
      if (account.tokenExpiresAt - now < 10 * 60 * 1000) {
        logInfo('微軟登入憑證已過期或即將過期，正在自動刷新憑證...');
        const refreshed = await accountStore.refreshAccountToken(account.id);
        if (!refreshed) {
          throw new Error('自動重新整理憑證失敗，請重新登入您的微軟帳號！');
        }
        account = refreshed;
        logInfo('微軟登入憑證自動刷新成功！');
      } else {
        logInfo('微軟登入憑證有效。');
      }
      
      const finalAccountJson = JSON.stringify({
        id: account.id,
        mcId: account.mcId,
        mcAccessToken: account.mcAccessToken
      });

      logInfo(`遊戲版本: ${instance.version}`);
      logInfo(`Mod Loader: ${instance.modloader} ${instance.loaderVersion ? `(${instance.loaderVersion})` : ''}`);

      const reqVersion = await invoke<number>('get_required_java_version', { instanceId: id });
      let javaPath = '';

      // === Phase 1: Java environment setup ===
      logInfo('正在進行 Java 環境準備...');

      const customJavaPath = instance.javaPath || useSettingsStore.getState().config.customJavaPath;
      let useCustomJava = false;

      if (customJavaPath && customJavaPath.trim() !== '') {
        logInfo(`檢測到自訂 Java 設定路徑: ${customJavaPath}`);
        try {
          const verified = await invoke<{ path: string; version: string; major: number } | null>(
            'verify_custom_java', { path: customJavaPath }
          );
          if (verified && verified.major >= reqVersion) {
            javaPath = customJavaPath;
            useCustomJava = true;
            logInfo(`自訂 Java 驗證成功，版本: ${verified.version}`);
            set((state) => {
              const s = state.instanceStates[id] || getInitialInstanceState();
              return {
                downloadStatusText: `使用自訂 Java ${verified.version}`,
                instanceStates: {
                  ...state.instanceStates,
                  [id]: {
                    ...s,
                    downloadStatusText: `使用自訂 Java ${verified.version}`
                  }
                }
              };
            });
          } else if (verified) {
            logInfo(`自訂 Java 版本為 ${verified.major}，低於需求版本 Java ${reqVersion}，將自動尋找相容版本。`);
            useAppStore.getState().addNotification({
              type: 'warning',
              title: 'Java 版本不相容',
              message: `自訂的 Java ${verified.major} 低於遊戲所需版本 Java ${reqVersion}，將自動尋找相容版本。`
            });
          }
        } catch (err) {
          logInfo(`自訂 Java 驗證失敗: ${err}`);
          console.error('Failed to verify custom Java:', err);
        }
      }

      if (!useCustomJava) {
        logInfo(`正在系統中掃描所需的 Java ${reqVersion} 相容環境...`);
        set((state) => {
          const s = state.instanceStates[id] || getInitialInstanceState();
          return {
            downloadStatusText: '正在掃描系統 Java...',
            instanceStates: {
              ...state.instanceStates,
              [id]: {
                ...s,
                downloadStatusText: '正在掃描系統 Java...'
              }
            }
          };
        });
        const javaInstalls = await invoke<{ path: string; version: string; major: number }[]>('detect_java');

        const exactMatch = javaInstalls.find(j => j.major === reqVersion);
        const higherMatch = javaInstalls
          .filter(j => j.major > reqVersion)
          .sort((a, b) => a.major - b.major)[0];

        const foundJava = exactMatch ?? higherMatch;

        if (foundJava) {
          javaPath = foundJava.path;
          logInfo(`找到系統 Java ${foundJava.major} (${foundJava.version})，路徑: ${foundJava.path}`);
          set((state) => {
            const s = state.instanceStates[id] || getInitialInstanceState();
            return {
              downloadStatusText: `找到 Java ${foundJava.major}`,
              instanceStates: {
                ...state.instanceStates,
                [id]: {
                  ...s,
                  downloadStatusText: `找到 Java ${foundJava.major}`
                }
              }
            };
          });
        } else {
          logInfo(`系統中未找到 Java ${reqVersion} 相容環境，準備自動下載...`);
          set((state) => {
            const s = state.instanceStates[id] || getInitialInstanceState();
            return {
              launchPhase: 'java_download',
              downloadingInstanceId: id,
              downloadStatusText: `找不到 Java ${reqVersion}，準備下載...`,
              instanceStates: {
                ...state.instanceStates,
                [id]: {
                  ...s,
                  launchPhase: 'java_download',
                  isDownloading: true,
                  downloadStatusText: `找不到 Java ${reqVersion}，準備下載...`
                }
              }
            };
          });
          javaPath = await invoke<string>('download_java', { majorVersion: reqVersion, instanceId: id });
          logInfo(`Java ${reqVersion} 下載與安裝完成，路徑: ${javaPath}`);
          set((state) => {
            const s = state.instanceStates[id] || getInitialInstanceState();
            return {
              downloadingInstanceId: null,
              instanceStates: {
                ...state.instanceStates,
                [id]: {
                  ...s,
                  isDownloading: false
                }
              }
            };
          });
        }
      }

      // === Phase 2: Game files preparation ===
      logInfo('正在檢查與準備遊戲核心檔案、依賴庫 (Libraries)、資源包索引 (Assets) 等...');
      set((state) => {
        const s = state.instanceStates[id] || getInitialInstanceState();
        return {
          launchPhase: 'files',
          downloadingInstanceId: id,
          downloadStatusText: '正在準備遊戲檔案...',
          instanceStates: {
            ...state.instanceStates,
            [id]: {
              ...s,
              launchPhase: 'files',
              isDownloading: true,
              downloadStatusText: '正在準備遊戲檔案...'
            }
          }
        };
      });
      await invoke('install_instance_files', { instanceId: id, javaPath });
      logInfo('遊戲檔案與依賴庫準備完成！');
      set((state) => {
        const s = state.instanceStates[id] || getInitialInstanceState();
        return {
          downloadingInstanceId: null,
          instanceStates: {
            ...state.instanceStates,
            [id]: {
              ...s,
              isDownloading: false
            }
          }
        };
      });

      // === Phase 3: Game launch process ===
      logInfo('正在組裝啟動參數，並呼叫 Java 啟動遊戲進程...');
      set((state) => {
        const s = state.instanceStates[id] || getInitialInstanceState();
        return {
          launchPhase: 'launching',
          downloadStatusText: '正在啟動遊戲...',
          instanceStates: {
            ...state.instanceStates,
            [id]: {
              ...s,
              launchPhase: 'launching',
              downloadStatusText: '正在啟動遊戲...'
            }
          }
        };
      });
      await invoke('launch_instance', { instanceId: id, javaPath, accountJson: finalAccountJson });
      logInfo('遊戲啟動指令發送成功！');

      set((state) => {
        const s = state.instanceStates[id] || getInitialInstanceState();
        return {
          launchingInstanceId: null,
          downloadingInstanceId: null,
          launchPhase: 'idle',
          downloadProgress: 0,
          downloadStatusText: '',
          instanceStates: {
            ...state.instanceStates,
            [id]: {
              ...s,
              isLaunching: false,
              isDownloading: false,
              launchPhase: 'idle',
              downloadProgress: 0,
              downloadStatusText: ''
            }
          }
        };
      });

    } catch (error: any) {
      const errStr = error?.message || String(error);
      logInfo(`[錯誤] 啟動失敗: ${errStr}`);
      console.error('Launch failed:', error);
      set((state) => {
        const s = state.instanceStates[id] || getInitialInstanceState();
        return {
          launchingInstanceId: null,
          downloadingInstanceId: null,
          launchPhase: 'idle',
          downloadProgress: 0,
          downloadStatusText: '',
          instanceStates: {
            ...state.instanceStates,
            [id]: {
              ...s,
              isLaunching: false,
              isDownloading: false,
              isCrashed: true,
              launchPhase: 'idle',
              downloadProgress: 0,
              downloadStatusText: `啟動失敗: ${errStr}`
            }
          }
        };
      });
      useAppStore.getState().addNotification({
        type: 'error',
        title: '啟動失敗',
        message: errStr
      });
      throw error;
    }
  },

  saveInstanceOrder: async (order: string[]) => {
    try {
      const currentInstances = get().instances;
      const sorted = [...currentInstances].sort((a, b) => {
        const pos_a = order.indexOf(a.id);
        const pos_b = order.indexOf(b.id);
        const val_a = pos_a === -1 ? Infinity : pos_a;
        const val_b = pos_b === -1 ? Infinity : pos_b;
        return val_a - val_b;
      });
      set({ instances: sorted });
      await invoke('save_instance_order', { order });
    } catch (error) {
      console.error('Failed to save instance order:', error);
    }
  },

  watchInstanceFolders: async (instanceId) => {
    try {
      await invoke('watch_instance_folders', { instanceId });
    } catch (error) {
      console.error('Failed to watch instance folders:', error);
    }
  },

  unwatchInstanceFolders: async () => {
    try {
      await invoke('unwatch_instance_folders');
    } catch (error) {
      console.error('Failed to unwatch instance folders:', error);
    }
  },

  cancelLaunch: async (instanceId) => {
    try {
      await invoke('cancel_launch_session', { instanceId });
    } catch (error) {
      console.error('Failed to cancel launch:', error);
    }
    set((state) => {
      const s = state.instanceStates[instanceId] || getInitialInstanceState();
      return {
        launchingInstanceId: null,
        downloadingInstanceId: null,
        launchPhase: 'idle',
        downloadProgress: 0,
        downloadStatusText: '',
        instanceStates: {
          ...state.instanceStates,
          [instanceId]: {
            ...s,
            isLaunching: false,
            isDownloading: false,
            launchPhase: 'idle',
            downloadProgress: 0,
            downloadStatusText: '已取消'
          }
        }
      };
    });
    console.log(`Launch cancelled for instance: ${instanceId}`);
  },

  killGame: async (instanceId) => {
    try {
      await invoke('kill_launch_session', { instanceId });
      set((state) => {
        const s = state.instanceStates[instanceId] || getInitialInstanceState();
        return {
          runningInstanceId: null,
          instanceStates: {
            ...state.instanceStates,
            [instanceId]: {
              ...s,
              isRunning: false,
              launchPhase: 'idle',
              downloadProgress: 0,
              downloadStatusText: ''
            }
          }
        };
      });
    } catch (error) {
      console.error('Failed to kill game:', error);
    }
  }
}));
