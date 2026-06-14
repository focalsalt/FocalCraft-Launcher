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
          selectedAccountId: loadedAccounts[0].id, // 預設選取第一個
          refreshStatuses: initialStatuses
        });

        // 檢查並自動刷新所有快過期的帳號
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

  addAccount: async (account) => {
    const { accounts } = get();
    // 避免重複加入同一個 UUID 帳號
    const exists = accounts.some(a => a.id === account.id);
    let newAccounts: Account[];
    if (exists) {
      newAccounts = accounts.map(a => a.id === account.id ? account : a);
    } else {
      newAccounts = [...accounts, account];
    }

    // 新增帳號時，自動排在第一位（變成預選帳號）
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

  selectAccount: async (id) => {
    const { accounts } = get();
    const targetAccount = accounts.find(a => a.id === id);
    if (!targetAccount) return;

    // 將選取的帳號移至陣列首位，以方便預設加載
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
        break; // Success!
      } catch (error) {
        attempt++;
        lastError = error;
        console.warn(`Attempt ${attempt} to refresh token for ${id} failed:`, error);
        if (attempt < maxRetries) {
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
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

  checkAndRefreshTokens: async () => {
    const { accounts } = get();
    const now = Date.now();
    for (const account of accounts) {
      // 如果 token 將在 30 分鐘內過期，或已經過期，自動刷新
      if (account.tokenExpiresAt - now < 30 * 60 * 1000) {
        console.log(`Token near expiry or expired for ${account.mcId}, auto refreshing...`);
        get().refreshAccountToken(account.id).catch(console.error);
      }
    }
  }
}));
