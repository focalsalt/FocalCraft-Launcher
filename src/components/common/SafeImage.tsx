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

  // If there's an error, or the src is completely empty
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

