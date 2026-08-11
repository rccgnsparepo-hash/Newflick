import React, { useState } from 'react';
import { ShieldCheck, Wifi, MessageSquare, Sparkles, MapPin, Heart, Share2, ExternalLink, Flame } from 'lucide-react';
import { TabType } from '../../lib/navigationService';
import { playGlitchClickSound, triggerVibration } from '../../lib/sounds';

interface RightRailProps {
  profile: any;
  selectedCampus: string;
  isOnline: boolean;
  registeredUsers?: any[];
  setActiveTab: (tab: TabType) => void;
  setDeepLinkedPeerId?: (id: string | null) => void;
  setIsSettingsOpen: (open: boolean) => void;
}

export const RightRail: React.FC<RightRailProps> = ({
  profile,
  selectedCampus,
  isOnline,
  registeredUsers = [],
  setActiveTab,
  setDeepLinkedPeerId,
  setIsSettingsOpen
}) => {
  const [toggleTab, setToggleTab] = useState<'followings' | 'foryou'>('followings');

  // Get top suggested users (excluding current user)
  const suggestedPeers = registeredUsers
    .filter(u => u.uid !== profile?.uid)
    .slice(0, 3);

  return (
    <aside className="hidden xl:flex w-80 shrink-0 h-[calc(100%-16px)] my-2 mr-2 flex-col bg-[#fca998] rounded-[32px] p-5 space-y-5 overflow-y-auto z-30 select-none shadow-lg border border-[#f89b87]">
      {/* TOP PILL TOGGLE CAPSULE */}
      <div className="w-full bg-[#f8927e]/60 backdrop-blur-md rounded-full p-1.5 flex items-center justify-between border border-white/30 shadow-inner">
        <button
          onClick={() => {
            playGlitchClickSound();
            setToggleTab('followings');
          }}
          className={`flex-1 py-2 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
            toggleTab === 'followings'
              ? 'bg-white text-slate-900 shadow-md scale-105'
              : 'text-white hover:text-slate-900 font-bold'
          }`}
        >
          Followings
        </button>

        <button
          onClick={() => {
            playGlitchClickSound();
            setToggleTab('foryou');
          }}
          className={`flex-1 py-2 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
            toggleTab === 'foryou'
              ? 'bg-white text-slate-900 shadow-md scale-105'
              : 'text-white hover:text-slate-900 font-bold'
          }`}
        >
          For You
        </button>
      </div>

      {/* FEATURED POST MEDIA CARD WITH FLOATING ACTIONS */}
      <div className="relative rounded-[28px] overflow-hidden shadow-xl border border-white/40 aspect-[4/5] group bg-slate-900">
        <img
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800"
          alt="Featured Student"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        
        {/* Dark subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />

        {/* Floating Left Side Glass Actions Bar */}
        <div className="absolute left-3 bottom-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-2.5 flex flex-col items-center gap-3 text-white shadow-lg">
          <button 
            onClick={() => {
              playGlitchClickSound();
              triggerVibration('medium');
            }}
            className="flex flex-col items-center group/btn hover:scale-110 transition-transform cursor-pointer"
          >
            <div className="p-2 rounded-full bg-red-500/80 text-white shadow-sm">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <span className="text-[10px] font-black mt-1">500</span>
          </button>

          <button 
            onClick={() => {
              playGlitchClickSound();
            }}
            className="flex flex-col items-center group/btn hover:scale-110 transition-transform cursor-pointer"
          >
            <div className="p-2 rounded-full bg-white/30 text-white shadow-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black mt-1">64</span>
          </button>

          <button 
            onClick={() => {
              playGlitchClickSound();
            }}
            className="flex flex-col items-center group/btn hover:scale-110 transition-transform cursor-pointer"
          >
            <div className="p-2 rounded-full bg-white/30 text-white shadow-sm">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black mt-1">200</span>
          </button>

          <div className="pt-1 border-t border-white/20">
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100"
              alt="Author"
              className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Featured Tag & Author Overlay */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-extrabold text-slate-900 shadow-md flex items-center gap-1">
          <Flame className="w-3 h-3 text-[#f9553a]" />
          <span>TRENDING</span>
        </div>

        <div className="absolute bottom-4 right-4 text-right text-white">
          <h4 className="text-sm font-extrabold tracking-tight drop-shadow">Julia Fun Galaxy</h4>
          <p className="text-[10px] text-rose-100 font-medium drop-shadow">{selectedCampus}</p>
        </div>
      </div>

      {/* SUGGESTED PEERS STRIP */}
      <div className="bg-white/80 backdrop-blur-md rounded-[24px] p-4 shadow-sm space-y-3 border border-white">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-900 tracking-tight uppercase">
            Suggested Peers
          </h4>
          <button
            onClick={() => {
              playGlitchClickSound();
              setActiveTab('match');
            }}
            className="text-[10px] font-extrabold text-[#f9553a] hover:underline"
          >
            View All →
          </button>
        </div>

        <div className="space-y-2">
          {suggestedPeers.length > 0 ? (
            suggestedPeers.map((peer, idx) => (
              <div 
                key={peer.uid || idx}
                className="p-2 bg-white/90 hover:bg-white rounded-2xl flex items-center justify-between shadow-xs transition group cursor-pointer"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <img 
                    src={peer.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
                    alt={peer.displayName} 
                    className="w-8 h-8 rounded-xl object-cover ring-2 ring-rose-200 group-hover:ring-[#f9553a] transition shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 truncate uppercase">
                      {peer.displayName || 'STUDENT PEER'}
                    </h5>
                    <p className="text-[9px] text-slate-500 truncate uppercase">
                      {peer.school || selectedCampus}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    playGlitchClickSound();
                    triggerVibration('light');
                    if (setDeepLinkedPeerId) setDeepLinkedPeerId(peer.uid);
                    setActiveTab('chat');
                  }}
                  className="p-2 bg-[#f9553a] hover:bg-slate-900 text-white rounded-xl transition shrink-0 shadow-sm"
                  title="Direct Tunnel Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="p-2.5 bg-rose-50/50 rounded-xl text-[10px] text-slate-500 italic text-center font-medium">
              Scanning active student nodes...
            </div>
          )}
        </div>
      </div>

      {/* QUICK SYSTEM STATUS */}
      <div className="bg-white/70 backdrop-blur-md rounded-[20px] p-3 text-[10px] text-slate-800 flex items-center justify-between border border-white">
        <div className="flex items-center gap-1.5 font-bold">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span>{selectedCampus}</span>
        </div>
        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-[9px]">
          {isOnline ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
    </aside>
  );
};
