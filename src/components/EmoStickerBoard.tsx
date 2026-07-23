import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Download, Clock, Star, Flame, Terminal, Plus, Check } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';

interface EmoStickerBoardProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'POPULAR REACTION',
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '🚀', '👀', '✨', '💯']
  },
  {
    name: 'SECURE CORE SYSTEM',
    emojis: ['🔒', '🔓', '🛡️', '🔑', '💻', '📡', '⚡', '🌌', '☠️', '☣️', '☣️', '🤖', '👾']
  },
  {
    name: 'EMOTIONAL TELEMETRY',
    emojis: ['😎', '😏', '🤔', '🧐', '🤨', '🤯', '🥵', '🥶', '😷', '👹', '💀', '👽', '💥']
  },
  {
    name: 'COMMUNICATION LINK',
    emojis: ['💬', '🗣️', '📢', '🔔', '📌', '📎', '📅', '📝', '📍', '✉️', '📥', '📤', '🟢']
  }
];

const STICKER_STORE_PACKS = [
  {
    id: 'pack-matrix',
    name: 'CRITICAL MATRIX',
    author: 'Flick AI Lab',
    desc: 'Cyberpunk terminal terminals and green E2EE nodes.',
    downloaded: true,
    stickers: [
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=lockNode',
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=keychain0',
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=shield00',
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=pulse',
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=cyberterminal',
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=decrypt00',
    ]
  },
  {
    id: 'pack-glitch',
    name: 'GLITCH FLICKER',
    author: 'Cyber_Artist_4',
    desc: 'Neon lights and glitchy elements.',
    downloaded: false,
    stickers: [
      'https://api.dicebear.com/7.x/identicon/svg?seed=glitchHeart',
      'https://api.dicebear.com/7.x/identicon/svg?seed=matrixSkull',
      'https://api.dicebear.com/7.x/identicon/svg?seed=neonFlicker',
      'https://api.dicebear.com/7.x/identicon/svg?seed=warningFlash',
      'https://api.dicebear.com/7.x/identicon/svg?seed=quantumWave',
      'https://api.dicebear.com/7.x/identicon/svg?seed=terminalError',
    ]
  },
  {
    id: 'pack-fun',
    name: 'FUN ANIME PIXELS',
    author: 'PixelMaster_Node',
    desc: 'Super express emotions for crypto communicators.',
    downloaded: false,
    stickers: [
      'https://api.dicebear.com/7.x/pixel-art/svg?seed=happy',
      'https://api.dicebear.com/7.x/pixel-art/svg?seed=wink',
      'https://api.dicebear.com/7.x/pixel-art/svg?seed=shock',
      'https://api.dicebear.com/7.x/pixel-art/svg?seed=angry',
      'https://api.dicebear.com/7.x/pixel-art/svg?seed=sleepy',
      'https://api.dicebear.com/7.x/pixel-art/svg?seed=cool',
    ]
  }
];

export default function EmoStickerBoard({ onSelectEmoji, onSelectSticker }: EmoStickerBoardProps) {
  const [activeBoardTab, setActiveBoardTab] = useState<'emojis' | 'stickers' | 'store'>('emojis');
  const [downloadedPacks, setDownloadedPacks] = useState<string[]>(['pack-matrix']);
  const [stickerPacks, setStickerPacks] = useState(STICKER_STORE_PACKS);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  const handleDownloadPack = (packId: string) => {
    playGlitchClickSound();
    setDownloadedPacks(prev => {
      if (prev.includes(packId)) return prev;
      playLikeSound();
      return [...prev, packId];
    });
    setStickerPacks(prev => prev.map(p => p.id === packId ? { ...p, downloaded: true } : p));
  };

  const handleEmojiClick = (emoji: string) => {
    playGlitchClickSound();
    // Add to recents
    setRecents(prev => {
      const filtered = prev.filter(x => x !== emoji);
      return [emoji, ...filtered].slice(0, 16);
    });
    onSelectEmoji(emoji);
  };

  const handleStickerClick = (stickerUrl: string) => {
    playGlitchClickSound();
    setRecents(prev => {
      const filtered = prev.filter(x => x !== stickerUrl);
      return [stickerUrl, ...filtered].slice(0, 16);
    });
    onSelectSticker(stickerUrl);
  };

  const toggleFavorite = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playGlitchClickSound();
    setFavorites(prev => {
      if (prev.includes(item)) {
        return prev.filter(x => x !== item);
      }
      return [...prev, item];
    });
  };

  return (
    <div className="w-full bg-[var(--color-surface)] border-2 border-[var(--neon-green)] shadow-[5px_5px_0_0_#000000] p-4 font-mono text-[var(--neon-green)] max-w-md select-none h-80 flex flex-col">
      
      {/* Board Selector Tabs */}
      <div className="flex border-b border-[var(--neon-green)]/35 pb-2 shrink-0 justify-between items-center text-[9px] font-mono">
        <div className="flex gap-1.5">
          <button
            onClick={() => { playGlitchClickSound(); setActiveBoardTab('emojis'); }}
            className={`px-3 py-1 border uppercase font-bold transition cursor-pointer ${
              activeBoardTab === 'emojis'
                ? 'bg-[var(--neon-green)] text-black border-transparent font-extrabold'
                : 'border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10'
            }`}
          >
            😜 EMOJIS
          </button>
          <button
            onClick={() => { playGlitchClickSound(); setActiveBoardTab('stickers'); }}
            className={`px-3 py-1 border uppercase font-bold transition cursor-pointer ${
              activeBoardTab === 'stickers'
                ? 'bg-[var(--neon-green)] text-black border-transparent font-extrabold'
                : 'border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10'
            }`}
          >
            🖼️ STICKERS
          </button>
        </div>

        <button
          onClick={() => { playGlitchClickSound(); setActiveBoardTab('store'); }}
          className={`flex items-center gap-1 px-2.5 py-1 text-yellow-500 hover:text-[var(--color-text)] transition cursor-pointer text-[8.5px] uppercase font-bold ${
            activeBoardTab === 'store' ? 'underline' : ''
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
          <span>PACKS STORE</span>
        </button>
      </div>

      {/* Main Board Body View scroll area */}
      <div className="flex-1 overflow-y-auto mt-3 pr-1 min-h-0 space-y-4">
        
        {activeBoardTab === 'emojis' && (
          <>
            {/* Recents area */}
            {recents.filter(r => !r.startsWith('http')).length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[8px] uppercase text-zinc-500 font-bold tracking-widest flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-500" /> RECENTS
                </span>
                <div className="flex flex-wrap gap-2">
                  {recents.filter(r => !r.startsWith('http')).map((emo, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEmojiClick(emo)}
                      className="text-lg hover:scale-125 transition p-1 cursor-pointer"
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Emoji Categories */}
            {EMOJI_CATEGORIES.map((cat, catIdx) => (
              <div key={catIdx} className="space-y-1.5">
                <span className="text-[8px] uppercase text-zinc-500 font-bold tracking-widest block border-b border-[var(--neon-green-border)]/60 pb-0.5">
                  ✦ {cat.name}
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {cat.emojis.map((emo, emoIdx) => (
                    <button
                      key={emoIdx}
                      onClick={() => handleEmojiClick(emo)}
                      className="text-xl hover:scale-125 transition cursor-pointer p-0.5"
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {activeBoardTab === 'stickers' && (
          <div className="space-y-4">
            {downloadedPacks.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-[10px]">
                No sticker packs downloaded currently.<br/>
                Visit the <span onClick={() => setActiveBoardTab('store')} className="text-yellow-500 cursor-pointer underline hover:text-[var(--color-text)]">Packs Store</span> to explore content.
              </div>
            ) : (
              stickerPacks.filter(p => downloadedPacks.includes(p.id)).map((pack) => (
                <div key={pack.id} className="space-y-2">
                  <span className="text-[8px] uppercase text-[var(--neon-green)] font-extrabold tracking-widest flex justify-between items-center bg-[var(--neon-green)]/10 px-2 py-1">
                    <span>{pack.name} ({pack.author})</span>
                    <span className="text-zinc-500 text-[7px]">{pack.desc}</span>
                  </span>

                  <div className="grid grid-cols-4 gap-2">
                    {pack.stickers.map((stickerUrl, sIdx) => {
                      const isFav = favorites.includes(stickerUrl);
                      return (
                        <div
                          key={sIdx}
                          onClick={() => handleStickerClick(stickerUrl)}
                          className="border border-[var(--neon-green-border)]/80 bg-[var(--color-surface)] p-2 flex items-center justify-center cursor-pointer hover:border-[var(--neon-green)] transition relative group"
                        >
                          <img src={stickerUrl} className="w-12 h-12 object-contain" alt="Sticker asset" />
                          
                          <button
                            onClick={(e) => toggleFavorite(stickerUrl, e)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition p-0.5 hover:scale-125 text-yellow-500 shrink-0"
                            title="Favorite sticker"
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-yellow-500' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeBoardTab === 'store' && (
          <div className="space-y-3.5">
            <span className="text-[8.5px] uppercase text-zinc-400 block font-bold tracking-widest border-b border-[var(--neon-green-border)] pb-1">
              🔋 CLOUD DIRECTORY SYSTEM PACKS
            </span>

            {stickerPacks.map((pack) => {
              const isDownloaded = downloadedPacks.includes(pack.id);
              return (
                <div key={pack.id} className="border border-[var(--neon-green-border)]/80 bg-[var(--color-surface)] p-3 flex justify-between items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-[var(--color-text)]">
                      <span>{pack.name}</span>
                      <span className="text-[7.5px] font-mono text-zinc-500 font-normal">by {pack.author}</span>
                    </div>
                    <p className="text-[8.5px] text-zinc-400 italic font-serif leading-light">{pack.desc}</p>
                    <div className="flex gap-2">
                      {pack.stickers.slice(0, 3).map((st, idx) => (
                        <img key={idx} src={st} className="w-6 h-6 object-contain opacity-50" alt="sticker preview" />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => !isDownloaded && handleDownloadPack(pack.id)}
                    disabled={isDownloaded}
                    className={`px-3 py-1.5 uppercase font-bold text-[8.5px] tracking-wider transition cursor-pointer flex items-center gap-1 border ${
                      isDownloaded
                        ? 'border-zinc-700 text-zinc-500 bg-transparent'
                        : 'border-[var(--neon-green)] text-black bg-[var(--neon-green)] hover:bg-white hover:text-black'
                    }`}
                  >
                    {isDownloaded ? (
                      <>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>READY</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>FETCH</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
