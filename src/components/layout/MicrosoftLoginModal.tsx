import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Copy, ExternalLink, Loader2, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
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

  const pollingRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  // 開始 Device Flow 登入流程
  const startLoginFlow = async () => {
    setStep('fetching_code');
    setErrorMsg('');
    try {
      // 1. 取得 Device Code
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

      // 2. 開啟倒數計時
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleError('驗證碼已過期，請重新嘗試。');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 3. 開始輪詢 Token
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

        // 輪詢成功，使用者已登入微軟帳號，開始驗證 Minecraft
        cleanup();
        setStep('verifying_mc');
        
        const account = await invoke<any>('login_minecraft_with_ms_token', {
          msAccessToken: tokenRes.access_token,
          msRefreshToken: tokenRes.refresh_token
        });

        // 登入 Minecraft 成功，寫入 store
        await addAccount(account);
        setStep('success');
        addNotification({
          type: 'success',
          title: '登入成功',
          message: `歡迎回來，${account.mcId}！`,
          duration: 4000
        });

        // 1.5 秒後自動關閉 Modal
        setTimeout(() => {
          onClose();
        }, 1500);

      } catch (err: any) {
        const errMsg = String(err);
        if (errMsg === 'authorization_pending') {
          // 繼續等待使用者操作
          return;
        } else if (errMsg === 'slow_down') {
          // 微軟要求放慢速度
          return;
        } else if (errMsg === 'expired_token') {
          handleError('登入超時，驗證碼已失效，請重新發送。');
        } else if (errMsg === 'XSTS_NO_XBOX_ACCOUNT') {
          handleError('登入失敗：您的微軟帳號尚未註冊 Xbox Live 帳號，請先前往 Xbox 官網註冊後再登入。');
        } else if (errMsg === 'XSTS_CHILD_ACCOUNT') {
          handleError('登入失敗：此微軟帳號受家長監護限制，無法登入 Xbox Live 服務。');
        } else if (errMsg === 'NO_MINECRAFT_LICENSE') {
          handleError('登入失敗：此帳號未購買 Minecraft 遊戲。請使用擁有正版遊戲的帳號。');
        } else {
          handleError(`驗證失敗：${errMsg}`);
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
      title: '登入失敗',
      message: msg.length > 55 ? '驗證過程中發生錯誤。' : msg,
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
            <h2>正在獲取驗證代碼...</h2>
            <p>與微軟伺服器安全連線中，請稍候</p>
          </div>
        )}

        {step === 'waiting_user' && (
          <div className={styles.content}>
            <h2>微軟帳號安全登入</h2>
            <p className={styles.subtitle}>請在您的瀏覽器中輸入下方代碼完成驗證</p>
            
            <div className={styles.codeContainer}>
              <div className={styles.userCode}>{userCode}</div>
              <button className={styles.copyBtn} onClick={handleCopyCode}>
                <Copy size={16} />
                <span>{copied ? '已複製' : '複製代碼'}</span>
              </button>
            </div>

            <div className={styles.stepsInfo}>
              <div className={styles.stepRow}>
                <span className={styles.stepNum}>1</span>
                <span>打開驗證網址：<a href="#" onClick={(e) => { e.preventDefault(); handleOpenBrowser(); }} className={styles.link}>{verificationUri}</a></span>
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepNum}>2</span>
                <span>輸入上方顯示的 {userCode} 驗證碼</span>
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepNum}>3</span>
                <span>在微軟網頁完成登入後回到此啟動器</span>
              </div>
            </div>

            <button className={styles.actionBtn} onClick={handleOpenBrowser}>
              <span>開啟驗證網頁</span>
              <ExternalLink size={16} />
            </button>

            <div className={styles.countdown}>
              代碼有效剩餘時間：<span className={styles.timer}>{formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        {step === 'verifying_mc' && (
          <div className={styles.content}>
            <Loader2 className={`${styles.spinner} ${styles.accentSpinner}`} size={48} />
            <h2>正在驗證 Minecraft 帳號...</h2>
            <p>取得 Xbox Live 與 Minecraft Services 憑證中</p>
          </div>
        )}

        {step === 'success' && (
          <div className={styles.content}>
            <CheckCircle className={styles.successIcon} size={54} />
            <h2 className={styles.successTitle}>登入成功！</h2>
            <p>已成功連結您的 Minecraft 角色，即將關閉視窗...</p>
          </div>
        )}

        {step === 'error' && (
          <div className={styles.content}>
            {errorMsg.includes('NO_MINECRAFT_LICENSE') ? (
              <ShieldAlert className={styles.errorIcon} size={54} />
            ) : (
              <AlertCircle className={styles.errorIcon} size={54} />
            )}
            <h2>登入失敗</h2>
            <p className={styles.errorDesc}>{errorMsg}</p>
            
            <div className={styles.btnGroup}>
              <button className={styles.secondaryBtn} onClick={startLoginFlow}>
                重新嘗試
              </button>
              <button className={styles.primaryBtn} onClick={onClose}>
                關閉視窗
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
