import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Keyboard, 
  LogOut, 
  Bell, 
  Check, 
  Wifi, 
  WifiOff, 
  Battery, 
  BatteryCharging,
  Sliders,
  Sparkle,
  Radio,
  MessageSquare,
  Zap
} from 'lucide-react';
import { ConnectionStatusBadge } from '../ConnectionStatusBadge';
import { useNotificationSystem } from '../../lib/notificationSystem';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
}

export const VisualBatteryGauge: React.FC<{
  batteryLevel: number | null;
  isCharging: boolean;
  compact?: boolean;
}> = ({ batteryLevel, isCharging, compact = false }) => {
  const percentage = batteryLevel !== null ? Math.round(batteryLevel * 100) : null;
  
  // Dynamic color configuration
  let colorClasses = 'border-[var(--neon-green)]/35 bg-[var(--color-surface)] text-[var(--neon-green)]';
  let barFillColor = 'bg-[var(--neon-green)]';
  let statusBadge = 'OPTIMAL';

  if (isCharging) {
    colorClasses = 'border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.35)]';
    barFillColor = 'bg-cyan-400';
    statusBadge = 'CHARGING';
  } else if (percentage !== null) {
    if (percentage > 60) {
      colorClasses = 'border-emerald-500/50 bg-emerald-950/25 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
      barFillColor = 'bg-emerald-400';
      statusBadge = 'OPTIMAL';
    } else if (percentage > 25) {
      colorClasses = 'border-amber-500/60 bg-amber-950/30 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]';
      barFillColor = 'bg-amber-400';
      statusBadge = 'MODERATE';
    } else if (percentage > 10) {
      colorClasses = 'border-orange-500/70 bg-orange-950/40 text-orange-400 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.3)]';
      barFillColor = 'bg-orange-500';
      statusBadge = 'LOW';
    } else {
      colorClasses = 'border-red-500 bg-red-955/50 text-red-400 animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.5)]';
      barFillColor = 'bg-red-500';
      statusBadge = 'CRITICAL';
    }
  }

  const tooltipText = percentage !== null
    ? `${isCharging ? '⚡ Grid Power Active (Charging)' : `Battery Level: ${percentage}%`} [${statusBadge}] - Mobile Session Stamina`
    : 'Continuous Grid Power Online (AC Standard)';

  return (
    <div 
      className={`flex items-center space-x-2 font-mono uppercase tracking-wider font-bold transition-all duration-300 select-none ${
        compact 
          ? 'p-1.5 border justify-center text-[9px]' 
          : 'px-2.5 py-1.5 border text-xs shadow-sm'
      } ${colorClasses}`}
      title={tooltipText}
    >
      {/* Physical Battery Chassis with Positive Terminal Cap */}
      <div className="relative flex items-center shrink-0">
        <div className={`border rounded-[2px] p-[1.5px] flex items-center overflow-hidden transition-colors duration-300 ${
          compact ? 'w-6 h-3' : 'w-7 sm:w-8 h-3.5'
        } border-current bg-black/50`}>
          <div 
            className={`h-full rounded-[1px] transition-all duration-500 ${barFillColor} ${
              isCharging ? 'animate-pulse' : ''
            }`}
            style={{ width: `${percentage !== null ? Math.max(10, percentage) : 100}%` }}
          />
        </div>
        {/* Positive terminal nub */}
        <div className="w-[2px] h-1.5 bg-current rounded-r-[1px] absolute -right-[3px] top-1/2 -translate-y-1/2 opacity-90" />
      </div>

      {/* Percentage and indicator readout */}
      <div className="flex items-center space-x-1">
        {isCharging && <Zap className="w-3.5 h-3.5 text-cyan-300 animate-bounce" />}
        <span className="font-mono font-black tracking-tight">
          {percentage !== null ? `${percentage}%` : 'GRID'}
        </span>
        {isCharging && !compact && (
          <span className="text-[8.5px] font-black text-cyan-300 ml-0.5 tracking-tighter">
            [CHRG]
          </span>
        )}
      </div>
    </div>
  );
};

interface AppHeaderProps {
  profile: {
    photoURL?: string;
    displayName?: string;
    email?: string;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreadE2EECount: number;
  notifications: NotificationItem[];
  isOnline: boolean;
  isSlow: boolean;
  connectionType: string;
  batteryLevel: number | null;
  isCharging: boolean;
  setShowCinematicIntro: (show: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsShortcutsOpen: (open: boolean) => void;
  handleNotificationClick: (n: NotificationItem) => void;
  handleClearNotification: (id: string) => void;
  logout: () => void;
  playGlitchClickSound: () => void;
  triggerVibration: (pattern?: 'light' | 'medium' | 'heavy') => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  profile,
  activeTab,
  setActiveTab,
  unreadE2EECount,
  notifications,
  isOnline,
  isSlow,
  connectionType,
  batteryLevel,
  isCharging,
  setShowCinematicIntro,
  setIsSettingsOpen,
  setIsShortcutsOpen,
  handleNotificationClick,
  handleClearNotification,
  logout,
  playGlitchClickSound,
  triggerVibration
}) => {
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { markAllMessagesAsRead } = useNotificationSystem();

  return (
    <header className="border-b border-[var(--neon-green-border)] shrink-0 h-16 z-40 bg-[var(--color-background)]/90 backdrop-blur-md font-mono relative w-full">
      <div className="w-full px-3 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo and branding */}
        <div 
          onClick={() => setShowCinematicIntro(true)} 
          className="flex items-center space-x-6 select-none group/logo cursor-pointer"
          title="Fara Flick Sovereign Net"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 border-2 border-[var(--neon-green)] flex items-center justify-center font-serif text-2xl font-black bg-[var(--color-surface)] text-[var(--neon-green)] shadow-[3px_3px_0px_var(--neon-green)] transition-all duration-100 container-glitch-hover">
              F
            </div>
            <div>
              <h1 className="font-serif font-black text-sm sm:text-base text-[var(--color-text)] tracking-tight leading-none uppercase glitch-hover">
                FARA FLICK
              </h1>
              <p className="hidden xs:block text-[9px] uppercase tracking-widest font-mono font-bold text-[var(--neon-green)] mt-1 opacity-90 group-hover/logo:text-red-500 transition-colors">
                E2E SECURE NET // PORTAL_A
              </p>
            </div>
          </div>
        </div>

        {/* Credentials & System Monitors - Desktop */}
        <div className="flex items-center space-x-2.5">
          <ConnectionStatusBadge />

          <div 
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 border font-mono text-xs uppercase tracking-wider font-bold transition-all select-none ${
              !isOnline 
                ? 'border-red-500 bg-red-955/20 text-red-500 animate-pulse'
                : isSlow
                  ? 'border-amber-500 bg-amber-955/20 text-amber-500'
                  : 'border-[var(--neon-green)]/20 bg-[var(--color-surface)] text-[var(--neon-green)]'
            }`}
            title={
              !isOnline 
                ? 'Network Tunnel Offline' 
                : `Network Connected via ${connectionType.toUpperCase()}${isSlow ? ' (Slow Connection)' : ''}`
            }
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-4 h-4 text-red-500 animate-bounce" />
                <span className="hidden xs:inline">TUNNEL BLOCKED</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 text-[var(--neon-green)]" />
                <span className="hidden xs:inline">
                  {isSlow ? 'TUNNEL SLOW' : 'TUNNEL LIVE'}
                </span>
              </>
            )}
          </div>

          {/* Dynamic Visual Battery Gauge Indicator */}
          <VisualBatteryGauge batteryLevel={batteryLevel} isCharging={isCharging} />

          {/* Notifications Dropdown */}
          <div className="relative border-[var(--neon-green)]/20 pl-1">
            <button
              onClick={() => {
                playGlitchClickSound();
                setShowNotifDropdown(!showNotifDropdown);
              }}
              className="p-2 border border-[var(--neon-green)]/20 hover:border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--color-surface)] cursor-pointer"
              title="System Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-3.5 w-80 bg-[var(--color-surface)] border-2 border-[var(--neon-green)] shadow-xl overflow-hidden z-50 text-left rounded-none">
                <div className="p-3 border-b border-[var(--neon-green)]/20 bg-[var(--color-surface)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest font-black text-[var(--neon-green)] truncate">NODE BROADCASTS</span>
                    <span className="text-[8px] bg-red-600 border border-black px-1.5 py-0.5 font-mono text-[var(--color-text)] font-bold shrink-0">
                      {notifications.length} DISPATCHED
                    </span>
                  </div>
                  {(notifications.length > 0 || unreadE2EECount > 0) && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        playGlitchClickSound();
                        triggerVibration('light');
                        await markAllMessagesAsRead();
                      }}
                      className="text-[8px] uppercase tracking-wider font-mono font-bold text-[var(--neon-green)] hover:text-black hover:bg-[var(--neon-green)] px-2 py-0.5 border border-[var(--neon-green)]/40 transition cursor-pointer shrink-0"
                      title="Globally mark all messages and notifications as read"
                    >
                      MARK ALL READ
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-[var(--neon-green)]/10 text-xs">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-zinc-500 italic">
                      No active queue signals.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className="p-4 hover:bg-[var(--neon-green)]/10 flex items-start justify-between gap-2 bg-[var(--color-background)] cursor-pointer group transition-all"
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="space-y-1 flex-1">
                          <p className="font-bold tracking-tight text-[var(--color-text)] group-hover:text-[var(--neon-green)] transition-colors">{n.title}</p>
                          <p className="text-[10px] text-zinc-400">{n.body}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearNotification(n.id);
                          }}
                          className="border border-[var(--neon-green)]/40 p-1 hover:bg-[var(--neon-green)] hover:text-black text-[var(--neon-green)] transition cursor-pointer self-start"
                          title="Done"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={() => {
              playGlitchClickSound();
              setIsShortcutsOpen(true);
            }}
            className="p-2 border border-[var(--neon-green)]/25 hover:border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--color-surface)] cursor-pointer hover:bg-[var(--color-surface)]/45 transition"
            title="Keyboard Shortcuts Menu [Shift + K]"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Profile trigger */}
          <button
            id="tour-profile-btn"
            onClick={() => {
              playGlitchClickSound();
              setIsSettingsOpen(true);
            }}
            className="flex items-center space-x-2 border-l border-[var(--neon-green)]/25 pl-3 h-8 text-left hover:opacity-85 transition cursor-pointer"
            title="Configure Node Profile"
          >
            <img
              src={profile?.photoURL}
              alt={profile?.displayName}
              className="w-7 h-7 rounded-none border border-[var(--neon-green)]/40 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="hidden sm:block">
              <p className="text-xs font-black leading-none text-[var(--color-text)] uppercase">{profile?.displayName}</p>
              <div className="flex items-center gap-1 mt-1 font-mono text-[8px] text-[var(--neon-green)]">
                <span className="w-1.5 h-1.5 bg-[var(--neon-green)] rounded-full"></span>
                <span>TUNNEL ON</span>
              </div>
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2 border border-transparent hover:border-red-500/30 text-zinc-500 hover:text-red-500 transition cursor-pointer"
            title="Terminate Secure Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Indicator & Menu Toggle */}
        <div className="hidden items-center space-x-2.5">
          {unreadE2EECount > 0 && (
            <span className="bg-red-600 text-[var(--color-text)] px-2 py-1 leading-none text-[8.5px] font-black border border-red-500 animate-pulse tracking-tight font-mono">
              {unreadE2EECount} SECURE
            </span>
          )}
          <button
            onClick={() => {
              playGlitchClickSound();
              triggerVibration('light');
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }}
            className="px-3 py-2 border border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--color-surface)] font-mono font-bold tracking-wider text-[9px] uppercase flex items-center gap-1 cursor-pointer transition-all hover:bg-[var(--neon-green)] hover:text-black"
            aria-label="Toggle Navigation Terminal"
          >
            {isMobileMenuOpen ? (
              <>
                <span className="font-extrabold mr-0.5">✕</span>
                <span>CLOSE</span>
              </>
            ) : (
              <>
                <span className="text-xs">☰</span>
                <span>MENU</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="md:hidden w-full bg-[var(--color-surface)] border-t border-[var(--neon-green)]/30 text-[var(--neon-green)] overflow-hidden font-mono text-[10px]"
          >
            <div className="p-4 sm:p-6 space-y-4 divide-y divide-[var(--neon-green)]/15">
              
              <div className="flex items-center space-x-3 pb-3">
                <img
                  src={profile?.photoURL}
                  alt={profile?.displayName}
                  className="w-10 h-10 border-2 border-[var(--neon-green)] object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[var(--color-text)] uppercase truncate mb-0.5">
                    {profile?.displayName}
                  </p>
                  <p className="text-[8px] text-zinc-400 lowercase truncate leading-none mb-1">
                    {profile?.email}
                  </p>
                  <div className="flex items-center gap-1.5 font-mono text-[8px] text-[var(--neon-green)] font-black">
                    <span className="w-1.5 h-1.5 bg-[var(--neon-green)] rounded-full animate-ping"></span>
                    <span>SECURE NODE ACTIVE</span>
                  </div>
                </div>
              </div>

              <div className="py-3 space-y-2">
                <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-1">Console Destinations</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      triggerVibration('light');
                      setActiveTab('chat');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`p-2 text-center border font-bold uppercase transition flex flex-col items-center justify-center gap-1 text-[8px] ${
                      activeTab === 'chat'
                        ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black font-black font-serif italic'
                        : 'border-[var(--neon-green)]/20 text-zinc-400 bg-[var(--color-background)]/40 hover:text-[var(--color-text)]'
                    }`}
                  >
                    <div className="relative">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {unreadE2EECount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-red-650 text-[var(--color-text)] px-0.5 font-mono text-[7px] font-black rounded-sm border border-red-500">
                          {unreadE2EECount}
                        </span>
                      )}
                    </div>
                    <span>Chats</span>
                  </button>

                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      triggerVibration('light');
                      setActiveTab('status');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`p-2 text-center border font-bold uppercase transition flex flex-col items-center justify-center gap-1 text-[8px] ${
                      activeTab === 'status'
                        ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black font-black font-serif italic'
                        : 'border-[var(--neon-green)]/20 text-zinc-400 bg-[var(--color-background)]/40 hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Sparkle className="w-3.5 h-3.5" />
                    <span>Status</span>
                  </button>

                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      triggerVibration('light');
                      setActiveTab('news');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`p-2 text-center border font-bold uppercase transition flex flex-col items-center justify-center gap-1 text-[8px] ${
                      activeTab === 'news'
                        ? 'border-[var(--neon-green)] bg-[var(--neon-green)] text-black font-black font-serif italic'
                        : 'border-[var(--neon-green)]/20 text-zinc-400 bg-[var(--color-background)]/40 hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-zinc-400" />
                    <span>News</span>
                  </button>
                </div>
              </div>

              <div className="py-3 grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black">Tunnel Monitor</span>
                  <div className={`p-2 border font-bold text-center flex items-center justify-center space-x-1 select-none text-[8.5px] ${
                    !isOnline 
                      ? 'border-red-500/40 text-red-500 bg-red-955/20 animate-pulse'
                      : isSlow
                        ? 'border-amber-500/40 text-amber-500'
                        : 'border-[var(--neon-green)]/20 bg-[var(--color-background)]/40 text-[var(--neon-green)]'
                  }`}>
                    {!isOnline ? <WifiOff className="w-3.5 h-3.5 shrink-0" /> : <Wifi className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{!isOnline ? "BLOCKED" : isSlow ? "SLOW CONNECTION" : "LIVE"}</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black">Power Reserves</span>
                  <VisualBatteryGauge batteryLevel={batteryLevel} isCharging={isCharging} compact />
                </div>
              </div>

              <div className="py-3 space-y-2 whitespace-nowrap">
                <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-1">Utility Subsystems</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      setShowNotifDropdown(!showNotifDropdown);
                    }}
                    className="p-2.5 border border-[var(--neon-green)]/35 bg-[var(--color-background)]/30 text-[var(--neon-green)] font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-[var(--neon-green)]/15 transition text-[9px]"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Alerts ({notifications.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      setIsSettingsOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2.5 border border-[var(--neon-green)]/35 bg-[var(--color-background)]/30 text-[var(--neon-green)] font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-[var(--neon-green)]/15 transition text-[9px]"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Config</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      setIsShortcutsOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2.5 border border-[var(--neon-green)]/35 bg-[var(--color-background)]/30 text-[var(--neon-green)] font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-[var(--neon-green)]/15 transition text-[9px]"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Shortcuts</span>
                  </button>

                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2.5 border border-red-500/30 bg-red-955/10 text-red-500 font-extrabold flex items-center justify-center gap-1.5 uppercase hover:bg-red-500/10 transition text-[9px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </header>
  );
};
