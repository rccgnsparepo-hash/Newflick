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
  Camera,
  Users,
  Compass
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUsers, subscribeToUserFollowers, followUser, unfollowUser } from '../lib/services';
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
  onOpenUserProfile?: (userId: string) => void;
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
  showBrutalistToast,
  onOpenUserProfile
}: BentoProfileProps) {
  const [activeTab, setActiveTab] = useState<'flicks' | 'followers' | 'following' | 'explore'>('flicks');
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerSearch, setFollowerSearch] = useState('');
  const [submittingMap, setSubmittingMap] = useState<Record<string, boolean>>({});

  const [coverUrl, setCoverUrl] = useState<string>(
    () => currentCover || profile?.coverPhotoURL || COVER_PRESETS[0]
  );
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [customCoverInput, setCustomCoverInput] = useState('');

  // Filter user's own flicks
  const userFlicks = firebasePosts.filter((p) => p.authorId === profile?.uid);

  // Subscribe to real-time followers and following for current user
  useEffect(() => {
    if (!profile?.uid) return;

    const unsubFollowers = subscribeToUserFollowers(profile.uid, (data) => {
      setFollowerIds(data.followers || []);
      setFollowingIds(data.following || []);
    });

    return () => unsubFollowers();
  }, [profile?.uid]);

  // Subscribe to community users for Explore list
  useEffect(() => {
    const unsub = subscribeToUsers((users) => {
      setSystemUsers(users.filter((u) => u.uid !== profile?.uid));
    });
    return () => unsub();
  }, [profile?.uid]);

  const followersList = systemUsers.filter((u) => followerIds.includes(u.uid));
  const followingList = systemUsers.filter((u) => followingIds.includes(u.uid));

  useEffect(() => {
    refreshScrollTrigger();
  }, [activeTab, userFlicks.length, followerIds.length, followingIds.length]);

  const isUserFollowing = (targetUid: string) => {
    return followingIds.includes(targetUid);
  };

  const handleToggleFollow = async (targetUser: { uid: string; displayName?: string; photoURL?: string; username?: string }) => {
    if (!profile?.uid || submittingMap[targetUser.uid]) return;
    
    setSubmittingMap((prev) => ({ ...prev, [targetUser.uid]: true }));
    playGlitchClickSound();
    triggerVibration('medium');

    const followingNow = isUserFollowing(targetUser.uid);

    try {
      if (followingNow) {
        await unfollowUser(profile.uid, targetUser.uid);
        showBrutalistToast('UNFOLLOWED', `Removed @${targetUser.displayName || targetUser.username || 'user'}`, 'info');
      } else {
        await followUser(
          profile.uid,
          targetUser.uid,
          profile.displayName || profile.username || 'Operator'
        );
        showBrutalistToast('FLICKER ADDED', `Now following @${targetUser.displayName || targetUser.username || 'user'}`, 'success');
      }
    } catch (err) {
      console.warn('Failed to update follow state:', err);
    } finally {
      setSubmittingMap((prev) => ({ ...prev, [targetUser.uid]: false }));
    }
  };

  const handleSelectCover = (url: string) => {
    setCoverUrl(url);
    if (setCurrentCover) setCurrentCover(url);
    setIsCoverModalOpen(false);
    playGlitchClickSound();
    triggerVibration('medium');
    showBrutalistToast('COVER UPDATED', 'Profile cover header customized', 'success');
  };

  // Filter explore users
  const filteredExplore = systemUsers.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(followerSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(followerSearch.toLowerCase())
  );

  // Filter followers list
  const filteredFollowers = followersList.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(followerSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(followerSearch.toLowerCase())
  );

  // Filter following list
  const filteredFollowing = followingList.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(followerSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(followerSearch.toLowerCase())
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 md:pb-6 text-[var(--color-text)]">
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

          {/* STATS BAR: FLICKS, FOLLOWERS & FOLLOWING */}
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
                setActiveTab('followers');
              }}
              className={`glass-panel p-3 text-center transition-all cursor-pointer ${
                activeTab === 'followers'
                  ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)]/50 text-[var(--neon-green)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <p className="text-xl font-shamgod font-bold text-white tracking-wider">
                {followersList.length}
              </p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mt-0.5 font-bold">Followers</p>
            </button>

            <button
              onClick={() => {
                playGlitchClickSound();
                setActiveTab('following');
              }}
              className={`glass-panel p-3 text-center transition-all cursor-pointer ${
                activeTab === 'following'
                  ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)]/50 text-[var(--neon-green)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <p className="text-xl font-shamgod font-bold text-white tracking-wider">
                {followingList.length}
              </p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mt-0.5 font-bold">Following</p>
            </button>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS SWITCHER */}
      <div className="flex items-center gap-2 p-1.5 glass-panel overflow-x-auto">
        <button
          onClick={() => {
            playGlitchClickSound();
            setActiveTab('flicks');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'flicks'
              ? 'bg-[var(--neon-green)] text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Flicks</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{userFlicks.length}</span>
        </button>

        <button
          onClick={() => {
            playGlitchClickSound();
            setActiveTab('followers');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'followers'
              ? 'bg-[var(--neon-green)] text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Followers</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{followersList.length}</span>
        </button>

        <button
          onClick={() => {
            playGlitchClickSound();
            setActiveTab('following');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'following'
              ? 'bg-[var(--neon-green)] text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Following</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{followingList.length}</span>
        </button>

        <button
          onClick={() => {
            playGlitchClickSound();
            setActiveTab('explore');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'explore'
              ? 'bg-[var(--neon-green)] text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Explore</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{systemUsers.length}</span>
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

      {/* TAB 2: FOLLOWERS LIST */}
      {activeTab === 'followers' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search followers..."
              value={followerSearch}
              onChange={(e) => setFollowerSearch(e.target.value)}
              className="w-full glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredFollowers.length === 0 ? (
              <div className="col-span-full glass-panel p-8 text-center text-zinc-500 font-mono text-xs">
                No followers found. Share your profile link to grow your network!
              </div>
            ) : (
              filteredFollowers.map((flicker) => {
                const following = isUserFollowing(flicker.uid);
                return (
                  <div
                    key={flicker.uid}
                    className="glass-panel p-4 flex items-center justify-between gap-3 hover:border-[var(--neon-green)]/40 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile && onOpenUserProfile(flicker.uid)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
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
                    </button>

                    <button
                      onClick={() => handleToggleFollow(flicker)}
                      disabled={submittingMap[flicker.uid]}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[10px] uppercase font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                        following
                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          : 'bg-[var(--neon-green)] text-black font-extrabold border border-black hover:bg-white'
                      }`}
                    >
                      {following ? (
                        <>
                          <UserCheck className="w-3 h-3" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" /> Follow Back
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

      {/* TAB 3: FOLLOWING LIST */}
      {activeTab === 'following' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search following nodes..."
              value={followerSearch}
              onChange={(e) => setFollowerSearch(e.target.value)}
              className="w-full glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredFollowing.length === 0 ? (
              <div className="col-span-full glass-panel p-8 text-center text-zinc-500 font-mono text-xs">
                You are not following any nodes yet. Browse the Explore tab!
              </div>
            ) : (
              filteredFollowing.map((flicker) => (
                <div
                  key={flicker.uid}
                  className="glass-panel p-4 flex items-center justify-between gap-3 hover:border-[var(--neon-green)]/40 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => onOpenUserProfile && onOpenUserProfile(flicker.uid)}
                    className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                  >
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
                  </button>

                  <button
                    onClick={() => handleToggleFollow(flicker)}
                    disabled={submittingMap[flicker.uid]}
                    className="px-3 py-1.5 rounded-xl font-mono text-[10px] uppercase font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-500/50"
                  >
                    <UserCheck className="w-3 h-3" /> Following
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EXPLORE USERS GRID */}
      {activeTab === 'explore' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search community nodes by name or handle..."
              value={followerSearch}
              onChange={(e) => setFollowerSearch(e.target.value)}
              className="w-full glass-input pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredExplore.length === 0 ? (
              <div className="col-span-full glass-panel p-8 text-center text-zinc-500 font-mono text-xs">
                No community nodes found matching search query.
              </div>
            ) : (
              filteredExplore.map((flicker) => {
                const following = isUserFollowing(flicker.uid);

                return (
                  <div
                    key={flicker.uid}
                    className="glass-panel p-4 flex items-center justify-between gap-3 hover:border-[var(--neon-green)]/40 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile && onOpenUserProfile(flicker.uid)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
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
                    </button>

                    <button
                      onClick={() => handleToggleFollow(flicker)}
                      disabled={submittingMap[flicker.uid]}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[10px] uppercase font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                        following
                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                          : 'bg-[var(--neon-green)] text-black font-extrabold border border-black hover:bg-white'
                      }`}
                    >
                      {following ? (
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
