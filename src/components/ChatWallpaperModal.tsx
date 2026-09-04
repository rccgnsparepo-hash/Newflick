import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  Image as ImageIcon,
  Sliders,
  Upload,
  RefreshCw,
  Palette,
  Eye,
  SlidersHorizontal,
  CheckCheck,
  ShieldCheck,
  Cloud,
  Maximize2,
  Minimize2,
  Sparkles,
  Sun,
  Moon,
  Info,
  Laptop
} from 'lucide-react';
import { ChatWallpaperConfig } from '../types/wallpaper';
import {
  CURATED_GALLERY,
  GRADIENT_PRESETS,
  SOLID_PRESETS,
  DEFAULT_WALLPAPER_CONFIG,
  calculateEffectiveDim,
  getContrastGuardLevel,
  processDesktopImageFile,
  analyzeImageBrightness,
  savePerChatWallpaper,
  saveGlobalWallpaper,
  saveWallpaperToFirestore,
  resetChatWallpaper,
  hasPerChatWallpaper
} from '../lib/wallpaperData';

interface ChatWallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string;
  currentConfig: ChatWallpaperConfig;
  userId?: string;
  onApply: (newConfig: ChatWallpaperConfig) => void;
  onLivePreview?: (previewConfig: ChatWallpaperConfig | null) => void;
}

type TabType = 'gallery' | 'gradients' | 'upload' | 'solid';

export const ChatWallpaperModal: React.FC<ChatWallpaperModalProps> = ({
  isOpen,
  onClose,
  chatId,
  chatName,
  currentConfig,
  userId,
  onApply,
  onLivePreview
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('gallery');
  const [selectedConfig, setSelectedConfig] = useState<ChatWallpaperConfig>(() => ({
    ...currentConfig,
    autoContrast: currentConfig.autoContrast ?? true,
    effectiveDim: calculateEffectiveDim(currentConfig)
  }));

  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [liveChatPreviewEnabled, setLiveChatPreviewEnabled] = useState(true);
  const [syncToFirestore, setSyncToFirestore] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync candidate config to live chat background if enabled
  useEffect(() => {
    if (liveChatPreviewEnabled && onLivePreview) {
      onLivePreview({
        ...selectedConfig,
        effectiveDim: calculateEffectiveDim(selectedConfig)
      });
    }
  }, [selectedConfig, liveChatPreviewEnabled, onLivePreview]);

  // Clean up live preview when modal is closed without applying
  const handleCancelAndRevert = () => {
    if (onLivePreview) {
      onLivePreview(null);
    }
    onClose();
  };

  const hasOverride = hasPerChatWallpaper(chatId);
  const effectiveDim = calculateEffectiveDim(selectedConfig);
  const contrastLevel = getContrastGuardLevel(selectedConfig.luminance ?? 50);

  // Handle Desktop Image File Upload (.png, .jpg, .jpeg, .tiff, .tif, .webp)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some(ext => lowerName.endsWith(ext));

    if (!isAllowed) {
      setUploadError('Unsupported format. Please upload a desktop image in PNG, JPG, JPEG, TIFF, or WEBP.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      // Process and decode (including TIFF decoding through UTIF and Canvas brightness sampling)
      const processed = await processDesktopImageFile(file);
      
      const newConfig: ChatWallpaperConfig = {
        type: 'custom',
        id: `custom-desktop-${Date.now()}`,
        name: file.name.length > 22 ? `${file.name.substring(0, 19)}...` : file.name,
        value: processed.dataUrl,
        dim: processed.luminance >= 120 ? 50 : 35,
        blur: 0,
        isCustom: true,
        autoContrast: true,
        luminance: processed.luminance,
        contrastGuard: getContrastGuardLevel(processed.luminance),
        fileName: file.name,
        fileFormat: processed.format.toUpperCase()
      };

      newConfig.effectiveDim = calculateEffectiveDim(newConfig);
      setSelectedConfig(newConfig);
      setIsUploading(false);
    } catch (err: any) {
      console.error('[Upload Processing Failed]', err);
      setUploadError(err.message || 'Failed to parse desktop image file.');
      setIsUploading(false);
    }
  };

  // Apply to current chat tunnel
  const handleApplyThisChat = async () => {
    setIsSaving(true);
    const finalConfig = {
      ...selectedConfig,
      effectiveDim: calculateEffectiveDim(selectedConfig)
    };

    savePerChatWallpaper(chatId, finalConfig);

    if (syncToFirestore && userId) {
      await saveWallpaperToFirestore(userId, finalConfig, chatId);
    }

    if (onLivePreview) onLivePreview(null);
    onApply(finalConfig);
    setIsSaving(false);
    onClose();
  };

  // Set as global default for all chats
  const handleSetAllChats = async () => {
    setIsSaving(true);
    const finalConfig = {
      ...selectedConfig,
      effectiveDim: calculateEffectiveDim(selectedConfig)
    };

    saveGlobalWallpaper(finalConfig);
    savePerChatWallpaper(chatId, finalConfig);

    if (syncToFirestore && userId) {
      await saveWallpaperToFirestore(userId, finalConfig);
    }

    if (onLivePreview) onLivePreview(null);
    onApply(finalConfig);
    setIsSaving(false);
    onClose();
  };

  // Reset to default
  const handleResetDefault = async () => {
    resetChatWallpaper(chatId);
    if (syncToFirestore && userId) {
      await saveWallpaperToFirestore(userId, DEFAULT_WALLPAPER_CONFIG, chatId);
    }
    if (onLivePreview) onLivePreview(null);
    onApply(DEFAULT_WALLPAPER_CONFIG);
    setSelectedConfig(DEFAULT_WALLPAPER_CONFIG);
    onClose();
  };

  // Helper to build preview background styling
  const getWallpaperBackgroundStyle = () => {
    if (selectedConfig.type === 'photo' || selectedConfig.type === 'custom') {
      return {
        backgroundColor: '#09090b',
        backgroundImage: `url("${selectedConfig.value}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center'
      };
    }
    if (selectedConfig.type === 'gradient') {
      return {
        background: selectedConfig.value
      };
    }
    return {
      backgroundColor: selectedConfig.value || '#09090b'
    };
  };

  // Adaptive message bubble styling for conversation preview
  const isBright = (selectedConfig.luminance ?? 50) >= 120;
  const isMedium = (selectedConfig.luminance ?? 50) >= 60 && !isBright;

  const incomingBubbleClass = selectedConfig.autoContrast && isBright
    ? 'bg-zinc-950/95 border-zinc-650 text-white shadow-2xl backdrop-blur-md ring-1 ring-zinc-700/50'
    : selectedConfig.autoContrast && isMedium
    ? 'bg-zinc-900/90 border-zinc-700 text-zinc-100 shadow-xl'
    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 shadow-md';

  const outgoingBubbleClass = selectedConfig.autoContrast && isBright
    ? 'bg-emerald-950/95 border-emerald-400 text-white shadow-2xl ring-1 ring-emerald-500/40'
    : selectedConfig.autoContrast && isMedium
    ? 'bg-[var(--neon-green)]/20 border-[var(--neon-green)]/60 text-white shadow-xl'
    : 'bg-[var(--neon-green)]/15 border-[var(--neon-green)]/40 text-emerald-100 shadow-md';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 font-mono select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`w-full bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ${
            isFullscreenPreview ? 'max-w-6xl h-[94vh]' : 'max-w-5xl max-h-[92vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="p-3.5 sm:p-4 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 flex items-center justify-center text-[var(--neon-green)]">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black uppercase text-white tracking-wider">
                    Chat Wallpaper Studio
                  </h3>
                  <span className="text-[8.5px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-[var(--neon-green)]" />
                    Auto-Contrast Engine
                  </span>
                </div>
                <p className="text-[9px] text-zinc-400 truncate max-w-sm sm:max-w-md">
                  Active Conversation: <span className="text-white font-bold">{chatName}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white text-[9px] font-bold uppercase transition cursor-pointer"
                title={isFullscreenPreview ? 'Compact view' : 'Enlarge preview'}
              >
                {isFullscreenPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreenPreview ? 'Standard' : 'Enlarge'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancelAndRevert}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: Split Layout (Live Conversation Preview Left, Gallery & Controls Right) */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-zinc-900 min-h-0">
            
            {/* LEFT COLUMN: Real Conversation Window Preview */}
            <div className="md:col-span-5 p-3.5 sm:p-5 flex flex-col items-center justify-between bg-black/40 min-h-[380px]">
              
              {/* Simulation Frame */}
              <div className="w-full max-w-[320px] sm:max-w-[340px] rounded-2xl border-2 border-zinc-800 shadow-2xl overflow-hidden flex flex-col h-[410px] relative bg-zinc-950">
                
                {/* Mock Window Top Bar */}
                <div className="p-2.5 bg-zinc-900/95 border-b border-zinc-800/80 flex items-center justify-between z-10 backdrop-blur-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/50 flex items-center justify-center text-[10px] text-[var(--neon-green)] font-bold shrink-0">
                      {chatName.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-white truncate leading-tight">{chatName}</p>
                      <p className="text-[7.5px] text-[var(--neon-green)] leading-none flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
                        E2EE Tunnel Active
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[8px]">
                    <Eye className="w-3 h-3 text-[var(--neon-green)]" />
                    <span className="uppercase font-bold">PREVIEW</span>
                  </div>
                </div>

                {/* Conversation Stream with Live Wallpaper, Dimming & Auto-Contrast Bubbles */}
                <div className="flex-1 relative overflow-hidden p-3 flex flex-col justify-end space-y-2.5">
                  {/* Wallpaper Canvas with Soft Blur */}
                  <div
                    className="absolute inset-0 transition-all duration-300 pointer-events-none"
                    style={{
                      ...getWallpaperBackgroundStyle(),
                      filter: selectedConfig.blur > 0 ? `blur(${selectedConfig.blur}px)` : 'none',
                      transform: selectedConfig.blur > 0 ? 'scale(1.05)' : 'none'
                    }}
                  />

                  {/* Dimming Layer (Enforced by Auto-Contrast for readability) */}
                  <div
                    className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-300"
                    style={{ opacity: effectiveDim / 100 }}
                  />

                  {/* Timestamp divider */}
                  <div className="relative z-10 flex justify-center my-1">
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-zinc-700/60 text-[7px] text-zinc-300 font-bold uppercase tracking-wider shadow-sm">
                      Today · 256-bit Encrypted
                    </span>
                  </div>

                  {/* Message Stream Preview */}
                  <div className="relative z-10 space-y-2 select-none">
                    {/* Incoming bubble (Peer) */}
                    <div className="flex justify-start">
                      <div className={`p-2.5 rounded-2xl rounded-tl-sm border text-[10px] max-w-[88%] font-sans transition-all duration-200 ${incomingBubbleClass}`}>
                        <p className="leading-snug">
                          How does the wallpaper look? Reading this message should feel completely comfortable.
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[7px] text-zinc-400 font-mono">10:41 AM</span>
                          {selectedConfig.autoContrast && isBright && (
                            <span className="text-[6.5px] px-1 rounded bg-black text-amber-300 font-mono font-bold">
                              SHIELDED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Outgoing bubble (Self) */}
                    <div className="flex justify-end">
                      <div className={`p-2.5 rounded-2xl rounded-tr-sm border text-[10px] max-w-[88%] font-sans transition-all duration-200 ${outgoingBubbleClass}`}>
                        <p className="leading-snug font-medium">
                          The contrast auto-adjusts automatically! Even on bright desktop backgrounds, text is razor sharp. ⚡
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[7px] mt-1 font-mono text-[var(--neon-green)]">
                          <span>10:42 AM</span>
                          <CheckCheck className="w-2.5 h-2.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mock Input Bar */}
                <div className="p-2 bg-zinc-900/95 border-t border-zinc-800 flex items-center gap-1.5 z-10">
                  <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full px-3 py-1 text-[8px] text-zinc-500 font-sans truncate">
                    Type an encrypted transmission...
                  </div>
                  <div className="w-6 h-6 rounded-full bg-[var(--neon-green)] text-black flex items-center justify-center text-[10px] font-black shrink-0">
                    ↑
                  </div>
                </div>
              </div>

              {/* Preview Controller Controls */}
              <div className="w-full mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[8px] text-zinc-400 px-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={liveChatPreviewEnabled}
                      onChange={(e) => setLiveChatPreviewEnabled(e.target.checked)}
                      className="rounded accent-[var(--neon-green)]"
                    />
                    <span>Live test behind active window</span>
                  </label>
                  <span className="text-zinc-500 font-mono">
                    Luminance: <strong className="text-white">{selectedConfig.luminance ?? 50}/255</strong>
                  </span>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Gallery, Gradients, Desktop Upload, and Auto-Contrast Sliders */}
            <div className="md:col-span-7 p-3.5 sm:p-5 flex flex-col justify-between space-y-4">
              
              {/* Category Selector Tabs (Gallery, Gradients, Upload, Solid) */}
              <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                {[
                  { id: 'gallery', label: 'Desktop Gallery', icon: ImageIcon },
                  { id: 'gradients', label: 'Gradients', icon: Palette },
                  { id: 'upload', label: 'Upload Image', icon: Upload },
                  { id: 'solid', label: 'Solid Tones', icon: Sliders }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-[var(--neon-green)] text-black shadow-sm font-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: CURATED DESKTOP WALLPAPERS GALLERY */}
              {activeTab === 'gallery' && (
                <div className="space-y-2.5 flex-1 min-h-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">
                      Selectable Desktop Wallpapers (16:9 HD):
                    </span>
                    <span className="text-[8px] text-[var(--neon-green)] font-mono">
                      {CURATED_GALLERY.length} curated
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {CURATED_GALLERY.map((preset) => {
                      const isGalleryActive = selectedConfig.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const newCfg: ChatWallpaperConfig = {
                              ...preset.config,
                              autoContrast: selectedConfig.autoContrast,
                              dim: selectedConfig.autoContrast
                                ? preset.config.dim
                                : selectedConfig.dim,
                              blur: selectedConfig.blur
                            };
                            newCfg.effectiveDim = calculateEffectiveDim(newCfg);
                            setSelectedConfig(newCfg);
                          }}
                          className={`group rounded-xl border overflow-hidden text-left relative h-20 transition cursor-pointer ${
                            isGalleryActive
                              ? 'border-[var(--neon-green)] ring-2 ring-[var(--neon-green)] shadow-lg'
                              : 'border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <img
                            src={preset.previewUrl}
                            alt={preset.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-1.5 flex flex-col justify-end">
                            <span className="text-[8px] font-bold text-white uppercase truncate">
                              {preset.name}
                            </span>
                          </div>
                          {isGalleryActive && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--neon-green)] text-black flex items-center justify-center shadow">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: COLOR GRADIENTS */}
              {activeTab === 'gradients' && (
                <div className="space-y-2.5 flex-1 min-h-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">
                      Atmospheric Color Gradients:
                    </span>
                    <span className="text-[8px] text-[var(--neon-green)] font-mono">Clean CSS Vector</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {GRADIENT_PRESETS.map((preset) => {
                      const isGradActive = selectedConfig.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const newCfg: ChatWallpaperConfig = {
                              ...preset.config,
                              autoContrast: selectedConfig.autoContrast,
                              dim: selectedConfig.dim,
                              blur: 0
                            };
                            newCfg.effectiveDim = calculateEffectiveDim(newCfg);
                            setSelectedConfig(newCfg);
                          }}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                            isGradActive
                              ? 'border-[var(--neon-green)] ring-1 ring-[var(--neon-green)] bg-zinc-900'
                              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-lg border border-zinc-700 shrink-0 shadow-inner"
                              style={{ background: preset.previewColor }}
                            />
                            <span className="text-[8.5px] font-bold text-white uppercase truncate">
                              {preset.name}
                            </span>
                          </div>
                          {isGradActive && (
                            <Check className="w-3 h-3 text-[var(--neon-green)] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: DESKTOP IMAGE UPLOAD (PNG, JPG, JPEG, TIFF, WEBP) */}
              {activeTab === 'upload' && (
                <div className="space-y-3 flex-1 min-h-0">
                  <div className="p-4 border-2 border-dashed border-zinc-800 hover:border-[var(--neon-green)]/60 rounded-xl bg-zinc-900/40 text-center space-y-2 transition">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.tiff,.tif,.webp,image/png,image/jpeg,image/tiff,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="w-10 h-10 rounded-full bg-zinc-800 mx-auto flex items-center justify-center text-[var(--neon-green)]">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-white uppercase">
                        Upload Your Own Desktop Image
                      </p>
                      <p className="text-[8px] text-zinc-400 mt-0.5">
                        Supports formats: <strong className="text-zinc-200">PNG, JPG, JPEG, TIFF, WEBP</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-[var(--neon-green)] hover:bg-white text-black font-black rounded-lg text-[9px] uppercase transition cursor-pointer disabled:opacity-50"
                    >
                      {isUploading ? 'Analyzing Image Luminance...' : 'Choose Desktop File'}
                    </button>
                  </div>

                  {uploadError && (
                    <p className="text-[8.5px] text-rose-400 font-bold bg-rose-950/40 p-2 rounded border border-rose-800/60">
                      {uploadError}
                    </p>
                  )}

                  {selectedConfig.isCustom && (
                    <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded border border-zinc-700 bg-cover bg-center shrink-0"
                          style={{ backgroundImage: `url("${selectedConfig.value}")` }}
                        />
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-white truncate">
                            {selectedConfig.name}
                          </p>
                          <p className="text-[7.5px] text-[var(--neon-green)] font-mono">
                            Format: {selectedConfig.fileFormat || 'CUSTOM'} · Luminance: {selectedConfig.luminance ?? 'N/A'}/255
                          </p>
                        </div>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                        Active Upload
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SOLID TONES */}
              {activeTab === 'solid' && (
                <div className="space-y-2.5 flex-1 min-h-0">
                  <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">
                    Minimalist Solid Backgrounds:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {SOLID_PRESETS.map((preset) => {
                      const isSolidActive = selectedConfig.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            const newCfg: ChatWallpaperConfig = {
                              ...preset.config,
                              autoContrast: selectedConfig.autoContrast,
                              dim: 0,
                              blur: 0
                            };
                            newCfg.effectiveDim = calculateEffectiveDim(newCfg);
                            setSelectedConfig(newCfg);
                          }}
                          className={`p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                            isSolidActive
                              ? 'border-[var(--neon-green)] ring-1 ring-[var(--neon-green)] bg-zinc-900'
                              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-6 h-6 rounded-lg border border-zinc-700 shrink-0"
                              style={{ background: preset.previewColor }}
                            />
                            <span className="text-[9px] font-bold text-white uppercase">
                              {preset.name}
                            </span>
                          </div>
                          {isSolidActive && (
                            <Check className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AUTOMATIC CONTRAST ADJUSTMENT & READABILITY ENGINE */}
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[var(--neon-green)]" />
                    <span className="text-[9.5px] uppercase font-black text-white">
                      Automatic Contrast Guard
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[8px] text-zinc-400 uppercase">
                      {selectedConfig.autoContrast ? 'Auto Active' : 'Manual'}
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedConfig.autoContrast}
                      onChange={(e) => {
                        const newCfg = {
                          ...selectedConfig,
                          autoContrast: e.target.checked
                        };
                        newCfg.effectiveDim = calculateEffectiveDim(newCfg);
                        setSelectedConfig(newCfg);
                      }}
                      className="w-4 h-4 rounded accent-[var(--neon-green)] cursor-pointer"
                    />
                  </label>
                </div>

                {/* Auto-Contrast Status Badge & Feedback */}
                {selectedConfig.autoContrast ? (
                  <div className="p-2 rounded-lg bg-black/40 border border-zinc-800 flex items-start gap-2">
                    {isBright ? (
                      <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div className="text-[8px] text-zinc-300 leading-snug">
                      <strong className="text-white">
                        {isBright
                          ? 'High-Brightness Wallpaper Detected'
                          : isMedium
                          ? 'Balanced Brightness Detected'
                          : 'Dark Tone Wallpaper Detected'}
                      </strong>
                      <p className="text-zinc-400 mt-0.5">
                        {isBright
                          ? `Enforcing protective dark dimming (${effectiveDim}%) and obsidian bubble contrast shields so chat text is 100% legible.`
                          : isMedium
                          ? `Applying medium contrast protection (${effectiveDim}%) to balance image vibrance with text readability.`
                          : `Natural contrast active. Message bubbles render with crisp readability over dark tones.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-zinc-950/60 text-[7.5px] text-zinc-400">
                    Manual override enabled. Contrast guard is suspended.
                  </div>
                )}

                {/* Dimming & Soft Blur Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-zinc-850">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[8px] text-zinc-400">
                      <span>Dimming (Dark Overlay):</span>
                      <span className="text-white font-mono font-bold">{effectiveDim}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="85"
                      value={selectedConfig.dim}
                      onChange={(e) => {
                        const newCfg = {
                          ...selectedConfig,
                          dim: Number(e.target.value)
                        };
                        newCfg.effectiveDim = calculateEffectiveDim(newCfg);
                        setSelectedConfig(newCfg);
                      }}
                      className="w-full accent-[var(--neon-green)] bg-zinc-800 h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[8px] text-zinc-400">
                      <span>Soft Blur:</span>
                      <span className="text-white font-mono font-bold">{selectedConfig.blur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={selectedConfig.blur}
                      onChange={(e) =>
                        setSelectedConfig((prev) => ({
                          ...prev,
                          blur: Number(e.target.value)
                        }))
                      }
                      className="w-full accent-[var(--neon-green)] bg-zinc-800 h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

              </div>

              {/* FIRESTORE CLOUD PERSISTENCE OPTION */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-850 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Cloud className="w-3.5 h-3.5 text-[var(--neon-green)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-white uppercase truncate">
                      Save Preferred Choice to Firestore Cloud
                    </p>
                    <p className="text-[7.5px] text-zinc-400">
                      Syncs wallpaper across all your devices & sessions
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={syncToFirestore}
                  onChange={(e) => setSyncToFirestore(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--neon-green)] cursor-pointer shrink-0"
                />
              </div>

              {/* ACTION BUTTONS (Reset, Cancel, Set for All, Apply for this Chat) */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-zinc-900 shrink-0">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {hasOverride && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleResetDefault}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[9px] font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelAndRevert}
                    className="flex-1 sm:flex-initial px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[9px] font-bold uppercase transition cursor-pointer border border-zinc-800"
                  >
                    Cancel
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSetAllChats}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 rounded-xl text-[9px] font-bold uppercase transition cursor-pointer text-center disabled:opacity-50"
                  >
                    {isSaving ? 'Syncing...' : 'Set for All Chats'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleApplyThisChat}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-[var(--neon-green)] hover:bg-white text-black font-black rounded-xl text-[9px] uppercase transition cursor-pointer shadow-md text-center disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Apply to This Chat'}
                  </button>
                </div>
              </div>

            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
