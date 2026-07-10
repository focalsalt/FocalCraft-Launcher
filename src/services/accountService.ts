import { invoke } from '@tauri-apps/api/core';
import { Account } from '../types';

export const accountService = {
  // 載入帳號，並將頭像 URL 轉換為 minotar.net (免翻牆/快)
  async loadAccounts(): Promise<Account[]> {
    const accountsJson = await invoke<string>('load_accounts');
    const loadedAccounts = JSON.parse(accountsJson) as Account[];
    return loadedAccounts.map(a => ({
      ...a,
      avatarUrl: a.avatarUrl ? a.avatarUrl.replace('mc-heads.net', 'minotar.net') : `https://minotar.net/avatar/${a.id}`
    }));
  },

  // 保存帳號
  async saveAccounts(accounts: Account[]): Promise<void> {
    await invoke('save_accounts', { accountsJson: JSON.stringify(accounts) });
  },

  // 刷新 Minecraft 帳號 Token
  async refreshMinecraftAccount(refreshToken: string): Promise<Account> {
    const refreshed: Account = await invoke('refresh_minecraft_account', { refreshToken });
    return {
      ...refreshed,
      avatarUrl: refreshed.avatarUrl ? refreshed.avatarUrl.replace('mc-heads.net', 'minotar.net') : `https://minotar.net/avatar/${refreshed.id}`
    };
  }
};
