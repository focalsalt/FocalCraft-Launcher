import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check } from 'lucide-react';
import { useI18n } from '../../utils/i18n';
import styles from './CustomMultiSelect.module.css';

export interface CustomMultiSelectOption {
  value: string;
  label: string;
}

export interface CustomMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: CustomMultiSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  direction?: 'up' | 'down';
}

export function CustomMultiSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  direction = 'down',
}: CustomMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  // 計算選項下拉清單的絕對定位，避免被父容器 overflow: hidden 裁切
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

  // 點擊外部區域以關閉下拉式選單
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

  // 視窗大小改變或滾動時更新定位
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

  const handleToggleOption = (optValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (value.includes(optValue)) {
      // 至少保留一個被選取，防呆處理
      if (value.length === 1) return;
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

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

  return (
    <div className={styles.customSelectContainer} ref={containerRef}>
      <div
        className={`${styles.customSelectTrigger} ${disabled ? styles.disabled : ''} ${isOpen ? styles.active : ''}`}
        onClick={handleOpen}
      >
        <div className={styles.chipsContainer}>
          {value.length === 0 ? (
            <span className={styles.placeholder}>
              {placeholder || t('common.select_placeholder')}
            </span>
          ) : (
            value.map((val) => {
              const matched = options.find((o) => o.value === val);
              return (
                <div key={val} className={styles.chip} onClick={(e) => e.stopPropagation()}>
                  <span className={styles.chipLabel}>{matched ? matched.label : val}</span>
                  {!disabled && (
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => {
                        if (value.length > 1) {
                          onChange(value.filter((v) => v !== val));
                        }
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className={styles.triggerIcons}>
          <ChevronDown
            size={16}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              color: 'var(--text-muted)',
            }}
          />
        </div>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`${styles.customSelectDropdown} global-scrollbar`}
            style={dropdownStyle}
          >
            {options.map((opt) => {
              const isSelected = value.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  className={`${styles.customSelectOption} ${isSelected ? styles.selected : ''}`}
                  onClick={(e) => handleToggleOption(opt.value, e)}
                >
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {isSelected && <Check size={14} className={styles.checkIcon} />}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
