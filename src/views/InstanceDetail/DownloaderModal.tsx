import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../utils/i18n';
import { ModrinthDownloadModal } from './ModrinthDownloadModal';
import { CurseForgeDownloadModal } from './CurseForgeDownloadModal';
import styles from './DownloaderModal.module.css';

interface Props {
  isOpen: boolean;
  instanceId: string;
  projectType: 'mod' | 'resourcepack' | 'shader' | 'datapack';
  gameVersion: string;
  loader: string;
  datapackWorldFolder?: string;
  onDownloadComplete: () => void;
  onClose: () => void;
}

export interface HeaderState {
  isSelectingConfirm: boolean;
  isManualMode: boolean;
  confirmModsCount: number;
  confirmedSelectionSize: number;
}

export function DownloaderModal({
  isOpen,
  instanceId,
  projectType,
  gameVersion,
  loader,
  datapackWorldFolder,
  onDownloadComplete,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [platform, setPlatform] = useState<'modrinth' | 'curseforge'>('modrinth');
  const [headerState, setHeaderState] = useState<HeaderState>({
    isSelectingConfirm: false,
    isManualMode: false,
    confirmModsCount: 0,
    confirmedSelectionSize: 0,
  });

  // Reset states on reopen
  useEffect(() => {
    if (isOpen) {
      setPlatform('modrinth');
      setHeaderState({
        isSelectingConfirm: false,
        isManualMode: false,
        confirmModsCount: 0,
        confirmedSelectionSize: 0,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showTabs = !headerState.isSelectingConfirm && !headerState.isManualMode;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          {showTabs ? (
            <div className={styles.platformTabs}>
              <button
                className={`${styles.platformTab} ${platform === 'modrinth' ? styles.active : ''}`}
                onClick={() => setPlatform('modrinth')}
                type="button"
              >
                Modrinth
              </button>
              <button
                className={`${styles.platformTab} ${platform === 'curseforge' ? styles.active : ''}`}
                onClick={() => setPlatform('curseforge')}
                type="button"
              >
                CurseForge
              </button>
            </div>
          ) : headerState.isManualMode ? (
            <div className={styles.headerTitleContainer}>
              <AlertTriangle className={styles.warningIcon} size={18} />
              <h2 className={styles.headerTitle}>
                {t('downloader.manual_mode_title')}
              </h2>
            </div>
          ) : (
            <h2 className={styles.headerTitle}>
              {t('downloader.confirm_title', {
                confirmed: headerState.confirmedSelectionSize,
                total: headerState.confirmModsCount,
              })}
            </h2>
          )}
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {platform === 'modrinth' ? (
            <ModrinthDownloadModal
              isOpen={isOpen}
              instanceId={instanceId}
              projectType={projectType}
              gameVersion={gameVersion}
              loader={loader}
              datapackWorldFolder={datapackWorldFolder}
              onDownloadComplete={onDownloadComplete}
              onClose={onClose}
              onHeaderStateChange={setHeaderState}
            />
          ) : (
            <CurseForgeDownloadModal
              isOpen={isOpen}
              instanceId={instanceId}
              projectType={projectType}
              gameVersion={gameVersion}
              loader={loader}
              datapackWorldFolder={datapackWorldFolder}
              onDownloadComplete={onDownloadComplete}
              onClose={onClose}
              onHeaderStateChange={setHeaderState}
            />
          )}
        </div>
      </div>
    </div>
  );
}
