import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Copy, ExternalLink, Loader2, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { useI18n } from '../../utils/i18n';
import styles from './MicrosoftLoginModal.module.css';

interface MicrosoftLoginModalProps {
  onClose: () => void;
}

type LoginStep = 'idle' | 'fetching_code' | 'waiting_user' | 'verifying_mc' | 'success' | 'error';

export function MicrosoftLoginModal({ onClose }: MicrosoftLoginModalProps) {
  const [step, setStep] = useState<LoginStep>('idle');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const { addAccount } = useAccountStore();
  const { addNotification } = useAppStore();
  const { t } = useI18n();

  const pollingRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  // 執行微軟 Device Flow 登入
  const startLoginFlow = async () => {
    setStep('fetching_code');
    setErrorMsg('');
    try {
      // 取得 Device Code
      const res = await invoke<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
      }>('get_device_code');

      setUserCode(res.user_code);
      setVerificationUri(res.verification_uri);
      setTimeLeft(res.expires_in);
      setStep('waiting_user');

      // 倒數計時
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleError(t('account.login.code_expired'));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 輪詢 Token
      startPolling(res.device_code, res.interval);
    } catch (err) {
      console.error(err);
      handleError(String(err));
    }
  };

  const startPolling = (code: string, intervalSeconds: number) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);

    pollingRef.current = window.setInterval(async () => {
      try {
        const tokenRes = await invoke<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>('poll_device_token', { deviceCode: code });

        // 驗證 MC 帳號
        cleanup();
        setStep('verifying_mc');
        
        const account = await invoke<any>('login_minecraft_with_ms_token', {
          msAccessToken: tokenRes.access_token,
          msRefreshToken: tokenRes.refresh_token
        });

        // 儲存帳號
        await addAccount(account);
        setStep('success');
        addNotification({
          type: 'success',
          title: t('account.notification.login_success.title'),
          message: t('account.login.welcome_back', { name: account.mcId }),
          duration: 4000
        });

        // 自動關閉
        setTimeout(() => {
          onClose();
        }, 1500);

      } catch (err: any) {
        const errMsg = String(err);
        if (errMsg === 'authorization_pending') {
          // 等待使用者
          return;
        } else if (errMsg === 'slow_down') {
          // 限制頻率
          return;
        } else if (errMsg === 'expired_token') {
          handleError(t('account.login.timeout'));
        } else if (errMsg === 'XSTS_NO_XBOX_ACCOUNT') {
          handleError(t('account.login.no_xbox_account'));
        } else if (errMsg === 'XSTS_CHILD_ACCOUNT') {
          handleError(t('account.login.child_account'));
        } else if (errMsg === 'NO_MINECRAFT_LICENSE') {
          handleError(t('account.login.no_license'));
        } else {
          handleError(t('account.login.verification_failed', { error: errMsg }));
        }
      }
    }, intervalSeconds * 1000);
  };

  const handleError = (msg: string) => {
    cleanup();
    setErrorMsg(msg);
    setStep('error');
    addNotification({
      type: 'error',
      title: t('account.notification.login_failed.title'),
      message: msg.length > 55 ? t('account.login.process_error') : msg,
      duration: 5000
    });
  };

  const cleanup = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleOpenBrowser = async () => {
    try {
      await invoke('open_in_browser', { url: verificationUri });
    } catch (err) {
      console.error('Failed to open browser:', err);
      window.open(verificationUri, '_blank');
    }
  };


  useEffect(() => {
    startLoginFlow();
    return () => cleanup();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose} disabled={step === 'verifying_mc'}>
          <X size={18} />
        </button>

        {step === 'fetching_code' && (
          <div className={styles.content}>
            <Loader2 className={`${styles.spinner} ${styles.primarySpinner}`} size={48} />
            <h2>{t('account.login.fetching_code')}</h2>
            <p>{t('account.login.connecting_ms')}</p>
          </div>
        )}

        {step === 'waiting_user' && (
          <div className={styles.content}>
            <h2>{t('account.login.title')}</h2>
            <p className={styles.subtitle}>{t('account.login.subtitle')}</p>
            
            <div className={styles.codeContainer}>
              <div className={styles.userCode}>{userCode}</div>
              <button className={styles.copyBtn} onClick={handleCopyCode}>
                <Copy size={16} />
                <span>{copied ? t('account.login.copied') : t('account.login.copy_code')}</span>
              </button>
            </div>

            <div className={styles.stepsInfo}>
              <div className={styles.stepRow}>
                <span className={styles.stepNum}>1</span>
                <span>{t('account.login.step1')}<a href="#" onClick={(e) => { e.preventDefault(); handleOpenBrowser(); }} className={styles.link}>{verificationUri}</a></span>
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepNum}>2</span>
                <span>{t('account.login.step2', { code: userCode })}</span>
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepNum}>3</span>
                <span>{t('account.login.step3')}</span>
              </div>
            </div>

            <button className={styles.actionBtn} onClick={handleOpenBrowser}>
              <span>{t('account.login.btn.open_browser')}</span>
              <ExternalLink size={16} />
            </button>

            <div className={styles.countdown}>
              {t('account.login.remaining_time')}<span className={styles.timer}>{formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        {step === 'verifying_mc' && (
          <div className={styles.content}>
            <Loader2 className={`${styles.spinner} ${styles.accentSpinner}`} size={48} />
            <h2>{t('account.login.verifying')}</h2>
            <p>{t('account.login.fetching_tokens')}</p>
          </div>
        )}

        {step === 'success' && (
          <div className={styles.content}>
            <CheckCircle className={styles.successIcon} size={54} />
            <h2 className={styles.successTitle}>{t('account.login.success_title')}</h2>
            <p>{t('account.login.success_desc')}</p>
          </div>
        )}

        {step === 'error' && (
          <div className={styles.content}>
            {errorMsg.includes('NO_MINECRAFT_LICENSE') ? (
              <ShieldAlert className={styles.errorIcon} size={54} />
            ) : (
              <AlertCircle className={styles.errorIcon} size={54} />
            )}
            <h2>{t('account.login.failed_title')}</h2>
            <p className={styles.errorDesc}>{errorMsg}</p>
            
            <div className={styles.btnGroup}>
              <button className={styles.secondaryBtn} onClick={startLoginFlow}>
                {t('account.login.btn.retry')}
              </button>
              <button className={styles.primaryBtn} onClick={onClose}>
                {t('account.login.btn.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
