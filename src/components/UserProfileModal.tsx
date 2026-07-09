import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Activity, FileText, Mail, Key, Sparkles, AlertTriangle } from 'lucide-react';
import { UserProfile, Post } from '../types';
import { getUserProfile, getDeterministicChatId } from '../lib/services';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { playGlitchClickSound } from '../lib/sounds';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileModalProps {
  uid: string | null;
  onClose: () => void;
}

export default function UserProfileModal({ uid, onClose }: UserProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time call tracking states
  const [isInCall, setIsInCall] = useState(false);
  const [activeCallDetails, setActiveCallDetails] = useState<any>(null);

  const { profile: myProfile } = useAuth();
  const [chatData, setChatData] = useState<any | null>(null);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);

  useEffect(() => {
    if (!uid || !myProfile?.uid) return;
    const chatId = getDeterministicChatId(myProfile.uid, uid);
    const chatRef = doc(db, 'chats', chatId);
    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChatData(data);
        const map = data.disabledReadReceipts || {};
        // Read receipt is enabled if we haven't explicitly set disabled to true
        setReadReceiptsEnabled(map[myProfile.uid] !== true);
      } else {
        setChatData(null);
        setReadReceiptsEnabled(true);
      }
    }, (err) => {
      console.warn("Failed subscribing to chat for read receipts toggle:", err);
    });
    return () => unsub();
  }, [uid, myProfile?.uid]);

  const toggleReadReceipts = async () => {
    if (!uid || !myProfile?.uid) return;
    playGlitchClickSound();
    const chatId = getDeterministicChatId(myProfile.uid, uid);
    const chatRef = doc(db, 'chats', chatId);
    
    try {
      // Ensure the chat document exists first
      const { getOrCreateDirectChat } = await import('../lib/services');
      const chat = await getOrCreateDirectChat(myProfile.uid, uid);

      const nextVal = !readReceiptsEnabled;
      const currentDisabled = chat?.disabledReadReceipts || {};
      const updatedMap = {
        ...currentDisabled,
        [myProfile.uid]: !nextVal
      };
      
      await updateDoc(chatRef, {
        disabledReadReceipts: updatedMap
      });
      setReadReceiptsEnabled(nextVal);
    } catch (err) {
      console.error("Failed to update read receipts preference:", err);
    }
  };

  useEffect(() => {
    if (!uid) return;
    
    const qCalls = query(collection(db, 'calls'));
    const unsubscribeCalls = onSnapshot(qCalls, (snap) => {
      const activeCall = snap.docs
        .map(doc => doc.data())
        .find(c => (c.callerId === uid || c.receiverId === uid) && c.status !== 'ended');
      
      setIsInCall(!!activeCall);
      setActiveCallDetails(activeCall || null);
    }, (err) => {
      console.warn("Active call monitor subscription warning:", err);
    });

    return () => unsubscribeCalls();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    setPosts([]);

    async function loadData() {
      try {
        // Fetch profile
        const userProf = await getUserProfile(uid);
        if (!userProf) {
          setError('User profile coordinates not found in cryptographic lookup registry.');
          setLoading(false);
          return;
        }
        setProfile(userProf);

        // Fetch user's dialogue posts
        const postsRef = collection(db, 'posts');
        const q = query(
          postsRef,
          where('authorId', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(15)
        );
        const snap = await getDocs(q);
        const loadedPosts: Post[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Post));
        setPosts(loadedPosts);
      } catch (err: any) {
        console.error('[Profile Fetch] DB query failure:', err);
        setError(err.message || 'Lookup failure on remote cluster.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [uid]);

  if (!uid) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop glass blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#050505]/85 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Brutalist frame */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-2xl bg-[#090909] border-2 border-[var(--neon-green)] p-6 md:p-8 shadow-[6px_6px_0px_#000000] z-10 overflow-hidden font-mono text-zinc-100 max-h-[85vh] flex flex-col"
        >
          {/* Header coordinates decoration (Brutalism aesthetic) */}
          <div className="flex items-center justify-between border-b-2 border-[var(--neon-green)]/35 pb-4 mb-6 shrink-0">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--neon-green)] shrink-0" />
              <span className="text-[10px] uppercase font-black tracking-widest text-[var(--neon-green)]">
                PROXIMITY SECURE PROFILE // Node ID: {uid.substring(0, 12)}...
              </span>
            </div>
            <button
              onClick={() => {
                playGlitchClickSound();
                onClose();
              }}
              className="p-1 px-3 border border-[var(--neon-green)]/30 hover:border-red-500 hover:bg-red-500 hover:text-black transition text-zinc-400 text-[10px] uppercase font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </div>

          {loading ? (
            <div className="flex-1 space-y-6 overflow-y-auto animate-pulse">
              {/* Profile Card Identity skeleton */}
              <div className="bg-black/55 border border-zinc-900 p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 shrink-0" />
                <div className="space-y-3 flex-1 w-full">
                  <div className="h-4 bg-zinc-900 w-1/3 rounded" />
                  <div className="h-2.5 bg-zinc-900 w-1/5 rounded" />
                  <div className="h-3 bg-zinc-900 w-2/3 rounded mt-2" />
                  <div className="space-y-1.5 pt-1">
                    <div className="h-2 bg-zinc-900 w-1/2 rounded" />
                    <div className="h-2 bg-zinc-900 w-2/5 rounded" />
                  </div>
                </div>
              </div>

              {/* Public key skeleton */}
              <div className="bg-zinc-950 border border-zinc-900 p-4 space-y-2">
                <div className="h-3 bg-zinc-900 w-1/4 rounded" />
                <div className="h-2 bg-zinc-900 w-full rounded" />
                <div className="h-2 bg-zinc-900 w-5/6 rounded" />
              </div>

              {/* Dialogue feeds published skeleton */}
              <div className="space-y-3">
                <div className="h-3 bg-zinc-900 w-1/5 rounded" />
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div key={idx} className="p-4 bg-zinc-950/40 border border-zinc-900 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-zinc-900 rounded-full" />
                        <div className="h-2 bg-zinc-900 w-20 rounded" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2.5 bg-zinc-900 w-full rounded" />
                        <div className="h-2.5 bg-zinc-900 w-4/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-red-500/30 bg-red-500/5 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">{error}</p>
            </div>
          ) : !profile ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2 text-zinc-500 italic text-xs">
              This cryptographic node has not configured its public directory profile.
            </div>
          ) : (
            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
              {/* Profile Card Identity */}
              <div className="bg-black/55 border border-[var(--neon-green)]/20 p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5 relative overflow-hidden">
                <div className="absolute top-2 right-2 pointer-events-none text-[8px] text-[var(--neon-green)]/25 uppercase select-none font-bold">
                  REGISTRY VERIFIED
                </div>

                <div className="relative shrink-0 select-none">
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    className={`w-16 h-16 border-2 object-cover ${
                      isInCall ? 'border-red-500' : 'border-[var(--neon-green)]/30'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                  {isInCall && (
                    <>
                      <span className="absolute inset-0 border-2 border-red-500 animate-ping opacity-75" />
                      <span className="absolute inset-[-4px] border border-red-500/50 animate-pulse" />
                    </>
                  )}
                </div>

                <div className="space-y-2 text-center sm:text-left min-w-0 flex-1">
                  <div>
                    <h2 className="text-xl font-serif italic text-white font-black leading-tight">
                      {profile.displayName}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8.5px] font-mono font-bold uppercase border ${
                        profile.status === 'online' 
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                          : 'border-zinc-700 bg-zinc-900/50 text-zinc-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${profile.status === 'online' ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
                        {profile.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                      </span>

                      {isInCall && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8.5px] font-mono font-bold uppercase border border-red-500 bg-red-955/20 text-red-500 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          IN ENCRYPTED CALL
                        </span>
                      )}
                    </div>

                    {isInCall ? (
                      <div className="mt-2.5 p-2 bg-red-955/20 border border-red-500 flex items-center justify-between gap-3 animate-pulse text-[8px] font-mono">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          <div className="font-black tracking-widest text-red-500 uppercase">
                            ⚡ SECURE AUDIO LINK ACTIVE // STATUS: {activeCallDetails?.status?.toUpperCase()}
                          </div>
                        </div>
                        <span className="text-[7.5px] bg-red-500 text-black px-1.5 py-0.5 font-black uppercase select-none">
                          LIVE_VOX
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2.5 p-2 bg-[var(--neon-green)]/5 border border-[var(--neon-green)]/15 flex items-center gap-2 text-[8px] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]/50"></span>
                        <div className="tracking-widest text-[var(--neon-green)]/50 uppercase">
                          STANDBY // ENCRYPTION COURIER READY
                        </div>
                      </div>
                    )}
                  </div>

                  {profile.bio && (
                    <p className="text-[11px] text-zinc-300 leading-relaxed max-w-md italic border-l-2 border-[var(--neon-green)]/30 pl-3">
                      "{profile.bio}"
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 text-[9px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[var(--neon-green)]/70 shrink-0" />
                      <span className="truncate">{profile.email || 'REDACTED@FARAFK.TUNNEL'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[var(--neon-green)]/70 shrink-0" />
                      <span>UID: {profile.uid.substring(0, 16)}...</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* public keys coordinates keys */}
              {profile.publicKey && (
                <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-[var(--neon-green)] font-mono">
                    <Key className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                    <span>Active E2EE Public Key Coordinates</span>
                  </div>
                  <p className="text-[8.5px] text-zinc-500 font-mono break-all leading-relaxed whitespace-pre-wrap select-all max-h-16 overflow-y-auto scrollbar-thin">
                    {profile.publicKey}
                  </p>
                </div>
              )}

              {/* Granular Privacy Settings Section */}
              {uid !== myProfile?.uid && (
                <div className="bg-zinc-950 border border-[var(--neon-green)]/35 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-[var(--neon-green)] font-mono">
                    <Shield className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                    <span>Granular Privacy Preferences</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-[#090909] border border-zinc-900 gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-white font-mono uppercase font-bold block">
                        Read Receipts for this Chat
                      </span>
                      <span className="text-[8.5px] text-zinc-500 font-mono block leading-normal">
                        Toggle read checkmarks. If disabled, neither participant will see read ticks (green checkmarks) for this conversation.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleReadReceipts}
                      className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border cursor-pointer transition shrink-0 ${
                        readReceiptsEnabled
                          ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/20'
                          : 'border-rose-500 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                      }`}
                    >
                      {readReceiptsEnabled ? '[ENABLED / ON]' : '[DISABLED / OFF]'}
                    </button>
                  </div>
                </div>
              )}

              {/* dialogue feeds published */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase font-extrabold tracking-wider text-white border-b border-dashed border-zinc-800 pb-2">
                  <FileText className="w-4 h-4 text-[var(--neon-green)] shrink-0" />
                  <span>DIALOGUE FEEDS PUBLISHED ({posts.length})</span>
                </div>

                {posts.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 italic uppercase">
                    This user node has not transmitted any public dialogue feeds.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin pr-1">
                    {posts.map((post) => (
                      <div 
                        key={post.id} 
                        className="p-3 bg-[#0c0c0c] border border-zinc-800 hover:border-zinc-700 transition rounded-none text-[11px] leading-relaxed relative"
                      >
                        <p className="text-zinc-300 font-sans">{post.content}</p>
                        {post.imageUrl && (
                          <img 
                            src={post.imageUrl} 
                            alt="Attached node graphics" 
                            className="mt-2 text-center max-h-24 w-auto object-cover border border-zinc-800/40"
                          />
                        )}
                        <span className="text-[7.5px] uppercase text-zinc-400 font-mono block text-right mt-1.5 tracking-wide">
                          {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'GENESIS RELEASE'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
