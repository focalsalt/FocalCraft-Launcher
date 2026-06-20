import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '../../utils/i18n';
import styles from './CustomColorPicker.module.css';

interface CustomColorPickerProps {
  value: string | null;
  onChange: (val: string | null) => void;
}

const PRESET_COLORS = [
  { hex: '#3C8527', name: 'Green' },   // Minecraft Green
  { hex: '#2EA0D8', name: 'Blue' },    // Ocean Blue
  { hex: '#9C27B0', name: 'Purple' },  // Royal Purple
  { hex: '#D8A32E', name: 'Orange' },  // Sunset Orange
  { hex: '#D83030', name: 'Red' },     // Lava Red
  { hex: '#00BCD4', name: 'Cyan' }     // Ender Cyan
];

export function CustomColorPicker({ value, onChange }: CustomColorPickerProps) {
  const { t } = useI18n();
  const activeColor = value || '#3C8527';
  const isDefaultColor = !value || value.toUpperCase() === '#3C8527';

  // HSL state
  const [hsl, setHsl] = useState({ h: 107, s: 55, l: 34 });
  // RGB state
  const [rgb, setRgb] = useState({ r: 60, g: 133, b: 39 });
  // Mode state
  const [mode, setMode] = useState<'hsl' | 'rgb'>('hsl');
  const [hexInputText, setHexInputText] = useState(activeColor);

  // Sync internal states when value changes from parent
  useEffect(() => {
    if (/^#[0-9A-Fa-f]{6}$/.test(activeColor)) {
      const convertedHsl = hexToHsl(activeColor);
      setHsl(convertedHsl);
      const convertedRgb = hexToRgb(activeColor);
      if (convertedRgb) {
        setRgb(convertedRgb);
      }
      setHexInputText(activeColor);
    }
  }, [value]);

  const updateColorFromHsl = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l);
    setHexInputText(hex);
    onChange(hex);
  };

  const updateColorFromRgb = (r: number, g: number, b: number) => {
    const hex = rgbToHex(r, g, b);
    setHexInputText(hex);
    onChange(hex);
  };

  const handleHueChange = (val: number) => {
    const newHsl = { ...hsl, h: val };
    setHsl(newHsl);
    updateColorFromHsl(newHsl.h, newHsl.s, newHsl.l);
  };

  const handleSatChange = (val: number) => {
    const newHsl = { ...hsl, s: val };
    setHsl(newHsl);
    updateColorFromHsl(newHsl.h, newHsl.s, newHsl.l);
  };

  const handleLightChange = (val: number) => {
    const newHsl = { ...hsl, l: val };
    setHsl(newHsl);
    updateColorFromHsl(newHsl.h, newHsl.s, newHsl.l);
  };

  const handleRedChange = (val: number) => {
    const newRgb = { ...rgb, r: val };
    setRgb(newRgb);
    updateColorFromRgb(newRgb.r, newRgb.g, newRgb.b);
  };

  const handleGreenChange = (val: number) => {
    const newRgb = { ...rgb, g: val };
    setRgb(newRgb);
    updateColorFromRgb(newRgb.r, newRgb.g, newRgb.b);
  };

  const handleBlueChange = (val: number) => {
    const newRgb = { ...rgb, b: val };
    setRgb(newRgb);
    updateColorFromRgb(newRgb.r, newRgb.g, newRgb.b);
  };

  const handleHexInputChange = (text: string) => {
    setHexInputText(text);
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      onChange(text);
    }
  };

  const handlePresetSelect = (hex: string) => {
    onChange(hex);
  };

  const handleReset = () => {
    onChange(null);
  };

  // Dynamic gradient tracks for HSL
  const satTrackBg = `linear-gradient(to right, hsl(${hsl.h}, 0%, ${hsl.l}%), hsl(${hsl.h}, 100%, ${hsl.l}%))`;
  const lightTrackBg = `linear-gradient(to right, #000000 0%, hsl(${hsl.h}, ${hsl.s}%, 50%) 50%, #ffffff 100%)`;

  // Dynamic gradient tracks for RGB
  const redTrackBg = `linear-gradient(to right, rgb(0, ${rgb.g}, ${rgb.b}), rgb(255, ${rgb.g}, ${rgb.b}))`;
  const greenTrackBg = `linear-gradient(to right, rgb(${rgb.r}, 0, ${rgb.b}), rgb(${rgb.r}, 255, ${rgb.b}))`;
  const blueTrackBg = `linear-gradient(to right, rgb(${rgb.r}, ${rgb.g}, 0), rgb(${rgb.r}, ${rgb.g}, 255))`;

  return (
    <div className={styles.container}>
      {/* 預設配色 */}
      <div className={styles.section}>
        <div className={styles.label}>{t('settings.theme.presets')}</div>
        <div className={styles.presetsRow}>
          {PRESET_COLORS.map((preset) => {
            const isActive = activeColor.toUpperCase() === preset.hex.toUpperCase();
            return (
              <button
                key={preset.hex}
                className={`${styles.presetBtn} ${isActive ? styles.presetBtnActive : ''}`}
                style={{ backgroundColor: preset.hex }}
                onClick={() => handlePresetSelect(preset.hex)}
                title={preset.name}
              >
                {isActive && <Check className={styles.presetCheckmark} size={14} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 色彩調整滑桿 */}
      <div className={styles.section}>
        <div className={styles.label}>
          <span>{t('settings.theme.custom_adjust')}</span>
          <div className={styles.modeToggleGroup}>
            <button
              className={`${styles.modeToggleBtn} ${mode === 'hsl' ? styles.modeToggleBtnActive : ''}`}
              onClick={() => setMode('hsl')}
            >
              HSL
            </button>
            <button
              className={`${styles.modeToggleBtn} ${mode === 'rgb' ? styles.modeToggleBtnActive : ''}`}
              onClick={() => setMode('rgb')}
            >
              RGB
            </button>
          </div>
        </div>
        <div className={styles.sliderGroup}>
          {mode === 'hsl' ? (
            <>
              {/* Hue Slider */}
              <div className={styles.sliderRow}>
                <div className={styles.label}>
                  <span>{t('settings.theme.hue')}</span>
                  <span className={styles.valueSpan}>{hsl.h}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hsl.h}
                  onChange={(e) => handleHueChange(parseInt(e.target.value))}
                  className={`${styles.slider} ${styles.hueTrack}`}
                />
              </div>

              {/* Saturation Slider */}
              <div className={styles.sliderRow}>
                <div className={styles.label}>
                  <span>{t('settings.theme.saturation')}</span>
                  <span className={styles.valueSpan}>{hsl.s}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hsl.s}
                  onChange={(e) => handleSatChange(parseInt(e.target.value))}
                  className={styles.slider}
                  style={{ background: satTrackBg }}
                />
              </div>

              {/* Lightness Slider */}
              <div className={styles.sliderRow}>
                <div className={styles.label}>
                  <span>{t('settings.theme.lightness')}</span>
                  <span className={styles.valueSpan}>{hsl.l}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hsl.l}
                  onChange={(e) => handleLightChange(parseInt(e.target.value))}
                  className={styles.slider}
                  style={{ background: lightTrackBg }}
                />
              </div>
            </>
          ) : (
            <>
              {/* Red Slider */}
              <div className={styles.sliderRow}>
                <div className={styles.label}>
                  <span>{t('settings.theme.red')}</span>
                  <span className={styles.valueSpan}>{rgb.r}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={(e) => handleRedChange(parseInt(e.target.value))}
                  className={styles.slider}
                  style={{ background: redTrackBg }}
                />
              </div>

              {/* Green Slider */}
              <div className={styles.sliderRow}>
                <div className={styles.label}>
                  <span>{t('settings.theme.green')}</span>
                  <span className={styles.valueSpan}>{rgb.g}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={(e) => handleGreenChange(parseInt(e.target.value))}
                  className={styles.slider}
                  style={{ background: greenTrackBg }}
                />
              </div>

              {/* Blue Slider */}
              <div className={styles.sliderRow}>
                <div className={styles.label}>
                  <span>{t('settings.theme.blue')}</span>
                  <span className={styles.valueSpan}>{rgb.b}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={(e) => handleBlueChange(parseInt(e.target.value))}
                  className={styles.slider}
                  style={{ background: blueTrackBg }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 顏色預覽與輸入 */}
      <div className={styles.previewRow}>
        <div className={styles.previewSwatch} style={{ backgroundColor: activeColor }}></div>
        <div className={styles.colorInputWrapper}>
          <input
            type="text"
            className={styles.hexInput}
            value={hexInputText}
            onChange={(e) => handleHexInputChange(e.target.value)}
            placeholder="#3C8527"
          />
          {!isDefaultColor && (
            <button className={styles.resetBtn} onClick={handleReset}>
              {t('settings.btn.restore') || '恢復預設'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions for HEX <-> HSL conversion
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}
