import { useState, useRef, useEffect } from 'react';
import { useAccountStore } from '../../store/accountStore';
import { ChevronDown, ChevronUp, Plus, LogOut, Loader2, AlertCircle } from 'lucide-react';
import styles from './AccountDropdown.module.css';
import { MicrosoftLoginModal } from './MicrosoftLoginModal';
import { Account } from '../../types';
import { CustomConfirmModal } from '../common/CustomConfirmModal';
import { useI18n } from '../../utils/i18n';

export function AccountDropdown() {
  const { t } = useI18n();
  const { accounts, selectedAccountId, selectAccount, removeAccount, refreshStatuses } = useAccountStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
  const [avatarLoadErrors, setAvatarLoadErrors] = useState<Record<string, boolean>>({});

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const unselectedAccounts = accounts.filter(a => a.id !== selectedAccountId);

  const renderAccountStatus = (account: Account) => {
    const status = refreshStatuses[account.id] || 'idle';
    const isExpired = account.tokenExpiresAt < Date.now();

    if (status === 'updating') {
      return (
        <div className={`${styles.statusWrapper} ${styles.updating}`}>
          <Loader2 className={`${styles.statusIcon} ${styles.spin}`} size={12} />
          <span>{t('account.dropdown.verifying')}</span>
        </div>
      );
    }

    if (status === 'failed' || isExpired) {
      return (
        <div className={`${styles.statusWrapper} ${styles.failed}`}>
          <AlertCircle className={styles.statusIcon} size={12} />
          <span>{t('account.dropdown.expired')}</span>
        </div>
      );
    }

    return (
      <div className={`${styles.statusWrapper} ${styles.valid}`}>
        <span className={styles.onlineDot}>●</span>
        <span>{t('account.dropdown.online')}</span>
      </div>
    );
  };

  // 點擊外部關閉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddAccount = () => {
    setIsLoginModalOpen(true);
    setIsOpen(false);
  };

  const handleLogoutClick = () => {
    setIsConfirmLogoutOpen(true);
    setIsOpen(false);
  };

  const handleConfirmLogout = () => {
    if (selectedAccountId) {
      removeAccount(selectedAccountId);
    }
    setIsConfirmLogoutOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.trigger} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.avatar}>
          {selectedAccount?.avatarUrl && !avatarLoadErrors[selectedAccount.id] ? (
            <img
              src={selectedAccount.avatarUrl}
              alt="Avatar"
              onError={() => setAvatarLoadErrors(prev => ({ ...prev, [selectedAccount.id]: true }))}
            />
          ) : (
            <img src="/Offline_Avatar.png" alt="Avatar" />
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>
            {selectedAccount ? selectedAccount.mcId : t('account.dropdown.not_logged_in')}
          </div>
          {selectedAccount ? (
            renderAccountStatus(selectedAccount)
          ) : (
            <div className={`${styles.statusWrapper} ${styles.empty}`}>
              <span>{t('account.dropdown.no_active_account')}</span>
            </div>
          )}
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {unselectedAccounts.length > 0 && (
            <>
              {unselectedAccounts.map(account => (
                <button
                  key={account.id}
                  className={styles.menuItem}
                  onClick={() => {
                    selectAccount(account.id);
                    setIsOpen(false);
                  }}
                >
                  <div className={styles.otherAccount}>
                    <div className={`${styles.avatar} ${styles.smallAvatar}`}>
                      {account.avatarUrl && !avatarLoadErrors[account.id] ? (
                        <img
                          src={account.avatarUrl}
                          alt="Avatar"
                          onError={() => setAvatarLoadErrors(prev => ({ ...prev, [account.id]: true }))}
                        />
                      ) : (
                        <img src="/Offline_Avatar.png" alt="Avatar" />
                      )}
                    </div>
                    <div className={styles.otherAccountInfo}>
                      <span className={styles.otherAccountName}>{account.mcId}</span>
                      {renderAccountStatus(account)}
                    </div>
                  </div>
                </button>
              ))}
              <div className={styles.divider} />
            </>
          )}

          <button className={styles.menuItem} onClick={handleAddAccount}>
            <Plus size={16} />
            <span>{t('account.dropdown.add_account')}</span>
          </button>

          {selectedAccount && (
            <button className={`${styles.menuItem} ${styles.dangerItem}`} onClick={handleLogoutClick}>
              <LogOut size={16} />
              <span>{t('account.dropdown.logout_btn')}</span>
            </button>
          )}
        </div>
      )}
      {isLoginModalOpen && (
        <MicrosoftLoginModal onClose={() => setIsLoginModalOpen(false)} />
      )}

      <CustomConfirmModal
        isOpen={isConfirmLogoutOpen}
        title={t('account.dropdown.logout_title')}
        message={t('account.dropdown.logout_confirm', { name: selectedAccount?.mcId || '' })}
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsConfirmLogoutOpen(false)}
      />
    </div>
  );
}
