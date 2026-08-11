import React, { useState } from 'react';
import { 
  School, 
  Radio, 
  MessageSquare, 
  Sparkles, 
  Briefcase, 
  User, 
  Search, 
  Bell, 
  Settings, 
  HelpCircle, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Volume2,
  VolumeX,
  Zap,
  SlidersHorizontal
} from 'lucide-react';
import { TabType } from '../../lib/navigationService';
import { playGlitchClickSound, triggerVibration } from '../../lib/sounds';

interface DesktopSidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreadE2EECount: number;
  unreadNotifCount: number;
  profile: any;
  logout: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsShortcutsOpen: (open: boolean) => void;
  setIsFeedbackOpen: (open: boolean) => void;
  setShowCinematicIntro?: (show: boolean) => void;
  onOpenSearch?: () => void;
  onToggleNotifications?: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  selectedCampus: string;
  onCampusChange: (campus: string) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  setActiveTab,
  unreadE2EECount,
  unreadNotifCount,
  profile,
  logout,
  setIsSettingsOpen,
  setIsShortcutsOpen,
  setIsFeedbackOpen,
  setShowCinematicIntro,
  onOpenSearch,
  onToggleNotifications,
  soundMuted,
  onToggleSound,
  selectedCampus,
  onCampusChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    {
      id: 'home' as TabType,
      label: 'Home Chronicles',
      icon: School,
      badge: null,
      color: 'text-[#f9553a]',
    },
    {
      id: 'news' as TabType,
      label: 'Campus Signal',
      icon: Radio,
      badge: null,
      color: 'text-amber-600',
    },
    {
      id: 'chat' as TabType,
      label: 'Crypto Tunnels',
      icon: MessageSquare,
      badge: unreadE2EECount > 0 ? unreadE2EECount : null,
      badgeColor: 'bg-[#f9553a] text-white',
      color: 'text-cyan-600',
    },
    {
      id: 'match' as TabType,
      label: 'Peer Matcher',
      icon: Sparkles,
      badge: null,
      color: 'text-pink-600',
    },
    {
      id: 'workspace' as TabType,
      label: 'Workspace Hub',
      icon: Briefcase,
      badge: null,
      color: 'text-emerald-600',
    },
    {
      id: 'profile' as TabType,
      label: 'Student Profile',
      icon: User,
      badge: null,
      color: 'text-purple-600',
    },
  ];

  const handleNavClick = (tab: TabType) => {
    playGlitchClickSound();
    triggerVibration('light');
    setActiveTab(tab);
  };

  return (
    <aside 
      className={`hidden md:flex flex-col justify-between h-[calc(100%-16px)] bg-[#f8cfc5]/90 backdrop-blur-md rounded-[32px] my-2 ml-2 transition-all duration-300 z-40 shrink-0 select-none overflow-y-auto shadow-sm border border-white/60 ${
        isExpanded ? 'w-60 p-4' : 'w-20 p-3'
      }`}
    >
      {/* TOP: BRANDING & TOGGLE */}
      <div className="space-y-5 flex flex-col items-center w-full">
        {/* Brand Header / Menu Toggle */}
        <div className="flex items-center justify-between w-full pb-2 border-b border-rose-200/50">
          <button
            onClick={() => {
              playGlitchClickSound();
              setIsExpanded(!isExpanded);
            }}
            className="w-11 h-11 rounded-2xl bg-white/70 hover:bg-white text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0 shadow-sm"
            title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isExpanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          {isExpanded && (
            <div 
              onClick={() => {
                playGlitchClickSound();
                if (setShowCinematicIntro) setShowCinematicIntro(true);
              }}
              className="flex items-center space-x-2 cursor-pointer group min-w-0 pr-1"
            >
              <div className="w-8 h-8 rounded-xl bg-[#f9553a] flex items-center justify-center shrink-0 shadow-md">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-xs text-slate-900 tracking-tight uppercase truncate">
                FLICK
              </span>
            </div>
          )}
        </div>

        {/* Campus Gateway Selector (If Expanded) */}
        {isExpanded && (
          <div className="w-full space-y-1">
            <label className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest px-1 block">
              CAMPUS GATEWAY
            </label>
            <select
              value={selectedCampus}
              onChange={(e) => onCampusChange(e.target.value)}
              className="w-full bg-white/80 border border-rose-200 rounded-2xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f9553a] cursor-pointer shadow-sm"
            >
              <option value="Global Feed">🌐 GLOBAL CAMPUS FEED</option>
              <option value="University of Lagos">🦅 UNILAG (LAGOS)</option>
              <option value="Covenant University">🦅 COVENANT UNIV</option>
              <option value="Babcock University">⚡ BABCOCK UNIV</option>
            </select>
          </div>
        )}

        {/* MAIN NAVIGATION LINKS */}
        <nav className="space-y-2.5 w-full flex flex-col items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative flex items-center transition-all duration-200 cursor-pointer group ${
                  isExpanded ? 'w-full px-3.5 py-3 space-x-3 rounded-2xl' : 'justify-center w-12 h-12 rounded-2xl'
                } ${
                  isActive 
                    ? 'bg-[#f9553a] text-white shadow-lg shadow-[#f9553a]/30 font-extrabold scale-105' 
                    : 'bg-white/50 hover:bg-white text-slate-700 hover:text-slate-900 shadow-sm'
                }`}
                title={item.label}
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-700'}`} />
                  {item.badge && !isExpanded && (
                    <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center bg-red-600 text-white shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider truncate">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-red-600 text-white shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* QUICK UTILITIES */}
        <div className="space-y-2 w-full pt-3 border-t border-rose-200/50 flex flex-col items-center">
          {/* Search Button */}
          {onOpenSearch && (
            <button
              onClick={() => {
                playGlitchClickSound();
                onOpenSearch();
              }}
              className={`flex items-center text-slate-700 hover:bg-white rounded-2xl transition cursor-pointer shadow-sm ${
                isExpanded ? 'w-full px-3.5 py-2.5 space-x-3 bg-white/50' : 'justify-center w-11 h-11 bg-white/50'
              }`}
              title="Search"
            >
              <Search className="w-4.5 h-4.5 text-slate-700 shrink-0" />
              {isExpanded && (
                <span className="text-xs font-bold uppercase tracking-wider">Search</span>
              )}
            </button>
          )}

          {/* Notifications Button */}
          {onToggleNotifications && (
            <button
              onClick={() => {
                playGlitchClickSound();
                onToggleNotifications();
              }}
              className={`flex items-center text-slate-700 hover:bg-white rounded-2xl transition cursor-pointer shadow-sm relative ${
                isExpanded ? 'w-full px-3.5 py-2.5 space-x-3 bg-white/50' : 'justify-center w-11 h-11 bg-white/50'
              }`}
              title="Notifications"
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <Bell className="w-4.5 h-4.5 text-amber-600" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#f9553a] rounded-full animate-ping" />
                )}
              </div>
              {isExpanded && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider">Alerts</span>
                  {unreadNotifCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#f9553a] text-white text-[9px] font-black rounded-full">
                      {unreadNotifCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => {
              playGlitchClickSound();
              onToggleSound();
            }}
            className={`flex items-center text-slate-700 hover:bg-white rounded-2xl transition cursor-pointer shadow-sm ${
              isExpanded ? 'w-full px-3.5 py-2.5 space-x-3 bg-white/50' : 'justify-center w-11 h-11 bg-white/50'
            }`}
            title="Audio Settings"
          >
            {soundMuted ? (
              <VolumeX className="w-4.5 h-4.5 text-red-500 shrink-0" />
            ) : (
              <Volume2 className="w-4.5 h-4.5 text-[#f9553a] shrink-0" />
            )}
            {isExpanded && (
              <span className="text-xs font-bold uppercase tracking-wider">Audio {soundMuted ? 'Muted' : 'On'}</span>
            )}
          </button>
        </div>
      </div>

      {/* BOTTOM: USER PROFILE & SETTINGS */}
      <div className="pt-3 border-t border-rose-200/50 space-y-2 w-full flex flex-col items-center">
        {profile && (
          <div className={`p-1.5 bg-white/80 rounded-2xl flex items-center shadow-sm ${
            isExpanded ? 'w-full space-x-2.5 p-2' : 'justify-center w-11 h-11'
          }`}>
            <img 
              src={profile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
              alt={profile.displayName || 'Student'} 
              className="w-8 h-8 rounded-xl object-cover ring-2 ring-[#f9553a]/30 shrink-0"
              referrerPolicy="no-referrer"
            />
            {isExpanded && (
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-extrabold text-slate-900 truncate uppercase">
                  {profile.displayName || 'STUDENT'}
                </h4>
                <p className="text-[9px] font-medium text-slate-500 truncate lowercase">
                  {profile.email || 'verified'}
                </p>
              </div>
            )}
          </div>
        )}

        <div className={`flex items-center ${isExpanded ? 'w-full space-x-2' : 'flex-col space-y-2'}`}>
          <button
            onClick={() => {
              playGlitchClickSound();
              setIsSettingsOpen(true);
            }}
            className="w-11 h-11 bg-white/70 hover:bg-white text-slate-700 hover:text-[#f9553a] rounded-2xl flex items-center justify-center transition cursor-pointer shadow-sm"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              logout();
            }}
            className="w-11 h-11 bg-rose-100 hover:bg-rose-500 text-rose-600 hover:text-white rounded-2xl flex items-center justify-center transition cursor-pointer shadow-sm"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
