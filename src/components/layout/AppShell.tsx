import React from 'react';
import { TabType } from '../../lib/navigationService';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { RightRail } from './RightRail';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreadE2EECount: number;
  unreadNotifCount: number;
  profile: any;
  isOnline: boolean;
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
  registeredUsers?: any[];
  setDeepLinkedPeerId?: (id: string | null) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab,
  setActiveTab,
  unreadE2EECount,
  unreadNotifCount,
  profile,
  isOnline,
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
  onCampusChange,
  registeredUsers = [],
  setDeepLinkedPeerId
}) => {
  return (
    <div className="w-full h-screen h-[100dvh] overflow-hidden flex flex-col md:flex-row bg-[#fcdada] text-slate-900 font-sans relative p-1 sm:p-2 md:p-3 gap-2 md:gap-3">
      {/* 1. PERSISTENT DESKTOP SIDEBAR (MD & UP) */}
      <DesktopSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadE2EECount={unreadE2EECount}
        unreadNotifCount={unreadNotifCount}
        profile={profile}
        logout={logout}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsShortcutsOpen={setIsShortcutsOpen}
        setIsFeedbackOpen={setIsFeedbackOpen}
        setShowCinematicIntro={setShowCinematicIntro}
        onOpenSearch={onOpenSearch}
        onToggleNotifications={onToggleNotifications}
        soundMuted={soundMuted}
        onToggleSound={onToggleSound}
        selectedCampus={selectedCampus}
        onCampusChange={onCampusChange}
      />

      {/* 2. MAIN VIEWPORT CONTAINER - FLOATING CRISP WHITE CARD */}
      <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden relative bg-white rounded-[28px] md:rounded-[36px] shadow-2xl border border-white/80 my-1 md:my-0">
        {/* Mobile Top Header Bar */}
        <MobileHeader
          profile={profile}
          unreadNotifCount={unreadNotifCount}
          isOnline={isOnline}
          setIsSettingsOpen={setIsSettingsOpen}
          setShowCinematicIntro={setShowCinematicIntro}
          onOpenSearch={onOpenSearch}
          onToggleNotifications={onToggleNotifications}
          soundMuted={soundMuted}
          onToggleSound={onToggleSound}
          selectedCampus={selectedCampus}
          onCampusChange={onCampusChange}
        />

        {/* Main View Area */}
        <main className="flex-1 min-w-0 w-full h-full pb-16 md:pb-0 relative flex flex-col overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Fixed Navigation */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          unreadE2EECount={unreadE2EECount}
        />
      </div>

      {/* 3. RIGHT RAIL (XL & UP) - HIGHLIGHT FEATURED CARD PANEL */}
      {activeTab !== 'chat' && (
        <RightRail
          profile={profile}
          selectedCampus={selectedCampus}
          isOnline={isOnline}
          registeredUsers={registeredUsers}
          setActiveTab={setActiveTab}
          setDeepLinkedPeerId={setDeepLinkedPeerId}
          setIsSettingsOpen={setIsSettingsOpen}
        />
      )}
    </div>
  );
};
