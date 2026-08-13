import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Heart,
  MessageSquare,
  Share2,
  Trash2,
  Check,
  UserPlus,
  UserCheck,
  Search,
  Sparkles,
  ShieldCheck,
  Clock,
  ImageIcon,
  X,
  Camera
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUsers } from '../lib/services';
import { refreshScrollTrigger } from '../lib/gsapAnimations';

interface BentoProfileProps {
  profile: any;
  firebasePosts: any[];
  deletePost: (id: string, uid: string) => Promise<void>;
  currentCover?: string;
  setCurrentCover?: (url: string) => void;
  showCoverSelector?: boolean;
  setShowCoverSelector?: (show: boolean) => void;
  playGlitchClickSound: () => void;
  triggerVibration: (type: 'light' | 'medium' | 'heavy') => void;
  showBrutalistToast: (title: string, message: string, type?: any, icon?: string, id?: string) => void;
}

const COVER_PRESETS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1200',
  'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=1200',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1200',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1200'
];

export default function BentoProfile({
  profile,
  firebasePosts,
  deletePost,
  currentCover,
  setCurrentCover,
  playGlitchClickSound,
  triggerVibration,
  showBrutalistToast
}: BentoProfileProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'flicks' | 'flickers'>('flicks');
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [followerSearch, setFollowerSearch] = useState('');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const [coverUrl, setCoverUrl] = useState<string>(
    () => currentCover || profile?.coverPhotoURL || COVER_PRESETS[0]
  );
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [customCoverInput, setCustomCoverInput] = useState('');

  // Filter user's own flicks
  const userFlicks = firebasePosts.filter((p) => p.authorId === profile?.uid);

  // Subscribe to community users for Flickers list
  useEffect(() => {
    const unsub = subscribeToUsers((users) => {
      setSystemUsers(users.filter((u) => u.uid !== profile?.uid));
    });
    return () => unsub();
  }, [profile?.uid]);

  useEffect(() => {
    refreshScrollTrigger();
  }, [activeTab, userFlicks.length]);

  const handleToggleFollow = (targetUid: string, targetName: string) => {
    playGlitchClickSound();
    triggerVibration('light');
    const isFollowing = followingMap[targetUid];
    setFollowingMap((prev) => ({ ...prev, [targetUid]: !isFollowing }));

    showBrutalistToast(
      isFollowing ? 'UNFOLLOWED' : 'FLICKER ADDED',
      isFollowing ? `Removed @${targetName}` : `Now following @${targetName}`,
      isFollowing ? 'info' : 'success'
    );
  };

  const handleSelectCover = (url: string) => {
    setCoverUrl(url);
    if (setCurrentCover) setCurrentCover(url);
    setIsCoverModalOpen(false);
    playGlitchClickSound();
    triggerVibration('medium');
    showBrutalistToast('COVER UPDATED', 'Profile cover header customized', 'success');
  };

  const filteredFlickers = systemUsers.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(followerSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(followerSearch.toLowerCase())
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20 text-[var(--color-text)]">
      {/* HEADER CARD WITH COVER PHOTO */}
      <div className="glass-panel overflow-hidden relative space-y-0">
        {/* Cover Photo Banner */}
        <div className="relative w-full h-44 sm:h-52 bg-gradient-to-r from-emerald-950 via-cyan-950 to-zinc-950 overflow-hidden">
          <img
            src={coverUrl}
            alt="Profile Cover"
            className="w-full h-full object-cover transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-black/20 to-transparent" />

          {/* Change Cover Button */}
          <button
            onClick={() => {
              playGlitchClickSound();
              setIsCoverModalOpen(true);
            }}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-xs font-mono font-bold text-white hover:bg-black/80 hover:border-[var(--neon-green)] transition-all flex items-center gap-1.5 cursor-pointer shadow-lg z-10"
          >
            <Camera className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            <span>Change Cover</span>
          </button>
        </div>

        {/* Profile Info & Avatar */}
        <div className="p-6 pt-0 relative space-y-6 -mt-12 z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            {/* User Avatar */}
            <div className="flex items-end gap-4">
              <div className="relative shrink-0">
                <img
                  src={profile?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'}
                  alt={profile?.displayName || 'User'}
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-[#080a0f] shadow-2xl bg-black"
                />
                <span className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--neon-green)] border-2 border-black" />
              </div>

              <div className="space-y-1 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-shamgod text-white tracking-wide uppercase">
                    {profile?.displayName || 'User Node'}
                  </h1>
                  <span className="bg-[var(--neon-green)]/15 text-[var(--neon-green)] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-[var(--neon-green)]/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> VERIFIED
                  </span>
                </div>

                <p className="text-xs font-mono text-zinc-400">
                  @{profile?.username || profile?.email?.split('@')[0] || 'handle'}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs font-sans text-zinc-300 leading-relaxed max-w-xl">
            {profile?.bio || 'Encrypted mesh user node communicating on Flick network.'}
          </p>

          {/* STATS BAR: FLICKS & FLICKERS */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--glass-border)]">
            <button
              onClick={() => {
                playGlitchClickSound();
                setActiveTab('flicks');
              }}
              className={`glass-panel p-3 text-center transition-all cursor-pointer ${
                activeTab === 'flicks'
                  ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)]/50 text-[var(--neon-green)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <p className="text-xl font-shamgod font-bold text-white tracking-wider">{userFlicks.length}</p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mt-0.5 font-bold">Flicks</p>
            </button>

            <button
              onClick={() => {
                playGlitchClickSound();
                setActiveTab('flickers');
              }}
              className={`glass-panel p-3 text-center transition-all cursor-pointer ${
                activeTab === 'flickers'
                  ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)]/50 text-[var(--neon-green)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <p className="text-xl font-shamgod font-bold text-white tracking-wider">
                {profile?.followersCount || systemUsers.length + 12}
              </p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mt-0.5 font-bold">Flickers</p>
            </button>

            <div className="glass-panel p-3 text-center text-zinc-400">
              <p className="text-xl font-shamgod font-bold text-white tracking-wider">
                {profile?.followingCount || 8}
              </p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mt-0.5 font-bold">Following</p>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS SWITCHER */}
      <div className="flex items-center gap-2 p-1.5 glass-panel">
        <button
          onClick={() => {
            playGlitchClickSound();
            setActiveTab('flicks');
          }}
          className={`flex-1 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'flicks'
              ? 'bg-[var(--neon-green)] text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Flicks</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20">{userFlicks.length}</span>
        </button>

        <button
          onClick={() => {
            playGlitchClickSound();
            setActiveTab('flickers');
          }}
          className={`flex-1 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'flickers'
              ? 'bg-[var(--neon-green)] text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Flickers</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20">{systemUsers.length}</span>
        </button>
      </div>

      {/* TAB 1: FLICKS LIST */}
      {activeTab === 'flicks' && (
        <div className="space-y-4">
          {userFlicks.length === 0 ? (
            <div className="glass-panel p-8 text-center space-y-3 text-zinc-500 font-mono">
              <ImageIcon className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs uppercase tracking-wider">No Flicks published yet.</p>
              <p className="text-[10px] text-zinc-600">Share your thoughts or media on the main feed!</p>
            </div>
          ) : (
            userFlicks.map((post) => (
              <div key={post.id} className="glass-panel gsap-scroll-card p-5 space-y-4">
                {/* Author Info & Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={profile?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-[var(--neon-green)]/40"
                    />
                    <div>
                      <p className="text-sm font-mono font-bold text-white">{profile?.displayName}</p>
                      <p className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[var(--neon-green)]" />
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      playGlitchClickSound();
                      if (confirm('Delete this Flick?')) {
                        await deletePost(post.id, profile?.uid);
                        showBrutalistToast('FLICK DELETED', 'Post removed from feed', 'info');
                      }
                    }}
                    className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all cursor-pointer"
                    title="Delete Post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Post Content */}
                <p className="text-sm font-sans text-zinc-200 leading-relaxed">{post.content}</p>

                {/* Post Attachment */}
                {post.mediaUrl && (
                  <div className="rounded-xl overflow-hidden border border-[var(--glass-border)] max-h-80">
                    <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Post Footer Controls */}
                <div className="flex items-center gap-6 pt-2 border-t border-[var(--glass-border)] text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <Heart className="w-4 h-4 fill-rose-500/20" />
                    <span>{post.likesCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.commentsCount || 0}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: FLICKERS GRID */}
      {activeTab === 'flickers' && (
        <div className="space-y-4">
          {/* Search Flickers */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Flickers by name or handle..."
              value={followerSearch}
              onChange={(e) => setFollowerSearch(e.target.value)}
              className="w-full glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          {/* Flickers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredFlickers.length === 0 ? (
              <div className="col-span-full glass-panel p-8 text-center text-zinc-500 font-mono text-xs">
                No Flickers found matching search query.
              </div>
            ) : (
              filteredFlickers.map((flicker) => {
                const isFollowing = followingMap[flicker.uid];

                return (
                  <div
                    key={flicker.uid}
                    className="glass-panel p-4 flex items-center justify-between gap-3 hover:border-[var(--neon-green)]/40 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={flicker.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-[var(--neon-green)]/30 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-white truncate">
                          {flicker.displayName || 'User'}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-400 truncate">
                          @{flicker.username || 'handle'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleFollow(flicker.uid, flicker.displayName || 'user')}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[10px] uppercase font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                        isFollowing
                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          : 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/50 hover:bg-[var(--neon-green)] hover:text-black'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3 h-3" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" /> Follow
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* COVER PHOTO SELECTION MODAL */}
      <AnimatePresence>
        {isCoverModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl"
            onClick={() => setIsCoverModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel p-6 max-w-lg w-full space-y-5 border border-[var(--glass-border)] shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
                <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[var(--neon-green)]" /> Select Cover Header Photo
                </h3>
                <button
                  onClick={() => setIsCoverModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Presets Grid */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Preset Glass Backgrounds
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {COVER_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectCover(preset)}
                      className={`h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer relative group ${
                        coverUrl === preset ? 'border-[var(--neon-green)] shadow-lg' : 'border-transparent hover:border-white/50'
                      }`}
                    >
                      <img src={preset} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      {coverUrl === preset && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Check className="w-5 h-5 text-[var(--neon-green)]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Image URL input */}
              <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Or Paste Custom Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={customCoverInput}
                    onChange={(e) => setCustomCoverInput(e.target.value)}
                    className="flex-1 glass-input px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (customCoverInput.trim()) {
                        handleSelectCover(customCoverInput.trim());
                      }
                    }}
                    className="px-4 py-2 bg-[var(--neon-green)] text-black rounded-xl font-mono text-xs uppercase font-bold hover:brightness-110 transition-all cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
