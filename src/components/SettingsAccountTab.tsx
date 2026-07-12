import React, { useRef, useState } from 'react';
import { User, Image as ImageIcon, Sparkles, Loader2, Trash2, ShieldAlert } from 'lucide-react';
import { playGlitchClickSound } from '../lib/sounds';
import { useAuth } from '../contexts/AuthContext';
import { showBrutalistToast } from '../lib/toast';

interface AccountTabProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  bio: string;
  setBio: (val: string) => void;
  photoURL: string;
  setPhotoURL: (val: string) => void;
  isUploading: boolean;
  handlePictureUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReplayTour?: () => void;
  onClose: () => void;
}

export function SettingsAccountTab({
  displayName,
  setDisplayName,
  bio,
  setBio,
  photoURL,
  setPhotoURL,
  isUploading,
  handlePictureUpload,
  onReplayTour,
  onClose
}: AccountTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { deleteAccount } = useAuth();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const generateRandomSeedAvatar = () => {
    playGlitchClickSound();
    const randomSeed = Math.floor(Math.random() * 100000);
    const url = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${randomSeed}`;
    setPhotoURL(url);
  };

  const handleDeleteAccount = async () => {
    playGlitchClickSound();
    setIsDeleting(true);
    try {
      await deleteAccount();
      onClose();
    } catch (err) {
      console.warn(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
        <User className="w-4 h-4" /> SECURE IDENTITY PREFERENCES
      </h3>

      {/* Avatar Section */}
      <div className="flex flex-col items-center space-y-3 p-4 bg-[#0c0c0c] border border-[var(--neon-green)]/15">
        <div className="relative w-20 h-20 border border-[var(--neon-green)]/35 bg-black overflow-hidden rounded-none">
          {photoURL ? (
            <img src={photoURL} alt="Profile preview" className="w-[100%] h-[100%] object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-[100%] h-[100%] flex items-center justify-center text-zinc-400 font-serif text-3xl italic">
              {displayName.charAt(0) || '?'}
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--neon-green)]" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 text-[9px] font-mono uppercase border border-[var(--neon-green)]/35 hover:border-[var(--neon-green)] text-zinc-300 transition cursor-pointer flex items-center gap-1 bg-black"
          >
            <ImageIcon className="w-3 h-3 text-[var(--neon-green)]" />
            Upload custom Photo
          </button>
          
          <button
            type="button"
            onClick={generateRandomSeedAvatar}
            className="px-2.5 py-1 text-[9px] font-mono uppercase border border-[var(--neon-green)]/35 hover:border-[var(--neon-green)] text-zinc-300 transition cursor-pointer flex items-center gap-1 bg-black"
          >
            <Sparkles className="w-3 h-3 text-[var(--neon-green)]" />
            Generate Random Seed
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePictureUpload}
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* Display Name Input */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 font-mono">
          Decrypted Name Alias
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          required
          className="w-full bg-black border border-[var(--neon-green)]/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--neon-green)] font-mono"
        />
      </div>

      {/* Bio input */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-zinc-400 font-mono">
          <span>Identity Biography</span>
          <span className="opacity-60">{bio.length}/300</span>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Declare your secure public thought matrix..."
          className="w-full bg-black border border-[var(--neon-green)]/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--neon-green)] font-sans leading-relaxed resize-none"
        />
      </div>

      {/* Secure Tour options block */}
      <div className="bg-[#090909] border border-dashed border-[var(--neon-green)]/15 p-3.5 space-y-2.5">
        <h4 className="text-[10px] uppercase tracking-wider font-bold text-[var(--neon-green)] font-mono">Guided walk-through system</h4>
        <p className="text-[9px] text-zinc-400 font-sans leading-normal">
          Not sure how to navigate social streams or post key fragments? Re-initialize the interactive system tour guide overlay.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onReplayTour) onReplayTour();
          }}
          className="w-full text-center py-2 bg-black border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black font-mono text-[9px] uppercase cursor-pointer"
        >
          🚀 Trigger Tour Guide
        </button>
      </div>

      {/* DANGER ZONE - Account Deletion */}
      <div className="bg-[#120505] border border-red-500/20 p-3.5 space-y-2.5">
        <h4 className="text-[10px] uppercase tracking-wider font-bold text-red-500 font-mono flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 animate-pulse text-red-500" /> DEREGISTRATION ZONE [HIGH RISK]
        </h4>
        <p className="text-[9px] text-zinc-400 font-sans leading-normal">
          Deregistering your cryptographic node will permanently delete your identity document, local keystore references, and credentials.
        </p>
        
        {!showConfirmDelete ? (
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              setShowConfirmDelete(true);
            }}
            className="w-full text-center py-2 bg-black border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-black font-mono text-[9px] uppercase cursor-pointer transition"
          >
            💀 WIPE NODE & DELETE ACCOUNT
          </button>
        ) : (
          <div className="space-y-2 bg-black border border-red-500 p-2.5">
            <p className="text-[8.5px] text-red-400 font-mono uppercase text-center tracking-wider">
              ⚠️ DOUBLE CONFIRMATION REQUIRED. THIS ACTION IS IRREVERSIBLE!
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                className="flex-1 py-1.5 bg-red-600 text-white font-mono text-[9.5px] uppercase hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Wiping Node...' : 'YES, WIPE FOREVER'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  playGlitchClickSound();
                  setShowConfirmDelete(false);
                }}
                className="flex-1 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[9.5px] uppercase hover:bg-zinc-800"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
