import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ChatWallpaperConfig, WallpaperPreset } from '../types/wallpaper';
import UTIF from 'utif';

export const DEFAULT_WALLPAPER_CONFIG: ChatWallpaperConfig = {
  type: 'default',
  id: 'default-stealth',
  name: 'Default Obsidian Stealth',
  value: '#09090b',
  dim: 20,
  blur: 0,
  autoContrast: true,
  luminance: 12,
  contrastGuard: 'low',
  effectiveDim: 20
};

// Curated Desktop High-Definition Wallpapers (landscape 16:9 / desktop resolutions)
export const CURATED_GALLERY: WallpaperPreset[] = [
  {
    id: 'photo-cyberpunk-rain',
    name: 'Cyberpunk Neon Rain',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400',
    defaultLuminance: 35,
    config: {
      type: 'photo',
      id: 'photo-cyberpunk-rain',
      name: 'Cyberpunk Neon Rain',
      value: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1920',
      dim: 35,
      blur: 0,
      autoContrast: true,
      luminance: 35,
      contrastGuard: 'low',
      effectiveDim: 35
    }
  },
  {
    id: 'photo-deep-cosmos',
    name: 'Cosmic Nebula Space',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=400',
    defaultLuminance: 28,
    config: {
      type: 'photo',
      id: 'photo-deep-cosmos',
      name: 'Cosmic Nebula Space',
      value: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1920',
      dim: 30,
      blur: 0,
      autoContrast: true,
      luminance: 28,
      contrastGuard: 'low',
      effectiveDim: 30
    }
  },
  {
    id: 'photo-tokyo-night',
    name: 'Tokyo Midnight Lights',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=400',
    defaultLuminance: 75,
    config: {
      type: 'photo',
      id: 'photo-tokyo-night',
      name: 'Tokyo Midnight Lights',
      value: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1920',
      dim: 45,
      blur: 0,
      autoContrast: true,
      luminance: 75,
      contrastGuard: 'medium',
      effectiveDim: 45
    }
  },
  {
    id: 'photo-emerald-abyss',
    name: 'Emerald Deep Forest',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1511497584788-87676104235f?q=80&w=400',
    defaultLuminance: 42,
    config: {
      type: 'photo',
      id: 'photo-emerald-abyss',
      name: 'Emerald Deep Forest',
      value: 'https://images.unsplash.com/photo-1511497584788-87676104235f?q=80&w=1920',
      dim: 35,
      blur: 0,
      autoContrast: true,
      luminance: 42,
      contrastGuard: 'low',
      effectiveDim: 35
    }
  },
  {
    id: 'photo-brutalist-monolith',
    name: 'Obsidian Monolith Architecture',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400',
    defaultLuminance: 95,
    config: {
      type: 'photo',
      id: 'photo-brutalist-monolith',
      name: 'Obsidian Monolith Architecture',
      value: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1920',
      dim: 50,
      blur: 0,
      autoContrast: true,
      luminance: 95,
      contrastGuard: 'medium',
      effectiveDim: 50
    }
  },
  {
    id: 'photo-sunset-synth',
    name: 'Sunset Synth Horizon',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400',
    defaultLuminance: 145, // Bright image!
    config: {
      type: 'photo',
      id: 'photo-sunset-synth',
      name: 'Sunset Synth Horizon',
      value: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920',
      dim: 55,
      blur: 0,
      autoContrast: true,
      luminance: 145,
      contrastGuard: 'high',
      effectiveDim: 55
    }
  },
  {
    id: 'photo-misty-mountains',
    name: 'Dark Fog Highlands',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=400',
    defaultLuminance: 120,
    config: {
      type: 'photo',
      id: 'photo-misty-mountains',
      name: 'Dark Fog Highlands',
      value: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1920',
      dim: 45,
      blur: 0,
      autoContrast: true,
      luminance: 120,
      contrastGuard: 'medium',
      effectiveDim: 45
    }
  },
  {
    id: 'photo-liquid-onyx',
    name: 'Liquid Onyx Ribbon',
    category: 'gallery',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400',
    defaultLuminance: 50,
    config: {
      type: 'photo',
      id: 'photo-liquid-onyx',
      name: 'Liquid Onyx Ribbon',
      value: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920',
      dim: 35,
      blur: 0,
      autoContrast: true,
      luminance: 50,
      contrastGuard: 'low',
      effectiveDim: 35
    }
  }
];

// Curated Desktop Color Gradients
export const GRADIENT_PRESETS: WallpaperPreset[] = [
  {
    id: 'grad-cyber-matrix',
    name: 'Cyber Aura Matrix',
    category: 'gradients',
    type: 'gradient',
    previewColor: 'linear-gradient(135deg, #051a14 0%, #09090b 50%, #12081c 100%)',
    defaultLuminance: 18,
    config: {
      type: 'gradient',
      id: 'grad-cyber-matrix',
      name: 'Cyber Aura Matrix',
      value: 'linear-gradient(135deg, #051a14 0%, #09090b 50%, #12081c 100%)',
      dim: 10,
      blur: 0,
      autoContrast: true,
      luminance: 18,
      contrastGuard: 'low',
      effectiveDim: 10
    }
  },
  {
    id: 'grad-cosmic-purple',
    name: 'Deep Galactic Purple',
    category: 'gradients',
    type: 'gradient',
    previewColor: 'linear-gradient(180deg, #1f0b38 0%, #090314 100%)',
    defaultLuminance: 24,
    config: {
      type: 'gradient',
      id: 'grad-cosmic-purple',
      name: 'Deep Galactic Purple',
      value: 'linear-gradient(180deg, #1f0b38 0%, #090314 100%)',
      dim: 10,
      blur: 0,
      autoContrast: true,
      luminance: 24,
      contrastGuard: 'low',
      effectiveDim: 10
    }
  },
  {
    id: 'grad-ocean-trench',
    name: 'Abyssal Ocean Trench',
    category: 'gradients',
    type: 'gradient',
    previewColor: 'linear-gradient(135deg, #07192c 0%, #02070d 100%)',
    defaultLuminance: 22,
    config: {
      type: 'gradient',
      id: 'grad-ocean-trench',
      name: 'Abyssal Ocean Trench',
      value: 'linear-gradient(135deg, #07192c 0%, #02070d 100%)',
      dim: 10,
      blur: 0,
      autoContrast: true,
      luminance: 22,
      contrastGuard: 'low',
      effectiveDim: 10
    }
  },
  {
    id: 'grad-sunset-embers',
    name: 'Sunset Embers Dusk',
    category: 'gradients',
    type: 'gradient',
    previewColor: 'linear-gradient(135deg, #321010 0%, #0d0507 100%)',
    defaultLuminance: 32,
    config: {
      type: 'gradient',
      id: 'grad-sunset-embers',
      name: 'Sunset Embers Dusk',
      value: 'linear-gradient(135deg, #321010 0%, #0d0507 100%)',
      dim: 15,
      blur: 0,
      autoContrast: true,
      luminance: 32,
      contrastGuard: 'low',
      effectiveDim: 15
    }
  },
  {
    id: 'grad-emerald-borealis',
    name: 'Emerald Borealis',
    category: 'gradients',
    type: 'gradient',
    previewColor: 'linear-gradient(145deg, #042618 0%, #020f09 60%, #07191e 100%)',
    defaultLuminance: 25,
    config: {
      type: 'gradient',
      id: 'grad-emerald-borealis',
      name: 'Emerald Borealis',
      value: 'linear-gradient(145deg, #042618 0%, #020f09 60%, #07191e 100%)',
      dim: 10,
      blur: 0,
      autoContrast: true,
      luminance: 25,
      contrastGuard: 'low',
      effectiveDim: 10
    }
  },
  {
    id: 'grad-titanium-slate',
    name: 'Titanium Slate Minimal',
    category: 'gradients',
    type: 'gradient',
    previewColor: 'linear-gradient(160deg, #1c2024 0%, #0e1113 100%)',
    defaultLuminance: 30,
    config: {
      type: 'gradient',
      id: 'grad-titanium-slate',
      name: 'Titanium Slate Minimal',
      value: 'linear-gradient(160deg, #1c2024 0%, #0e1113 100%)',
      dim: 10,
      blur: 0,
      autoContrast: true,
      luminance: 30,
      contrastGuard: 'low',
      effectiveDim: 10
    }
  }
];

// Solid Minimalist Tones
export const SOLID_PRESETS: WallpaperPreset[] = [
  {
    id: 'solid-pure-black',
    name: 'Pitch Pure Black (OLED)',
    category: 'solid',
    type: 'solid',
    previewColor: '#000000',
    defaultLuminance: 0,
    config: {
      type: 'solid',
      id: 'solid-pure-black',
      name: 'Pitch Pure Black (OLED)',
      value: '#000000',
      dim: 0,
      blur: 0,
      autoContrast: true,
      luminance: 0,
      contrastGuard: 'low',
      effectiveDim: 0
    }
  },
  {
    id: 'solid-dark-slate',
    name: 'WhatsApp Dark Slate',
    category: 'solid',
    type: 'solid',
    previewColor: '#0b141a',
    defaultLuminance: 18,
    config: {
      type: 'solid',
      id: 'solid-dark-slate',
      name: 'WhatsApp Dark Slate',
      value: '#0b141a',
      dim: 0,
      blur: 0,
      autoContrast: true,
      luminance: 18,
      contrastGuard: 'low',
      effectiveDim: 0
    }
  },
  {
    id: 'solid-midnight-navy',
    name: 'Telegram Midnight Navy',
    category: 'solid',
    type: 'solid',
    previewColor: '#0c1622',
    defaultLuminance: 20,
    config: {
      type: 'solid',
      id: 'solid-midnight-navy',
      name: 'Telegram Midnight Navy',
      value: '#0c1622',
      dim: 0,
      blur: 0,
      autoContrast: true,
      luminance: 20,
      contrastGuard: 'low',
      effectiveDim: 0
    }
  },
  {
    id: 'solid-forest-pine',
    name: 'Covenant Forest Pine',
    category: 'solid',
    type: 'solid',
    previewColor: '#081711',
    defaultLuminance: 19,
    config: {
      type: 'solid',
      id: 'solid-forest-pine',
      name: 'Covenant Forest Pine',
      value: '#081711',
      dim: 0,
      blur: 0,
      autoContrast: true,
      luminance: 19,
      contrastGuard: 'low',
      effectiveDim: 0
    }
  }
];

// --- Automatic Contrast Adjustment Logic ---

/**
 * Calculates effective dimming percentage based on auto-contrast and detected luminance.
 * Bright wallpapers (luminance >= 130) automatically enforce higher dimming and high-contrast bubble shields.
 */
export function calculateEffectiveDim(config: ChatWallpaperConfig): number {
  const manualDim = Math.max(0, Math.min(90, config.dim || 0));
  if (!config.autoContrast) {
    return manualDim;
  }

  const lum = config.luminance !== undefined ? config.luminance : 50;

  if (lum >= 140) {
    // Very bright background (e.g. daylight / white / light desktop image)
    return Math.max(manualDim, 55);
  } else if (lum >= 90) {
    // Medium-bright background
    return Math.max(manualDim, 40);
  } else if (lum >= 50) {
    // Moderate darkness
    return Math.max(manualDim, 25);
  } else {
    // Deep dark background
    return manualDim;
  }
}

/**
 * Determines contrast guard level from luminance
 */
export function getContrastGuardLevel(luminance: number): 'high' | 'medium' | 'low' {
  if (luminance >= 120) return 'high';
  if (luminance >= 60) return 'medium';
  return 'low';
}

/**
 * Analyzes the perceived average brightness (luminance: 0 to 255) of an image using canvas pixel sampling.
 * Uses standard ITU-R BT.601 relative luminance: Y = 0.299*R + 0.587*G + 0.114*B
 */
export async function analyzeImageBrightness(imageSrc: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => {
        // Fallback if image load hangs
        resolve(60);
      }, 3500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(60);
            return;
          }

          // Downsample to 32x32 for ultra-fast sampling
          canvas.width = 32;
          canvas.height = 32;
          ctx.drawImage(img, 0, 0, 32, 32);

          const imgData = ctx.getImageData(0, 0, 32, 32);
          const data = imgData.data;
          let totalLuminance = 0;
          const pixelCount = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Perceived luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += lum;
          }

          const avgLum = Math.round(totalLuminance / pixelCount);
          resolve(Math.max(0, Math.min(255, avgLum)));
        } catch (e) {
          // If tainted by CORS, estimate safe default
          resolve(70);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(50);
      };

      img.src = imageSrc;
    } catch (e) {
      resolve(50);
    }
  });
}

/**
 * Converts any uploaded desktop file (.png, .jpg, .jpeg, .tiff, .tif, .webp) to a browser-compatible data URL.
 * Specially decodes TIFF images using UTIF so they render smoothly in all web browsers and Canvas.
 */
export async function processDesktopImageFile(
  file: File
): Promise<{ dataUrl: string; format: string; luminance: number; fileName: string }> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const isTiff = lowerName.endsWith('.tiff') || lowerName.endsWith('.tif') || file.type === 'image/tiff';

  if (isTiff) {
    // Process TIFF with UTIF
    const arrayBuffer = await file.arrayBuffer();
    const ifds = UTIF.decode(arrayBuffer);
    if (!ifds || ifds.length === 0) {
      throw new Error('Could not decode TIFF file headers.');
    }
    UTIF.decodeImage(arrayBuffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const width = ifds[0].width;
    const height = ifds[0].height;

    // Draw onto canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);

    // Calculate luminance directly from RGBA
    let totalLum = 0;
    const pixelCount = width * height;
    for (let i = 0; i < rgba.length; i += 4) {
      totalLum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    }
    const avgLum = Math.round(totalLum / pixelCount);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return {
      dataUrl,
      format: 'tiff',
      luminance: avgLum,
      fileName
    };
  }

  // Standard PNG, JPG, JPEG, WEBP
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const lum = await analyzeImageBrightness(dataUrl);
      const extMatch = lowerName.match(/\.([a-z0-9]+)$/);
      const format = extMatch ? extMatch[1] : 'png';
      resolve({
        dataUrl,
        format,
        luminance: lum,
        fileName
      });
    };
    reader.readAsDataURL(file);
  });
}

// --- Local Storage Management ---

export function getChatWallpaperConfig(chatId?: string): ChatWallpaperConfig {
  try {
    if (chatId) {
      const perChat = localStorage.getItem(`flick_wallpaper_chat_${chatId}`);
      if (perChat) {
        const parsed = JSON.parse(perChat);
        parsed.effectiveDim = calculateEffectiveDim(parsed);
        return parsed;
      }
    }
    const globalDefault = localStorage.getItem('flick_global_wallpaper_config');
    if (globalDefault) {
      const parsed = JSON.parse(globalDefault);
      parsed.effectiveDim = calculateEffectiveDim(parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse wallpaper config:', e);
  }
  return DEFAULT_WALLPAPER_CONFIG;
}

export function hasPerChatWallpaper(chatId: string): boolean {
  if (!chatId) return false;
  return !!localStorage.getItem(`flick_wallpaper_chat_${chatId}`);
}

export function savePerChatWallpaper(chatId: string, config: ChatWallpaperConfig): void {
  if (!chatId) return;
  try {
    const configToSave = {
      ...config,
      effectiveDim: calculateEffectiveDim(config)
    };
    localStorage.setItem(`flick_wallpaper_chat_${chatId}`, JSON.stringify(configToSave));
  } catch (e) {
    console.warn('Failed to save per-chat wallpaper:', e);
  }
}

export function saveGlobalWallpaper(config: ChatWallpaperConfig): void {
  try {
    const configToSave = {
      ...config,
      effectiveDim: calculateEffectiveDim(config)
    };
    localStorage.setItem('flick_global_wallpaper_config', JSON.stringify(configToSave));
  } catch (e) {
    console.warn('Failed to save global wallpaper:', e);
  }
}

export function resetChatWallpaper(chatId: string): void {
  if (!chatId) return;
  try {
    localStorage.removeItem(`flick_wallpaper_chat_${chatId}`);
  } catch (e) {
    console.warn('Failed to reset chat wallpaper:', e);
  }
}

// --- Firestore Cloud Persistence ---

/**
 * Saves the user's preferred wallpaper choice to Firestore under users/{userId}.
 * Supports both global default and per-chat tunnel overrides.
 */
export async function saveWallpaperToFirestore(
  userId: string,
  config: ChatWallpaperConfig,
  chatId?: string
): Promise<boolean> {
  if (!userId || !db) return false;

  try {
    const userRef = doc(db, 'users', userId);
    const sanitizedConfig = {
      ...config,
      effectiveDim: calculateEffectiveDim(config),
      updatedAt: Date.now()
    };

    const updatePayload: Record<string, any> = {
      preferredWallpaper: sanitizedConfig,
      updatedAt: Date.now()
    };

    if (chatId) {
      updatePayload[`chatWallpapers.${chatId}`] = sanitizedConfig;
    }

    await setDoc(userRef, updatePayload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore Wallpaper Sync Error]', err);
    return false;
  }
}

/**
 * Loads the user's preferred wallpaper choice from Firestore and syncs into local cache.
 */
export async function loadWallpaperFromFirestore(
  userId: string,
  chatId?: string
): Promise<ChatWallpaperConfig | null> {
  if (!userId || !db) return null;

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      let selected: ChatWallpaperConfig | null = null;

      if (chatId && data.chatWallpapers && data.chatWallpapers[chatId]) {
        selected = data.chatWallpapers[chatId];
        savePerChatWallpaper(chatId, selected!);
      } else if (data.preferredWallpaper) {
        selected = data.preferredWallpaper;
        saveGlobalWallpaper(selected!);
      }

      if (selected) {
        selected.effectiveDim = calculateEffectiveDim(selected);
        return selected;
      }
    }
  } catch (err) {
    console.warn('[Firestore Wallpaper Fetch Error]', err);
  }

  return null;
}
