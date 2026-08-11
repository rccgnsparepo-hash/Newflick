import React from 'react';
import { Zap, Bell, Settings, Search, Volume2, VolumeX } from 'lucide-react';
import { playGlitchClickSound, triggerVibration } from '../../lib/sounds';

interface MobileHeaderProps {
  profile: any;
  unreadNotifCount: number;
  isOnline: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  setShowCinematicIntro?: (show: boolean) => void;
  onOpenSearch?: () => void;
  onToggleNotifications?: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  selectedCampus: string;
  onCampusChange: (campus: string) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  profile,
  unreadNotifCount,
  isOnline,
  setIsSettingsOpen,
  setShowCinematicIntro,
  onOpenSearch,
  onToggleNotifications,
  soundMuted,
  onToggleSound,
  selectedCampus,
  onCampusChange
}) => {
  return (
    <header className="md:hidden sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 px-3.5 py-3 flex items-center justify-between select-none">
      {/* Brand & Campus Selector */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <div 
          onClick={() => {
            playGlitchClickSound();
            if (setShowCinematicIntro) setShowCinematicIntro(true);
          }}
          className="w-9 h-9 rounded-2xl bg-[#f9553a] flex items-center justify-center shrink-0 cursor-pointer shadow-sm text-white"
        >
          <Zap className="w-5 h-5 fill-white" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-1.5">
            <h1 className="font-sans font-black text-sm tracking-tight text-slate-900 uppercase truncate">
              FLICK
            </h1>
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-red-500'}`} />
          </div>
          <select
            value={selectedCampus}
            onChange={(e) => onCampusChange(e.target.value)}
            className="bg-transparent text-[9px] font-bold text-slate-500 focus:outline-none cursor-pointer max-w-[130px] truncate"
          >
            <option value="Global Feed" className="bg-white text-slate-900">🌐 GLOBAL FEED</option>
            <option value="University of Lagos" className="bg-white text-slate-900">🦅 UNILAG</option>
            <option value="Covenant University" className="bg-white text-slate-900">🦅 COVENANT</option>
            <option value="Babcock University" className="bg-white text-slate-900">⚡ BABCOCK</option>
          </select>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center space-x-2">
        {/* Search */}
        {onOpenSearch && (
          <button
            onClick={() => {
              playGlitchClickSound();
              onOpenSearch();
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 active:scale-95 transition cursor-pointer"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {/* Sound toggle */}
        <button
          onClick={() => {
            playGlitchClickSound();
            onToggleSound();
          }}
          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 active:scale-95 transition cursor-pointer"
          title="Audio Switch"
        >
          {soundMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-[#f9553a]" />}
        </button>

        {/* Notifications */}
        {onToggleNotifications && (
          <button
            onClick={() => {
              playGlitchClickSound();
              onToggleNotifications();
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 relative active:scale-95 transition cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#f9553a] rounded-full ring-2 ring-white animate-ping" />
            )}
          </button>
        )}

        {/* Profile / Settings */}
        <button
          onClick={() => {
            playGlitchClickSound();
            setIsSettingsOpen(true);
          }}
          className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-[#f9553a] active:scale-95 transition shrink-0 cursor-pointer"
          title="Settings"
        >
          <img 
            src={profile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
            alt="Profile" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </button>
      </div>
    </header>
  );
};
