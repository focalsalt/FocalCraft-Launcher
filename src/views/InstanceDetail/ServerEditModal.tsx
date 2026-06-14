import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './ServerEditModal.module.css';

interface Server {
  name: string;
  ip: string;
  acceptTextures?: number;
}

interface Props {
  isOpen: boolean;
  server: Server | null;
  onSave: (name: string, ip: string, acceptTextures: number) => void;
  onCancel: () => void;
}

export function ServerEditModal({ isOpen, server, onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [acceptTextures, setAcceptTextures] = useState(0);

  useEffect(() => {
    if (server) {
      setName(server.name);
      setIp(server.ip);
      setAcceptTextures(server.acceptTextures !== undefined ? server.acceptTextures : 0);
    } else {
      setName('');
      setIp('');
      setAcceptTextures(0);
    }
  }, [server, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ip.trim()) return;
    onSave(name.trim(), ip.trim(), acceptTextures);
  };

  return (
    <div className={styles.overlay}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h2>{server ? '編輯伺服器' : '新增伺服器'}</h2>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        
        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label>伺服器名稱</label>
            <input 
              type="text" 
              className={styles.input} 
              placeholder="例如：Hypixel" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>伺服器位址 (IP / 域名)</label>
            <input 
              type="text" 
              className={styles.input} 
              placeholder="例如：mc.hypixel.net" 
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>伺服器資源包設定</label>
            <select 
              className={styles.select} 
              value={acceptTextures}
              onChange={(e) => setAcceptTextures(parseInt(e.target.value))}
            >
              <option value={0}>詢問 (Prompt)</option>
              <option value={1}>啟用 (Enabled)</option>
              <option value={2}>停用 (Disabled)</option>
            </select>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            取消
          </button>
          <button type="submit" className={styles.saveBtn} disabled={!name.trim() || !ip.trim()}>
            儲存
          </button>
        </div>
      </form>
    </div>
  );
}
