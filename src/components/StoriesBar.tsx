import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Story, MessageReaction } from '../types';
import { showBrutalistToast } from '../lib/toast';
import { 
  createStory, 
  subscribeToStories, 
  viewStory, 
  addOrUpdateStoryReaction, 
  removeStoryReaction, 
  subscribeToStoryReactions,
  subscribeToUsers,
  voteStoryPoll,
  getOrCreateDirectChat,
  sendE2EEMessage
} from '../lib/services';
import { 
  Plus, X, Eye, Image as ImageIcon, Sparkles, Clock, ChevronLeft, ChevronRight, 
  Smile, Film, Volume2, Mic, VolumeX, BarChart2, Users, Music, MapPin, 
  Link2, PlusCircle, AlertCircle, Play, Pause, RotateCcw, Send, CheckCircle, Flame, Gift, Award
} from 'lucide-react';
import { playLikeSound, playGlitchClickSound } from '../lib/sounds';
import { fileToBase64 } from '../lib/mediaHelper';
import { motion, AnimatePresence } from 'motion/react';
import StoryDashboardOverlay from './StoryDashboardOverlay';

interface StoryGroup {
  authorId: string;
  authorName: string;
  authorPhoto: string;
  stories: Story[];
}

// Bulk Upload creator items
interface CreatorStoryItem {
  id: string;
  mediaType: 'image' | 'video' | 'audio' | 'none';
  dataUrl?: string;
  name?: string;
  content: string;
  link: string;
  location: string;
  musicTitle: string;
  musicArtist: string;
  pollQuestion: string;
  pollOptions: string[]; // Up to 4 strings
  stickers: string[]; // Emoji sticker badges
  mentions: string; // Space/comma separated mentions
  hashtags: string; // Space/comma separated hashtags
  gradientPreset: string; // Index or key
}

// Upload queue task status
interface UploadQueueTask {
  id: string;
  mediaType: 'image' | 'video' | 'audio' | 'none';
  name?: string;
  dataUrl?: string;
  content: string;
  link?: string;
  location?: string;
  musicTitle?: string;
  musicArtist?: string;
  pollQuestion?: string;
  pollOptions?: { id: string; text: string; votes: number }[];
  stickers?: string[];
  mentions?: string[];
  hashtags?: string[];
  gradientPreset?: string;
  
  // Pipeline management states
  progress: number;
  status: 'pending' | 'compressing' | 'uploading' | 'completed' | 'failed' | 'paused';
  error?: string;
}

const GRADIENT_PRESETS = [
  { key: 'slate', name: 'Slate Dusk', class: 'from-zinc-900 via-slate-800 to-zinc-950 text-white' },
  { key: 'cosmic', name: 'Cosmic Glow', class: 'from-violet-950 via-purple-900 to-zinc-950 text-white' },
  { key: 'neon', name: 'Cyber Neon', class: 'from-cyan-950 via-zinc-900 to-blue-950 text-cyan-400' },
  { key: 'cyberpunk', name: 'Cyberpunk', class: 'from-purple-900 via-red-950 to-amber-900 text-yellow-400' },
  { key: 'rosegold', name: 'Rose Gold', class: 'from-rose-950 via-stone-900 to-neutral-900 text-rose-200' },
  { key: 'forest', name: 'Forest Moss', class: 'from-emerald-950 via-teal-900 to-zinc-950 text-emerald-300' },
  { key: 'solar', name: 'Solar Burst', class: 'from-amber-950 via-orange-900 to-zinc-950 text-orange-200' },
];

const PRESET_STICKERS = ['🔥', '🚀', '🎉', '👽', '💀', '👾', '🍕', '🍻', '🧠', '💡', '💎', '🦄', '💖', '⭐', '🌈', '⚡'];

export default function StoriesBar() {
  const { profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  
  // Immersive player states
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number>(0);
  const [isPlayerMuted, setIsPlayerMuted] = useState(false);
  const [isPlayerPaused, setIsPlayerPaused] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  // BULK CREATOR WORKSPACE STATE
  const [storyBatch, setStoryBatch] = useState<CreatorStoryItem[]>([]);
  const [activeBatchIdx, setActiveBatchIdx] = useState<number>(0);
  
  // PIPELINE UPLOAD QUEUE STATE
  const [uploadQueue, setUploadQueue] = useState<UploadQueueTask[]>([]);
  const uploadQueueRef = useRef<UploadQueueTask[]>([]);
  useEffect(() => {
    uploadQueueRef.current = uploadQueue;
  }, [uploadQueue]);

  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  
  // Extra elements for player
  const [currentReactions, setCurrentReactions] = useState<MessageReaction[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Subscribe to all users to resolve profiles
  useEffect(() => {
    const unsubscribe = subscribeToUsers((usersList) => {
      const map: Record<string, any> = {};
      usersList.forEach(u => {
        map[u.uid] = u;
      });
      setUsersMap(map);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to stories real-time feed
  useEffect(() => {
    const unsubscribe = subscribeToStories((newList) => {
      const now = new Date().getTime();
      
      const getMs = (s: any) => {
        if (!s.createdAt) return now;
        if (s.createdAt.toDate) {
          try {
            return s.createdAt.toDate().getTime();
          } catch (e) {
            return now;
          }
        }
        if (typeof s.createdAt === 'number') return s.createdAt;
        if (s.createdAt.seconds) return s.createdAt.seconds * 1000;
        const parsed = Date.parse(s.createdAt);
        return isNaN(parsed) ? now : parsed;
      };

      const validStoriesList = newList.filter(s => {
        if (!s.createdAt) return true; // Keep pending uploads
        const time = getMs(s);
        return (now - time) < (24 * 60 * 60 * 1000); // Expiration limit
      });
      
      // Deduplicate stories by unique ID to prevent identical dual-render artifacts
      const uniqueStoriesMap = new Map<string, Story>();
      validStoriesList.forEach(s => {
        if (s.id) {
          const existing = uniqueStoriesMap.get(s.id);
          if (!existing || (!existing.createdAt && s.createdAt)) {
            uniqueStoriesMap.set(s.id, s);
          }
        }
      });
      const uniqueStoriesList = Array.from(uniqueStoriesMap.values());

      const sanitizedList = uniqueStoriesList.map(s => {
        if (s.authorId !== profile?.uid) {
          return { ...s, viewedBy: s.viewedBy || [] };
        }
        return s;
      });

      setStories(sanitizedList);
      
      // Group by authorId
      const groups: StoryGroup[] = [];
      const sortedStories = [...sanitizedList].sort((a, b) => {
        return getMs(a) - getMs(b);
      });

      sortedStories.forEach(s => {
        let match = groups.find(g => g.authorId === s.authorId);
        if (!match) {
          match = {
            authorId: s.authorId,
            authorName: s.authorName,
            authorPhoto: s.authorPhoto,
            stories: []
          };
          groups.push(match);
        }
        match.stories.push(s);
      });
      setStoryGroups(groups);
    }, (err) => {
      console.error("Stories stream subscription failed:", err);
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  // Handle active player story state reactions and view counts
  const activeGroup = activeGroupIdx !== null ? storyGroups[activeGroupIdx] : null;
  const activeStory = activeGroup ? activeGroup.stories[activeStoryIdx] : null;

  useEffect(() => {
    if (!activeStory) {
      setCurrentReactions([]);
      return;
    }

    if (profile) {
      viewStory(activeStory.id, profile.uid).catch(() => {});
    }

    const unsubscribe = subscribeToStoryReactions(activeStory.id, (loadedReactions) => {
      setCurrentReactions(loadedReactions);
    });

    return () => unsubscribe();
  }, [activeStory?.id, profile?.uid]);

  // STORY PLAYER PROGRESS CONTROLLER
  useEffect(() => {
    if (activeGroupIdx === null || !activeGroup || isPlayerPaused) return;

    // Standard story slides play for 7 seconds
    const timer = setTimeout(() => {
      handleNextStory();
    }, 7000);

    return () => clearTimeout(timer);
  }, [activeGroupIdx, activeStoryIdx, isPlayerPaused, storyGroups.length]);

  const handleNextStory = () => {
    if (activeGroupIdx === null || !activeGroup) return;

    if (activeStoryIdx < activeGroup.stories.length - 1) {
      setActiveStoryIdx(activeStoryIdx + 1);
    } else if (activeGroupIdx < storyGroups.length - 1) {
      setActiveGroupIdx(activeGroupIdx + 1);
      setActiveStoryIdx(0);
    } else {
      setActiveGroupIdx(null);
      setActiveStoryIdx(0);
    }
  };

  const handlePrevStory = () => {
    if (activeGroupIdx === null || !activeGroup) return;

    if (activeStoryIdx > 0) {
      setActiveStoryIdx(activeStoryIdx - 1);
    } else if (activeGroupIdx > 0) {
      const prevGroup = storyGroups[activeGroupIdx - 1];
      setActiveGroupIdx(activeGroupIdx - 1);
      setActiveStoryIdx(prevGroup.stories.length - 1);
    } else {
      setActiveStoryIdx(0);
    }
  };

  // BACKGROUND STORY UPLOAD PIPELINE PROCESSOR
  useEffect(() => {
    // Pick the first 'pending' task in the queue to process sequentially
    const nextTask = uploadQueue.find(t => t.status === 'pending');
    if (!nextTask) return;

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const runPipeline = async () => {
      try {
        // 1. COMPRESSING STAGE (Simulated smart compression metrics check)
        setUploadQueue(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'compressing', progress: 15 } : t));
        await new Promise(r => setTimeout(r, 600));

        // 2. UPLOADING STAGE (Incremental progress ticks)
        setUploadQueue(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'uploading', progress: 30 } : t));
        
        let currentProgress = 30;
        const interval = setInterval(async () => {
          // Double check if the user paused the task during upload using the stable, synchronized ref
          const currentTaskState = uploadQueueRef.current.find(t => t.id === nextTask.id);

          if (!currentTaskState) {
            clearInterval(interval);
            isProcessingRef.current = false;
            return;
          }

          if (currentTaskState.status === 'paused') {
            clearInterval(interval);
            isProcessingRef.current = false;
            return;
          }

          if (currentProgress < 90) {
            currentProgress += 15;
            setUploadQueue(prev => prev.map(t => t.id === nextTask.id ? { ...t, progress: currentProgress } : t));
          } else {
            clearInterval(interval);
            // Complete and Write to Firestore
            try {
              setUploadQueue(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'uploading', progress: 95 } : t));
              
              await createStory({
                authorId: profile?.uid || 'anonymous',
                authorName: profile?.displayName || 'Campus Citizen',
                authorPhoto: profile?.photoURL || '',
                content: nextTask.content,
                mediaType: nextTask.mediaType,
                imageUrl: nextTask.mediaType === 'image' ? nextTask.dataUrl : undefined,
                videoUrl: nextTask.mediaType === 'video' ? nextTask.dataUrl : undefined,
                audioUrl: nextTask.mediaType === 'audio' ? nextTask.dataUrl : undefined,
                link: nextTask.link || undefined,
                location: nextTask.location || undefined,
                musicTitle: nextTask.musicTitle || undefined,
                musicArtist: nextTask.musicArtist || undefined,
                pollQuestion: nextTask.pollQuestion || undefined,
                pollOptions: nextTask.pollOptions || undefined,
                stickers: nextTask.stickers || undefined,
                mentions: nextTask.mentions || undefined,
                hashtags: nextTask.hashtags || undefined,
                gradientPreset: nextTask.gradientPreset || undefined
              });

              setUploadQueue(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'completed', progress: 100 } : t));
              showBrutalistToast('STATUS BULK SUCCESS', `Story item uploaded successfully!`, 'success');
              playLikeSound();
            } catch (err: any) {
              console.error("Bulk upload task crash:", err);
              setUploadQueue(prev => prev.map(t => t.id === nextTask.id ? { ...t, status: 'failed', error: err?.message || 'Transmission handshakes failed' } : t));
              showBrutalistToast('TRANSMISSION EXCEPTION', `Failed to deliver story task: ${nextTask.name}`, 'error');
            } finally {
              isProcessingRef.current = false;
            }
          }
        }, 400);
      } catch (err: any) {
        console.error("Pipeline run outer catch error:", err);
        isProcessingRef.current = false;
      }
    };

    runPipeline();
  }, [uploadQueue, profile]);

  // Monitor network status change to trigger auto resumption of paused queue items
  useEffect(() => {
    const handleOnline = () => {
      showBrutalistToast('CONNECTION RE-ESTABLISHED', 'Network link online. Auto draining status upload queue...', 'success');
      setUploadQueue(prev => prev.map(t => t.status === 'paused' ? { ...t, status: 'pending' } : t));
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // INIT BULK STORY BATCH WITH DEFAULT TEXT SLIDE
  const initBatchWorkspace = () => {
    if (!profile || !profile.uid) {
      showBrutalistToast('SECURITY DENIAL', 'You must log in to publish a story on the network.', 'error');
      return;
    }
    const defaultSlide: CreatorStoryItem = {
      id: 'slide_' + Math.random().toString(36).substring(2, 9),
      mediaType: 'none',
      content: '',
      link: '',
      location: '',
      musicTitle: '',
      musicArtist: '',
      pollQuestion: '',
      pollOptions: ['', ''],
      stickers: [],
      mentions: '',
      hashtags: '',
      gradientPreset: 'cosmic'
    };
    setStoryBatch([defaultSlide]);
    setActiveBatchIdx(0);
    setIsCreateOpen(true);
  };

  // MULTIPLE FILE PROCESSING
  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newSlides: CreatorStoryItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const mime = file.type;
        let mediaType: 'image' | 'video' | 'audio' | 'none' = 'none';
        if (mime.startsWith('image/')) mediaType = 'image';
        else if (mime.startsWith('video/')) mediaType = 'video';
        else if (mime.startsWith('audio/')) mediaType = 'audio';

        if (mediaType === 'none') {
          showBrutalistToast('TYPE WARNING', `Skipped ${file.name} - Unsupported format.`, 'warning');
          continue;
        }

        // Only enforce pre-upload limits on non-compressed media (videos and audio clips)
        if (mediaType !== 'image' && file.size > 1548576) {
          showBrutalistToast('ASSET OVERSIZE', `Skipping ${file.name} (> 1.5MB). Only images support auto-compression.`, 'warning');
          continue;
        }

        const b64 = await fileToBase64(file);
        newSlides.push({
          id: 'slide_' + Math.random().toString(36).substring(2, 9) + '_' + i,
          mediaType,
          dataUrl: b64,
          name: file.name,
          content: '',
          link: '',
          location: '',
          musicTitle: '',
          musicArtist: '',
          pollQuestion: '',
          pollOptions: ['', ''],
          stickers: [],
          mentions: '',
          hashtags: '',
          gradientPreset: 'cosmic'
        });
      } catch (err) {
        showBrutalistToast('MEDIA ERROR', `Failed processing raw binary files: ${file.name}`, 'error');
      }
    }

    if (newSlides.length > 0) {
      // Append to the active story batch
      setStoryBatch(prev => {
        const filtered = prev.filter(s => s.mediaType !== 'none' || s.content.trim() !== '');
        const updated = [...filtered, ...newSlides];
        setActiveBatchIdx(updated.length - 1);
        return updated;
      });
      playGlitchClickSound();
    }
  };

  const addTextSlide = () => {
    const newSlide: CreatorStoryItem = {
      id: 'slide_' + Math.random().toString(36).substring(2, 9),
      mediaType: 'none',
      content: '',
      link: '',
      location: '',
      musicTitle: '',
      musicArtist: '',
      pollQuestion: '',
      pollOptions: ['', ''],
      stickers: [],
      mentions: '',
      hashtags: '',
      gradientPreset: 'slate'
    };
    setStoryBatch(prev => [...prev, newSlide]);
    setActiveBatchIdx(storyBatch.length);
    playGlitchClickSound();
  };

  const removeSlideFromBatch = (indexToRemove: number) => {
    if (storyBatch.length <= 1) {
      showBrutalistToast('BATCH EMPTY', 'You need at least one slide in your batch stories.', 'warning');
      return;
    }
    setStoryBatch(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setActiveBatchIdx(prevIdx => Math.max(0, prevIdx - 1));
    playGlitchClickSound();
  };

  // UPDATE PARAMETERS OF ACTIVE SLIDE IN CREATION WORKSPACE
  const updateActiveSlide = (fields: Partial<CreatorStoryItem>) => {
    setStoryBatch(prev => prev.map((s, idx) => idx === activeBatchIdx ? { ...s, ...fields } : s));
  };

  // DISPATCH ENTIRE BATCH TO THE PIPELINE UPLOAD QUEUE
  const handleBroadcastBatch = () => {
    const tasks: UploadQueueTask[] = storyBatch.map(slide => {
      // Parse mentions and hashtags to arrays
      const mentionsArr = slide.mentions
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(t => t.startsWith('@') && t.length > 1);

      const hashtagsArr = slide.hashtags
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(t => t.startsWith('#') && t.length > 1);

      // Clean poll options
      const parsedPollOptions = slide.pollQuestion.trim()
        ? slide.pollOptions.filter(opt => opt.trim() !== '').map((opt, i) => ({ id: 'opt_' + i, text: opt.trim(), votes: 0 }))
        : undefined;

      return {
        id: slide.id,
        mediaType: slide.mediaType,
        name: slide.name || 'Text Story Block',
        dataUrl: slide.dataUrl,
        content: slide.content.trim(),
        link: slide.link.trim() || undefined,
        location: slide.location.trim() || undefined,
        musicTitle: slide.musicTitle.trim() || undefined,
        musicArtist: slide.musicArtist.trim() || undefined,
        pollQuestion: slide.pollQuestion.trim() || undefined,
        pollOptions: parsedPollOptions,
        stickers: slide.stickers.length > 0 ? slide.stickers : undefined,
        mentions: mentionsArr.length > 0 ? mentionsArr : undefined,
        hashtags: hashtagsArr.length > 0 ? hashtagsArr : undefined,
        gradientPreset: slide.mediaType === 'none' ? slide.gradientPreset : undefined,
        progress: 0,
        status: 'pending'
      };
    });

    setUploadQueue(prev => [...prev, ...tasks]);
    setIsCreateOpen(false);
    setIsQueueExpanded(true);
    showBrutalistToast('PIPELINE ACTIVATED', `${tasks.length} stories added to background transmission queue!`, 'success');
    playGlitchClickSound();
  };

  // CONTROL TASK IN TRANSMISSION QUEUE
  const pauseTask = (id: string) => {
    setUploadQueue(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' } : t));
    playGlitchClickSound();
  };

  const resumeTask = (id: string) => {
    setUploadQueue(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' } : t));
    playGlitchClickSound();
  };

  const cancelTask = (id: string) => {
    setUploadQueue(prev => prev.filter(t => t.id !== id));
    playGlitchClickSound();
  };

  // STORY POLL VOTE DISPATCHER
  const handleVotePoll = async (storyId: string, optionId: string) => {
    if (!profile) return;
    try {
      playGlitchClickSound();
      await voteStoryPoll(storyId, profile.uid, optionId);
      showBrutalistToast('VOTE REGISTERED', 'Your opinion has been stored securely!', 'success');
    } catch (err) {
      showBrutalistToast('TRANSMISSION ERROR', 'Failed to transmit vote to cluster.', 'error');
    }
  };

  // TOGGLE REACTION
  const toggleReaction = async (emoji: string) => {
    if (!profile || !activeStory) return;
    const existing = currentReactions.find(r => r.userId === profile.uid);
    if (existing && existing.emoji === emoji) {
      await removeStoryReaction(activeStory.id, profile.uid);
    } else {
      await addOrUpdateStoryReaction(activeStory.id, {
        userId: profile.uid,
        userName: profile.displayName,
        emoji
      });
    }
    playLikeSound();
    setShowReactionPicker(false);
  };

  // DISPATCH INSTANT SECURE STORY REPLY (Became cryptographic chat message)
  const handleSendReply = async () => {
    if (!profile || !activeStory || !replyInput.trim()) return;
    
    setIsSendingReply(true);
    try {
      const authorId = activeStory.authorId;
      const peerProfile = usersMap[authorId];
      if (!peerProfile) {
        throw new Error("Unable to resolve recipient profile cluster.");
      }

      // Establish/fetch Direct Chat room
      const chat = await getOrCreateDirectChat(profile.uid, authorId);
      
      const payloadText = `💬 [Story Reply to "${activeStory.content || 'Media status'}"]: ${replyInput.trim()}`;

      // Cryptographically E2EE deliver message reply
      await sendE2EEMessage({
        chatId: chat.id,
        senderId: profile.uid,
        senderDisplayName: profile.displayName,
        receiverId: authorId,
        plainText: payloadText,
        recipientPublicKeyJwk: peerProfile.publicKey,
        senderPublicKeyJwk: profile.publicKey
      });

      playLikeSound();
      showBrutalistToast('REPLY DELIVERED ✓', 'Direct cryptographically secured reply delivered!', 'success');
      setReplyInput('');
    } catch (err: any) {
      console.error("Story reply submission failed:", err);
      showBrutalistToast('TRANSMISSION SHIELDED', err?.message || 'Handshake failed', 'error');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Aggregation of reactions
  const groupedReactions = currentReactions.reduce((acc, r) => {
    const match = acc.find(x => x.emoji === r.emoji);
    if (match) {
      match.users.push(r);
    } else {
      acc.push({ emoji: r.emoji, users: [r] });
    }
    return acc;
  }, [] as { emoji: string; users: MessageReaction[] }[]);

  const isGroupViewed = (group: StoryGroup) => {
    if (!profile) return false;
    return group.stories.every(s => s.viewedBy?.includes(profile.uid));
  };

  const activeBatchSlide = storyBatch[activeBatchIdx];

  return (
    <div id="tour-stories-bar" className="w-full bg-white dark:bg-zinc-950 border border-black/10 dark:border-zinc-800 p-3 sm:p-4 mb-2 sm:mb-4 relative">
      <div className="flex items-center justify-between mb-3 border-b border-black/5 dark:border-zinc-900 pb-2">
        <span className="text-[10px] uppercase tracking-widest font-black text-neutral-500 dark:text-zinc-400">
          Realtime Circles Stories
        </span>
        <div className="flex items-center space-x-2">
          {/* Dashboard overlay button */}
          <button
            onClick={() => {
              playGlitchClickSound();
              setIsDashboardOpen(true);
            }}
            className="flex items-center space-x-1 border border-neutral-300 dark:border-zinc-800 hover:border-black dark:hover:border-white px-2.5 py-0.5 text-neutral-600 dark:text-zinc-400 hover:text-black dark:hover:text-white bg-white dark:bg-zinc-900 transition duration-150 cursor-pointer text-[9.5px] font-mono uppercase font-black"
            title="Open Stories Analytics Dashboard"
          >
            <BarChart2 className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>Viewer Analytics</span>
          </button>
          
          {uploadQueue.length > 0 && (
            <button
              onClick={() => setIsQueueExpanded(!isQueueExpanded)}
              className="flex items-center space-x-1.5 px-2 py-0.5 border border-amber-400 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9.5px] font-mono font-black uppercase"
            >
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
              <span>Pipeline: {uploadQueue.filter(t => t.status !== 'completed').length} Tasks</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Story Groups Scroll */}
      <div className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-none select-none">
        <div className="flex flex-col items-center space-y-1.5 flex-shrink-0">
          <motion.button
            id="bulk-stories-creator-trigger"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playGlitchClickSound();
              initBatchWorkspace();
            }}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-dashed border-neutral-400 dark:border-zinc-700 flex items-center justify-center hover:border-black dark:hover:border-zinc-400 transition-all bg-[#FAF9F6] dark:bg-zinc-900 group cursor-pointer"
            title="Publish dynamic stories batch"
          >
            <Plus className="w-5 h-5 text-neutral-500 group-hover:text-black dark:group-hover:text-white transition-colors" />
          </motion.button>
          <span className="text-[9.5px] font-bold text-neutral-500 dark:text-zinc-500 uppercase tracking-wider">
            Share
          </span>
        </div>

        {storyGroups.map((group, idx) => {
          const viewed = isGroupViewed(group);
          return (
            <motion.div
              key={group.authorId}
              whileHover={{ scale: 1.04 }}
              onClick={() => {
                playGlitchClickSound();
                setActiveGroupIdx(idx);
                setActiveStoryIdx(0);
                setIsPlayerPaused(false);
              }}
              className="flex flex-col items-center space-y-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div 
                className={`p-0.5 rounded-full transition-all duration-300 relative ${
                  viewed 
                    ? 'border border-neutral-300 dark:border-zinc-800' 
                    : 'border-2 border-amber-500 dark:border-amber-400'
                }`}
              >
                <img
                  src={group.authorPhoto}
                  alt={group.authorName}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border border-white dark:border-black bg-zinc-100"
                  referrerPolicy="no-referrer"
                />
                
                {group.stories.length > 1 && (
                  <span className="absolute -top-1 -right-1 bg-black text-white dark:bg-white dark:text-black font-mono text-[8px] font-black h-4 px-1 rounded-full flex items-center justify-center">
                    {group.stories.length}
                  </span>
                )}
              </div>
              <span className="text-[9.5px] font-semibold text-neutral-700 dark:text-zinc-400 tracking-tight max-w-[64px] truncate text-center font-serif italic">
                {group.authorName}
              </span>
            </motion.div>
          );
        })}

        {storyGroups.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-4 text-neutral-400 text-[10.5px] italic font-serif">
            No active stories in circulation. Share yours now!
          </div>
        )}
      </div>

      {/* --- PIPELINE STATUS TRANSMISSION QUEUE DRAG-TRAY --- */}
      <AnimatePresence>
        {isQueueExpanded && uploadQueue.length > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-4 right-4 z-50 bg-[#FAF9F6] dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 shadow-2xl p-4 w-80 rounded-none text-zinc-900 dark:text-zinc-100"
          >
            <div className="flex items-center justify-between border-b border-black/10 dark:border-zinc-800 pb-2 mb-3">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                <h4 className="text-[10px] font-black uppercase tracking-widest font-mono">Transmission Queue</h4>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setUploadQueue([])}
                  className="text-[8px] font-mono uppercase bg-neutral-200 dark:bg-zinc-900 px-1 py-0.5 text-zinc-500 hover:text-red-500"
                  title="Clear Queue History"
                >
                  Clear History
                </button>
                <button onClick={() => setIsQueueExpanded(false)}>
                  <X className="w-3.5 h-3.5 hover:text-red-500" />
                </button>
              </div>
            </div>

            <div className="space-y-3.5 max-h-60 overflow-y-auto scrollbar-none">
              {uploadQueue.map(task => (
                <div key={task.id} className="text-[11px] border-b border-black/5 dark:border-zinc-900 pb-2.5 last:border-0">
                  <div className="flex items-center justify-between mb-1.5 font-mono text-[9px] font-bold">
                    <span className="truncate max-w-[120px] text-zinc-600 dark:text-zinc-400">{task.name}</span>
                    <span className={`uppercase font-black ${
                      task.status === 'completed' ? 'text-green-600' :
                      task.status === 'compressing' ? 'text-blue-500 animate-pulse' :
                      task.status === 'uploading' ? 'text-amber-500' :
                      task.status === 'failed' ? 'text-red-500' : 'text-zinc-500'
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  {/* Progress Slider Bar */}
                  <div className="h-1 w-full bg-neutral-200 dark:bg-zinc-900 overflow-hidden mb-2">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'failed' ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] opacity-60 font-mono">
                      {task.mediaType.toUpperCase()} Status Slot
                    </span>
                    
                    <div className="flex items-center space-x-1.5">
                      {task.status === 'uploading' && (
                        <button 
                          onClick={() => pauseTask(task.id)}
                          className="p-1 border border-zinc-300 dark:border-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-900"
                          title="Pause"
                        >
                          <Pause className="w-2.5 h-2.5 text-zinc-500" />
                        </button>
                      )}
                      {task.status === 'paused' && (
                        <button 
                          onClick={() => resumeTask(task.id)}
                          className="p-1 border border-zinc-300 dark:border-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-900"
                          title="Resume"
                        >
                          <Play className="w-2.5 h-2.5 text-green-600" />
                        </button>
                      )}
                      {(task.status === 'failed' || task.status === 'paused') && (
                        <button 
                          onClick={() => resumeTask(task.id)}
                          className="p-1 border border-zinc-300 dark:border-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-900"
                          title="Retry Transmission"
                        >
                          <RotateCcw className="w-2.5 h-2.5 text-blue-500" />
                        </button>
                      )}
                      {task.status !== 'completed' && (
                        <button 
                          onClick={() => cancelTask(task.id)}
                          className="p-1 border border-zinc-300 dark:border-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-900"
                          title="Cancel/Delete"
                        >
                          <X className="w-2.5 h-2.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {task.error && (
                    <div className="mt-1 font-mono text-[8px] text-red-500 leading-none">
                      Error: {task.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- EXTENSIVE DYNAMIC BULK STORY CREATOR MODAL --- */}
      <AnimatePresence>
        {isCreateOpen && (
          <div data-overlay="true" className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#FAF9F6] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-2 border-black dark:border-zinc-800 p-6 max-w-4xl w-full h-[85vh] rounded-none shadow-2xl flex flex-col justify-between"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-black/10 dark:border-zinc-900 pb-3 mb-4 shrink-0">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  <h3 className="font-serif italic text-lg sm:text-xl font-bold">Status Bulk Creator Studio</h3>
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-mono px-2 py-0.5 border border-amber-300 font-black">
                    {storyBatch.length} {storyBatch.length === 1 ? 'SLIDE' : 'SLIDES'}
                  </span>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Two-Column Workspace Core */}
              <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden">
                
                {/* Left Side: Batch list/navigator & adding controls */}
                <div className="w-full md:w-1/4 border-r-0 md:border-r border-black/10 dark:border-zinc-900 pr-0 md:pr-4 flex flex-col justify-between overflow-y-auto scrollbar-none h-1/3 md:h-full shrink-0">
                  <div className="space-y-2 pb-4">
                    <span className="block text-[8.5px] uppercase tracking-widest font-black text-neutral-500 font-mono mb-2">Slide Stack</span>
                    
                    {storyBatch.map((slide, idx) => (
                      <div 
                        key={slide.id}
                        onClick={() => {
                          playGlitchClickSound();
                          setActiveBatchIdx(idx);
                        }}
                        className={`p-2 flex items-center space-x-2 border cursor-pointer relative group transition-all duration-200 ${
                          activeBatchIdx === idx 
                            ? 'border-black dark:border-white bg-black/5 dark:bg-white/5 font-black scale-[1.02]' 
                            : 'border-black/10 dark:border-zinc-800 hover:border-black/30 bg-white dark:bg-zinc-900/50'
                        }`}
                      >
                        {/* Miniature Preview Indicator */}
                        <div className="w-9 h-12 bg-neutral-100 dark:bg-zinc-800 shrink-0 border border-neutral-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                          {slide.mediaType === 'image' && slide.dataUrl ? (
                            <img src={slide.dataUrl} className="w-full h-full object-cover" />
                          ) : slide.mediaType === 'video' ? (
                            <Film className="w-4 h-4 text-zinc-500" />
                          ) : slide.mediaType === 'audio' ? (
                            <Mic className="w-4 h-4 text-blue-500" />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${GRADIENT_PRESETS.find(g => g.key === slide.gradientPreset)?.class || GRADIENT_PRESETS[0].class}`} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 text-[10px]">
                          <p className="truncate font-mono">
                            {idx + 1}. {slide.mediaType.toUpperCase()} BLOCK
                          </p>
                          <p className="truncate text-[8.5px] text-zinc-500 font-sans italic">
                            {slide.content || '(no text context)'}
                          </p>
                        </div>

                        {/* Remove slider slide button */}
                        {storyBatch.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSlideFromBatch(idx);
                            }}
                            className="absolute right-1 top-1 bg-neutral-200 dark:bg-zinc-800 text-neutral-500 hover:text-red-500 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete frame"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Attachment triggers */}
                  <div className="space-y-2 pt-2 border-t border-black/5 dark:border-zinc-900">
                    <button
                      onClick={addTextSlide}
                      className="w-full py-2 border border-black dark:border-zinc-800 text-xs font-mono font-bold uppercase tracking-wider hover:bg-black/5 dark:hover:bg-zinc-900 flex items-center justify-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Text Slide</span>
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 border border-dashed border-amber-500 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold uppercase tracking-wider hover:bg-amber-500/10 flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Bulk Add Media</span>
                    </button>
                  </div>
                </div>

                {/* Right Side: Configuration editor for active slide */}
                <div className="flex-1 overflow-y-auto scrollbar-none pr-1 space-y-4 font-sans text-xs">
                  {activeBatchSlide ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">
                      
                      {/* Sub-Col 1: Active frame preview & general context */}
                      <div className="space-y-4">
                        <span className="block text-[8.5px] uppercase tracking-widest font-black text-neutral-500 font-mono">Frame Preview</span>
                        
                        <div className="border border-black/10 dark:border-zinc-900 w-full aspect-[9/14] max-h-[350px] relative flex items-center justify-center overflow-hidden bg-[#0E0E10] shadow-md">
                          {activeBatchSlide.mediaType === 'image' && activeBatchSlide.dataUrl ? (
                            <>
                              <img src={activeBatchSlide.dataUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-md scale-110" />
                              <img src={activeBatchSlide.dataUrl} className="relative z-10 max-w-full max-h-full object-contain" />
                            </>
                          ) : activeBatchSlide.mediaType === 'video' && activeBatchSlide.dataUrl ? (
                            <div className="text-center p-4">
                              <Film className="w-12 h-12 text-amber-500 mx-auto mb-2 animate-pulse" />
                              <span className="text-[10px] font-mono text-zinc-500">Video Payload Attached</span>
                            </div>
                          ) : activeBatchSlide.mediaType === 'audio' && activeBatchSlide.dataUrl ? (
                            <div className="text-center p-4">
                              <Mic className="w-12 h-12 text-blue-500 mx-auto mb-2 animate-pulse" />
                              <span className="text-[10px] font-mono text-zinc-500">Voice Note Attached</span>
                            </div>
                          ) : (
                            // Text Story Frame Preview with background style classes
                            <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT_PRESETS.find(g => g.key === activeBatchSlide.gradientPreset)?.class || GRADIENT_PRESETS[0].class} flex flex-col justify-center items-center px-6 text-center`}>
                              <p className="font-serif italic text-sm leading-relaxed font-semibold">
                                {activeBatchSlide.content || '"Craft your text status block"'}
                              </p>
                            </div>
                          )}

                          {/* Float stickers overlays */}
                          {activeBatchSlide.stickers.length > 0 && (
                            <div className="absolute top-1/4 inset-x-2 flex flex-wrap justify-center gap-1.5 pointer-events-none">
                              {activeBatchSlide.stickers.map((stk, i) => (
                                <span key={i} className="text-2xl drop-shadow animate-bounce" style={{ animationDelay: `${i*100}ms` }}>{stk}</span>
                              ))}
                            </div>
                          )}

                          {/* Float Location widget overlay */}
                          {activeBatchSlide.location.trim() && (
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs border border-white/10 px-2 py-0.5 rounded flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-red-400" />
                              <span className="text-[9px] font-mono text-white tracking-tight">{activeBatchSlide.location}</span>
                            </div>
                          )}

                          {/* Float music track looping widget */}
                          {activeBatchSlide.musicTitle.trim() && (
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs border border-white/10 px-2 py-0.5 rounded flex items-center space-x-1 max-w-[120px] truncate">
                              <Music className="w-3 h-3 text-amber-400 animate-spin" />
                              <span className="text-[9px] font-mono text-white truncate">{activeBatchSlide.musicTitle}</span>
                            </div>
                          )}
                        </div>

                        {/* General Narrative caption */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1.5 font-mono">Story Caption / Context</label>
                          <textarea
                            value={activeBatchSlide.content}
                            onChange={(e) => updateActiveSlide({ content: e.target.value })}
                            rows={3}
                            maxLength={400}
                            placeholder="Add core caption text or thoughts..."
                            className="w-full text-xs p-2.5 bg-white dark:bg-zinc-900 border border-black/15 dark:border-zinc-800 focus:outline-none focus:border-black rounded-none"
                          />
                        </div>

                        {/* If text-only block, show atmospheric theme gradients */}
                        {activeBatchSlide.mediaType === 'none' && (
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1.5 font-mono">Atmospheric Background Gradient</label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {GRADIENT_PRESETS.map(preset => (
                                <button
                                  key={preset.key}
                                  type="button"
                                  onClick={() => updateActiveSlide({ gradientPreset: preset.key })}
                                  className={`h-7 rounded-sm bg-gradient-to-br ${preset.class} flex items-center justify-center border transition-all ${
                                    activeBatchSlide.gradientPreset === preset.key 
                                      ? 'border-black dark:border-white scale-105 shadow font-black' 
                                      : 'border-transparent hover:scale-102'
                                  }`}
                                  title={preset.name}
                                >
                                  <span className="text-[7.5px] uppercase font-mono tracking-widest">{preset.name.slice(0, 4)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Sub-Col 2: Interactive components configuration (Polls, Links, Stickers, Music, Tags) */}
                      <div className="space-y-4">
                        <span className="block text-[8.5px] uppercase tracking-widest font-black text-neutral-500 font-mono">Interactive Enrichment Widgets</span>
                        
                        {/* Real-time Poll constructor */}
                        <div className="border border-black/10 dark:border-zinc-900 p-3 bg-white dark:bg-zinc-900/40">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[9.5px] font-black uppercase text-amber-500">Add Real-time Poll</span>
                            <span className="text-[8px] opacity-60">Interactive Voting Card</span>
                          </div>
                          
                          <input
                            type="text"
                            placeholder="Ask a community question..."
                            value={activeBatchSlide.pollQuestion}
                            onChange={(e) => updateActiveSlide({ pollQuestion: e.target.value })}
                            className="w-full text-xs p-2 mb-2 bg-white dark:bg-zinc-900 border border-black/10 dark:border-zinc-800 focus:outline-none rounded-none"
                          />

                          {activeBatchSlide.pollQuestion.trim() !== '' && (
                            <div className="grid grid-cols-2 gap-2">
                              {activeBatchSlide.pollOptions.map((opt, i) => (
                                <input
                                  key={i}
                                  type="text"
                                  placeholder={`Option ${i+1}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const updatedOptions = [...activeBatchSlide.pollOptions];
                                    updatedOptions[i] = e.target.value;
                                    updateActiveSlide({ pollOptions: updatedOptions });
                                  }}
                                  className="text-[10px] p-1.5 bg-white dark:bg-zinc-900 border border-black/10 dark:border-zinc-800 focus:outline-none rounded-none"
                                />
                              ))}
                              {activeBatchSlide.pollOptions.length < 4 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateActiveSlide({ pollOptions: [...activeBatchSlide.pollOptions, ''] });
                                  }}
                                  className="col-span-2 text-[9px] font-mono text-zinc-500 hover:text-black hover:underline"
                                >
                                  + Add Option Slot
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Swipe up safe web Link */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1 font-mono">Attach Safe Website Link</label>
                          <div className="relative">
                            <Link2 className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                            <input
                              type="url"
                              placeholder="https://flick.chat/campus-alert"
                              value={activeBatchSlide.link}
                              onChange={(e) => updateActiveSlide({ link: e.target.value })}
                              className="w-full text-xs pl-8 pr-2.5 py-2 bg-white dark:bg-zinc-900 border border-black/15 dark:border-zinc-800 focus:outline-none focus:border-black rounded-none"
                            />
                          </div>
                        </div>

                        {/* Audio / Music Track capsule details */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1 font-mono">Music / Song Track</label>
                            <input
                              type="text"
                              placeholder="Song Title"
                              value={activeBatchSlide.musicTitle}
                              onChange={(e) => updateActiveSlide({ musicTitle: e.target.value })}
                              className="w-full text-xs p-2 bg-white dark:bg-zinc-900 border border-black/15 dark:border-zinc-800 focus:outline-none rounded-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1 font-mono">Music Artist</label>
                            <input
                              type="text"
                              placeholder="Artist Name"
                              value={activeBatchSlide.musicArtist}
                              onChange={(e) => updateActiveSlide({ musicArtist: e.target.value })}
                              className="w-full text-xs p-2 bg-white dark:bg-zinc-900 border border-black/15 dark:border-zinc-800 focus:outline-none rounded-none"
                            />
                          </div>
                        </div>

                        {/* Location Tag */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1 font-mono">Location tag</label>
                          <div className="relative">
                            <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                            <input
                              type="text"
                              placeholder="e.g. SF Campus Library"
                              value={activeBatchSlide.location}
                              onChange={(e) => updateActiveSlide({ location: e.target.value })}
                              className="w-full text-xs pl-8 pr-2.5 py-2 bg-white dark:bg-zinc-900 border border-black/15 dark:border-zinc-800 focus:outline-none focus:border-black rounded-none"
                            />
                          </div>
                        </div>

                        {/* Custom Sticker Stamp overlay selector */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1 font-mono">Stickers Sticker Stamps</label>
                          <div className="flex flex-wrap gap-1.5 p-2 border border-black/10 bg-white dark:bg-zinc-900">
                            {PRESET_STICKERS.map(sticker => {
                              const active = activeBatchSlide.stickers.includes(sticker);
                              return (
                                <button
                                  key={sticker}
                                  type="button"
                                  onClick={() => {
                                    playGlitchClickSound();
                                    const updated = active 
                                      ? activeBatchSlide.stickers.filter(s => s !== sticker)
                                      : [...activeBatchSlide.stickers, sticker];
                                    updateActiveSlide({ stickers: updated });
                                  }}
                                  className={`text-lg p-1 hover:scale-110 active:scale-95 transition-transform ${active ? 'bg-amber-100 dark:bg-amber-950 border border-amber-400 rounded' : 'opacity-60 hover:opacity-100'}`}
                                >
                                  {sticker}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Mentions & Hashtags input parsing */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1 font-mono">Mentions (@peer)</label>
                            <input
                              type="text"
                              placeholder="@bob @alice"
                              value={activeBatchSlide.mentions}
                              onChange={(e) => updateActiveSlide({ mentions: e.target.value })}
                              className="w-full text-xs p-2 bg-white dark:bg-zinc-900 border border-black/15 dark:border-zinc-800 focus:outline-none focus:border-black rounded-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest font-black opacity-60 mb-1 font-mono">Hashtags (#tag)</label>
                            <input
                              type="text"
                              placeholder="#vibes #alert"
                              value={activeBatchSlide.hashtags}
                              onChange={(e) => updateActiveSlide({ hashtags: e.target.value })}
                              className="w-full text-xs p-2 bg-white dark:bg-zinc-900 border border-black/15 dark:border-zinc-800 focus:outline-none focus:border-black rounded-none"
                            />
                          </div>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-400 italic">
                      Select or add a story frame slide above to begin editing.
                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Actions row */}
              <div className="flex justify-end gap-3 pt-4 border-t border-black/10 dark:border-zinc-900 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="border border-black/15 dark:border-zinc-800 px-5 py-2 hover:bg-black/5 dark:hover:bg-zinc-900 text-xs transition uppercase font-bold tracking-wider rounded-none cursor-pointer"
                >
                  Close Studio
                </button>
                <button
                  type="button"
                  onClick={handleBroadcastBatch}
                  className="border border-black dark:border-white bg-black dark:bg-white text-white dark:text-black px-8 py-2 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs transition uppercase font-bold tracking-widest rounded-none flex items-center gap-1.5 cursor-pointer shadow-lg animate-pulse hover:animate-none"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Bulk Batch ({storyBatch.length})</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleBulkFileChange}
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
      />

      {/* --- PREMIUM REAL-TIME IMMERSIVE STORIES PLAYER VIEW --- */}
      <AnimatePresence>
        {activeStory && activeGroup && (
          <div data-overlay="true" className="fixed inset-0 bg-black/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            
            <div className="absolute inset-0" onClick={() => setActiveGroupIdx(null)} />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm sm:max-w-md h-[85vh] max-h-[780px] bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col justify-between z-10 rounded-none text-white"
            >
              
              {/* TOP FLOATING OVERLAYS */}
              <div className="p-4 bg-gradient-to-b from-black/95 to-transparent z-20 space-y-3 shrink-0">
                
                {/* Horizontal Progress bar slider tickers */}
                <div className="flex gap-1">
                  {activeGroup.stories.map((s, idx) => (
                    <div key={s.id} className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-amber-400 rounded-full transition-all duration-300 ${
                          idx < activeStoryIdx 
                            ? 'w-full' 
                            : idx === activeStoryIdx 
                              ? 'w-full origin-left' 
                              : 'w-0'
                        }`}
                        style={idx === activeStoryIdx && !isPlayerPaused ? {
                          animation: 'storyTimer 7s linear forwards'
                        } : {}}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={activeGroup.authorPhoto}
                      alt={activeGroup.authorName}
                      className="w-9 h-9 rounded-full object-cover border border-zinc-700 bg-zinc-900"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-none flex items-center gap-1.5">
                        <span>{activeGroup.authorName}</span>
                        {/* Verified system stamp badge */}
                        {activeGroup.stories.length > 3 && (
                          <CheckCircle className="w-3.5 h-3.5 text-blue-400 fill-blue-400 shrink-0" />
                        )}
                      </h4>
                      <span className="text-[9px] font-mono text-zinc-400 flex items-center gap-1 mt-1 font-bold">
                        <Clock className="w-2.5 h-2.5" />
                        {activeStory.createdAt ? (activeStory.createdAt.toDate ? activeStory.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Pause control toggle */}
                    <button
                      onClick={() => setIsPlayerPaused(!isPlayerPaused)}
                      className="p-1 hover:bg-white/10 rounded border border-zinc-800 text-zinc-400 hover:text-white"
                      title={isPlayerPaused ? 'Resume Playback' : 'Pause Playback'}
                    >
                      {isPlayerPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                    
                    <button
                      onClick={() => setActiveGroupIdx(null)}
                      className="p-1 px-2.5 border border-zinc-800 text-zinc-400 hover:text-white hover:border-white transition cursor-pointer text-[10px] uppercase font-mono"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              {/* CORE MEDIA INTERACTIVE DISPLAY FRAME */}
              <div className="flex-1 w-full relative flex items-center justify-center p-6 bg-[#0B0B0C] overflow-hidden">
                
                {activeStory.mediaType === 'image' && activeStory.imageUrl ? (
                  <>
                    <img
                      src={activeStory.imageUrl}
                      alt="Story Frame background blur"
                      className="absolute inset-0 w-full h-full object-cover opacity-40 blur-lg scale-110"
                    />
                    <img
                      src={activeStory.imageUrl}
                      alt="Story Frame backdrop"
                      className="relative z-10 max-w-full max-h-full object-contain mx-auto"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/40 z-10 pointer-events-none" />
                    
                    {activeStory.content && (
                      <div className="absolute bottom-16 left-4 right-4 text-center z-20 bg-black/70 backdrop-blur-md border border-white/10 p-4 shadow-xl">
                        <p className="text-white text-sm font-serif italic">
                          "{activeStory.content}"
                        </p>
                      </div>
                    )}
                  </>
                ) : activeStory.mediaType === 'video' && activeStory.videoUrl ? (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
                    <video 
                      ref={playerVideoRef}
                      src={activeStory.videoUrl} 
                      autoPlay 
                      playsInline 
                      muted={isPlayerMuted}
                      className="w-full h-full object-contain"
                    />
                    {activeStory.content && (
                      <div className="absolute bottom-16 left-4 right-4 text-center z-10 bg-black/60 p-3">
                        <p className="text-white text-xs font-sans">
                          "{activeStory.content}"
                        </p>
                      </div>
                    )}
                  </div>
                ) : activeStory.mediaType === 'audio' && activeStory.audioUrl ? (
                  <div className="absolute inset-0 w-full h-full flex flex-col justify-center items-center p-8 bg-gradient-to-br from-indigo-950 via-zinc-950 to-purple-950 text-white text-center">
                    <Mic className="w-12 h-12 text-blue-400 mb-4 animate-pulse" />
                    <audio src={activeStory.audioUrl} autoPlay controls className="w-full mb-4" />
                    <p className="font-serif italic text-sm">
                      "{activeStory.content || "Voice message chronicle"}"
                    </p>
                  </div>
                ) : (
                  // Text-only Atmosphere preset styling
                  <div className={`absolute inset-0 bg-gradient-to-br ${
                    GRADIENT_PRESETS.find(g => g.key === activeStory.gradientPreset)?.class || GRADIENT_PRESETS[1].class
                  } flex flex-col justify-center items-center px-8 text-center text-white`}>
                    <span className="text-[10px] font-mono border border-white/10 px-2 py-0.5 uppercase tracking-widest text-amber-400 rounded mb-4 bg-white/5 opacity-50">Secure Thought Block</span>
                    <p className="font-serif italic text-base sm:text-lg leading-relaxed font-semibold">
                      "{activeStory.content}"
                    </p>
                  </div>
                )}

                {/* --- FLOATING ENRICHMENT DECORATIVE INTERACTIVE WIDGETS --- */}

                {/* 1. Location badge overlay */}
                {activeStory.location && (
                  <div className="absolute top-4 left-4 bg-black/65 backdrop-blur-xs border border-white/10 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow z-10">
                    <MapPin className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] font-mono text-white tracking-tight font-black uppercase">{activeStory.location}</span>
                  </div>
                )}

                {/* 2. Music marquee track loop overlay */}
                {activeStory.musicTitle && (
                  <div className="absolute top-4 right-4 bg-black/65 backdrop-blur-xs border border-white/10 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow max-w-[150px] truncate z-10">
                    <Music className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                    <span className="text-[10px] font-mono text-white truncate font-bold">
                      {activeStory.musicTitle} • {activeStory.musicArtist || 'Artist'}
                    </span>
                  </div>
                )}

                {/* 3. Sticker Stamps floating group */}
                {activeStory.stickers && activeStory.stickers.length > 0 && (
                  <div className="absolute top-1/4 inset-x-4 flex flex-wrap justify-center gap-2 pointer-events-none z-10">
                    {activeStory.stickers.map((stk, i) => (
                      <span key={i} className="text-3xl drop-shadow animate-bounce" style={{ animationDelay: `${i * 150}ms` }}>{stk}</span>
                    ))}
                  </div>
                )}

                {/* 4. Mentions & Hashtags highlighted capsules */}
                <div className="absolute top-1/3 inset-x-4 flex flex-wrap justify-center gap-1.5 pointer-events-none z-10">
                  {activeStory.mentions?.map((men, i) => (
                    <span key={i} className="bg-blue-500/80 backdrop-blur-xs border border-blue-400/30 px-2 py-0.5 rounded text-[9.5px] font-mono text-white font-black tracking-tight">{men}</span>
                  ))}
                  {activeStory.hashtags?.map((tag, i) => (
                    <span key={i} className="bg-amber-500/80 backdrop-blur-xs border border-amber-400/30 px-2 py-0.5 rounded text-[9.5px] font-mono text-white font-black tracking-tight">{tag}</span>
                  ))}
                </div>

                {/* 5. Real-time Interactive Poll Card */}
                {activeStory.pollQuestion && (
                  <div className="absolute bottom-1/4 left-6 right-6 bg-black/75 backdrop-blur-md border border-white/10 p-4 shadow-2xl z-10 text-center font-sans">
                    <h5 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-3">{activeStory.pollQuestion}</h5>
                    
                    <div className="space-y-2">
                      {(() => {
                        const votes = activeStory.pollVotes || {};
                        const userVote = profile ? votes[profile.uid] : null;
                        const totalVotes = Object.keys(votes).length;
                        
                        return (activeStory.pollOptions || []).map(opt => {
                          const optionVotesCount = Object.values(votes).filter(v => v === opt.id).length;
                          const percent = totalVotes > 0 ? Math.round((optionVotesCount / totalVotes) * 100) : 0;
                          const isMyVote = userVote === opt.id;

                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleVotePoll(activeStory.id, opt.id)}
                              className={`w-full relative h-9 border text-xs flex items-center justify-between px-3 overflow-hidden transition-all duration-200 ${
                                isMyVote 
                                  ? 'border-amber-400 bg-amber-500/10 font-bold' 
                                  : 'border-white/10 hover:border-white/30 bg-white/5'
                              }`}
                            >
                              {/* Background progress fill width */}
                              <div 
                                className="absolute left-0 top-0 bottom-0 bg-white/10 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                              
                              <span className="relative z-10 text-white flex items-center gap-1.5">
                                {opt.text}
                                {isMyVote && <CheckCircle className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                              </span>
                              
                              <span className="relative z-10 font-mono text-[10px] text-zinc-400">
                                {percent}% ({optionVotesCount})
                              </span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* Manual tap directional hit-zones */}
                <div className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize" onClick={handlePrevStory} />
                <div className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize" onClick={handleNextStory} />

                {/* Precision arrows */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevStory();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 border border-zinc-800 p-1.5 text-white transition cursor-pointer z-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextStory();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 border border-zinc-800 p-1.5 text-white transition cursor-pointer z-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* BOTTOM INTERACTIVE DECK, VIEWER LOG, AND E2EE REPLIER */}
              <div className="p-4 bg-gradient-to-t from-black via-black to-transparent z-20 flex flex-col space-y-3 border-t border-zinc-900 shrink-0">
                
                {/* Aggregate Reactions bubble capsules */}
                {groupedReactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center pb-1">
                    {groupedReactions.map(gr => (
                      <span key={gr.emoji} className="bg-white/10 hover:bg-white/20 px-2 py-0.5 text-xs text-white rounded-full font-mono flex items-center space-x-1 border border-white/5 shadow">
                        <span>{gr.emoji}</span>
                        <span className="text-[9px] opacity-75 font-bold">{gr.users.length}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 text-amber-400 shrink-0">
                    <Eye className="w-4 h-4 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold">
                      {activeStory.viewsCount || 0} realviews
                    </span>
                  </div>

                  {/* Viewer node details (if author is me) */}
                  {activeStory.authorId === profile?.uid && (
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded max-w-[50%] overflow-x-auto scrollbar-none">
                      <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-wider mr-1">By:</span>
                      {(() => {
                        const viewers = (activeStory.viewedBy || []).map(uid => usersMap[uid]).filter(Boolean);
                        if (viewers.length === 0) {
                          return <span className="text-[8px] text-zinc-500 font-mono">None</span>;
                        }
                        return viewers.map(v => (
                          <div key={v.uid} className="flex items-center gap-0.5 bg-white/10 px-1 py-0.5 rounded text-[8.5px] shrink-0" title={v.displayName || v.email}>
                            {v.photoURL ? (
                              <img src={v.photoURL} referrerPolicy="no-referrer" alt={v.displayName} className="w-2.5 h-2.5 rounded-full object-cover" />
                            ) : (
                              <div className="w-2.5 h-2.5 rounded-full bg-neutral-600 flex items-center justify-center text-[6px] font-bold text-white">
                                {v.displayName?.slice(0, 1).toUpperCase() || '?'}
                              </div>
                            )}
                            <span className="text-white font-mono truncate max-w-[30px]">{v.displayName?.split(' ')[0] || v.email?.split('@')[0]}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {/* Quick Reaction picker */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowReactionPicker(!showReactionPicker)}
                      className="flex items-center space-x-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 text-white text-[10.5px] uppercase font-bold tracking-wider rounded font-mono transition cursor-pointer border border-white/10"
                    >
                      <Smile className="w-3.5 h-3.5" />
                      <span>React</span>
                    </button>

                    {showReactionPicker && (
                      <div className="absolute bottom-10 right-0 bg-neutral-900 border border-zinc-800 p-2 flex space-x-1.5 shadow-2xl z-40 rounded">
                        {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🚀'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(emoji)}
                            className="hover:scale-125 transition duration-150 p-1 text-base cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* E2EE Chat replier (swipe up message became direct chat context) */}
                {activeStory.authorId !== profile?.uid && (
                  <div className="flex items-center gap-2 border-t border-zinc-800 pt-3">
                    <input
                      type="text"
                      placeholder="Encrypted reply to author..."
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      disabled={isSendingReply}
                      className="flex-1 bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white rounded-none"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={isSendingReply || !replyInput.trim()}
                      className="bg-white text-black p-1.5 hover:bg-neutral-200 disabled:opacity-40 transition-colors"
                      title="Send encrypted reply"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest text-center mt-1">
                  Consolidated Story Group Node: {activeStoryIdx + 1} of {activeGroup.stories.length}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StoryDashboardOverlay
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        stories={stories}
        currentUserId={profile?.uid || ''}
      />

      <style>{`
        @keyframes storyTimer {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
