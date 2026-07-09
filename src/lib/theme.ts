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
    name: 'Neon Green',
    color: '#00ff66',
    rgb: '0, 255, 102',
    glow: 'rgba(0, 255, 102, 0.15)',
    border: 'rgba(0, 255, 102, 0.25)',
    glowIntense: 'rgba(0, 255, 102, 0.6)'
  },
  purple: {
    name: 'Cyber Purple',
    color: '#bd00ff',
    rgb: '189, 0, 255',
    glow: 'rgba(189, 0, 255, 0.15)',
    border: 'rgba(189, 0, 255, 0.25)',
    glowIntense: 'rgba(189, 0, 255, 0.6)'
  },
  white: {
    name: 'Monochrome White',
    color: '#ffffff',
    rgb: '255, 255, 255',
    glow: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.22)',
    glowIntense: 'rgba(255, 255, 255, 0.5)'
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
