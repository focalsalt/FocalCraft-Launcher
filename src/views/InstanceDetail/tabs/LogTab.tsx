import React, { useState } from 'react';
import { Loader, AlertTriangle, Copy, Trash2, Check } from 'lucide-react';
import styles from '../InstanceDetail.module.css';

interface LogTabProps {
  logs: string[];
  logConsoleRef: React.RefObject<HTMLDivElement | null>;
  instanceId: string;
  runningInstanceId: string | null;
  crashedInstanceId: string | null;
  onClearLogs?: () => void;
}

export function LogTab({
  logs,
  logConsoleRef,
  instanceId,
  runningInstanceId,
  crashedInstanceId,
  onClearLogs,
}: LogTabProps) {
  const isRunning = runningInstanceId === instanceId;
  const isCrashed = crashedInstanceId === instanceId;
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyLogs = async () => {
    if (logs.length === 0) return;
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = logs.join('\n');
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className={styles.tabContainer}>
      {/* Log action toolbar */}
      <div className={styles.logToolbar}>
        {isRunning ? (
          <div className={styles.logStatusBar}>
            <Loader className="animate-spin" size={14} />
            <span>遊戲執行中，正在即時串流輸出日誌...</span>
          </div>
        ) : (
          <div />
        )}
        <div className={styles.logActions}>
          <button
            className={`${styles.logActionBtn} ${copySuccess ? styles.logActionSuccess : ''}`}
            onClick={handleCopyLogs}
            title="複製日誌"
            disabled={logs.length === 0}
          >
            {copySuccess ? <Check size={14} /> : <Copy size={14} />}
            <span>{copySuccess ? '已複製！' : '複製日誌'}</span>
          </button>
          <button
            className={`${styles.logActionBtn} ${styles.logActionDanger}`}
            onClick={onClearLogs}
            title="清除日誌"
            disabled={logs.length === 0}
          >
            <Trash2 size={14} />
            <span>清除日誌</span>
          </button>
        </div>
      </div>

      <div className={`${styles.logConsole} global-scrollbar`} ref={logConsoleRef}>
        {logs.length > 0 ? (
          logs.map((line, index) => (
            <div key={index} className={styles.logLine}>{line}</div>
          ))
        ) : (
          <div className={styles.logEmpty}>目前無遊戲執行日誌紀錄。點選「啟動遊戲」後，控制台輸出將在此即時呈現。</div>
        )}
      </div>
      {isCrashed && (
        <div className={styles.crashBanner}>
          <AlertTriangle size={18} />
          <div>
            <strong>遊戲異常崩潰退出！</strong>
            <span>請檢查下方日誌內容，找出 Mod 衝突或設定錯誤原因。</span>
          </div>
        </div>
      )}
    </div>
  );
}
