import { useState } from 'react';
import { LucideIcon, ImageOff } from 'lucide-react';
import styles from './SafeImage.module.css';

interface SafeImageProps {
  src?: string;
  fallbackIcon?: LucideIcon;
  fallbackEmoji?: string;
  className?: string;
  alt?: string;
}

export function SafeImage({ 
  src, 
  fallbackIcon: FallbackIcon = ImageOff, 
  fallbackEmoji, 
  className = '', 
  alt = '' 
}: SafeImageProps) {
  const [isError, setIsError] = useState(false);

  // 圖片載入失敗或無來源時顯示 Fallback
  if (isError || !src) {
    return (
      <div className={`${styles.fallbackContainer} ${className}`}>
        {fallbackEmoji ? (
          <span className={styles.emoji}>{fallbackEmoji}</span>
        ) : (
          <FallbackIcon className={styles.fallbackIcon} />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setIsError(true)}
    />
  );
}
