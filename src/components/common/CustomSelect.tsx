import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../../utils/i18n';
import styles from './CustomSelect.module.css';

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  direction?: 'up' | 'down';
}

export function CustomSelect({ value, onChange, options, disabled, placeholder, direction = 'down' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 計算選單定位
  const updateDropdownPos = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (direction === 'up') {
      setDropdownPos({
        top: rect.top - 206, // 200px max-height + 6px gap
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [direction]);

  const handleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updateDropdownPos();
    }
    setIsOpen((prev) => !prev);
  };

  // 點擊外部關閉
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 視窗變動時更新定位
  useEffect(() => {
    if (!isOpen) return;
    function handleUpdate() {
      updateDropdownPos();
    }
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, updateDropdownPos]);

  const selectedOption = options.find((o) => o.value === value);

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: dropdownPos.top,
    left: dropdownPos.left,
    width: dropdownPos.width,
    zIndex: 99999,
    ...(direction === 'up'
      ? { boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.5)' }
      : { boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)' }),
  };

  const { t } = useI18n();

  return (
    <div className={styles.customSelectContainer} ref={containerRef}>
      <button
        type="button"
        className={`${styles.customSelectTrigger} ${disabled ? styles.disabled : ''}`}
        onClick={handleOpen}
        disabled={disabled}
      >
        <div className={styles.triggerContent}>
          {(() => {
            if (!selectedOption) return <span className={styles.placeholderText}>{placeholder || t('common.select_placeholder')}</span>;
            const match = selectedOption.label.match(/^(.*?)\s*\(([^)]+)\)$/);
            if (match) {
              return (
                <div className={styles.labelWrapper}>
                  <div className={styles.mainLabel}>{match[1]}</div>
                  <div className={styles.subLabel}>{match[2]}</div>
                </div>
              );
            }
            return <span>{selectedOption.label}</span>;
          })()}
        </div>
        <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={`${styles.customSelectDropdown} global-scrollbar`}
          style={dropdownStyle}
        >
          {options.map((opt) => {
            const match = opt.label.match(/^(.*?)\s*\(([^)]+)\)$/);
            return (
              <div
                key={opt.value}
                className={`${styles.customSelectOption} ${opt.value === value ? styles.selected : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <div className={styles.optionContent}>
                  {match ? (
                    <>
                      <div className={styles.mainLabel}>{match[1]}</div>
                      <div className={styles.subLabel}>{match[2]}</div>
                    </>
                  ) : (
                    <span>{opt.label}</span>
                  )}
                </div>
                {opt.value === value && <Check size={14} />}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
