export type BrutalistTheme = 'green' | 'purple' | 'white';

export interface ThemeConfig {
  name: string;
  color: string;
  rgb: string;
  glow: string;
  border: string;
  glowIntense: string;
}

export const THEMES: Record<BrutalistTheme, ThemeConfig> = {
  green: {
    name: 'Emerald Glass',
    color: '#00ff66',
    rgb: '0, 255, 102',
    glow: 'rgba(0, 255, 102, 0.15)',
    border: 'rgba(0, 255, 102, 0.25)',
    glowIntense: 'rgba(0, 255, 102, 0.6)'
  },
  purple: {
    name: 'Violet Glass',
    color: '#bd00ff',
    rgb: '189, 0, 255',
    glow: 'rgba(189, 0, 255, 0.15)',
    border: 'rgba(189, 0, 255, 0.25)',
    glowIntense: 'rgba(189, 0, 255, 0.6)'
  },
  white: {
    name: 'Ice Glass',
    color: '#ffffff',
    rgb: '255, 255, 255',
    glow: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.22)',
    glowIntense: 'rgba(255, 255, 255, 0.5)'
  }
};

export type UIAppFont = 'poppins' | 'nunito' | 'inter' | 'system' | 'helvetica';

export interface FontConfig {
  name: string;
  description: string;
  family: string;
}

export const APP_FONTS: Record<UIAppFont, FontConfig> = {
  poppins: {
    name: 'Poppins',
    description: 'Modern, geometric, friendly rounded feel (Matches WhatsApp tone)',
    family: '"Poppins", ui-sans-serif, system-ui, sans-serif'
  },
  nunito: {
    name: 'Nunito Sans',
    description: 'Soft, rounded UI typography, crafted specifically for message bubbles',
    family: '"Nunito Sans", ui-sans-serif, system-ui, sans-serif'
  },
  inter: {
    name: 'Inter',
    description: 'Extremely readable, precision UI font with huge weight range',
    family: '"Inter", ui-sans-serif, system-ui, sans-serif'
  },
  system: {
    name: 'SF Pro / Roboto',
    description: 'Native system font stack — peak performance & platform consistency',
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Roboto", "Segoe UI", sans-serif'
  },
  helvetica: {
    name: 'Helvetica Neue',
    description: 'Classic, neutral, universally legible design font',
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif'
  }
};

export function applyTheme(themeKey: BrutalistTheme) {
  if (typeof window === 'undefined') return;
  const active = THEMES[themeKey] || THEMES.green;
  const root = document.documentElement;
  
  root.style.setProperty('--neon-green', active.color);
  root.style.setProperty('--neon-green-rgb', active.rgb);
  root.style.setProperty('--neon-green-glow', active.glow);
  root.style.setProperty('--neon-green-border', active.border);
  root.style.setProperty('--neon-green-glow-intense', active.glowIntense);
  
  localStorage.setItem('flick_brutalist_theme', themeKey);
}

export function getSavedTheme(): BrutalistTheme {
  if (typeof window === 'undefined') return 'green';
  return (localStorage.getItem('flick_brutalist_theme') as BrutalistTheme) || 'green';
}

export function applyFont(fontKey: UIAppFont) {
  if (typeof window === 'undefined') return;
  const active = APP_FONTS[fontKey] || APP_FONTS.poppins;
  document.documentElement.style.setProperty('--font-sans', active.family);
  document.body.style.fontFamily = active.family;
  localStorage.setItem('flick_app_font', fontKey);
}

export function getSavedFont(): UIAppFont {
  if (typeof window === 'undefined') return 'poppins';
  return (localStorage.getItem('flick_app_font') as UIAppFont) || 'poppins';
}

