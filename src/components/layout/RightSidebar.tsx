import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile } from '../../types';
import { subscribeToUsers } from '../../lib/services';
import { triggerViewProfile } from '../../lib/profileTrigger';
import { playGlitchClickSound } from '../../lib/sounds';
import { triggerVibration } from '../../lib/haptics';
import { showBrutalistToast } from '../../lib/toast';
import {
  TrendingUp,
  UserPlus,
  Radio,
  Sparkles,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Flame,
  Search,
  CheckCircle2
} from 'lucide-react';

interface RightSidebarProps {
  onSearchTag?: (tag: string) => void;
  onOpenChatWithUser?: (userId: string) => void;
}

export default function RightSidebar({
  onSearchTag,
  onOpenChatWithUser
}: RightSidebarProps) {
  const { profile, user: currentUser } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = subscribeToUsers((users) => {
      // Filter out current user
      const filtered = users.filter(u => u.uid !== currentUser?.uid).slice(0, 4);
      setSuggestedUsers(filtered);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const handleToggleFollow = (userId: string, userName: string) => {
    playGlitchClickSound();
    triggerVibration('medium');
    const isFollowing = !!followingMap[userId];
    setFollowingMap(prev => ({ ...prev, [userId]: !isFollowing }));
    showBrutalistToast(
      isFollowing ? 'UNFOLLOWED' : 'CONNECTED',
      isFollowing ? `Disconnected from ${userName}` : `Now following ${userName}`,
      'success'
    );
  };

  const trendingTopics = [
    { tag: '#exams2026', count: '1.2k packets', category: 'ACADEMIC' },
    { tag: '#e2ee_security', count: '840 shares', category: 'TECH' },
    { tag: '#campus_events', count: '620 posts', category: 'CAMPUS' },
    { tag: '#faraflick', count: '2.4k transmissions', category: 'ANNOUNCEMENT' },
    { tag: '#study_buddies', count: '410 matches', category: 'PEER MATCH' },
  ];

  return (
    <aside className="flex flex-col gap-5 w-72 xl:w-80 shrink-0 h-full overflow-y-auto py-5 pr-4 pl-1 text-[var(--color-text)] select-none scrollbar-thin">
      
      {/* 1. OPERATOR PROFILE SUMMARY CARD */}
      <div className="bg-[var(--color-surface)]/90 border border-[var(--neon-green-border)]/50 rounded-2xl p-4 shadow-lg space-y-3 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:border-[var(--neon-green)]/70 hover:shadow-[0_0_20px_rgba(0,255,102,0.15)]">
        <div className="absolute top-0 right-0 p-1 px-2.5 bg-[var(--neon-green)]/10 border-b border-l border-[var(--neon-green-border)] text-[9px] font-mono text-[var(--neon-green)] font-black uppercase tracking-widest rounded-bl-xl">
          CURRENT NODE
        </div>

        <div className="flex items-center space-x-3 pt-1">
          <div className="relative shrink-0 cursor-pointer group" onClick={() => currentUser?.uid && triggerViewProfile(currentUser.uid)}>
            <img
              src={profile?.photoURL || 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120'}
              alt={profile?.displayName || 'User'}
              className="w-12 h-12 rounded-full object-cover border-2 border-[var(--neon-green)] group-hover:scale-105 group-hover:shadow-[0_0_12px_rgba(0,255,102,0.4)] transition-all duration-200"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-black rounded-full animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <h4
              onClick={() => currentUser?.uid && triggerViewProfile(currentUser.uid)}
              className="text-xs font-mono font-black text-[var(--color-text)] truncate uppercase cursor-pointer hover:text-[var(--neon-green)] transition"
            >
              {profile?.displayName || 'OPERATOR'}
            </h4>
            <p className="text-xs font-mono text-zinc-400 truncate">
              {profile?.email || '@operator'}
            </p>
            <span className="inline-block mt-1 text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-tight">
              DEAN'S LIST // LEVEL 300
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--neon-green-border)]/20 flex items-center justify-between text-xs font-mono">
          <div className="text-center flex-1 border-r border-[var(--neon-green-border)]/20">
            <span className="block text-sm font-black text-[var(--neon-green)]">148</span>
            <span className="text-[9px] text-zinc-400 uppercase font-bold">Packets</span>
          </div>
          <div className="text-center flex-1 border-r border-[var(--neon-green-border)]/20">
            <span className="block text-sm font-black text-[var(--color-text)]">1.2k</span>
            <span className="text-[9px] text-zinc-400 uppercase font-bold">Peers</span>
          </div>
          <div className="text-center flex-1">
            <span className="block text-sm font-black text-amber-400">99%</span>
            <span className="text-[9px] text-zinc-400 uppercase font-bold">Karma</span>
          </div>
        </div>
      </div>

      {/* 2. SUGGESTED PEERS / WHO TO FOLLOW */}
      <div className="bg-[var(--color-surface)]/90 border border-[var(--neon-green-border)]/50 rounded-2xl p-4 shadow-lg space-y-3 transition-all duration-300 hover:scale-[1.01] hover:border-[var(--neon-green)]/70 hover:shadow-[0_0_20px_rgba(0,255,102,0.15)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4.5 h-4.5 text-[var(--neon-green)]" />
            <h4 className="text-xs font-mono font-black uppercase tracking-wider text-[var(--color-text)]">
              SUGGESTED PEERS
            </h4>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 uppercase font-bold">Live Registry</span>
        </div>

        <div className="space-y-3 pt-1">
          {suggestedUsers.length === 0 ? (
            <p className="text-xs font-mono text-zinc-400 italic text-center py-2">
              Scanning spectrum for peers...
            </p>
          ) : (
            suggestedUsers.map((usr) => {
              const isFollowing = !!followingMap[usr.uid];
              return (
                <div key={usr.uid} className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-[var(--color-background)]/80 transition-all duration-200 border border-transparent hover:border-[var(--neon-green-border)]/50 hover:shadow-[0_0_12px_rgba(0,255,102,0.08)] hover:translate-x-0.5">
                  <div
                    onClick={() => triggerViewProfile(usr.uid)}
                    className="flex items-center space-x-2.5 min-w-0 cursor-pointer flex-1 group"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={usr.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120'}
                        alt={usr.displayName}
                        className="w-9 h-9 rounded-full object-cover border border-[var(--neon-green-border)] group-hover:scale-105 group-hover:border-[var(--neon-green)] transition-transform duration-200"
                      />
                      {usr.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-black rounded-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-mono font-bold text-[var(--color-text)] truncate uppercase group-hover:text-[var(--neon-green)] transition">
                        {usr.displayName}
                      </h5>
                      <span className="text-[9px] font-mono text-zinc-400 block truncate">
                        {usr.school || 'CSC Campus'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenChatWithUser && (
                      <button
                        onClick={() => onOpenChatWithUser(usr.uid)}
                        className="p-1.5 rounded-lg bg-[var(--color-background)] border border-[var(--neon-green-border)]/50 hover:border-[var(--neon-green)] hover:scale-110 text-zinc-300 hover:text-[var(--neon-green)] transition-all cursor-pointer"
                        title="Direct Message"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleFollow(usr.uid, usr.displayName)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-mono font-black uppercase transition-all duration-200 cursor-pointer ${
                        isFollowing
                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                          : 'bg-[var(--neon-green)] text-black font-extrabold hover:scale-105 hover:shadow-[0_0_12px_rgba(0,255,102,0.35)]'
                      }`}
                    >
                      {isFollowing ? 'CONNECTED' : '+ CONNECT'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. TRENDING CAMPUS WIRE */}
      <div className="bg-[var(--color-surface)]/90 border border-[var(--neon-green-border)]/50 rounded-2xl p-4 shadow-lg space-y-3 transition-all duration-300 hover:scale-[1.01] hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4.5 h-4.5 text-amber-400" />
          <h4 className="text-xs font-mono font-black uppercase tracking-wider text-[var(--color-text)]">
            CAMPUS TRENDS
          </h4>
        </div>

        <div className="space-y-2 pt-1">
          {trendingTopics.map((topic, i) => (
            <div
              key={i}
              onClick={() => {
                playGlitchClickSound();
                if (onSearchTag) onSearchTag(topic.tag);
              }}
              className="p-3 rounded-xl bg-[var(--color-background)]/60 hover:bg-[var(--color-background)] border border-[var(--neon-green-border)]/30 hover:border-amber-500/50 hover:shadow-[0_0_12px_rgba(245,158,11,0.12)] hover:translate-x-0.5 transition-all duration-200 cursor-pointer flex items-center justify-between group"
            >
              <div>
                <span className="text-[9px] font-mono text-amber-400 font-bold block uppercase tracking-wider">
                  {topic.category}
                </span>
                <h5 className="text-xs font-mono font-bold text-[var(--color-text)] group-hover:text-amber-400 transition mt-0.5">
                  {topic.tag}
                </h5>
                <span className="text-[9px] font-mono text-zinc-400 block mt-0.5">
                  {topic.count}
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. NETWORK PROTOCOL STATUS FOOTER */}
      <div className="p-3.5 bg-[var(--color-surface)]/50 rounded-xl border border-[var(--neon-green-border)]/20 text-xs font-mono text-zinc-400 space-y-1.5 transition-all duration-300 hover:border-[var(--neon-green)]/40 hover:shadow-[0_0_12px_rgba(0,255,102,0.12)]">
        <div className="flex items-center justify-between text-zinc-300 font-bold">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            FLICK DESKTOP V4.2
          </span>
          <span className="text-emerald-400 animate-pulse text-[10px]">● ENCRYPTED</span>
        </div>
        <p className="leading-relaxed text-[10px]">
          End-to-End Encrypted Social Architecture. Designed for high-density desktop engagement.
        </p>
      </div>

    </aside>
  );
}
