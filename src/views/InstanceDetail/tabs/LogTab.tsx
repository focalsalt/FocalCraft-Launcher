import React, { useState } from 'react';
import { Loader, AlertTriangle, Copy, Trash2, Check } from 'lucide-react';
import { useI18n } from '../../../utils/i18n';
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
  const { t } = useI18n();
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
      {/* 日誌操作工具列 */}
      <div className={styles.logToolbar}>
        {isRunning ? (
          <div className={styles.logStatusBar}>
            <Loader className="animate-spin" size={14} />
            <span>{t('tabs.log.status.running')}</span>
          </div>
        ) : (
          <div />
        )}
        <div className={styles.logActions}>
          <button
            className={`${styles.logActionBtn} ${copySuccess ? styles.logActionSuccess : ''}`}
            onClick={handleCopyLogs}
            title={t('tabs.log.btn.copy')}
            disabled={logs.length === 0}
          >
            {copySuccess ? <Check size={14} /> : <Copy size={14} />}
            <span>{copySuccess ? t('tabs.log.btn.copied') : t('tabs.log.btn.copy')}</span>
          </button>
          <button
            className={`${styles.logActionBtn} ${styles.logActionDanger}`}
            onClick={onClearLogs}
            title={t('tabs.log.btn.clear')}
            disabled={logs.length === 0}
          >
            <Trash2 size={14} />
            <span>{t('tabs.log.btn.clear')}</span>
          </button>
        </div>
      </div>

      <div className={`${styles.logConsole} global-scrollbar`} ref={logConsoleRef}>
        {logs.length > 0 ? (
          logs.map((line, index) => (
            <div key={index} className={styles.logLine}>{line}</div>
          ))
        ) : (
          <div className={styles.logEmpty}>{t('tabs.log.empty')}</div>
        )}
      </div>
      {isCrashed && (
        <div className={styles.crashBanner}>
          <AlertTriangle size={18} />
          <div>
            <strong>{t('tabs.log.crash_title')}</strong>
            <span>{t('tabs.log.crash_desc')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
