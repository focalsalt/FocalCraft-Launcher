import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const dropdownStyle = direction === 'up'
    ? { bottom: 'calc(100% + 6px)', top: 'auto', boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.5)' }
    : { top: 'calc(100% + 6px)', bottom: 'auto' };

  return (
    <div className={styles.customSelectContainer} ref={containerRef}>
      <button
        type="button"
        className={`${styles.customSelectTrigger} ${disabled ? styles.disabled : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span>{selectedOption ? selectedOption.label : (placeholder || '請選擇...')}</span>
        <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {isOpen && (
        <div className={`${styles.customSelectDropdown} global-scrollbar`} style={dropdownStyle}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.customSelectOption} ${opt.value === value ? styles.selected : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={14} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
