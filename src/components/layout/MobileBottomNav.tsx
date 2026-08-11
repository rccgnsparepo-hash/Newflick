import React from 'react';
import { School, Radio, MessageSquare, Sparkles, User, Briefcase } from 'lucide-react';
import { TabType } from '../../lib/navigationService';
import { playGlitchClickSound, triggerVibration } from '../../lib/sounds';

interface MobileBottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  unreadE2EECount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  unreadE2EECount,
}) => {
  const tabs = [
    {
      id: 'home' as TabType,
      label: 'Home',
      icon: School,
    },
    {
      id: 'news' as TabType,
      label: 'News',
      icon: Radio,
    },
    {
      id: 'chat' as TabType,
      label: 'Chat',
      icon: MessageSquare,
      badge: unreadE2EECount > 0 ? unreadE2EECount : null,
    },
    {
      id: 'match' as TabType,
      label: 'Matcher',
      icon: Sparkles,
    },
    {
      id: 'workspace' as TabType,
      label: 'Workspace',
      icon: Briefcase,
    },
    {
      id: 'profile' as TabType,
      label: 'Profile',
      icon: User,
    },
  ];

  const handleTabClick = (tab: TabType) => {
    playGlitchClickSound();
    triggerVibration('light');
    setActiveTab(tab);
  };

  return (
    <nav className="md:hidden fixed bottom-2 left-2 right-2 z-50 bg-slate-900/90 backdrop-blur-md rounded-3xl h-16 flex items-center justify-around px-2 font-sans select-none shadow-2xl border border-white/20 text-white">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 relative transition-all cursor-pointer ${
              isActive 
                ? 'text-[#f9553a] font-extrabold' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {/* Active Pill indicator */}
            {isActive && (
              <span className="absolute top-1 w-8 h-1 bg-[#f9553a] rounded-full shadow-sm" />
            )}

            <div className="relative shrink-0 mb-0.5 mt-1">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              {tab.badge && (
                <span className="absolute -top-1.5 -right-2 bg-[#f9553a] text-white font-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">
                  {tab.badge}
                </span>
              )}
            </div>

            <span className="text-[9px] font-bold tracking-tight uppercase truncate max-w-[56px]">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
