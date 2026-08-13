import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, UserCheck, MessageSquare, PhoneCall, Users, Sparkles, Check } from 'lucide-react';
import { getSavedPrivacySettings, savePrivacySettings, UserPrivacySettings } from '../lib/securityService';
import { playGlitchClickSound } from '../lib/sounds';
import { showBrutalistToast } from '../lib/toast';

interface SettingsPrivacyTabProps {
  userId: string;
}

export function SettingsPrivacyTab({ userId }: SettingsPrivacyTabProps) {
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() => getSavedPrivacySettings(userId));

  useEffect(() => {
    setPrivacy(getSavedPrivacySettings(userId));
  }, [userId]);

  const updateSetting = <K extends keyof UserPrivacySettings>(key: K, val: UserPrivacySettings[K]) => {
    playGlitchClickSound();
    const updated = { ...privacy, [key]: val };
    setPrivacy(updated);
    savePrivacySettings(userId, updated);
    showBrutalistToast('PRIVACY UPDATED', 'Privacy settings saved to profile node.', 'success');
  };

  return (
    <div className="space-y-6 text-[var(--color-text)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--neon-green)]/30 pb-3">
        <Eye className="w-5 h-5 text-[var(--neon-green)]" />
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider">PRIVACY & DISCOVERY CONTROLS</h3>
      </div>

      {/* Visibility Toggles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Last Seen */}
        <div className="p-3 border border-zinc-800 bg-[var(--color-background)] space-y-2">
          <label className="font-mono text-xs font-bold uppercase block text-zinc-300">Last Seen</label>
          <select
            value={privacy.lastSeen}
            onChange={(e) => updateSetting('lastSeen', e.target.value as any)}
            className="w-full bg-black border border-[var(--neon-green)]/40 px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">My Contacts Only</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>

        {/* Online Status */}
        <div className="p-3 border border-zinc-800 bg-[var(--color-background)] space-y-2">
          <label className="font-mono text-xs font-bold uppercase block text-zinc-300">Online Status Badge</label>
          <select
            value={privacy.onlineStatus}
            onChange={(e) => updateSetting('onlineStatus', e.target.value as any)}
            className="w-full bg-black border border-[var(--neon-green)]/40 px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">My Contacts Only</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>

        {/* Who Can Message Me */}
        <div className="p-3 border border-zinc-800 bg-[var(--color-background)] space-y-2">
          <label className="font-mono text-xs font-bold uppercase block text-zinc-300 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            Who Can Message Me
          </label>
          <select
            value={privacy.whoCanMessageMe}
            onChange={(e) => updateSetting('whoCanMessageMe', e.target.value as any)}
            className="w-full bg-black border border-[var(--neon-green)]/40 px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">My Contacts Only</option>
          </select>
        </div>

        {/* Who Can Call Me */}
        <div className="p-3 border border-zinc-800 bg-[var(--color-background)] space-y-2">
          <label className="font-mono text-xs font-bold uppercase block text-zinc-300 flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            Who Can Call Me
          </label>
          <select
            value={privacy.whoCanCallMe}
            onChange={(e) => updateSetting('whoCanCallMe', e.target.value as any)}
            className="w-full bg-black border border-[var(--neon-green)]/40 px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">My Contacts Only</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>

        {/* Who Can Add Me To Groups */}
        <div className="p-3 border border-zinc-800 bg-[var(--color-background)] space-y-2">
          <label className="font-mono text-xs font-bold uppercase block text-zinc-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            Who Can Add Me to Groups
          </label>
          <select
            value={privacy.whoCanAddToGroups}
            onChange={(e) => updateSetting('whoCanAddToGroups', e.target.value as any)}
            className="w-full bg-black border border-[var(--neon-green)]/40 px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none"
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">My Contacts Only</option>
          </select>
        </div>

        {/* Story Visibility */}
        <div className="p-3 border border-zinc-800 bg-[var(--color-background)] space-y-2">
          <label className="font-mono text-xs font-bold uppercase block text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Story Default Visibility
          </label>
          <select
            value={privacy.storyVisibility}
            onChange={(e) => updateSetting('storyVisibility', e.target.value as any)}
            className="w-full bg-black border border-[var(--neon-green)]/40 px-3 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none"
          >
            <option value="public">Public</option>
            <option value="contacts">Contacts Only</option>
            <option value="private">Private (Only Me)</option>
          </select>
        </div>

      </div>

      {/* Read Receipts & Typing Indicators */}
      <div className="p-4 border border-[var(--neon-green-border)] bg-[var(--color-background)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs font-bold uppercase">Read Receipts</p>
            <p className="text-[10px] text-zinc-400">Allow contacts to see when you have read their messages</p>
          </div>
          <button
            type="button"
            onClick={() => updateSetting('readReceipts', !privacy.readReceipts)}
            className={`px-3 py-1 text-[10px] font-mono uppercase font-bold border transition-all ${
              privacy.readReceipts
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                : 'border-zinc-700 text-zinc-400'
            }`}
          >
            {privacy.readReceipts ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <div>
            <p className="font-mono text-xs font-bold uppercase">Typing Indicator</p>
            <p className="text-[10px] text-zinc-400">Show typing animation status when composing messages</p>
          </div>
          <button
            type="button"
            onClick={() => updateSetting('typingIndicator', !privacy.typingIndicator)}
            className={`px-3 py-1 text-[10px] font-mono uppercase font-bold border transition-all ${
              privacy.typingIndicator
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)]'
                : 'border-zinc-700 text-zinc-400'
            }`}
          >
            {privacy.typingIndicator ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
