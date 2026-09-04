export type WallpaperType = 'default' | 'photo' | 'gradient' | 'solid' | 'custom';

export interface ChatWallpaperConfig {
  type: WallpaperType;
  id: string;
  name: string;
  value: string; // Image URL, gradient CSS, or hex color
  dim: number; // 0 to 90 (% manual dimming / dark overlay)
  blur: number; // 0 to 16 (px blur)
  isCustom?: boolean;
  
  // Automatic Contrast Adjustment parameters
  autoContrast: boolean; // When true, automatically balances background dimming & message bubble contrast
  luminance?: number; // Detected average background brightness (0 = pitch black, 255 = pure white)
  contrastGuard?: 'high' | 'medium' | 'low'; // Effective contrast guard level
  effectiveDim?: number; // Dynamically computed dimming factoring in autoContrast
  
  // Desktop upload metadata
  fileName?: string;
  fileFormat?: string; // png, jpg, jpeg, tiff, webp
}

export interface WallpaperPreset {
  id: string;
  name: string;
  category: 'gallery' | 'gradients' | 'solid' | 'upload';
  type: WallpaperType;
  previewColor?: string;
  previewUrl?: string;
  config: ChatWallpaperConfig;
  defaultLuminance?: number;
}
