import React, { createContext, useContext, useState, useEffect } from 'react';

export type DesignSystemTheme = 
  | 'neumorphism' 
  | 'claymorphism' 
  | 'brutalism' 
  | 'glassmorphism' 
  | 'minimalism' 
  | 'materialyou' 
  | 'fluent' 
  | 'neobrutalism' 
  | 'softui';

export type ColorScheme = 'dark' | 'light' | 'auto' | 'highcontrast';
export type AccentColor = 'coral' | 'green' | 'purple' | 'white' | 'blue' | 'amber';

interface ThemeContextType {
  theme: DesignSystemTheme;
  colorScheme: ColorScheme;
  accentColor: AccentColor;
  setTheme: (t: DesignSystemTheme) => void;
  setColorScheme: (c: ColorScheme) => void;
  setAccentColor: (a: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<DesignSystemTheme>(() => {
    return (localStorage.getItem('flick_theme_v3') as DesignSystemTheme) || 'softui';
  });

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    return (localStorage.getItem('flick_scheme_v3') as ColorScheme) || 'light';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    return (localStorage.getItem('flick_accent_v3') as AccentColor) || 'coral';
  });

  const setTheme = (t: DesignSystemTheme) => {
    setThemeState(t);
    localStorage.setItem('flick_theme_v3', t);
  };

  const setColorScheme = (c: ColorScheme) => {
    setColorSchemeState(c);
    localStorage.setItem('flick_scheme_v3', c);
  };

  const setAccentColor = (a: AccentColor) => {
    setAccentColorState(a);
    localStorage.setItem('flick_accent_v3', a);
  };

  useEffect(() => {
    // Determine active color scheme based on choice or system
    const root = document.documentElement;
    const body = document.body;

    let activeScheme = colorScheme;
    if (colorScheme === 'auto') {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeScheme = isSystemDark ? 'dark' : 'light';
    }

    // Toggle dark class for Tailwind
    if (activeScheme === 'dark' || activeScheme === 'highcontrast') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update body data-attributes for live theme styling
    body.setAttribute('data-theme', theme);
    body.setAttribute('data-color-scheme', activeScheme);
    body.setAttribute('data-accent', accentColor);

    // Apply color palettes and design variables
    applyThemeVariables(theme, activeScheme, accentColor);

    // Dispatch a custom window event to signal active components to re-render
    const event = new CustomEvent('theme-updated', {
      detail: { theme, colorScheme: activeScheme, accentColor }
    });
    window.dispatchEvent(event);
  }, [theme, colorScheme, accentColor]);

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, accentColor, setTheme, setColorScheme, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeListener() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handleThemeUpdate = () => {
      setTick((t) => t + 1);
    };
    window.addEventListener('theme-updated', handleThemeUpdate);
    return () => {
      window.removeEventListener('theme-updated', handleThemeUpdate);
    };
  }, []);
}

function applyThemeVariables(theme: DesignSystemTheme, scheme: ColorScheme, accent: AccentColor) {
  const root = document.documentElement;

  // 1. Map Accent colors
  const accentColors: Record<AccentColor, { primary: string; rgb: string; secondary: string; accent: string }> = {
    coral: { primary: '#f9553a', rgb: '249, 85, 58', secondary: '#fca998', accent: '#ff6b52' },
    green: { primary: '#00ff66', rgb: '0, 255, 102', secondary: '#00ccff', accent: '#ff0055' },
    purple: { primary: '#bd00ff', rgb: '189, 0, 255', secondary: '#ff00aa', accent: '#00f0ff' },
    white: { primary: '#ffffff', rgb: '255, 255, 255', secondary: '#a1a1aa', accent: '#ff0055' },
    blue: { primary: '#2563eb', rgb: '37, 99, 235', secondary: '#38bdf8', accent: '#f43f5e' },
    amber: { primary: '#f59e0b', rgb: '245, 158, 11', secondary: '#10b981', accent: '#ec4899' },
  };

  const colors = accentColors[accent] || accentColors.coral;

  // Set the default legacy/compatibility color variables
  root.style.setProperty('--neon-green', colors.primary);
  root.style.setProperty('--neon-green-rgb', colors.rgb);
  root.style.setProperty('--neon-green-glow', `rgba(${colors.rgb}, 0.15)`);
  root.style.setProperty('--neon-green-border', `rgba(${colors.rgb}, 0.25)`);
  root.style.setProperty('--neon-green-glow-intense', `rgba(${colors.rgb}, 0.6)`);

  // Map dynamic colors
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-accent', colors.accent);

  // 2. Map Backgrounds & Surfaces based on Dark/Light/High Contrast
  if (scheme === 'highcontrast') {
    root.style.setProperty('--color-background', '#000000');
    root.style.setProperty('--color-surface', '#000000');
    root.style.setProperty('--color-text', '#ffffff');
    root.style.setProperty('--border-width-card', '3px');
  } else if (scheme === 'light') {
    root.style.setProperty('--color-background', '#fcdada');
    root.style.setProperty('--color-surface', '#ffffff');
    root.style.setProperty('--color-text', '#1e293b');
    root.style.setProperty('--border-width-card', '0px');
  } else {
    // Dark mode
    root.style.setProperty('--color-background', '#181216');
    root.style.setProperty('--color-surface', '#221b20');
    root.style.setProperty('--color-text', '#f8fafc');
    root.style.setProperty('--border-width-card', '0px');
  }

  // 3. Map Design System styles
  const isDark = scheme === 'dark' || scheme === 'highcontrast';

  switch (theme) {
    case 'neumorphism':
      root.style.setProperty('--border-radius-card', '20px');
      root.style.setProperty('--border-radius-button', '12px');
      root.style.setProperty('--border-width-card', '0px');
      root.style.setProperty('--border-width-button', '0px');
      if (isDark) {
        root.style.setProperty('--shadow-card', '8px 8px 16px #101114, -8px -8px 16px #272a31');
        root.style.setProperty('--shadow-button', '4px 4px 8px #101114, -4px -4px 8px #272a31');
      } else {
        root.style.setProperty('--shadow-card', '8px 8px 16px #bebebe, -8px -8px 16px #ffffff');
        root.style.setProperty('--shadow-button', '4px 4px 8px #bebebe, -4px -4px 8px #ffffff');
      }
      root.style.setProperty('--backdrop-blur-card', '0px');
      break;

    case 'claymorphism':
      root.style.setProperty('--border-radius-card', '32px');
      root.style.setProperty('--border-radius-button', '20px');
      root.style.setProperty('--border-width-card', '2px');
      root.style.setProperty('--border-width-button', '1px');
      root.style.setProperty('--shadow-card', '10px 10px 30px rgba(0,0,0,0.15)');
      root.style.setProperty('--shadow-button', '4px 4px 12px rgba(0,0,0,0.12)');
      root.style.setProperty('--backdrop-blur-card', '0px');
      break;

    case 'glassmorphism':
      root.style.setProperty('--border-radius-card', '24px');
      root.style.setProperty('--border-radius-button', '14px');
      root.style.setProperty('--border-width-card', '1px');
      root.style.setProperty('--border-width-button', '1px');
      root.style.setProperty('--shadow-card', '0 8px 32px 0 rgba(0,0,0,0.37)');
      root.style.setProperty('--shadow-button', '0 4px 12px 0 rgba(0,0,0,0.15)');
      root.style.setProperty('--backdrop-blur-card', '20px');
      break;

    case 'minimalism':
      root.style.setProperty('--border-radius-card', '4px');
      root.style.setProperty('--border-radius-button', '2px');
      root.style.setProperty('--border-width-card', '1px');
      root.style.setProperty('--border-width-button', '1px');
      root.style.setProperty('--shadow-card', 'none');
      root.style.setProperty('--shadow-button', 'none');
      root.style.setProperty('--backdrop-blur-card', '0px');
      break;

    case 'materialyou':
      root.style.setProperty('--border-radius-card', '28px');
      root.style.setProperty('--border-radius-button', '24px');
      root.style.setProperty('--border-width-card', '0px');
      root.style.setProperty('--border-width-button', '0px');
      root.style.setProperty('--shadow-card', '0px 4px 12px rgba(0,0,0,0.06)');
      root.style.setProperty('--shadow-button', '0px 2px 8px rgba(0,0,0,0.04)');
      root.style.setProperty('--backdrop-blur-card', '0px');
      break;

    case 'fluent':
      root.style.setProperty('--border-radius-card', '8px');
      root.style.setProperty('--border-radius-button', '4px');
      root.style.setProperty('--border-width-card', '1px');
      root.style.setProperty('--border-width-button', '1px');
      root.style.setProperty('--shadow-card', '0px 8px 16px rgba(0,0,0,0.2)');
      root.style.setProperty('--shadow-button', '0px 2px 4px rgba(0,0,0,0.1)');
      root.style.setProperty('--backdrop-blur-card', '24px');
      break;

    case 'neobrutalism':
      root.style.setProperty('--border-radius-card', '0px');
      root.style.setProperty('--border-radius-button', '0px');
      root.style.setProperty('--border-width-card', '3px');
      root.style.setProperty('--border-width-button', '3px');
      root.style.setProperty('--shadow-card', '8px 8px 0px 0px #000000');
      root.style.setProperty('--shadow-button', '5px 5px 0px 0px #000000');
      root.style.setProperty('--backdrop-blur-card', '0px');
      break;

    case 'softui':
      root.style.setProperty('--border-radius-card', '16px');
      root.style.setProperty('--border-radius-button', '10px');
      root.style.setProperty('--border-width-card', '1px');
      root.style.setProperty('--border-width-button', '0px');
      root.style.setProperty('--shadow-card', '0px 10px 30px rgba(0,0,0,0.05)');
      root.style.setProperty('--shadow-button', '0px 4px 12px rgba(0,0,0,0.03)');
      root.style.setProperty('--backdrop-blur-card', '0px');
      break;

    case 'brutalism':
    default:
      root.style.setProperty('--border-radius-card', '0px');
      root.style.setProperty('--border-radius-button', '0px');
      root.style.setProperty('--border-width-card', '2px');
      root.style.setProperty('--border-width-button', '2px');
      root.style.setProperty('--shadow-card', '6px 6px 0px 0px #000000');
      root.style.setProperty('--shadow-button', '4px 4px 0px 0px #000000');
      root.style.setProperty('--backdrop-blur-card', '0px');
      break;
  }
}
