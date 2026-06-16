import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Account } from '../types';

interface AccountState {
  accounts: Account[];
  selectedAccountId: string | null;
  isLoading: boolean;
  refreshStatuses: Record<string, 'idle' | 'updating' | 'failed'>;
  loadAccounts: () => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  selectAccount: (id: string) => Promise<void>;
  refreshAccountToken: (id: string) => Promise<Account | null>;
  checkAndRefreshTokens: () => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  isLoading: false,
  refreshStatuses: {},

  // 載入所有帳號
  loadAccounts: async () => {
    set({ isLoading: true });
    try {
      const accountsJson = await invoke<string>('load_accounts');
      const loadedAccounts = JSON.parse(accountsJson) as Account[];
      
      if (loadedAccounts.length > 0) {
        const initialStatuses: Record<string, 'idle' | 'updating' | 'failed'> = {};
        loadedAccounts.forEach(a => {
          initialStatuses[a.id] = 'idle';
        });
        set({ 
          accounts: loadedAccounts,
          selectedAccountId: loadedAccounts[0].id, // 預設選取首位
          refreshStatuses: initialStatuses
        });

        // 自動更新即將過期權杖
        await get().checkAndRefreshTokens();
      } else {
        set({ accounts: [], selectedAccountId: null, refreshStatuses: {} });
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // 新增帳號
  addAccount: async (account) => {
    const { accounts } = get();
    const exists = accounts.some(a => a.id === account.id);
    let newAccounts: Account[];
    if (exists) {
      newAccounts = accounts.map(a => a.id === account.id ? account : a);
    } else {
      newAccounts = [...accounts, account];
    }

    // 置頂新登入帳號
    const targetAccount = newAccounts.find(a => a.id === account.id)!;
    const remaining = newAccounts.filter(a => a.id !== account.id);
    const reorderedAccounts = [targetAccount, ...remaining];

    set(state => ({
      accounts: reorderedAccounts,
      selectedAccountId: account.id,
      refreshStatuses: { ...state.refreshStatuses, [account.id]: 'idle' }
    }));

    try {
      await invoke('save_accounts', { accountsJson: JSON.stringify(reorderedAccounts) });
    } catch (error) {
      console.error('Failed to save accounts after add:', error);
    }
  },

  // 移除帳號
  removeAccount: async (id) => {
    const { accounts, selectedAccountId } = get();
    const newAccounts = accounts.filter(a => a.id !== id);
    let newSelectedId = selectedAccountId;

    if (selectedAccountId === id) {
      newSelectedId = newAccounts.length > 0 ? newAccounts[0].id : null;
    }

    const newStatuses = { ...get().refreshStatuses };
    delete newStatuses[id];

    set({
      accounts: newAccounts,
      selectedAccountId: newSelectedId,
      refreshStatuses: newStatuses
    });

    try {
      await invoke('save_accounts', { accountsJson: JSON.stringify(newAccounts) });
    } catch (error) {
      console.error('Failed to save accounts after remove:', error);
    }
  },

  // 切換目前選取帳號
  selectAccount: async (id) => {
    const { accounts } = get();
    const targetAccount = accounts.find(a => a.id === id);
    if (!targetAccount) return;

    // 置頂已選取帳號
    const remaining = accounts.filter(a => a.id !== id);
    const reorderedAccounts = [targetAccount, ...remaining];

    set({ 
      accounts: reorderedAccounts,
      selectedAccountId: id 
    });

    try {
      await invoke('save_accounts', { accountsJson: JSON.stringify(reorderedAccounts) });
    } catch (error) {
      console.error('Failed to save accounts after select:', error);
    }
  },

  // 重新整理單一帳號的權杖 (支援失敗自動重試)
  refreshAccountToken: async (id) => {
    const { accounts } = get();
    const targetAccount = accounts.find(a => a.id === id);
    if (!targetAccount) return null;

    set(state => ({
      refreshStatuses: { ...state.refreshStatuses, [id]: 'updating' }
    }));

    const maxRetries = 5;
    let attempt = 0;
    let refreshedAccount: Account | null = null;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const refreshed: Account = await invoke('refresh_minecraft_account', { 
          refreshToken: targetAccount.msRefreshToken 
        });
        refreshedAccount = refreshed;
        break; // 成功取得新權杖
      } catch (error) {
        attempt++;
        lastError = error;
        console.warn(`Attempt ${attempt} to refresh token for ${id} failed:`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 延遲後重試
        }
      }
    }

    if (refreshedAccount) {
      const updatedAccounts = get().accounts.map(a => a.id === id ? refreshedAccount! : a);

      set(state => ({
        accounts: updatedAccounts,
        refreshStatuses: { ...state.refreshStatuses, [id]: 'idle' }
      }));
      await invoke('save_accounts', { accountsJson: JSON.stringify(updatedAccounts) });
      return refreshedAccount;
    } else {
      console.error(`Failed to refresh token for account ${id} after ${maxRetries} attempts:`, lastError);
      set(state => ({
        refreshStatuses: { ...state.refreshStatuses, [id]: 'failed' }
      }));
      return null;
    }
  },

  // 檢查並刷新所有即將過期的權杖 (小於 30 分鐘者)
  checkAndRefreshTokens: async () => {
    const { accounts } = get();
    const now = Date.now();
    for (const account of accounts) {
      if (account.tokenExpiresAt - now < 30 * 60 * 1000) {
        console.log(`Token near expiry or expired for ${account.mcId}, auto refreshing...`);
        get().refreshAccountToken(account.id).catch(console.error);
      }
    }
  }
}));
