import { create } from 'zustand';
import { instanceService } from '../services/instanceService';
import { listen, emit } from '@tauri-apps/api/event';
import { Instance, InstanceStateDetail } from '../types';
import { useAppStore } from './appStore';
import { useAccountStore } from './accountStore';
import { getTranslation, getActiveLanguage, translateBackendStatus } from '../utils/i18n';
import { useSettingsStore } from './settingsStore';


interface ProgressPayload {
  instanceId?: string;
  status: string;
  progress: number;
  detail: string;
  statusCode?: string;
  statusParams?: Record<string, string>;
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
  importPack: (instanceId: string, filePath: string, selectedMods?: string[]) => Promise<any[]>;
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

  // 初始化監聽
  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    // 遊戲日誌監聽
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

    // 下載進度監聽
    await listen<ProgressPayload>('download-progress', (event) => {
      const targetId = event.payload.instanceId;
      const configLang = useSettingsStore.getState().config.language;
      const activeLang = getActiveLanguage(configLang);
      const translatedDetail = translateBackendStatus(
        event.payload.detail,
        activeLang,
        event.payload.statusCode,
        event.payload.statusParams
      );

      if (targetId) {
        set((state) => {
          const s = state.instanceStates[targetId] || getInitialInstanceState();
          return {
            instanceStates: {
              ...state.instanceStates,
              [targetId]: {
                ...s,
                downloadProgress: event.payload.progress,
                downloadStatusText: translatedDetail
              }
            }
          };
        });
      } else {
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
                  downloadStatusText: translatedDetail
                }
              }
            };
          });
        }
      }

      // 相容舊版欄位
      set({
        downloadProgress: event.payload.progress,
        downloadStatusText: translatedDetail
      });
    });

    // 遊戲狀態監聽
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

        // 遊戲崩潰處理
        if (isCrash) {
          useAppStore.getState().addNotification({
            type: 'error',
            title: getTranslation('instance.notification.crash.title'),
            message: getTranslation('instance.notification.crash.msg', { exitCode: exitCode !== undefined ? exitCode : -1 })
          });
          useAppStore.getState().setActiveDetailTab('log');
        }
      }
    });

    // 監聽總實例目錄變動
    await listen<void>('instances-changed', () => get().loadInstances());
  },

  // 載入實例列表
  loadInstances: async () => {
    try {
      const list = await instanceService.getInstances();
      set({ instances: list });
      await instanceService.watchInstancesDir().catch(err => {
        console.error('Failed to watch instances directory:', err);
      });
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  },

  // 建立實例
  createInstance: async (id, name, version, modloader, loaderVersion, icon, modrinthProjectId, modrinthVersionId) => {
    try {
      const created = await instanceService.createInstance(
        id,
        name,
        version,
        modloader,
        loaderVersion || "",
        icon || "",
        modrinthProjectId,
        modrinthVersionId
      );
      await get().loadInstances();
      return created;
    } catch (error) {
      console.error('Failed to create instance:', error);
      throw error;
    }
  },

  // 刪除實例
  deleteInstance: async (id) => {
    try {
      await instanceService.deleteInstance(id);
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

  // 更新啟動設定
  updateInstanceSettings: async (id, jvmArgs, maxMemory, javaPath) => {
    try {
      await instanceService.updateInstanceSettings(id, jvmArgs || "", maxMemory || 0, javaPath || null);
      await get().loadInstances();
    } catch (error) {
      console.error('Failed to update instance settings:', error);
      throw error;
    }
  },

  // 更新基礎設定
  updateInstanceConfig: async (id, name, version, modloader, loaderVersion, modrinthProjectId, modrinthVersionId) => {
    try {
      await instanceService.updateInstanceConfig(
        id,
        name,
        version,
        modloader,
        loaderVersion || "",
        modrinthProjectId,
        modrinthVersionId
      );
      await get().loadInstances();
    } catch (error) {
      console.error('Failed to update instance config:', error);
      throw error;
    }
  },

  // 匯入整合包
  importPack: async (instanceId, filePath, selectedMods?: string[]) => {
    set((state) => {
      const s = state.instanceStates[instanceId] || getInitialInstanceState();
      return {
        downloadingInstanceId: instanceId,
        downloadProgress: 0,
        downloadStatusText: getTranslation('modpack.import.status'),
        instanceStates: {
          ...state.instanceStates,
          [instanceId]: {
            ...s,
            isDownloading: true,
            downloadProgress: 0,
            downloadStatusText: getTranslation('modpack.import.status')
          }
        }
      };
    });
    try {
      const blocked = await instanceService.importPack(instanceId, filePath, selectedMods || null);
      await get().loadInstances();
      return blocked || [];
    } catch (error) {
      console.error('Failed to import pack:', error);
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

  // 啟動遊戲
  launchInstance: async (id, accountJson) => {
    // 防止重複啟動
    const current = get().instanceStates[id] || getInitialInstanceState();
    if (current.isLaunching || current.isRunning) return;

    // 設定啟動狀態
    set((state) => {
      const s = state.instanceStates[id] || getInitialInstanceState();
      return {
        launchingInstanceId: id,
        crashedInstanceId: null,
        launchPhase: 'java_check',
        downloadProgress: 0,
        downloadStatusText: getTranslation('instance.launch.initializing'),
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
            downloadStatusText: getTranslation('instance.launch.initializing')
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
      // 初始化後端啟動 Session
      await instanceService.initLaunchSession(id);
      const instance = get().instances.find(i => i.id === id);
      if (!instance) throw new Error(getTranslation('detail.not_found'));

      logInfo(getTranslation('instance.launch.log.preparing', { name: instance.name }));
      
      // 驗證並刷新 Token
      logInfo(getTranslation('instance.launch.log.verifying_ms'));
      const originalAccount = JSON.parse(accountJson);
      const accountStore = useAccountStore.getState();
      let account = accountStore.accounts.find(a => a.id === originalAccount.id);
      
      if (!account) {
        throw new Error(getTranslation('detail.notification.cannot_launch.account_missing'));
      }
      
      const now = Date.now();
      if (account.tokenExpiresAt - now < 10 * 60 * 1000) {
        logInfo(getTranslation('instance.launch.log.refreshing_ms'));
        const refreshed = await accountStore.refreshAccountToken(account.id);
        if (!refreshed) {
          throw new Error(getTranslation('account.err.session_expired'));
        }
        account = refreshed;
        logInfo(getTranslation('instance.launch.log.refresh_success'));
      } else {
        logInfo(getTranslation('instance.launch.log.ms_valid'));
      }
      
      const finalAccountJson = JSON.stringify({
        id: account.id,
        mcId: account.mcId,
        mcAccessToken: account.mcAccessToken
      });

      logInfo(getTranslation('instance.launch.log.version', { version: instance.version }));
      logInfo(`Mod Loader: ${instance.modloader} ${instance.loaderVersion ? `(${instance.loaderVersion})` : ''}`);

      const reqVersion = await instanceService.getRequiredJavaVersion(id);
      let javaPath = '';

      // 準備 Java 環境
      logInfo(getTranslation('instance.launch.log.preparing_java'));

      const customJavaPath = instance.javaPath;
      let useCustomJava = false;

      if (customJavaPath && customJavaPath.trim() !== '') {
        logInfo(getTranslation('instance.launch.log.custom_java_path', { path: customJavaPath }));
        javaPath = customJavaPath;
        useCustomJava = true;
      }

      if (!useCustomJava) {
        logInfo(getTranslation('instance.launch.log.scanning_java', { version: reqVersion }));
        set((state) => {
          const s = state.instanceStates[id] || getInitialInstanceState();
          return {
            downloadStatusText: getTranslation('instance.launch.log.scanning_java_ui'),
            instanceStates: {
              ...state.instanceStates,
              [id]: {
                ...s,
                downloadStatusText: getTranslation('instance.launch.log.scanning_java_ui')
              }
            }
          };
        });
        const javaInstalls = await instanceService.detectJava();

        const exactMatch = javaInstalls.find(j => j.major === reqVersion);
        const foundJava = exactMatch;

        if (foundJava) {
          javaPath = foundJava.path;
          logInfo(getTranslation('instance.launch.log.found_java', { major: foundJava.major, version: foundJava.version, path: foundJava.path }));
          set((state) => {
            const s = state.instanceStates[id] || getInitialInstanceState();
            return {
              downloadStatusText: getTranslation('instance.launch.status.found_java', { version: foundJava.major }),
              instanceStates: {
                ...state.instanceStates,
                [id]: {
                  ...s,
                  downloadStatusText: getTranslation('instance.launch.status.found_java', { version: foundJava.major })
                }
              }
            };
          });
        } else {
          logInfo(getTranslation('instance.launch.log.no_java', { version: reqVersion }));
          set((state) => {
            const s = state.instanceStates[id] || getInitialInstanceState();
            return {
              launchPhase: 'java_download',
              downloadingInstanceId: id,
              downloadStatusText: getTranslation('instance.launch.status.downloading_java', { version: reqVersion }),
              instanceStates: {
                ...state.instanceStates,
                [id]: {
                  ...s,
                  launchPhase: 'java_download',
                  isDownloading: true,
                  downloadStatusText: getTranslation('instance.launch.status.downloading_java', { version: reqVersion })
                }
              }
            };
          });
          javaPath = await instanceService.downloadJava(reqVersion, id);
          logInfo(getTranslation('instance.launch.log.java_download_complete', { version: reqVersion, path: javaPath }));
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

      // 下載與準備遊戲檔案
      logInfo(getTranslation('instance.launch.log.preparing_files'));
      set((state) => {
        const s = state.instanceStates[id] || getInitialInstanceState();
        return {
          launchPhase: 'files',
          downloadingInstanceId: id,
          downloadStatusText: getTranslation('instance.launch.status.preparing_files'),
          instanceStates: {
            ...state.instanceStates,
            [id]: {
              ...s,
              launchPhase: 'files',
              isDownloading: true,
              downloadStatusText: getTranslation('instance.launch.status.preparing_files')
            }
          }
        };
      });
      await instanceService.installInstanceFiles(id, javaPath);
      logInfo(getTranslation('instance.launch.log.files_ready'));
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

      // 啟動遊戲進程
      logInfo(getTranslation('instance.launch.log.assembling_args'));
      set((state) => {
        const s = state.instanceStates[id] || getInitialInstanceState();
        return {
          launchPhase: 'launching',
          downloadStatusText: getTranslation('instance.launch.status.launching'),
          instanceStates: {
            ...state.instanceStates,
            [id]: {
              ...s,
              launchPhase: 'launching',
              downloadStatusText: getTranslation('instance.launch.status.launching')
            }
          }
        };
      });
      await instanceService.launchInstance(id, javaPath, finalAccountJson);
      logInfo(getTranslation('instance.launch.log.launch_sent'));

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
      logInfo(getTranslation('instance.launch.log.launch_failed', { error: errStr }));
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
              downloadStatusText: getTranslation('instance.launch.status.launch_failed', { error: errStr })
            }
          }
        };
      });
      useAppStore.getState().addNotification({
        type: 'error',
        title: getTranslation('detail.notification.cannot_launch.title'),
        message: errStr
      });
      throw error;
    }
  },

  // 儲存實例排序
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
      await instanceService.saveInstanceOrder(order);
    } catch (error) {
      console.error('Failed to save instance order:', error);
    }
  },

  // 監聽目錄變動
  watchInstanceFolders: async (instanceId) => {
    try {
      await instanceService.watchInstanceFolders(instanceId);
    } catch (error) {
      console.error('Failed to watch instance folders:', error);
      throw error;
    }
  },

  // 取消監聽目錄變動
  unwatchInstanceFolders: async () => {
    try {
      await instanceService.unwatchInstanceFolders();
    } catch (error) {
      console.error('Failed to unwatch instance folders:', error);
    }
  },

  // 取消啟動
  cancelLaunch: async (instanceId) => {
    try {
      await instanceService.cancelLaunchSession(instanceId);
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
            downloadStatusText: getTranslation('instance.launch.status.cancelled')
          }
        }
      };
    });
    console.log(`Launch cancelled for instance: ${instanceId}`);
  },

  // 強制結束遊戲
  killGame: async (instanceId) => {
    try {
      await instanceService.killLaunchSession(instanceId);
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
