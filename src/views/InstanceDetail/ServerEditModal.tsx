import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';
import { useI18n } from '../../utils/i18n';
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
  const { t } = useI18n();

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

  // 提交伺服器表單
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ip.trim()) return;
    onSave(name.trim(), ip.trim(), acceptTextures);
  };

  const textureOptions = [
    { value: '0', label: t('tabs.servers.accept_textures.prompt') },
    { value: '1', label: t('tabs.servers.accept_textures.enabled') },
    { value: '2', label: t('tabs.servers.accept_textures.disabled') },
  ];

  return (
    <div className={styles.overlay}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h2>{server ? t('tabs.servers.modal.edit_title') : t('tabs.servers.modal.add_title')}</h2>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        
        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label>{t('tabs.servers.modal.label.name')}</label>
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
            <label>{t('tabs.servers.modal.label.ip')}</label>
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
            <label style={{ marginBottom: '8px', display: 'block' }}>{t('tabs.servers.modal.label.textures')}</label>
            <CustomSelect
              value={String(acceptTextures)}
              onChange={(val) => setAcceptTextures(parseInt(val))}
              options={textureOptions}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={styles.saveBtn} disabled={!name.trim() || !ip.trim()}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
