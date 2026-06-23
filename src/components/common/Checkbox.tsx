import React from 'react';
import { Square, CheckSquare, MinusSquare } from 'lucide-react';
import styles from './Checkbox.module.css';

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string | React.ReactNode;
  className?: string;
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  label,
  className = '',
}: CheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  return (
    <div
      className={`${styles.checkboxContainer} ${disabled ? styles.disabled : ''} ${className}`}
      onClick={handleClick}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (!disabled && onChange) onChange(!checked);
        }
      }}
    >
      <div className={styles.checkboxIcon}>
        {checked ? (
          <CheckSquare size={16} className={styles.checkedIcon} />
        ) : indeterminate ? (
          <MinusSquare size={16} className={styles.indeterminateIcon} />
        ) : (
          <Square size={16} className={styles.uncheckedIcon} />
        )}
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
