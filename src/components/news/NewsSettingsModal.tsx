import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, X, Shield, Check, Info } from 'lucide-react';
import { NewsNotificationSettings } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { playGlitchClickSound } from '../../lib/sounds';

interface NewsSettingsModalProps {
  onClose: () => void;
}

export const NewsSettingsModal: React.FC<NewsSettingsModalProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<NewsNotificationSettings>(() => 
    newsService.getNotificationSettings()
  );
  const [saved, setSaved] = useState(false);

  const toggleSetting = (key: keyof NewsNotificationSettings) => {
    playGlitchClickSound();
    const updated = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(updated);
    newsService.saveNotificationSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const ITEMS: { key: keyof NewsNotificationSettings; title: string; desc: string; icon: string }[] = [
    { key: 'breakingNews', title: 'Breaking News Alerts', desc: 'Instant high-priority alerts for major domestic & world events', icon: '🔴' },
    { key: 'following', title: 'Followed Sources & Campuses', desc: 'Updates from publishers and universities you actively follow', icon: '⭐' },
    { key: 'nigeria', title: 'Nigeria National & State Feed', desc: 'Daily digests for Lagos, Abuja, Politics and National security', icon: '🇳🇬' },
    { key: 'technology', title: 'Tech & Fintech Wire', desc: 'Startups, Web3, AI developments, and product launches', icon: '⚡' },
    { key: 'campus', title: 'Campus & Education Alerts', desc: 'ASUU announcements, exam dates, student union updates', icon: '🎓' },
    { key: 'sports', title: 'Sports & Football', desc: 'Match results, Premier League, Super Eagles & transfer wires', icon: '⚽' },
    { key: 'business', title: 'Business & Economy', desc: 'FX rates, Naira market changes, stock exchanges & policy', icon: '💼' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 font-mono select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md bg-zinc-950 border-2 border-zinc-800 shadow-[8px_8px_0_0_#000] p-4 sm:p-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--neon-green)]" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              NEWS ALERTS & PREFERENCES
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toggles */}
        <div className="space-y-3 mb-5 max-h-[60vh] overflow-y-auto pr-1">
          {ITEMS.map((item) => {
            const isEnabled = !!settings[item.key];
            return (
              <div
                key={item.key}
                onClick={() => toggleSetting(item.key)}
                className="p-3 bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-zinc-100">{item.title}</div>
                    <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{item.desc}</div>
                  </div>
                </div>

                <div className={`w-9 h-5 rounded-full p-0.5 transition ${isEnabled ? 'bg-[var(--neon-green)]' : 'bg-zinc-800'}`}>
                  <div className={`w-4 h-4 rounded-full bg-black transition transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Shield className="w-3 h-3 text-[var(--neon-green)]" />
            Zero trackers · Strictly private
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--neon-green)] text-black font-black text-xs uppercase"
          >
            {saved ? 'Saved!' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
