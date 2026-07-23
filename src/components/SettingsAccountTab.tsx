import React, { useRef, useState } from 'react';
import { User, Image as ImageIcon, Sparkles, Loader2, Trash2, ShieldAlert, Key, Copy, Eye, EyeOff, Lock } from 'lucide-react';
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
  const { deleteAccount, profile, changeGlobalKeyPassword } = useAuth();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showPass, setShowPass] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

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

  const handleCopyPasskey = () => {
    playGlitchClickSound();
    if (profile?.globalKeyPassword) {
      navigator.clipboard.writeText(profile.globalKeyPassword);
      showBrutalistToast('COPIED TO CLIPBOARD', 'Secure global key password has been copied.', 'success');
    }
  };

  const handleSaveCustomPassword = async () => {
    playGlitchClickSound();
    if (!customPassword.trim()) {
      showBrutalistToast('ERROR', 'Key password cannot be empty.', 'error');
      return;
    }
    if (customPassword.trim().length < 6) {
      showBrutalistToast('ERROR', 'Key password must be at least 6 characters.', 'error');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await changeGlobalKeyPassword(customPassword.trim());
      setCustomPassword('');
    } catch (err) {
      console.error(err?.message || err);
    } finally {
      setIsUpdatingPassword(false);
    }
  };


  return (
    <div className="space-y-5">
      <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
        <User className="w-4 h-4" /> SECURE IDENTITY PREFERENCES
      </h3>

      {/* Avatar Section */}
      <div className="flex flex-col items-center space-y-3 p-4 bg-[var(--color-surface)] border border-[var(--neon-green)]/15">
        <div className="relative w-20 h-20 border border-[var(--neon-green)]/35 bg-[var(--color-surface)] overflow-hidden rounded-none">
          {photoURL ? (
            <img src={photoURL} alt="Profile preview" className="w-[100%] h-[100%] object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-[100%] h-[100%] flex items-center justify-center text-zinc-400 font-serif text-3xl italic">
              {displayName.charAt(0) || '?'}
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-[var(--color-surface)]/80 flex items-center justify-center text-[var(--color-text)]">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--neon-green)]" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 text-[9px] font-mono uppercase border border-[var(--neon-green)]/35 hover:border-[var(--neon-green)] text-zinc-300 transition cursor-pointer flex items-center gap-1 bg-[var(--color-surface)]"
          >
            <ImageIcon className="w-3 h-3 text-[var(--neon-green)]" />
            Upload custom Photo
          </button>
          
          <button
            type="button"
            onClick={generateRandomSeedAvatar}
            className="px-2.5 py-1 text-[9px] font-mono uppercase border border-[var(--neon-green)]/35 hover:border-[var(--neon-green)] text-zinc-300 transition cursor-pointer flex items-center gap-1 bg-[var(--color-surface)]"
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
          className="w-full bg-[var(--color-surface)] border border-[var(--neon-green)]/30 px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] font-mono"
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
          className="w-full bg-[var(--color-surface)] border border-[var(--neon-green)]/30 px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] font-sans leading-relaxed resize-none"
        />
      </div>

      {/* E2EE Global Pass Key Sync Backup */}
      <div className="bg-[var(--color-surface)] border border-[var(--neon-green)]/20 p-3.5 space-y-3">
        <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--neon-green)] font-mono flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-[var(--neon-green)] animate-pulse" /> E2EE GLOBAL PASSKEY BACKUP
        </h4>
        <p className="text-[9px] text-zinc-400 font-sans leading-normal">
          This Global Passkey symmetrically encrypts your private key and stores it securely in the cloud. Enter this passkey on any other browser or device to unlock all encrypted chats in real-time.
        </p>

        {profile?.globalKeyPassword ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 bg-[var(--color-surface)] border border-[var(--neon-green)]/15 px-3 py-2 font-mono text-xs flex items-center justify-between">
                <span className="text-zinc-500 text-[10px] select-none mr-2">CURRENT:</span>
                <span className="text-[var(--color-text)] select-all font-bold tracking-wider flex-1 overflow-x-auto whitespace-nowrap">
                  {showPass ? profile.globalKeyPassword : '••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => { playGlitchClickSound(); setShowPass(!showPass); }}
                    className="p-1 hover:text-[var(--neon-green)] text-zinc-400 cursor-pointer transition"
                    title={showPass ? "Hide Passkey" : "Reveal Passkey"}
                  >
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPasskey}
                    className="p-1 hover:text-[var(--neon-green)] text-zinc-400 cursor-pointer transition"
                    title="Copy to Clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[9px] text-yellow-500 font-mono uppercase">
            ⚠️ No active Global Key Password found. Update your profile to provision.
          </p>
        )}

        <div className="border-t border-[var(--neon-green)]/10 pt-2.5 space-y-2">
          <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-400 font-mono">
            Customize Key Password
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter secure password (min 6 chars)..."
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--neon-green)]/20 px-2.5 py-1.5 text-xs text-[var(--color-text)] placeholder-zinc-600 focus:outline-none focus:border-[var(--neon-green)] font-mono"
            />
            <button
              type="button"
              disabled={isUpdatingPassword}
              onClick={handleSaveCustomPassword}
              className="px-3 py-1.5 bg-[var(--neon-green)] hover:bg-[#00e600] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-mono text-[9px] font-extrabold uppercase transition cursor-pointer flex items-center gap-1"
            >
              {isUpdatingPassword ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              Sync
            </button>
          </div>
        </div>
      </div>

      {/* Secure Tour options block */}
      <div className="bg-[var(--color-surface)] border border-dashed border-[var(--neon-green)]/15 p-3.5 space-y-2.5">
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
          className="w-full text-center py-2 bg-[var(--color-surface)] border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black font-mono text-[9px] uppercase cursor-pointer"
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
            className="w-full text-center py-2 bg-[var(--color-surface)] border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-black font-mono text-[9px] uppercase cursor-pointer transition"
          >
            💀 WIPE NODE & DELETE ACCOUNT
          </button>
        ) : (
          <div className="space-y-2 bg-[var(--color-surface)] border border-red-500 p-2.5">
            <p className="text-[8.5px] text-red-400 font-mono uppercase text-center tracking-wider">
              ⚠️ DOUBLE CONFIRMATION REQUIRED. THIS ACTION IS IRREVERSIBLE!
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                className="flex-1 py-1.5 bg-red-600 text-[var(--color-text)] font-mono text-[9.5px] uppercase hover:bg-red-700 disabled:opacity-50"
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
                className="flex-1 py-1.5 bg-[var(--color-surface)] border border-zinc-700 text-zinc-300 font-mono text-[9.5px] uppercase hover:bg-zinc-800"
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
