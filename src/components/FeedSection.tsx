import React, { useEffect, useState, useRef } from 'react';
import LazyImage from './LazyImage';
import { useAuth } from '../contexts/AuthContext';
import { useOperations } from '../contexts/OperationContext';
import { motion, AnimatePresence } from 'motion/react';
import { Post, DirectChat, UserProfile, Story } from '../types';
import ChatSection from './ChatSection';
import VoiceFirstHomeScreen from './VoiceFirstHomeScreen';
import { NewsSection } from './news/NewsSection';
import LiveSportsHub from './LiveSportsHub';
import { triggerVibration, triggerEventVibration } from '../lib/haptics';
import WorkspaceHub from "./WorkspaceHub";
import { triggerViewProfile } from '../lib/profileTrigger';
import { refreshScrollTrigger } from '../lib/gsapAnimations';
import {
  createPost,
  deletePost,
  updatePost,
  toggleLikePost,
  subscribeToFeed,
  createStory,
  subscribeToStories,
  deleteStory,
  viewStory,
  createGroupChat,
  subscribeToUsers,
  createComment,
  subscribeToComments
} from '../lib/services';
import {
  Briefcase, Heart,
  Trash2,
  Edit2,
  Send,
  Image as ImageIcon,
  Check,
  X,
  Smile,
  Mic,
  Music,
  Paperclip,
  ZoomIn,
  Volume2,
  VolumeX,
  Play,
  Pause,
  MessageSquare,
  Plus,
  Search,
  Bell,
  School,
  Sparkles,
  Users,
  Compass,
  TrendingUp,
  BookOpen,
  User,
  Zap,
  HelpCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Shield,
  ThumbsUp,
  Upload,
  Tv,
  Share2,
  Bookmark,
  Calendar,
  SendHorizontal,
  Video,
  Radio,
  GripVertical,
  Layers,
  Move
} from 'lucide-react';
import { compressImage } from '../lib/mediaHelper';
import { playLikeSound, playGlitchClickSound, playReceiveMessageSound } from '../lib/sounds';
import NodeClusterView from './NodeClusterView';
import { showBrutalistToast } from '../lib/toast';
import { sanitizeErrorMessage } from '../lib/errorSanitizer';
import ThreeSlidesPhysics from './ThreeSlidesPhysics';
import BentoProfile from './BentoProfile';
import { useThemeListener } from '../contexts/ThemeContext';

export interface FeedSectionProps {
  activeTab?: 'home' | 'match' | 'chat' | 'news' | 'profile' | 'workspace';
  setActiveTab?: (tab: 'home' | 'match' | 'chat' | 'news' | 'profile' | 'workspace') => void;
  unreadE2EECount?: number;
  deepLinkedPeerId?: string | null;
  onClearDeepLink?: () => void;
  deepLinkedGroupId?: string | null;
  onClearDeepLinkedGroup?: () => void;
  deepLinkedNewsId?: string | null;
  onClearDeepLinkedNews?: () => void;
}

export default function FeedSection({
  activeTab: controlledActiveTab,
  setActiveTab: controlledSetActiveTab,
  unreadE2EECount = 0,
  deepLinkedPeerId = null,
  onClearDeepLink = () => {},
  deepLinkedGroupId = null,
  onClearDeepLinkedGroup = () => {},
  deepLinkedNewsId = null,
  onClearDeepLinkedNews = () => {}
}: FeedSectionProps = {}) {
  const { profile } = useAuth();
  const operations = useOperations();
  useThemeListener();
  
  // Custom states
  const [localActiveTab, localSetActiveTab] = useState<'home' | 'match' | 'chat' | 'news' | 'profile' | 'workspace'>('home');
  const [currentCover, setCurrentCover] = useState(() => {
    return localStorage.getItem(`faraflick_profile_cover_${profile?.uid}`) || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1200';
  });
  const [showCoverSelector, setShowCoverSelector] = useState(false);
  const activeTab = controlledActiveTab || localActiveTab;
  const setActiveTab = controlledSetActiveTab || localSetActiveTab;
  const [homeSubView, setHomeSubView] = useState<'voice' | 'feed' | 'network' | 'live'>('voice');
  const [selectedCampus, setSelectedCampus] = useState<string>(() => {
    return localStorage.getItem('flick_selected_campus') || 'Global Feed';
  });

  // State to support collapsible desktop navigation rail/sidebar
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return localStorage.getItem('flick_sidebar_expanded') !== 'false';
  });

  // Sound and action states for morphic sidebar
  const [soundMuted, setSoundMuted] = useState(() => {
    return localStorage.getItem('flick_sound_enabled') === 'false';
  });

  const handleToggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    localStorage.setItem('flick_sound_enabled', next ? 'false' : 'true');
    // Call play audio locally
    if (!next) {
      playGlitchClickSound();
    }
    triggerVibration('light');
    showBrutalistToast('SPECTRUM LOG', next ? 'AUDIO TRANSMISSION MUTED' : 'AUDIO TRANSMISSION ONLINE', 'info');
  };

  const handleQuickTacticalDownload = () => {
    playGlitchClickSound();
    triggerVibration('heavy');
    showBrutalistToast('DIAGNOSTICS', 'DIAGNOSTICS DUMP COMPLETE: 0x7FFF PACKETS STABLE', 'success');
  };
  
  // Subscribed States
  const [firebasePosts, setFirebasePosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [groupChats, setGroupChats] = useState<DirectChat[]>([]);
  
  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  // Stories state
  const [activeStoryGroupId, setActiveStoryGroupId] = useState<string | null>(null);
  const [activeStoryIndexInGroup, setActiveStoryIndexInGroup] = useState<number>(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const storyStartTimeRef = useRef<number>(0);
  const storyHoldTimeoutRef = useRef<any>(null);
  const storyIsHoldRef = useRef<boolean>(false);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [isFeedPendingLong, setIsFeedPendingLong] = useState(false);
  const [isStoriesLoading, setIsStoriesLoading] = useState(true);

  // Show explicit status when Firestore data retrieval takes > 2 seconds
  useEffect(() => {
    let timer: any = null;
    if (isFeedLoading) {
      timer = setTimeout(() => {
        setIsFeedPendingLong(true);
      }, 2000);
    } else {
      setIsFeedPendingLong(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isFeedLoading]);
  const [storyContent, setStoryContent] = useState('');
  const [storyImg, setStoryImg] = useState('');
  const [storyVideo, setStoryVideo] = useState('');
  const [storyAudio, setStoryAudio] = useState('');
  const [storyType, setStoryType] = useState<'image' | 'video' | 'audio' | 'text'>('text');
  const [storyGradientPreset, setStoryGradientPreset] = useState('sunset');
  const [storyMusicTitle, setStoryMusicTitle] = useState('');
  const [storyMusicArtist, setStoryMusicArtist] = useState('');
  const [storyPollQ, setStoryPollQ] = useState('');
  const [storyCountdown, setStoryCountdown] = useState('');
  const [storyViewedList, setStoryViewedList] = useState<Record<string, boolean>>({});

  // Match State (Omegle student matcher)
  const [isMatching, setIsMatching] = useState(false);
  const [isMatchedActive, setIsMatchedActive] = useState(false);
  const [matchSchoolFilter, setMatchSchoolFilter] = useState('any');
  const [matchInterestFilter, setMatchInterestFilter] = useState('General Chat');
  const [matchPartner, setMatchPartner] = useState<any | null>(null);
  const [matchMessages, setMatchMessages] = useState<any[]>([]);
  const [matchInput, setMatchInput] = useState('');
  const [matchProgress, setMatchProgress] = useState(0);

  // Group Create / Search state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupType, setNewGroupType] = useState<'school' | 'friends' | 'custom'>('school');
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<'public' | 'private'>('public');
  const [newGroupPass, setNewGroupPass] = useState('');



  // General Post Creator modal
  const [showPostCreator, setShowPostCreator] = useState(false);
  const [postCreatorType, setPostCreatorType] = useState<'social' | 'academic' | 'question' | 'poll' | 'story'>('social');
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState('');
  const [postVideo, setPostVideo] = useState('');
  const [postPollOpts, setPostPollOpts] = useState<string[]>(['Option 1', 'Option 2']);
  const [postAnon, setPostAnon] = useState(false);

  // Drag & Drop Layout customization and Pinned Posts state
  const DEFAULT_FEED_SECTIONS = [
    { id: 'stories', label: 'Ephemeral Stories', icon: '⚡', desc: 'Peer story nodes' },
    { id: 'pinned_items', label: 'Pinned Vault', icon: '📌', desc: 'Bookmarked & pinned posts' },
    { id: 'quick_actions', label: 'Tactical Pills', icon: '✨', desc: 'Match Mate & shortcuts' },
    { id: 'trending_radar', label: 'Campus Radar', icon: '📈', desc: 'Trending intelligence' },
    { id: 'posts_stream', label: 'Feed Stream', icon: '📜', desc: 'Decentralized timeline' }
  ];

  const [feedSectionsOrder, setFeedSectionsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flick_feed_sections_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allIds = ['stories', 'pinned_items', 'quick_actions', 'trending_radar', 'posts_stream'];
          const existing = parsed.filter((id: string) => allIds.includes(id));
          allIds.forEach(id => {
            if (!existing.includes(id)) existing.push(id);
          });
          return existing;
        }
      }
    } catch (e) {}
    return ['stories', 'pinned_items', 'quick_actions', 'trending_radar', 'posts_stream'];
  });

  const [pinnedPostIds, setPinnedPostIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flick_pinned_posts');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [draggedPinnedId, setDraggedPinnedId] = useState<string | null>(null);
  const [dragOverPinnedId, setDragOverPinnedId] = useState<string | null>(null);
  const [isCustomizingFeedLayout, setIsCustomizingFeedLayout] = useState(false);

  const handleReorderSections = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setFeedSectionsOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      localStorage.setItem('flick_feed_sections_order', JSON.stringify(next));
      playGlitchClickSound();
      triggerVibration('medium');
      showBrutalistToast('LAYOUT SAVED ✓', 'Feed section order successfully reorganized!', 'success');
      return next;
    });
  };

  const handleReorderPinnedPosts = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setPinnedPostIds(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      localStorage.setItem('flick_pinned_posts', JSON.stringify(next));
      playGlitchClickSound();
      triggerVibration('light');
      showBrutalistToast('VAULT REORDERED ✓', 'Pinned items sequence updated!', 'success');
      return next;
    });
  };

  const togglePinPost = (postId: string) => {
    setPinnedPostIds(prev => {
      const isPinned = prev.includes(postId);
      const updated = isPinned ? prev.filter(id => id !== postId) : [postId, ...prev];
      localStorage.setItem('flick_pinned_posts', JSON.stringify(updated));
      showBrutalistToast(
        isPinned ? 'UNPINNED' : 'PINNED ✓', 
        isPinned ? 'Post removed from your pinned vault.' : 'Post pinned to your academic vault! Drag & drop to reorder anytime.', 
        isPinned ? 'info' : 'success'
      );
      return updated;
    });
  };

  const resetFeedLayout = () => {
    const def = ['stories', 'pinned_items', 'quick_actions', 'trending_radar', 'posts_stream'];
    setFeedSectionsOrder(def);
    localStorage.setItem('flick_feed_sections_order', JSON.stringify(def));
    playGlitchClickSound();
    triggerVibration('medium');
    showBrutalistToast('LAYOUT RESET ✓', 'Feed layout restored to standard protocol configuration.', 'info');
  };

  // Comments / discussions modal
  const [activeDiscussionPost, setActiveDiscussionPost] = useState<any | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [currentPostComments, setCurrentPostComments] = useState<any[]>([]);

  // Reels specific controls
  const [reelsMuted, setReelsMuted] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [heartBursts, setHeartBursts] = useState<Record<string, { id: string; x: number; y: number }[]>>({});

  // Compose floating radial menu toggle
  const [isRadialOpen, setIsRadialOpen] = useState(false);

  // Photo Magnifier Lightbox
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  // Subscribe to comments dynamically when activeDiscussionPost is set
  useEffect(() => {
    const handlePostEvent = () => setShowPostCreator(true);
    const handleSearchEvent = () => setIsSearchOpen(true);
    window.addEventListener('faraflick-trigger-post', handlePostEvent);
    window.addEventListener('faraflick-trigger-search', handleSearchEvent);
    return () => {
      window.removeEventListener('faraflick-trigger-post', handlePostEvent);
      window.removeEventListener('faraflick-trigger-search', handleSearchEvent);
    };
  }, []);

  useEffect(() => {
    if (!activeDiscussionPost) {
      setCurrentPostComments([]);
      return;
    }
    const unsub = subscribeToComments(activeDiscussionPost.id, (loaded) => {
      setCurrentPostComments(loaded);
    });
    return () => unsub();
  }, [activeDiscussionPost]);

  // Native back-button integration to close FeedSection modals & sheets
  useEffect(() => {
    const handleBackButton = (e: Event) => {
      if (zoomImg) {
        setZoomImg(null);
        e.preventDefault();
        return;
      }
      if (activeDiscussionPost) {
        setActiveDiscussionPost(null);
        e.preventDefault();
        return;
      }
      if (showPostCreator) {
        setShowPostCreator(false);
        e.preventDefault();
        return;
      }
      if (isRadialOpen) {
        setIsRadialOpen(false);
        e.preventDefault();
        return;
      }
    };
    window.addEventListener('faraflick-back-button', handleBackButton);
    return () => {
      window.removeEventListener('faraflick-back-button', handleBackButton);
    };
  }, [zoomImg, activeDiscussionPost, showPostCreator, isRadialOpen]);

  // Sync real-time feeds
  useEffect(() => {
    if (!profile) return;
    const unsubFeed = subscribeToFeed((loaded) => {
      setFirebasePosts(loaded);
      setIsFeedLoading(false);
    }, (err) => {
      console.warn("Failed to sync posts:", err);
      setIsFeedLoading(false);
      showBrutalistToast('SYNC ERROR', 'Failed to synchronize feed packets.', 'error');
    });

    const unsubStories = subscribeToStories((loaded) => {
      setStories(loaded);
      setIsStoriesLoading(false);
      
      // Auto-purge expired stories (older than 24h or invalid/corrupted ones) from the database in real-time
      loaded.forEach(s => {
        if (!s.id.startsWith('st-') && s.authorId !== 'flick-hq') {
          const ageMs = getStoryAgeInMs(s);
          if (ageMs > 24 * 60 * 60 * 1000) {
            console.log("Auto-purging expired/invalid story:", s.id, "age hours:", ageMs / 3600000);
            deleteStory(s.id).catch(err => console.warn("Failed to auto-purge story:", s.id, err));
          }
        }
      });
    }, (err) => {
      console.warn("Stories sync warning:", err);
      setIsStoriesLoading(false);
    });

    const unsubUsers = subscribeToUsers((loaded) => {
      setRegisteredUsers(loaded);
    });

    setGroupChats([]);

    return () => {
      unsubFeed();
      unsubStories();
      unsubUsers();
    };
  }, [profile]);

  useEffect(() => {
    refreshScrollTrigger();
  }, [firebasePosts.length, homeSubView, activeTab]);

  // Save campus choice to local storage
  const handleCampusChange = (campus: string) => {
    setSelectedCampus(campus);
    localStorage.setItem('flick_selected_campus', campus);
    playGlitchClickSound();
    triggerVibration('medium');
  };

  // Compile full list of posts (Streamed from Firebase)
  const getMergedPosts = () => {
    // Transform firebase posts to match our multi-faceted categories if they don't specify one
    const normalizedFirebase = firebasePosts.map(p => ({
      ...p,
      type: p.mediaType === 'video' ? 'reel' : 'social',
      commentsCount: (p as any).commentsCount || 0,
      sharesCount: (p as any).sharesCount || 0,
      savesCount: (p as any).savesCount || 0,
      school: p.authorName.includes('Covenant') ? 'Covenant University' : p.authorName.includes('Babcock') ? 'Babcock University' : 'University of Lagos'
    }));

    // Filter out posts whose authors are no longer registered, unless from current user or flick hq
    const rawList = normalizedFirebase.filter(p => {
      if (p.authorId === 'flick-hq') return true;
      if (profile && p.authorId === profile.uid) return true;
      return registeredUsers.some(u => u.uid === p.authorId);
    });

    // Filter by selected campus if not "Global Feed"
    const filteredList = selectedCampus === 'Global Feed' 
      ? rawList 
      : rawList.filter(p => p.school === selectedCampus);

    // DYNAMIC FEED RANKING ENGINE
    // Formula: score = engagement * 0.30 + relationship * 0.25 + interest * 0.20 + school_relevance * 0.15 + freshness * 0.10
    const scoredList = filteredList.map(p => {
      const engagement = ((p.likesCount || 0) + (p.commentsCount || 0) + (p.sharesCount || 0) + (p.savesCount || 0));
      
      // Relationship: higher weight if user is author or we interacted (simulated)
      const relationship = p.authorId === profile?.uid ? 10 : 2;

      // Interest: Academic and reels get weighted interest indices depending on mode
      const interest = p.type === 'academic' ? 8 : p.type === 'poll' ? 7 : p.type === 'reel' ? 6 : 4;

      // School relevance: Matches current user campus selection
      const schoolRelevance = p.school === selectedCampus ? 10 : 3;

      // Freshness: Decay over time
      const postDate = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
      const ageHours = (Date.now() - postDate.getTime()) / (3600000);
      const freshness = Math.max(0, 10 - ageHours);

      const score = (engagement * 0.30) + (relationship * 0.25) + (interest * 0.20) + (schoolRelevance * 0.15) + (freshness * 0.10);

      return {
        ...p,
        rankingScore: score
      };
    });

    // Sort descending by ranking score
    return scoredList.sort((a, b) => b.rankingScore - a.rankingScore);
  };



  // Double tap to like short vertical videos / posts
  const handleDoubleTapLike = (postId: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Trigger Heart Animation Burst
    const burstId = Math.random().toString();
    setHeartBursts(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), { id: burstId, x, y }]
    }));

    // Trigger database / like logic
    const postToLike = getMergedPosts().find(p => p.id === postId);
    if (postToLike) {
      handleLikeTrigger(postToLike);
    }

    // Auto dismiss burst after 800ms
    setTimeout(() => {
      setHeartBursts(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(h => h.id !== burstId)
      }));
    }, 800);
  };

  const handleLikeTrigger = async (post: any) => {
    if (!profile) return;
    const toastId = 'like-' + post.id;
    try {
      playLikeSound();
      triggerEventVibration('like');
      showBrutalistToast('SYNCING...', 'Dispatched endorsement update...', 'loading', undefined, toastId);
      await toggleLikePost(post.id, profile.uid);
      const isLiked = post.likes?.includes(profile.uid);
      showBrutalistToast('PACKET UPDATED', isLiked ? 'Removed like endorsement' : 'Added like endorsement to packet', 'success', undefined, toastId);
    } catch (err: any) {
      console.warn(err);
      showBrutalistToast('ERROR ×', 'Failed to endorse packet: ' + sanitizeErrorMessage(err), 'error', undefined, toastId);
    }
  };

  // Story creator upload triggers
  const handlePublishStory = async () => {
    if (!profile) return;
    
    // Validation based on selected story format
    if (storyType === 'text' && !storyContent.trim()) {
      showBrutalistToast('WARNING !', 'Story text context cannot be empty for text stories.', 'warning');
      return;
    }
    if (storyType === 'image' && !storyImg.trim() && !storyContent.trim()) {
      showBrutalistToast('WARNING !', 'Provide an image or text description to broadcast.', 'warning');
      return;
    }
    if (storyType === 'video' && !storyVideo.trim()) {
      showBrutalistToast('WARNING !', 'Attach a video file or link to broadcast a video story.', 'warning');
      return;
    }
    if (storyType === 'audio' && !storyAudio.trim()) {
      showBrutalistToast('WARNING !', 'Attach an audio file to broadcast a sound story.', 'warning');
      return;
    }

    let finalMediaType: 'image' | 'video' | 'audio' | 'none' = 'none';
    if (storyType === 'image' && storyImg.trim()) {
      finalMediaType = 'image';
    } else if (storyType === 'video' && storyVideo.trim()) {
      finalMediaType = 'video';
    } else if (storyType === 'audio' && storyAudio.trim()) {
      finalMediaType = 'audio';
    } else if (storyType === 'text') {
      finalMediaType = 'none';
    }

    const hasMedia = finalMediaType !== 'none';
    const taskLabel = `Broadcasting Story: ${storyType.toUpperCase()}`;

    // Create central operation task
    const taskId = operations.createTask('image upload', taskLabel, {
      maxRetries: 2,
      totalBytes: hasMedia ? 1024 * 1024 * 2.5 : undefined,
      onRetry: async () => {
        await handlePublishStory();
      }
    });

    setIsUploadingStory(true);
    const toastId = 'story-upload';
    try {
      playGlitchClickSound();
      triggerVibration('medium');
      
      // Phase 2: STARTING
      operations.updateTask(taskId, { state: 'STARTING', progress: 10 });
      showBrutalistToast('BROADCASTING...', 'Transmitting story node to the student network...', 'loading', undefined, toastId);
      await new Promise(resolve => setTimeout(resolve, 600));

      // Phase 4: UPLOADING (if has media)
      if (hasMedia) {
        operations.updateTask(taskId, { state: 'UPLOADING', progress: 20 });
        const totalSize = 1024 * 1024 * 2.5;
        
        for (let percent = 20; percent <= 80; percent += 20) {
          const bytesUploaded = Math.round((percent / 100) * totalSize);
          operations.updateTask(taskId, {
            progress: percent,
            bytesUploaded
          });
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      // Phase 3: CONNECTING
      operations.updateTask(taskId, { state: 'CONNECTING', progress: 85 });
      await new Promise(resolve => setTimeout(resolve, 400));

      if (!navigator.onLine) {
        throw new Error('offline: Device network connection was lost during transit.');
      }

      // Phase 5: SERVER ACKNOWLEDGED
      operations.updateTask(taskId, { state: 'SERVER ACKNOWLEDGED', progress: 90 });

      await createStory({
        authorId: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        content: storyContent.trim(),
        imageUrl: finalMediaType === 'image' ? storyImg.trim() : undefined,
        videoUrl: finalMediaType === 'video' ? storyVideo.trim() : undefined,
        audioUrl: finalMediaType === 'audio' ? storyAudio.trim() : undefined,
        mediaType: finalMediaType,
        gradientPreset: storyType === 'text' ? storyGradientPreset : undefined,
        musicTitle: finalMediaType === 'audio' ? storyMusicTitle.trim() || 'Flick Soundscape' : undefined,
        musicArtist: finalMediaType === 'audio' ? storyMusicArtist.trim() || 'Campus Node Broadcast' : undefined,
      });

      // Phase 6: FINALIZING
      operations.updateTask(taskId, { state: 'FINALIZING', progress: 95 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Phase 7: SUCCESS
      operations.successTask(taskId);

      // Reset states
      setStoryContent('');
      setStoryImg('');
      setStoryVideo('');
      setStoryAudio('');
      setStoryMusicTitle('');
      setStoryMusicArtist('');
      setIsUploadingStory(false);
      setShowPostCreator(false);
      showBrutalistToast('SUCCESS ✓', 'Story successfully broadcasted to campus network!', 'success', undefined, toastId);
    } catch (err: any) {
      console.warn(err);
      setIsUploadingStory(false);
      let errMsg = sanitizeErrorMessage(err);
      if (!navigator.onLine || errMsg.toLowerCase().includes('offline')) {
        errMsg = 'offline: Peer disconnected from network terminal.';
      }
      
      // Phase 8: FAILED
      operations.failTask(taskId, errMsg);
      showBrutalistToast('ERROR ×', 'Story broadcast failed: ' + errMsg, 'error', undefined, toastId);
    }
  };

  // Post Creator submit triggers
  const handlePublishPost = async () => {
    if (!profile) return;
    if (!postContent.trim()) {
      showBrutalistToast('WARNING !', 'Post text content cannot be empty.', 'warning');
      return;
    }

    const hasMedia = !!(postImage.trim() || postVideo.trim());
    const mediaTypeLabel = postVideo.trim() ? 'Video' : 'Image';
    const taskLabel = hasMedia ? `Publishing Post with ${mediaTypeLabel}` : `Publishing Post Dialogue`;
    
    // Create central operation task
    const taskId = operations.createTask('post creation', taskLabel, {
      maxRetries: 3,
      totalBytes: hasMedia ? 1024 * 1024 * 4.2 : undefined,
      onRetry: async () => {
        await handlePublishPost();
      }
    });

    setIsPublishingPost(true);
    triggerVibration('heavy');
    const toastId = 'post-publish';
    
    try {
      playGlitchClickSound();
      
      // Phase 2: STARTING
      operations.updateTask(taskId, { state: 'STARTING', progress: 10 });
      showBrutalistToast('PREPARING...', 'Compressing media and preparing buffers...', 'loading', undefined, toastId);
      await new Promise(resolve => setTimeout(resolve, 800));

      // Phase 4: UPLOADING (if has media)
      if (hasMedia) {
        operations.updateTask(taskId, { state: 'UPLOADING', progress: 20 });
        const totalSize = 1024 * 1024 * 4.2; // 4.2 MB
        
        for (let percent = 20; percent <= 80; percent += 15) {
          const bytesUploaded = Math.round((percent / 100) * totalSize);
          operations.updateTask(taskId, {
            progress: percent,
            bytesUploaded
          });
          showBrutalistToast('UPLOADING...', `Uploading ${mediaTypeLabel}... ${percent}%`, 'loading', undefined, toastId);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Phase 3: CONNECTING
      operations.updateTask(taskId, { state: 'CONNECTING', progress: 85 });
      showBrutalistToast('CONNECTING...', 'Establishing secure tunnel links to Firestore...', 'loading', undefined, toastId);
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!navigator.onLine) {
        throw new Error('offline: Device network connection was lost during transit.');
      }

      // Phase 5: SERVER ACKNOWLEDGED & FINALIZING
      operations.updateTask(taskId, { state: 'SERVER ACKNOWLEDGED', progress: 90 });
      showBrutalistToast('DEPLOYING...', 'Writing post packet metadata onto chain...', 'loading', undefined, toastId);
      
      const authorName = postAnon ? "Anonymous Confession" : profile.displayName;
      const authorPhoto = postAnon 
        ? "https://api.dicebear.com/7.x/pixel-art/svg?seed=anon" 
        : profile.photoURL;

      await createPost({
        authorId: profile.uid,
        authorName,
        authorPhoto,
        content: postContent.trim(),
        imageUrl: postImage.trim() || undefined,
        videoUrl: postVideo.trim() || undefined,
        mediaType: postVideo.trim() ? 'video' : postImage.trim() ? 'image' : 'none'
      });

      // Phase 6: FINALIZING
      operations.updateTask(taskId, { state: 'FINALIZING', progress: 95 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Phase 7: SUCCESS
      operations.successTask(taskId);
      
      setPostContent('');
      setPostImage('');
      setPostVideo('');
      setPostAnon(false);
      setShowPostCreator(false);
      showBrutalistToast('SUCCESS ✓', 'Packet securely deployed to global feeds!', 'success', undefined, toastId);
    } catch (err: any) {
      console.warn(err);
      let errMsg = sanitizeErrorMessage(err);
      if (!navigator.onLine || errMsg.toLowerCase().includes('offline')) {
        errMsg = 'offline: Peer disconnected from network terminal.';
      } else if (err?.code === 'permission-denied') {
        errMsg = 'permission denied: Write clearance revoked.';
      }
      
      // Phase 8: FAILED
      operations.failTask(taskId, errMsg);
      showBrutalistToast('ERROR ×', 'Failed to deploy post packet: ' + errMsg, 'error', undefined, toastId);
    } finally {
      setIsPublishingPost(false);
    }
  };

  // Omegle student matcher trigger
  const handleStartMatching = () => {
    setIsMatching(true);
    setIsMatchedActive(false);
    setMatchMessages([]);
    playGlitchClickSound();
    triggerVibration('heavy');

    let counter = 0;
    const interval = setInterval(() => {
      counter += 10;
      setMatchProgress(counter);
      if (counter >= 100) {
        clearInterval(interval);
        
        // Find random classmate registered or generate fallback profile
        const potentialPartners = registeredUsers.filter(u => u.uid !== profile?.uid);
        let partnerObj: any = null;
        if (potentialPartners.length > 0) {
          partnerObj = potentialPartners[Math.floor(Math.random() * potentialPartners.length)];
        } else {
          partnerObj = {
            displayName: 'Tunde (Physics Covenant)',
            photoURL: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=120',
            school: 'Covenant University',
            status: 'online'
          };
        }

        setMatchPartner(partnerObj);
        setIsMatching(false);
        setIsMatchedActive(true);
        triggerVibration('medium');
        playReceiveMessageSound();

        // Feed introductory simulated greeting
        setTimeout(() => {
          setMatchMessages([
            { sender: 'them', text: `Yo! Nice match. I am studying at ${partnerObj.school || 'Unilag'}. What are you up to?` }
          ]);
        }, 1200);
      }
    }, 300);
  };

  // Match text submission
  const handleSendMatchMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchInput.trim()) return;

    playGlitchClickSound();
    const userText = matchInput.trim();
    setMatchMessages(prev => [...prev, { sender: 'me', text: userText }]);
    setMatchInput('');

    // Trigger simulated responder from classmate
    setTimeout(() => {
      let responseText = "Haha nice, this campus matcher is crazy fast.";
      if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi')) {
        responseText = "What's good! What department are you in?";
      } else if (userText.toLowerCase().includes('calculus') || userText.toLowerCase().includes('exam') || userText.toLowerCase().includes('test')) {
        responseText = "Oh gosh, don't remind me of tests 😭 I have a massive quiz tomorrow.";
      }
      setMatchMessages(prev => [...prev, { sender: 'them', text: responseText }]);
      playReceiveMessageSound();
      triggerVibration('light');
    }, 1500);
  };

  // Group Create form
  const handleDeployGroup = async () => {
    if (!profile || !newGroupName.trim()) return;
    try {
      playGlitchClickSound();
      triggerVibration('heavy');
      await createGroupChat(newGroupName, [profile.uid], profile.uid, {
        description: newGroupDesc,
        privacy: newGroupPrivacy,
        inviteCode: newGroupPass,
        groupType: newGroupType as any
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateGroup(false);
      setActiveTab('groups'); // navigate to group tab
    } catch (err) {
      console.warn(err);
    }
  };

  // Story refs for video/audio play/pause synchronization
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Seed default story elements if Firestore lacks stories to support multi-media testing
  const defaultStories = [
    {
      id: 'st-text-0',
      authorId: 'flick-hq',
      authorName: 'FLICK HQ',
      authorPhoto: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120',
      content: '⚡ FLICK SECURE NET: DEPLOYED\n\nDecentralized encrypted communication is active on core campus nodes. Share text, images, video, and audio streams now!',
      mediaType: 'none',
      gradientPreset: 'cosmic',
      viewsCount: 1,
      viewedBy: [],
      createdAt: new Date(Date.now() - 3600000)
    },
    {
      id: 'st-image-0',
      authorId: 'flick-hq',
      authorName: 'FLICK HQ',
      authorPhoto: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120',
      content: 'Cyberpunk setup in our campus security war room.',
      mediaType: 'image',
      imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600',
      viewsCount: 12,
      viewedBy: [],
      createdAt: new Date(Date.now() - 1800000)
    },
    {
      id: 'st-audio-0',
      authorId: 'flick-hq',
      authorName: 'FLICK HQ',
      authorPhoto: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120',
      content: 'Tune in to our secure campus background audio pulse.',
      mediaType: 'audio',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      musicTitle: 'Cyber Ambient Synth',
      musicArtist: 'Fara Labs Digital',
      viewsCount: 42,
      viewedBy: [],
      createdAt: new Date(Date.now() - 600000)
    }
  ];

  const getStoryAgeInMs = (s: any) => {
    if (!s) return 24 * 60 * 60 * 1000 + 1000; // expired
    if (s.id?.startsWith('st-') || s.authorId === 'flick-hq') return 0; // default never expires
    if (!s.createdAt) {
      if (profile && s.authorId === profile.uid) {
        return 0; // freshly created by me
      }
      return 24 * 60 * 60 * 1000 + 1000; // missing and not me -> expired
    }
    const createdTime = s.createdAt.seconds 
      ? s.createdAt.seconds * 1000 
      : (s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt).getTime());
    return createdTime ? (Date.now() - createdTime) : (24 * 60 * 60 * 1000 + 1000);
  };

  const getStoriesList = () => {
    const list = stories.length > 0 ? stories : defaultStories;
    return list.filter(s => {
      // Filter out any story that is older than 24 hours (86400000 ms)
      // Except newly created ones (ageMs === 0)
      if (!s.id.startsWith('st-') && s.authorId !== 'flick-hq') {
        const ageMs = getStoryAgeInMs(s);
        if (ageMs > 24 * 60 * 60 * 1000) {
          return false;
        }
      }
      
      if (s.id.startsWith('st-') || s.authorId === 'flick-hq') return true;
      if (profile && s.authorId === profile.uid) return true;
      return registeredUsers.some(u => u.uid === s.authorId);
    });
  };

  interface StoryGroup {
    authorId: string;
    authorName: string;
    authorPhoto: string;
    stories: Story[];
  }

  // Group stories by their author ID (like Instagram story circles) without unstable duplicates
  const getGroupedStories = (): StoryGroup[] => {
    const rawStories = getStoriesList();
    const groupsMap: Record<string, StoryGroup> = {};

    rawStories.forEach(s => {
      const authorId = s.authorId || 'anonymous';
      if (!groupsMap[authorId]) {
        groupsMap[authorId] = {
          authorId,
          authorName: s.authorName || 'Anonymous',
          authorPhoto: s.authorPhoto || 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120',
          stories: []
        };
      }
      groupsMap[authorId].stories.push(s);
    });

    // Sort stories inside each group by creation date ascending
    Object.values(groupsMap).forEach(g => {
      g.stories.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
        const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
        return timeA - timeB;
      });
    });

    // Sort groups deterministically: Current user is always first, then flick-hq, then rest sorted by newest story
    const allGroups = Object.values(groupsMap);
    const currentUserGroup = profile ? allGroups.find(g => g.authorId === profile.uid) : undefined;
    const flickHqGroup = allGroups.find(g => g.authorId === 'flick-hq');
    
    const remainingGroups = allGroups.filter(g => {
      if (profile && g.authorId === profile.uid) return false;
      if (g.authorId === 'flick-hq') return false;
      return true;
    });

    remainingGroups.sort((a, b) => {
      const latestA = Math.max(...a.stories.map(s => {
        if (!s.createdAt) return 0;
        return s.createdAt.seconds ? s.createdAt.seconds * 1000 : (s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt).getTime());
      }));
      const latestB = Math.max(...b.stories.map(s => {
        if (!s.createdAt) return 0;
        return s.createdAt.seconds ? s.createdAt.seconds * 1000 : (s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt).getTime());
      }));
      return latestB - latestA;
    });

    const sortedResult: StoryGroup[] = [];
    if (currentUserGroup) sortedResult.push(currentUserGroup);
    if (flickHqGroup) sortedResult.push(flickHqGroup);
    sortedResult.push(...remainingGroups);

    return sortedResult;
  };

  // Open a specific user story group circle
  const handleOpenStoryGroup = (groupId: string) => {
    triggerVibration('light');
    setActiveStoryGroupId(groupId);
    setActiveStoryIndexInGroup(0);
    setStoryProgress(0);
    setIsStoryPaused(false);
    
    // Mark first story in this group as viewed
    const groups = getGroupedStories();
    const targetGroup = groups.find(g => g.authorId === groupId);
    if (targetGroup && targetGroup.stories[0]) {
      const firstStory = targetGroup.stories[0];
      setStoryViewedList(prev => ({ ...prev, [firstStory.id]: true }));
      viewStory(firstStory.id, profile?.uid || 'anonymous');
    }
  };

  const handleNextStory = () => {
    if (activeStoryGroupId === null) return;
    const groups = getGroupedStories();
    const groupIdx = groups.findIndex(g => g.authorId === activeStoryGroupId);
    if (groupIdx === -1) return;

    const currentGroup = groups[groupIdx];
    if (activeStoryIndexInGroup < currentGroup.stories.length - 1) {
      // Go to next story inside current user's group
      setActiveStoryIndexInGroup(activeStoryIndexInGroup + 1);
      setStoryProgress(0);
      triggerVibration('light');
      const nextStory = currentGroup.stories[activeStoryIndexInGroup + 1];
      if (nextStory) {
        setStoryViewedList(prev => ({ ...prev, [nextStory.id]: true }));
        viewStory(nextStory.id, profile?.uid || 'anonymous');
      }
    } else {
      // Finished all stories in this group, advance to next user's story group
      if (groupIdx < groups.length - 1) {
        const nextGroup = groups[groupIdx + 1];
        setActiveStoryGroupId(nextGroup.authorId);
        setActiveStoryIndexInGroup(0);
        setStoryProgress(0);
        triggerVibration('medium');
        const firstStory = nextGroup.stories[0];
        if (firstStory) {
          setStoryViewedList(prev => ({ ...prev, [firstStory.id]: true }));
          viewStory(firstStory.id, profile?.uid || 'anonymous');
        }
      } else {
        // No more story groups remaining, close viewer
        setActiveStoryGroupId(null);
        setActiveStoryIndexInGroup(0);
        setStoryProgress(0);
      }
    }
  };

  const handlePrevStory = () => {
    if (activeStoryGroupId === null) return;
    const groups = getGroupedStories();
    const groupIdx = groups.findIndex(g => g.authorId === activeStoryGroupId);
    if (groupIdx === -1) return;

    if (activeStoryIndexInGroup > 0) {
      // Go to previous story in active user group
      setActiveStoryIndexInGroup(activeStoryIndexInGroup - 1);
      setStoryProgress(0);
      triggerVibration('light');
      const prevStory = groups[groupIdx].stories[activeStoryIndexInGroup - 1];
      if (prevStory) {
        setStoryViewedList(prev => ({ ...prev, [prevStory.id]: true }));
      }
    } else {
      // Shift backwards to previous user's last story
      if (groupIdx > 0) {
        const prevGroup = groups[groupIdx - 1];
        setActiveStoryGroupId(prevGroup.authorId);
        setActiveStoryIndexInGroup(prevGroup.stories.length - 1);
        setStoryProgress(0);
        triggerVibration('medium');
        const lastStory = prevGroup.stories[prevGroup.stories.length - 1];
        if (lastStory) {
          setStoryViewedList(prev => ({ ...prev, [lastStory.id]: true }));
        }
      } else {
        // At the very beginning, restart active story progress
        setStoryProgress(0);
      }
    }
  };

  // Synchronize playing and pausing on active media elements (audio / video)
  useEffect(() => {
    if (activeStoryGroupId === null) return;
    if (isStoryPaused) {
      videoRef.current?.pause();
      audioRef.current?.pause();
    } else {
      videoRef.current?.play().catch(e => console.log('Video play interrupted:', e));
      audioRef.current?.play().catch(e => console.log('Audio play interrupted:', e));
    }
  }, [isStoryPaused, activeStoryGroupId, activeStoryIndexInGroup]);

  // Auto-progression timer for IG-style stories
  useEffect(() => {
    if (activeStoryGroupId === null) {
      setStoryProgress(0);
      setIsStoryPaused(false);
      return;
    }

    const groups = getGroupedStories();
    const currentGroup = groups.find(g => g.authorId === activeStoryGroupId);
    if (!currentGroup) return;

    const activeStory = currentGroup.stories[activeStoryIndexInGroup];
    if (!activeStory) return;

    // Use standard 5000ms story frame duration
    const storyDuration = 5000;
    const intervalTime = 30; // smooth 30ms ticks
    const step = (intervalTime / storyDuration) * 100;

    const timer = setInterval(() => {
      if (!isStoryPaused) {
        setStoryProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            handleNextStory();
            return 100;
          }
          return prev + step;
        });
      }
    }, intervalTime);

    return () => {
      clearInterval(timer);
    };
  }, [activeStoryGroupId, activeStoryIndexInGroup, isStoryPaused]);

  // Touch and swipe interactions (pause on hold, tap to skip, swipe to navigate)
  const touchStartXRef = useRef<number>(0);
  const touchEndXRef = useRef<number>(0);

  const handleStoryTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    storyStartTimeRef.current = Date.now();
    storyIsHoldRef.current = false;
    if ('touches' in e) {
      touchStartXRef.current = e.touches[0].clientX;
    }
    storyHoldTimeoutRef.current = setTimeout(() => {
      setIsStoryPaused(true);
      storyIsHoldRef.current = true;
    }, 150); // Pause if held for >150ms
  };

  const handleStoryTouchMove = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchEndXRef.current = e.touches[0].clientX;
    }
  };

  const handleStoryTouchEnd = (e: React.TouchEvent | React.MouseEvent, side: 'left' | 'right') => {
    clearTimeout(storyHoldTimeoutRef.current);
    setIsStoryPaused(false);
    
    // Check for swipe
    if ('changedTouches' in e && touchStartXRef.current !== 0 && touchEndXRef.current !== 0) {
      const deltaX = touchStartXRef.current - touchEndXRef.current;
      if (Math.abs(deltaX) > 50) { // minimum swipe distance
        if (deltaX > 0) {
          handleNextStory();
        } else {
          handlePrevStory();
        }
        // Reset touch coordinates
        touchStartXRef.current = 0;
        touchEndXRef.current = 0;
        storyIsHoldRef.current = false;
        return; // Skip tap logic if it was a swipe
      }
    }
    
    // Reset touch coordinates
    touchStartXRef.current = 0;
    touchEndXRef.current = 0;

    // Tap logic
    const duration = Date.now() - storyStartTimeRef.current;
    if (duration < 250 && !storyIsHoldRef.current) {
      if (side === 'left') {
        handlePrevStory();
      } else {
        handleNextStory();
      }
    }
    storyIsHoldRef.current = false;
  };

  const handleStoryMouseDown = (e: React.MouseEvent) => {
    handleStoryTouchStart(e);
  };

  const handleStoryMouseUp = (e: React.MouseEvent, side: 'left' | 'right') => {
    handleStoryTouchEnd(e, side);
  };

  // Poll Post voting interactions
  const handleVotePoll = (postId: string, optionIndex: number) => {
    playGlitchClickSound();
    triggerVibration('medium');
    // Live poll database update can be integrated here, no local fallback needed
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col relative font-mono overflow-hidden">
      
      {/* Main Tab Views Container */}
      <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {/* ==================== HOME TAB VIEW ==================== */}
          {(activeTab === 'home' || activeTab === 'feed') && (
            <div
              key="home"
              className="w-full h-full overflow-y-auto flex flex-col px-2 sm:px-4 py-4 space-y-5 select-text"
              style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
              <div className="w-full max-w-5xl lg:max-w-6xl mx-auto space-y-6 pb-24 md:pb-6">
                {/* Morphic custom capsule switcher (Sticky Top / Fixed) */}
                <div className="sticky top-0 z-30 flex glass-panel p-1.5 rounded-[20px] overflow-x-auto scrollbar-none gap-1">
                  <button
                    onClick={() => { playGlitchClickSound(); setHomeSubView('voice'); }}
                    className={`relative flex-1 min-w-[110px] py-2.5 text-center text-[9.5px] font-black uppercase tracking-wider cursor-pointer transition-all rounded-xl flex items-center justify-center gap-1.5 ${
                      homeSubView === 'voice'
                        ? 'text-[var(--color-text)] font-extrabold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {homeSubView === 'voice' && (
                      <motion.div
                        layoutId="homeSubViewActivePill"
                        className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl shadow-md z-0 pointer-events-none"
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                      />
                    )}
                    <span className="w-1.5 h-1.5 bg-[var(--neon-green)] rounded-full animate-ping shrink-0 relative z-10"></span>
                    <span className="relative z-10">🎙️ Voice Studio</span>
                  </button>
                  <button
                    onClick={() => { playGlitchClickSound(); setHomeSubView('feed'); }}
                    className={`relative flex-1 min-w-[110px] py-2.5 text-center text-[9.5px] font-black uppercase tracking-wider cursor-pointer transition-all rounded-xl ${
                      homeSubView === 'feed'
                        ? 'text-[var(--color-text)] font-extrabold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {homeSubView === 'feed' && (
                      <motion.div
                        layoutId="homeSubViewActivePill"
                        className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-700 rounded-xl shadow-md z-0 pointer-events-none"
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                      />
                    )}
                    <span className="relative z-10">✦ Feed Chronicles</span>
                  </button>
                  <button
                    onClick={() => { playGlitchClickSound(); setHomeSubView('live'); }}
                    className={`relative flex-1 min-w-[100px] py-2.5 text-center text-[9.5px] font-black uppercase tracking-wider cursor-pointer transition-all rounded-xl flex items-center justify-center gap-1 ${
                      homeSubView === 'live'
                        ? 'text-[var(--color-text)] font-extrabold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {homeSubView === 'live' && (
                      <motion.div
                        layoutId="homeSubViewActivePill"
                        className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-700 rounded-xl shadow-md z-0 pointer-events-none"
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                      />
                    )}
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping shrink-0 relative z-10"></span>
                    <span className="relative z-10">📺 Live Arena</span>
                  </button>
                  <button
                    onClick={() => { playGlitchClickSound(); setHomeSubView('network'); }}
                    className={`relative flex-1 min-w-[110px] py-2.5 text-center text-[9.5px] font-black uppercase tracking-wider cursor-pointer transition-all rounded-xl ${
                      homeSubView === 'network'
                        ? 'text-[var(--color-text)] font-extrabold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {homeSubView === 'network' && (
                      <motion.div
                        layoutId="homeSubViewActivePill"
                        className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-700 rounded-xl shadow-md z-0 pointer-events-none"
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                      />
                    )}
                    <span className="relative z-10">⚡ Node Cluster</span>
                  </button>
                </div>

            {homeSubView === 'voice' ? (
              <VoiceFirstHomeScreen 
                onOpenDirectChat={(peerId) => {
                  onClearDeepLink();
                  if (setActiveTab) setActiveTab('chat');
                }}
                onOpenCall={(peerId, peerName, peerPhoto, type) => {
                  window.dispatchEvent(new CustomEvent('faraflick-initiate-call', {
                    detail: { peerId, peerName, peerPhoto, type }
                  }));
                }}
                onOpenNetworkMap={() => setHomeSubView('network')}
              />
            ) : homeSubView === 'network' ? (
              <NodeClusterView 
                users={registeredUsers} 
                posts={firebasePosts} 
                currentUserUid={profile?.uid} 
              />
            ) : homeSubView === 'live' ? (
              <LiveSportsHub 
                profile={profile}
                showToast={showBrutalistToast}
                playClickSound={playGlitchClickSound}
              />
            ) : (
              <div className="space-y-4">
                {/* Reorder / Customization Control Bar */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 font-black tracking-wider flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[var(--neon-green)]" />
                      Dynamic Feed Layout
                    </span>
                    {pinnedPostIds.length > 0 && (
                      <span className="text-[8.5px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        📌 {pinnedPostIds.length} Pinned
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      setIsCustomizingFeedLayout(!isCustomizingFeedLayout);
                    }}
                    className={`px-2.5 py-1 text-[8.5px] font-mono uppercase font-black rounded-lg border transition flex items-center space-x-1.5 cursor-pointer ${
                      isCustomizingFeedLayout
                        ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] shadow-[0_0_12px_rgba(0,255,102,0.3)]'
                        : 'bg-[var(--color-surface)] text-zinc-400 border-[var(--neon-green-border)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Move className="w-2.5 h-2.5" />
                    <span>{isCustomizingFeedLayout ? 'Done Customizing' : 'Customize Order'}</span>
                  </button>
                </div>

                {/* Customization Drawer when active */}
                {isCustomizingFeedLayout && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3.5 bg-zinc-950/90 border-2 border-[var(--neon-green)]/40 rounded-2xl space-y-3 shadow-xl backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-black text-[var(--neon-green)] uppercase tracking-wider flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5" />
                        Drag & Drop or Reorder Feed Sections
                      </span>
                      <button
                        onClick={resetFeedLayout}
                        className="text-[8px] font-mono text-zinc-500 hover:text-red-400 transition uppercase font-bold"
                      >
                        [Reset to Default]
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {feedSectionsOrder.map((secId, idx) => {
                        const secMeta = DEFAULT_FEED_SECTIONS.find(s => s.id === secId) || { id: secId, label: secId, icon: '📦', desc: '' };
                        const isDragging = draggedSectionId === secId;
                        const isDragOver = dragOverSectionId === secId;

                        return (
                          <div
                            key={secId}
                            draggable
                            onDragStart={() => setDraggedSectionId(secId)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (dragOverSectionId !== secId) setDragOverSectionId(secId);
                            }}
                            onDragLeave={() => {
                              if (dragOverSectionId === secId) setDragOverSectionId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedSectionId && draggedSectionId !== secId) {
                                handleReorderSections(draggedSectionId, secId);
                              }
                              setDraggedSectionId(null);
                              setDragOverSectionId(null);
                            }}
                            className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-grab active:cursor-grabbing ${
                              isDragging 
                                ? 'opacity-40 border-dashed border-[var(--neon-green)] bg-[var(--neon-green)]/10'
                                : isDragOver
                                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 scale-[1.01]'
                                  : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <GripVertical className="w-4 h-4 text-zinc-600 hover:text-zinc-300" />
                              <span className="text-sm">{secMeta.icon}</span>
                              <div>
                                <h5 className="text-[10.5px] font-mono font-black text-zinc-200 uppercase">{secMeta.label}</h5>
                                <p className="text-[8px] font-sans text-zinc-500">{secMeta.desc}</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1">
                              <button
                                disabled={idx === 0}
                                onClick={() => {
                                  if (idx > 0) handleReorderSections(secId, feedSectionsOrder[idx - 1]);
                                }}
                                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 text-[10px] font-mono px-1.5"
                                title="Move Up"
                              >
                                ▲
                              </button>
                              <button
                                disabled={idx === feedSectionsOrder.length - 1}
                                onClick={() => {
                                  if (idx < feedSectionsOrder.length - 1) handleReorderSections(secId, feedSectionsOrder[idx + 1]);
                                }}
                                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 text-[10px] font-mono px-1.5"
                                title="Move Down"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Render Sections in configured dynamic order */}
                {feedSectionsOrder.map((sectionKey) => {
                  if (sectionKey === 'stories') {
                    return (
                      <div 
                        key="stories" 
                        id="tour-stories-bar" 
                        className={`glass-panel p-4 rounded-[20px] space-y-3 transition ${
                          isCustomizingFeedLayout ? 'ring-1 ring-[var(--neon-green)]/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                            ⚡ Ephemeral Peer Chronicles
                          </span>
                          <button
                            onClick={() => {
                              playGlitchClickSound();
                              setPostCreatorType('story');
                              setShowPostCreator(true);
                            }}
                            className="text-[7.5px] font-mono text-zinc-500 hover:text-[var(--neon-green)] transition uppercase font-black"
                          >
                            + ADD STORY NODE
                          </button>
                        </div>
                        
                        <div className="flex space-x-4 overflow-x-auto pb-1 scrollbar-none select-none">
                          {/* Add/View own story bubble */}
                          {(() => {
                            const allGroups = getGroupedStories();
                            const currentUserGroup = profile ? allGroups.find(g => g.authorId === profile.uid) : null;
                            const ownStoriesViewed = currentUserGroup ? currentUserGroup.stories.every(s => storyViewedList[s.id] || false) : true;
                            
                            return (
                              <div className="flex flex-col items-center space-y-1.5 shrink-0">
                                <div className="relative group">
                                  <button
                                    onClick={() => {
                                      playGlitchClickSound();
                                      if (currentUserGroup && profile) {
                                        handleOpenStoryGroup(profile.uid);
                                      } else {
                                        setPostCreatorType('story');
                                        setShowPostCreator(true);
                                      }
                                    }}
                                    className={`w-13 h-13 rounded-full flex items-center justify-center transition transform hover:scale-105 active:scale-95 cursor-pointer ${
                                      currentUserGroup 
                                        ? (ownStoriesViewed 
                                            ? 'bg-zinc-800 p-0.5' 
                                            : 'bg-gradient-to-tr from-amber-500 via-red-500 to-rose-600 animate-pulse p-0.5')
                                        : 'bg-[var(--color-background)] border-2 border-dashed border-[var(--neon-green-border)] hover:border-[var(--neon-green)] p-0'
                                    }`}
                                  >
                                    <div className={`w-full h-full rounded-full bg-[var(--color-surface)] flex items-center justify-center ${currentUserGroup ? 'p-[1.5px]' : 'p-0'}`}>
                                      {profile?.photoURL ? (
                                        <img 
                                          src={profile.photoURL} 
                                          alt="My Avatar" 
                                          className={`w-full h-full rounded-full object-cover transition ${currentUserGroup ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} 
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <span className="text-xs text-zinc-500 font-bold">+</span>
                                      )}
                                    </div>
                                  </button>
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playGlitchClickSound();
                                      setPostCreatorType('story');
                                      setShowPostCreator(true);
                                    }}
                                    className="absolute bottom-0 right-0 bg-[var(--neon-green)] text-black rounded-full p-0.5 border border-black hover:scale-110 transition cursor-pointer shadow-lg z-10"
                                    title="Add Story"
                                  >
                                    <Plus className="w-3 h-3 font-bold" />
                                  </button>
                                </div>
                                <span className="text-[8.5px] font-mono text-zinc-500 max-w-[55px] truncate">My Story</span>
                              </div>
                            );
                          })()}

                          {/* Render existing active stories grouped by other users */}
                          {getGroupedStories()
                            .filter(group => !profile || group.authorId !== profile.uid)
                            .map((group) => {
                              const allViewed = group.stories.every(s => storyViewedList[s.id] || false);
                              const authorFirstName = (group.authorName || 'Anonymous').split(' ')[0];
                              return (
                                <div key={group.authorId} className="flex flex-col items-center space-y-1.5 shrink-0">
                                  <button
                                    onClick={() => handleOpenStoryGroup(group.authorId)}
                                    className={`w-13 h-13 rounded-full p-0.5 flex items-center justify-center transition transform hover:scale-105 active:scale-95 cursor-pointer ${
                                      allViewed 
                                        ? 'bg-zinc-800' 
                                        : 'bg-gradient-to-tr from-amber-500 via-red-500 to-rose-600 animate-pulse'
                                    }`}
                                  >
                                    <div className="w-full h-full rounded-full bg-[var(--color-surface)] p-[1.5px] flex items-center justify-center">
                                      <img 
                                        src={group.authorPhoto || 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120'} 
                                        alt={group.authorName} 
                                        className="w-full h-full rounded-full object-cover border border-zinc-950" 
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </button>
                                  <span className="text-[8.5px] font-mono text-zinc-400 max-w-[55px] truncate uppercase">{authorFirstName}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  }

                  if (sectionKey === 'pinned_items') {
                    const pinnedPosts = getMergedPosts()
                      .filter(p => pinnedPostIds.includes(p.id))
                      .sort((a, b) => pinnedPostIds.indexOf(a.id) - pinnedPostIds.indexOf(b.id));

                    if (pinnedPosts.length === 0 && !isCustomizingFeedLayout) return null;

                    return (
                      <div 
                        key="pinned_items" 
                        className="p-4 border-2 border-amber-500/30 bg-amber-950/10 backdrop-blur-md rounded-2xl space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Bookmark className="w-4 h-4 text-amber-400 fill-current" />
                            <span className="text-[10px] font-mono font-black text-amber-300 uppercase tracking-widest">
                              PINNED ACADEMIC VAULT
                            </span>
                            <span className="text-[8px] font-mono text-amber-500/80 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-bold">
                              {pinnedPosts.length} ITEMS (DRAG TO REORDER)
                            </span>
                          </div>
                        </div>

                        {pinnedPosts.length === 0 ? (
                          <div className="p-4 text-center border border-dashed border-amber-500/20 rounded-xl">
                            <p className="text-[9px] font-mono text-amber-400/70">
                              Bookmark any post with the pin icon to keep it here in your prioritized quick-access vault!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pinnedPosts.map((post, pIdx) => {
                              const isDragging = draggedPinnedId === post.id;
                              const isDragOver = dragOverPinnedId === post.id;

                              return (
                                <div
                                  key={`pinned-${post.id}`}
                                  draggable
                                  onDragStart={() => setDraggedPinnedId(post.id)}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (dragOverPinnedId !== post.id) setDragOverPinnedId(post.id);
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverPinnedId === post.id) setDragOverPinnedId(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedPinnedId && draggedPinnedId !== post.id) {
                                      handleReorderPinnedPosts(draggedPinnedId, post.id);
                                    }
                                    setDraggedPinnedId(null);
                                    setDragOverPinnedId(null);
                                  }}
                                  className={`p-3 rounded-xl border bg-zinc-950/80 transition flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing ${
                                    isDragging 
                                      ? 'opacity-40 border-dashed border-amber-400 bg-amber-500/10'
                                      : isDragOver
                                        ? 'border-amber-400 bg-amber-500/20 scale-[1.01]'
                                        : 'border-amber-500/20 hover:border-amber-500/40'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                    <GripVertical className="w-4 h-4 text-amber-500/60 hover:text-amber-400 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[9px] font-mono font-bold text-amber-400">
                                          #{pIdx + 1}
                                        </span>
                                        <span className="text-[8.5px] font-mono text-zinc-400 truncate">
                                          {post.authorName || 'Anonymous'}
                                        </span>
                                        {post.campus && (
                                          <span className="text-[7.5px] font-mono px-1 rounded bg-zinc-800 text-zinc-300">
                                            {post.campus}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10.5px] font-sans text-zinc-200 truncate mt-0.5">
                                        {post.content}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    <button
                                      onClick={() => {
                                        playGlitchClickSound();
                                        setActiveDiscussionPost(post);
                                      }}
                                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[9px] font-mono font-bold transition"
                                      title="Open Discussion"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => {
                                        playGlitchClickSound();
                                        togglePinPost(post.id);
                                      }}
                                      className="p-1.5 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 rounded-lg text-[9px] font-mono transition"
                                      title="Unpin"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (sectionKey === 'quick_actions') {
                    return (
                      <div key="quick_actions" className="py-2">
                        <div className="flex space-x-2 overflow-x-auto pb-1.5 scrollbar-none">
                          <button
                            onClick={() => { playGlitchClickSound(); setActiveTab('match'); handleStartMatching(); }}
                            className="flex items-center space-x-1.5 shrink-0 bg-[var(--color-background)] border border-[var(--neon-green-border)] hover:border-pink-500/40 rounded-full px-3.5 py-1.5 text-xs font-mono font-black uppercase text-pink-400 hover:text-[var(--color-text)] transition transform active:scale-95 shadow-[0_2px_10px_rgba(236,72,153,0.05)]"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
                            <span>Match Mate</span>
                          </button>

                          <button
                            onClick={() => {
                              playGlitchClickSound();
                              setSelectedCampus('Global Feed');
                              setSearchQuery('#exams');
                              setIsSearchOpen(true);
                            }}
                            className="flex items-center space-x-1.5 shrink-0 bg-[var(--color-background)] border border-[var(--neon-green-border)] hover:border-amber-500/40 rounded-full px-3.5 py-1.5 text-xs font-mono font-black uppercase text-amber-500 hover:text-[var(--color-text)] transition transform active:scale-95 shadow-[0_2px_10px_rgba(245,158,11,0.05)]"
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                            <span>Trending</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (sectionKey === 'trending_radar') {
                    return (
                      <div key="trending_radar" className="p-3 bg-[var(--color-surface)]/60 border border-[var(--neon-green-border)] rounded-2xl flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-base">📈</span>
                          <div>
                            <span className="text-[8.5px] font-mono uppercase font-black text-zinc-400 tracking-wider block">
                              Campus Spectrum Radar
                            </span>
                            <span className="text-[10px] font-mono text-[var(--neon-green)] font-bold">
                              Trending: #Exams #StudyRelay #LibraryLive #Hackathon
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            playGlitchClickSound();
                            setSearchQuery('#StudyRelay');
                            setIsSearchOpen(true);
                          }}
                          className="text-[8.5px] font-mono uppercase font-bold text-zinc-400 hover:text-[var(--neon-green)] px-2 py-1 rounded bg-black/40 border border-zinc-800"
                        >
                          Explore
                        </button>
                      </div>
                    );
                  }

                  if (sectionKey === 'posts_stream') {
                    return (
                      <div key="posts_stream" className="space-y-6">
                        {isFeedLoading ? (
                          <div className="space-y-4">
                            {isFeedPendingLong && (
                              <div className="p-4 border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md rounded-2xl flex items-center space-x-3.5 text-emerald-400 font-mono text-xs shadow-[0_0_20px_rgba(16,185,129,0.12)] transition-all">
                                <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-black tracking-wider uppercase text-[11px] text-emerald-300">
                                      Syncing with secure nodes...
                                    </span>
                                    <span className="text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-900/30 text-emerald-400 font-mono uppercase">
                                      LIVE PROTOCOL
                                    </span>
                                  </div>
                                  <p className="text-[9.5px] text-zinc-400 font-sans mt-0.5 leading-tight">
                                    Decrypting & streaming real-time campus feeds from decentralized cloud database relays.
                                  </p>
                                </div>
                              </div>
                            )}

                            {Array.from({ length: 3 }).map((_, idx) => (
                              <div key={idx} className="p-5 border border-[var(--neon-green-border)] bg-[var(--color-background)]/40 rounded-2xl space-y-4 animate-pulse">
                                <div className="flex items-center space-x-3">
                                  <div className="w-9 h-9 bg-[var(--color-surface)] rounded-full" />
                                  <div className="space-y-1.5 flex-1">
                                    <div className="h-3 bg-[var(--color-surface)] rounded w-1/4" />
                                    <div className="h-2 bg-[var(--color-surface)] rounded w-1/6" />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="h-3 bg-[var(--color-surface)] rounded w-full" />
                                  <div className="h-3 bg-[var(--color-surface)] rounded w-5/6" />
                                </div>
                                <div className="h-32 bg-[var(--color-surface)]/30 rounded-xl border border-[var(--neon-green-border)]" />
                              </div>
                            ))}
                          </div>
                        ) : getMergedPosts().length === 0 ? (
                          <div className="p-12 text-center bg-[var(--color-background)]/40 border-2 border-dashed border-[var(--neon-green-border)] rounded-2xl flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-full flex items-center justify-center text-zinc-500 font-mono text-lg font-black animate-bounce">
                              ?
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-mono font-black uppercase text-zinc-400">FEED SILENT / NO PACKETS FOUND</p>
                              <p className="text-[10px] font-sans text-zinc-500 max-w-xs leading-normal">
                                No dialogue contributions have been transmitted to the spectrum yet. Try posting a new packet!
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <AnimatePresence initial={false}>
                              {getMergedPosts().flatMap((post, index) => {
                                const commentsCount = post.commentsCount || 0;
                                const cards = [];

                                // Inject Smart Recommendation Card every 3 posts
                                if (index > 0 && index % 2 === 0) {
                                  cards.push(
                                    <motion.div
                                      key={`recommendation-${post.id || index}`}
                                      layout
                                      initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: -30 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                      className="p-5 border border-red-500/20 bg-[var(--color-background)]/85 rounded-2xl space-y-3 relative overflow-hidden shadow-xl animate-pulse-slow"
                                    >
                                      <div className="absolute top-0 right-0 p-1 px-2.5 bg-red-600/15 text-[7px] text-red-400 font-black uppercase tracking-widest font-mono">
                                        CAMPUS RECOMMENDATION
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-[8px] font-mono text-rose-400 font-bold block uppercase">⏱️ SCHOLASTIC countdown</span>
                                        <h4 className="text-sm font-black text-[var(--color-text)] font-mono uppercase">First Semester Exams</h4>
                                        <p className="text-[10px] text-zinc-400">Exams start in exactly 4 days. Connect with other students to study together!</p>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => { playGlitchClickSound(); setActiveTab('match'); handleStartMatching(); }}
                                            className="w-full text-center py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-[var(--color-text)] font-mono text-[9px] font-black uppercase rounded-lg transition shadow-md cursor-pointer font-sans"
                                          >
                                            Find study partner
                                          </button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                }

                                cards.push(
                                  <motion.div 
                                    key={post.id || `post-${index}`}
                          layout
                          initial={{ opacity: 0, scale: 0.95, y: 30 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -30 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          className="glass-panel gsap-scroll-card rounded-[20px] overflow-hidden relative transition-all duration-350 hover:scale-[1.01] hover:border-white/20 shadow-xl"
                          onDoubleClick={(e) => handleDoubleTapLike(post.id, e)}
                        >
                      {/* Interactive Heart Burst Layer */}
                      <AnimatePresence>
                        {(heartBursts[post.id] || []).map(hb => (
                          <motion.div
                            key={hb.id}
                            initial={{ scale: 0, opacity: 0.8 }}
                            animate={{ scale: [1, 2.2, 1.8], opacity: [0.8, 1, 0] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            style={{ position: 'absolute', left: hb.x - 30, top: hb.y - 30, zIndex: 50, pointerEvents: 'none' }}
                            className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                          >
                            <Heart className="w-16 h-16 fill-red-500 stroke-red-600" />
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* Header */}
                      <div className="p-4 flex items-center justify-between border-b border-zinc-950">
                        <div className="flex items-center space-x-3">
                          <img
                            src={post.authorPhoto}
                            alt={post.authorName}
                            onClick={() => triggerViewProfile(post.authorId)}
                            className="w-10 h-10 rounded-full object-cover border border-[var(--neon-green-border)] cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h4 
                                onClick={() => triggerViewProfile(post.authorId)}
                                className="text-xs font-mono font-black text-[var(--color-text)] cursor-pointer hover:text-[var(--neon-green)] transition uppercase"
                              >
                                {post.authorName}
                              </h4>
                              <span className="text-[7.5px] bg-[var(--color-surface)] text-zinc-400 border border-[var(--neon-green-border)] px-1.5 rounded-full uppercase tracking-tight font-mono">
                                {(post.school || 'Global').split(' ')[0]}
                              </span>
                            </div>
                            <span className="text-[7.5px] font-mono text-zinc-500">
                              {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                          </div>
                        </div>

                        {post.type === 'academic' && (
                          <span className="text-[8px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                            📚 STUDY NOTE
                          </span>
                        )}
                        {post.type === 'poll' && (
                          <span className="text-[8px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase">
                            📊 POLL
                          </span>
                        )}
                        {post.type === 'question' && (
                          <span className="text-[8px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase">
                            ❓ QUESTION
                          </span>
                        )}
                      </div>

                      {/* Post Middle Content */}
                      <div className="p-4 space-y-3">
                        <p className="text-xs font-sans text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
                          {post.content}
                        </p>

                        {/* Poll interactive options */}
                        {post.type === 'poll' && post.pollOptions && (
                          <div className="space-y-2 pt-2">
                            {post.pollOptions.map((opt: string, oi: number) => {
                              const totalVotes = (post.pollVotes || [0, 0]).reduce((a: number, b: number) => a + b, 0) || 1;
                              const votesCount = (post.pollVotes || [0, 0])[oi] || 0;
                              const percentage = Math.round((votesCount / totalVotes) * 100);
                              
                              return (
                                <div 
                                  key={oi}
                                  onClick={() => handleVotePoll(post.id, oi)}
                                  className="relative border border-zinc-850 bg-[var(--color-surface)] hover:border-zinc-700 rounded-lg p-3 text-xs font-mono font-bold cursor-pointer transition select-none overflow-hidden"
                                >
                                  <div 
                                    className="absolute left-0 top-0 bottom-0 bg-amber-500/15 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                  <div className="relative z-10 flex items-center justify-between">
                                    <span className="text-[var(--color-text)]">{opt}</span>
                                    <span className="text-amber-400">{percentage}% ({votesCount})</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Media displays */}
                        {post.imageUrl && (
                          <div 
                            onClick={() => setZoomImg(post.imageUrl)}
                            className="rounded-lg overflow-hidden border border-zinc-950 cursor-zoom-in max-h-80"
                          >
                            <LazyImage 
                              src={post.imageUrl} 
                              alt="Campus feed attachment" 
                              className="w-full h-full object-cover hover:opacity-95 transition"
                            />
                          </div>
                        )}

                        {/* Deepened Video / Reel / Instagram Playback Handler */}
                        {post.videoUrl && (() => {
                          const url = post.videoUrl.trim();
                          const isInstagram = url.includes('instagram.com');
                          const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
                          
                          if (isInstagram) {
                            // Extract code from Instagram url (e.g., instagram.com/reel/C8a123bc/ -> /reel/C8a123bc/embed)
                            const igMatch = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
                            const igEmbedUrl = igMatch ? `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed/captioned/` : `${url}/embed/`;
                            
                            return (
                              <div className="rounded-xl overflow-hidden border border-[var(--neon-green-border)] bg-white relative w-full aspect-[4/5] max-h-[500px] shadow-lg flex flex-col">
                                <div className="bg-zinc-50 border-b border-zinc-100 px-3 py-2 flex items-center justify-between text-[8px] font-mono font-bold text-zinc-500 uppercase">
                                  <span>📷 INSTAGRAM REEL ATTACHMENT</span>
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    OPEN IN INSTAGRAM →
                                  </a>
                                </div>
                                <iframe
                                  src={igEmbedUrl}
                                  className="w-full h-full flex-1"
                                  allowFullScreen={true}
                                  frameBorder="0"
                                  scrolling="no"
                                  title="Instagram Reel"
                                ></iframe>
                              </div>
                            );
                          } else if (isYoutube) {
                            // Extract video ID from YouTube
                            let ytId = '';
                            if (url.includes('youtu.be/')) {
                              ytId = url.split('youtu.be/')[1]?.split('?')[0] || '';
                            } else if (url.includes('v=')) {
                              ytId = url.split('v=')[1]?.split('&')[0] || '';
                            } else if (url.includes('embed/')) {
                              ytId = url.split('embed/')[1]?.split('?')[0] || '';
                            }
                            
                            const ytEmbedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=0&mute=0&rel=0`;
                            
                            return (
                              <div className="rounded-xl overflow-hidden border border-[var(--neon-green-border)] bg-[var(--color-surface)] relative w-full aspect-video shadow-lg">
                                <iframe
                                  src={ytEmbedUrl}
                                  className="w-full h-full"
                                  allowFullScreen={true}
                                  frameBorder="0"
                                  title="YouTube Video"
                                ></iframe>
                              </div>
                            );
                          } else {
                            // Fallback to standard premium looping video player for raw MP4/WebM files
                            return (
                              <div className="rounded-xl overflow-hidden border border-[var(--neon-green-border)] bg-[var(--color-surface)] relative max-h-96 flex items-center justify-center shadow-lg">
                                <video
                                  src={post.videoUrl}
                                  autoPlay
                                  loop
                                  muted={reelsMuted}
                                  playsInline
                                  className="w-full h-full object-cover max-h-96"
                                />
                                {/* Controls */}
                                <div className="absolute bottom-3 right-3 flex space-x-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playGlitchClickSound();
                                      setReelsMuted(!reelsMuted);
                                    }}
                                    className="p-2 bg-[var(--color-surface)]/70 hover:bg-[var(--color-surface)] text-[var(--color-text)] rounded-full transition shadow"
                                  >
                                    {reelsMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </div>

                      {/* Bottom action panel */}
                      <div className="p-3.5 bg-[var(--color-surface)]/40 border-t border-zinc-950 flex items-center justify-between text-zinc-500 text-[10px] font-mono">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => handleLikeTrigger(post)}
                            className="flex items-center space-x-1 hover:text-red-500 transition active:scale-90"
                          >
                            <Heart className={`w-4 h-4 ${post.likesCount > 0 ? 'text-red-500 fill-red-500' : ''}`} />
                            <span className="font-bold text-zinc-400">{post.likesCount || 0}</span>
                          </button>

                          <button
                            onClick={() => { playGlitchClickSound(); setActiveDiscussionPost(post); }}
                            className="flex items-center space-x-1 hover:text-[var(--neon-green)] transition"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span className="font-bold text-zinc-400">{commentsCount}</span>
                          </button>
                        </div>

                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => {
                              playGlitchClickSound();
                              triggerVibration('light');
                              navigator.clipboard.writeText(`https://flick.app/posts/${post.id}`);
                              showBrutalistToast('COPIED ✓', 'Direct link copied to student terminal clipboard!', 'success');
                            }}
                            className="hover:text-blue-400 transition cursor-pointer"
                            title="Share Link"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              playGlitchClickSound();
                              triggerVibration('medium');
                              togglePinPost(post.id);
                            }}
                            className={`transition cursor-pointer p-1 rounded-lg ${
                              pinnedPostIds.includes(post.id) 
                                ? 'text-amber-400 bg-amber-950/30' 
                                : 'hover:text-amber-400 text-zinc-500'
                            }`}
                            title={pinnedPostIds.includes(post.id) ? "Unpin from Vault" : "Pin to Academic Vault (Drag to Reorder)"}
                          >
                            <Bookmark className={`w-4 h-4 ${pinnedPostIds.includes(post.id) ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );

                  return cards;
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      );
    }

    return null;
  })}
</div>
)}
</div>
</div>
)}

        {/* ==================== MATCH TAB VIEW ==================== */}
        {activeTab === 'match' && (
          <div
            key="match"
            className="w-full h-full overflow-y-auto flex flex-col px-4 py-3 pb-24 md:pb-0 select-text"
            style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <div className="space-y-5">
              <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 font-black block border-l border-pink-500 pl-1.5">
                OMEGLE-LIKE CAMPUS MATCHER
              </span>

              {isMatching ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-pink-500/10 animate-ping"></span>
                    <span className="absolute inset-4 rounded-full bg-pink-500/20 animate-pulse"></span>
                    <div className="w-12 h-12 bg-pink-600 rounded-full flex items-center justify-center text-[var(--color-text)]">
                      <Sparkles className="w-6 h-6 animate-spin" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--color-text)] uppercase font-mono">SEARCHING REMOTE CLASSROOMS...</h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1">ALIGNING ENCRYPTION TUNNEL TO SAME INTERESTS</p>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-48 bg-[var(--color-background)] h-1 rounded-full overflow-hidden border border-[var(--neon-green-border)]">
                    <div className="bg-pink-500 h-full transition-all duration-300" style={{ width: `${matchProgress}%` }}></div>
                  </div>
                </div>
              ) : isMatchedActive && matchPartner ? (
                <div className="space-y-4">
                  {/* Met matched peer panel */}
                  <div className="p-4 bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img src={matchPartner.photoURL} alt="" className="w-10 h-10 rounded-full border border-pink-500 object-cover" />
                      <div>
                        <h4 className="text-xs font-mono font-black text-[var(--color-text)]">MATCHED CLASSMATE</h4>
                        <p className="text-[8px] text-zinc-400 uppercase font-mono tracking-wider">
                          {matchPartner.displayName} // {matchPartner.school || 'Unilag'}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleStartMatching}
                      className="p-2 bg-pink-600/15 hover:bg-pink-600 text-pink-500 hover:text-[var(--color-text)] border border-pink-500/20 rounded-lg text-[9px] uppercase font-black transition font-mono"
                    >
                      [ NEXT MATCH ]
                    </button>
                  </div>

                  {/* Simulated Chat Feed */}
                  <div className="h-80 bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-4 overflow-y-auto space-y-3 font-mono text-[11px] flex flex-col justify-end">
                    {matchMessages.map((m, mi) => (
                      <div key={mi} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-2.5 rounded-lg ${m.sender === 'me' ? 'bg-pink-600 text-[var(--color-text)]' : 'bg-[var(--color-surface)] text-zinc-300'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat action input */}
                  <form onSubmit={handleSendMatchMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={matchInput}
                      onChange={(e) => setMatchInput(e.target.value)}
                      placeholder="Type encrypted classmate transmission..."
                      className="flex-1 bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-xl px-4 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-pink-500 focus:ring-0"
                    />
                    <button
                      type="submit"
                      className="p-3 bg-pink-600 hover:bg-pink-500 text-[var(--color-text)] rounded-xl transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-6 border border-[var(--neon-green-border)] bg-[var(--color-background)]/60 rounded-xl space-y-5 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-pink-500" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-xs font-mono font-black text-[var(--color-text)] uppercase">CONNECT TO VERIFIED CAMPUS NODES</h3>
                    <p className="text-[10px] text-zinc-400">Match with random active students matching your department or community.</p>
                  </div>

                  {/* Filter configurations */}
                  <div className="grid grid-cols-2 gap-2 text-left pt-2 font-mono text-[10px]">
                    <div>
                      <span className="block text-zinc-500 uppercase mb-1 font-bold">SCHOOL TARGET:</span>
                      <select
                        value={matchSchoolFilter}
                        onChange={(e) => setMatchSchoolFilter(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] p-2 text-[var(--color-text)] focus:outline-none rounded text-[9.5px]"
                      >
                        <option value="any">ANY CAMPUS</option>
                        <option value="University of Lagos">UNILAG</option>
                        <option value="Covenant University">COVENANT</option>
                        <option value="Babcock University">BABCOCK</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-zinc-500 uppercase mb-1 font-bold">INTEREST STACK:</span>
                      <select
                        value={matchInterestFilter}
                        onChange={(e) => setMatchInterestFilter(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] p-2 text-[var(--color-text)] focus:outline-none rounded text-[9.5px]"
                      >
                        <option value="General Chat">GENERAL STUDY</option>
                        <option value="CSC301">CSC CODING</option>
                        <option value="Calculus">CALCULUS COHORT</option>
                        <option value="Campus Gossip">CAMPUS gossip</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleStartMatching}
                    className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-[var(--color-text)] font-mono text-xs font-black uppercase rounded-lg transition"
                  >
                    [ INITIATE SECURE MATCHING ]
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== PROFILE TAB VIEW ==================== */}
        {activeTab === 'profile' && (
          <div
            key="profile"
            className="w-full h-full overflow-y-auto flex flex-col p-2 sm:p-4 pb-28 md:pb-4 select-text"
            style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <BentoProfile
              profile={profile}
              firebasePosts={firebasePosts}
              deletePost={deletePost}
              currentCover={currentCover}
              setCurrentCover={setCurrentCover}
              showCoverSelector={showCoverSelector}
              setShowCoverSelector={setShowCoverSelector}
              playGlitchClickSound={playGlitchClickSound}
              triggerVibration={triggerVibration}
              showBrutalistToast={showBrutalistToast}
            />
          </div>
        )}

        {/* ==================== SECURE CRYPTO CHATS TAB ==================== */}
        {activeTab === 'chat' && (
          <div
            key="chat"
            className="w-full h-full min-h-0 min-w-0 flex flex-col bg-[var(--color-surface)] overflow-hidden"
          >
            <div className="flex-1 min-h-0 min-w-0 h-full overflow-hidden flex flex-col">
              <ChatSection 
                deepLinkedPeerId={deepLinkedPeerId} 
                onClearDeepLink={onClearDeepLink} 
                deepLinkedGroupId={deepLinkedGroupId}
                onClearDeepLinkedGroup={onClearDeepLinkedGroup}
              />
            </div>
          </div>
        )}

        {/* ==================== WORKSPACE HUB TAB ==================== */}
        {activeTab === 'workspace' && (
          <div
            key="workspace"
            className="w-full h-full min-h-0 overflow-y-auto flex flex-col p-2 sm:p-4 pb-28 md:pb-4"
            style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <div className="flex-1 min-h-0 flex flex-col">
              <WorkspaceHub />
            </div>
          </div>
        )}

        {/* ==================== FLICK REAL NEWS WIRE TAB (NO AI) ==================== */}
        {activeTab === 'news' && (
          <div
            key="news"
            className="w-full h-full overflow-y-auto flex flex-col p-0 pb-20 md:pb-4 select-text"
            style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <div className="flex-1 flex flex-col">
              <NewsSection
                currentUser={profile}
                deepLinkedArticleId={deepLinkedNewsId}
                onClearDeepLink={onClearDeepLinkedNews}
                onShareToTimeline={async (article, comment) => {
                  try {
                    await createPost({
                      authorId: profile?.uid || 'anon',
                      authorName: profile?.displayName || 'Citizen',
                      authorPhoto: profile?.photoURL || 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120',
                      content: `[REPOST FROM FLICK NEWS: ${article.sourceName}]\n${article.title}\n\n${comment ? `"${comment}"\n\n` : ''}${article.excerpt}\n\nRead original: ${article.articleUrl}`,
                      imageUrl: article.imageUrl || undefined,
                      mediaType: article.imageUrl ? 'image' : 'none'
                    });
                    showBrutalistToast('DEPLOYED ✓', 'News repost deployed to FLICK social feed!', 'success');
                  } catch (e) {
                    console.warn('Failed to repost news article to timeline:', e);
                  }
                }}
              />
            </div>
          </div>
        )}
        </AnimatePresence>

      </div>

      {/* =================================== SECTION 6 — FLOATING COMPOSE BUTTON WITH SPRING RADIAL MENU =================================== */}
      {activeTab === 'home' && (
        <div className="fixed bottom-24 right-6 z-50">
          <AnimatePresence>
            {isRadialOpen && (
              <div className="absolute bottom-16 right-0 flex flex-col space-y-3.5 items-end">
                
                {/* Option 1: Social Post */}
                <motion.button
                  initial={{ scale: 0, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, y: 15 }}
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setPostCreatorType('social');
                    setPostAnon(false);
                    setShowPostCreator(true);
                    setIsRadialOpen(false);
                  }}
                  className="flex items-center space-x-2 bg-[var(--color-background)] border border-[var(--neon-green-border)] hover:border-[var(--neon-green)] p-2.5 rounded-full text-[10px] font-mono uppercase font-black text-[var(--color-text)] cursor-pointer transition shadow-2xl"
                >
                  <span>PUBLISH POST</span>
                  <span className="p-1.5 bg-[var(--neon-green)] text-black rounded-full"><ImageIcon className="w-3.5 h-3.5" /></span>
                </motion.button>

                {/* Option 2: Story */}
                <motion.button
                  initial={{ scale: 0, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, y: 15 }}
                  transition={{ delay: 0.05 }}
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setIsRadialOpen(false);
                    setPostCreatorType('story');
                    setShowPostCreator(true);
                  }}
                  className="flex items-center space-x-2 bg-[var(--color-background)] border border-[var(--neon-green-border)] hover:border-[var(--neon-green)] p-2.5 rounded-full text-[10px] font-mono uppercase font-black text-[var(--color-text)] cursor-pointer transition shadow-2xl"
                >
                  <span>BROADCAST STORY</span>
                  <span className="p-1.5 bg-amber-500 text-black rounded-full"><Sparkles className="w-3.5 h-3.5" /></span>
                </motion.button>


              </div>
            )}
          </AnimatePresence>

          {/* Floating toggle button */}
          <button
            onClick={() => { playGlitchClickSound(); triggerVibration('medium'); setIsRadialOpen(!isRadialOpen); }}
            className="w-13 h-13 bg-[var(--neon-green)] hover:bg-white text-black rounded-full flex items-center justify-center shadow-2xl transition transform hover:scale-105 active:scale-95"
          >
            <Plus className={`w-6 h-6 transition-transform duration-300 ${isRadialOpen ? 'rotate-45' : ''}`} />
          </button>
        </div>
      )}

      {/* =================================== SEARCH MODAL =================================== */}
      <AnimatePresence>
        {isSearchOpen && (
          <div data-overlay="true" className="fixed inset-0 bg-[var(--color-surface)]/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-4 border-b border-[var(--neon-green-border)] flex items-center justify-between">
                <span className="text-[9px] font-mono font-black uppercase text-[var(--neon-green)]">Spotlight search</span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="p-1 text-zinc-400 hover:text-[var(--color-text)] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Input */}
              <div className="p-4 border-b border-[var(--neon-green-border)]/40 relative">
                <Search className="absolute left-7 top-7 text-zinc-500 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter courses, groups, people, hashtags..."
                  className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] focus:ring-0"
                  autoFocus
                />
              </div>

              {/* Results list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {searchQuery ? (
                  <>
                    {/* Posts filter */}
                    <div className="space-y-2">
                      <span className="text-[8px] font-mono text-zinc-500 font-bold uppercase">MATCHING CONCURSIONS</span>
                      {getMergedPosts()
                        .filter(p => p.content.toLowerCase().includes(searchQuery.toLowerCase()) || p.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((post, pi) => (
                          <div 
                            key={pi}
                            onClick={() => {
                              setActiveDiscussionPost(post);
                              setIsSearchOpen(false);
                            }}
                            className="p-3 bg-[var(--color-surface)]/40 hover:bg-[var(--color-surface)] rounded-lg cursor-pointer transition flex items-center justify-between text-xs font-mono"
                          >
                            <span className="truncate text-zinc-300 max-w-[200px]">{post.content}</span>
                            <span className="text-zinc-500 text-[8px] uppercase">{post.authorName}</span>
                          </div>
                      ))}
                    </div>

                    {/* Students Filter */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[8px] font-mono text-zinc-500 font-bold uppercase">MATCHING STUDENTS</span>
                      {registeredUsers
                        .filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((user, ui) => (
                          <div 
                            key={ui}
                            onClick={() => {
                              triggerViewProfile(user.uid);
                              setIsSearchOpen(false);
                            }}
                            className="p-3 bg-[var(--color-surface)]/40 hover:bg-[var(--color-surface)] rounded-lg cursor-pointer transition flex items-center justify-between text-xs font-mono"
                          >
                            <span className="text-[var(--color-text)] font-bold">{user.displayName}</span>
                            <span className="text-zinc-500 text-[8px] uppercase">{user.email}</span>
                          </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-10 text-center text-zinc-500 italic text-xs font-serif">
                    Type a query above to explore remote campus logs.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* =================================== STORY VIEWERS FULL SCREEN =================================== */}
      <AnimatePresence>
        {activeStoryGroupId !== null && (
          <div data-overlay="true" className="fixed inset-0 bg-[var(--color-surface)]/98 z-[200] flex items-center justify-center p-4">
            {(() => {
              const groups = getGroupedStories();
              const currentGroup = groups.find(g => g.authorId === activeStoryGroupId);
              if (!currentGroup) return null;

              const activeStory = currentGroup.stories[activeStoryIndexInGroup];
              if (!activeStory) return null;

              const groupIdx = groups.findIndex(g => g.authorId === activeStoryGroupId);

              return (
                <div className="relative flex items-center justify-center w-full max-w-lg">
                  {/* Desktop Prev Button */}
                  {(groupIdx > 0 || activeStoryIndexInGroup > 0) && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePrevStory(); }}
                      className="hidden md:flex absolute -left-16 p-3 bg-[var(--color-surface)]/60 hover:bg-zinc-800 text-[var(--color-text)] border border-[var(--neon-green-border)] rounded-full hover:scale-110 transition z-50 cursor-pointer animate-fade-in"
                      title="Previous Story"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Central Story Card */}
                  <div className="w-full max-w-md h-[90vh] bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden relative flex flex-col justify-between shadow-2xl">
                    {/* Progress Indicators */}
                    <div className={`absolute top-4 left-4 right-4 z-50 flex gap-1.5 transition-opacity duration-300 ${isStoryPaused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                      {currentGroup.stories.map((s, idx) => (
                        <div key={s.id || idx} className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--neon-green)] transition-all duration-100"
                            style={{
                              width: idx < activeStoryIndexInGroup 
                                ? '100%' 
                                : idx === activeStoryIndexInGroup 
                                  ? `${storyProgress}%` 
                                  : '0%'
                            }} 
                          />
                        </div>
                      ))}
                    </div>

                    {/* Header bar */}
                    <div className={`p-4 pt-8 flex items-center justify-between relative z-40 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${isStoryPaused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                      <div className="flex items-center space-x-2.5">
                        <img src={currentGroup.authorPhoto} alt="" className="w-8 h-8 rounded-full border border-[var(--neon-green-border)] object-cover" />
                        <div>
                          <h4 className="text-xs font-mono font-black text-[var(--color-text)] uppercase">{currentGroup.authorName}</h4>
                          <span className="text-[7.5px] text-[var(--neon-green)] uppercase font-mono tracking-wider">CAMPUS INTEL NETWORK</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveStoryGroupId(null)}
                        className="p-1 bg-[var(--color-surface)]/45 rounded-full text-zinc-400 hover:text-[var(--color-text)] transition cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Main display & Tap/Hold areas */}
                    <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden select-none">
                      {/* Transparent Navigation & Pause Areas (Overlay) */}
                      <div className="absolute inset-0 z-20 flex" onTouchMove={handleStoryTouchMove}>
                        <div 
                          onMouseDown={handleStoryMouseDown}
                          onMouseUp={(e) => handleStoryMouseUp(e, 'left')}
                          onMouseLeave={() => { clearTimeout(storyHoldTimeoutRef.current); setIsStoryPaused(false); }}
                          onTouchStart={handleStoryTouchStart}
                          onTouchEnd={(e) => handleStoryTouchEnd(e, 'left')}
                          className="w-1/3 h-full cursor-w-resize"
                          title="Tap to go back"
                        />
                        <div 
                          onMouseDown={handleStoryMouseDown}
                          onMouseUp={(e) => handleStoryMouseUp(e, 'right')}
                          onMouseLeave={() => { clearTimeout(storyHoldTimeoutRef.current); setIsStoryPaused(false); }}
                          onTouchStart={handleStoryTouchStart}
                          onTouchEnd={(e) => handleStoryTouchEnd(e, 'right')}
                          className="w-2/3 h-full cursor-e-resize"
                          title="Tap or hold to skip/pause"
                        />
                      </div>

                      {/* Immersive multi-media content rendering with transition */}
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${activeStory.id}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.03 }}
                          transition={{ duration: 0.25 }}
                          className="absolute inset-0 w-full h-full flex flex-col justify-center items-center p-6 text-center"
                        >
                          {activeStory.mediaType === 'image' && activeStory.imageUrl ? (
                            <div className="absolute inset-0 w-full h-full flex flex-col justify-center items-center relative overflow-hidden pointer-events-none">
                              <img src={activeStory.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 blur-lg scale-115" referrerPolicy="no-referrer" />
                              <img src={activeStory.imageUrl} alt="" className="relative z-10 max-w-full max-h-[60vh] object-contain rounded-xl border border-[var(--neon-green-border)] shadow-2xl" referrerPolicy="no-referrer" />
                              {activeStory.content && (
                                <p className="relative z-10 text-xs font-mono text-[var(--color-text)] leading-relaxed mt-4 bg-[var(--color-surface)]/60 px-3 py-1.5 rounded-lg border border-[var(--neon-green-border)] max-w-[85%]">{activeStory.content}</p>
                              )}
                            </div>
                          ) : activeStory.mediaType === 'video' && activeStory.videoUrl ? (
                            <div className="absolute inset-0 w-full h-full flex flex-col justify-center items-center relative overflow-hidden pointer-events-none">
                              <div className="absolute inset-0 bg-[var(--color-surface)]/40 z-0" />
                              <video 
                                ref={videoRef}
                                src={activeStory.videoUrl} 
                                className="relative z-10 max-w-full max-h-[60vh] object-contain rounded-xl border border-[var(--neon-green-border)] shadow-2xl"
                                autoPlay
                                loop
                                muted
                                playsInline
                              />
                              {activeStory.content && (
                                <p className="relative z-10 text-xs font-mono text-[var(--color-text)] leading-relaxed mt-4 bg-[var(--color-surface)]/60 px-3 py-1.5 rounded-lg border border-[var(--neon-green-border)] max-w-[85%]">{activeStory.content}</p>
                              )}
                            </div>
                          ) : activeStory.mediaType === 'audio' && activeStory.audioUrl ? (
                            <div className="absolute inset-0 w-full h-full flex flex-col justify-center items-center bg-[var(--color-background)] p-6">
                              <audio 
                                ref={audioRef}
                                src={activeStory.audioUrl}
                                autoPlay
                                loop
                              />
                              <div className="flex flex-col items-center justify-center space-y-6 relative z-10 pointer-events-none">
                                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-zinc-800 via-zinc-900 to-black border-4 border-[var(--neon-green-border)] shadow-2xl flex items-center justify-center animate-spin" style={{ animationDuration: '10s' }}>
                                  <div className="w-12 h-12 rounded-full bg-[var(--neon-green)] flex items-center justify-center border-4 border-zinc-950">
                                    <Volume2 className="w-5 h-5 text-black" />
                                  </div>
                                </div>
                                <div className="text-center space-y-1">
                                  <h4 className="text-sm font-mono font-black text-[var(--neon-green)] uppercase tracking-wider">{activeStory.musicTitle || 'Flick Soundscape'}</h4>
                                  <p className="text-[10px] font-mono text-zinc-500 uppercase">{activeStory.musicArtist || 'Campus Node Broadcast'}</p>
                                </div>
                                {activeStory.content && (
                                  <p className="text-sm font-serif italic text-[var(--color-text)] leading-relaxed max-w-xs whitespace-pre-wrap mt-2">
                                    "{activeStory.content}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Text-only story or fallback */
                            <div className={`absolute inset-0 w-full h-full flex flex-col justify-center items-center p-6 ${
                              activeStory.gradientPreset === 'sunset' ? 'bg-gradient-to-tr from-orange-600 to-rose-600' :
                              activeStory.gradientPreset === 'cosmic' ? 'bg-gradient-to-tr from-purple-800 via-violet-900 to-fuchsia-800' :
                              activeStory.gradientPreset === 'emerald' ? 'bg-gradient-to-tr from-emerald-600 to-teal-800' :
                              activeStory.gradientPreset === 'amber' ? 'bg-gradient-to-tr from-amber-500 to-red-600' :
                              activeStory.gradientPreset === 'slate' ? 'bg-gradient-to-tr from-zinc-900 to-slate-800' :
                              activeStory.gradientPreset === 'neon' ? 'bg-gradient-to-tr from-black via-zinc-900 to-[var(--neon-green)]/40' :
                              'bg-gradient-to-tr from-orange-600 to-rose-600' /* default sunset */
                            }`}>
                              <p className="text-lg md:text-xl font-mono font-black text-[var(--color-text)] leading-relaxed max-w-xs whitespace-pre-wrap select-none pointer-events-none drop-shadow-lg">
                                {activeStory.content}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Bottom interactions replies */}
                    <div className={`p-4 bg-gradient-to-t from-black to-transparent space-y-3 relative z-40 transition-opacity duration-300 ${isStoryPaused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                      <div className="flex gap-2 justify-center py-2 text-xl select-none">
                        {['🔥', '❤️', '😂', '😮'].map(em => (
                          <button
                            key={em}
                            onClick={() => {
                              playGlitchClickSound();
                              triggerVibration('medium');
                              showBrutalistToast('REACTION SENT', `Dispatched story reaction: ${em}!`, 'success');
                            }}
                            className="hover:scale-125 transition cursor-pointer"
                          >
                            {em}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={`Reply directly to ${(currentGroup.authorName || 'User').split(' ')[0]}...`}
                          className="flex-1 bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-full px-4 py-2 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] focus:ring-0"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              playGlitchClickSound();
                              triggerVibration('medium');
                              showBrutalistToast('REPLY SENT', 'Direct story reply dispatched successfully!', 'success');
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Desktop Next Button */}
                  {(groupIdx < groups.length - 1 || activeStoryIndexInGroup < currentGroup.stories.length - 1) && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleNextStory(); }}
                      className="hidden md:flex absolute -right-16 p-3 bg-[var(--color-surface)]/60 hover:bg-zinc-800 text-[var(--color-text)] border border-[var(--neon-green-border)] rounded-full hover:scale-110 transition z-50 cursor-pointer animate-fade-in"
                      title="Next Story"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>



      {/* =================================== POST CREATOR DRAWER/MODAL =================================== */}
      <AnimatePresence>
        {showPostCreator && (
          <div data-overlay="true" className="fixed inset-0 bg-[var(--color-surface)]/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-4 border-b border-[var(--neon-green-border)] flex items-center justify-between">
                <span className="text-[9px] font-mono font-black uppercase text-[var(--neon-green)]">
                  DEPLOY {postCreatorType.toUpperCase()} PACKET
                </span>
                
                <button
                  onClick={() => setShowPostCreator(false)}
                  className="p-1 text-zinc-400 hover:text-[var(--color-text)] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category tabs inside creator */}
              {postCreatorType !== 'story' ? (
                <div className="flex bg-[var(--color-surface)] border-b border-[var(--neon-green-border)] text-[9px] font-mono font-bold text-zinc-500 uppercase overflow-x-auto scrollbar-none shrink-0">
                  {(['social', 'academic', 'question', 'poll'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setPostCreatorType(t)}
                      className={`flex-1 py-3 text-center border-b-2 transition ${
                        postCreatorType === t 
                          ? 'border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--neon-green)]/5 font-black' 
                          : 'border-transparent'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex bg-[var(--color-surface)] border-b border-[var(--neon-green-border)] text-[9px] font-mono font-bold text-zinc-500 uppercase overflow-x-auto scrollbar-none shrink-0">
                  {(['text', 'image', 'video', 'audio'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        playGlitchClickSound();
                        setStoryType(t);
                      }}
                      className={`flex-1 py-3 text-center border-b-2 transition ${
                        storyType === t 
                          ? 'border-[var(--neon-green)] text-[var(--neon-green)] bg-[var(--neon-green)]/5 font-black' 
                          : 'border-transparent'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="space-y-1.5">
                  <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">
                    {postCreatorType === 'story' ? `${storyType.toUpperCase()} story content / CAPTION:` : 'Transmission Content:'}
                  </span>
                  <textarea
                    value={postCreatorType === 'story' ? storyContent : postContent}
                    onChange={(e) => postCreatorType === 'story' ? setStoryContent(e.target.value) : setPostContent(e.target.value)}
                    placeholder={
                      postCreatorType === 'story' 
                        ? storyType === 'text'
                          ? "What is flickering on your mind today? (Type your text story)..."
                          : `Write a caption for your ${storyType} story (optional)...`
                        : postCreatorType === 'academic' 
                          ? "Write academic notes, homework help steps or solved quiz explanations..."
                          : postCreatorType === 'question'
                            ? "What textbook topics, calculus integrals, or homework assignments are you stuck with?..."
                            : "Write what's flickering across campus nodes..."
                    }
                    rows={4}
                    className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] focus:ring-0 resize-none leading-relaxed"
                  />
                </div>

                {/* Specific controls per story type or general post attachments */}
                <div className="grid grid-cols-1 gap-4">
                  {postCreatorType === 'story' ? (
                    <>
                      {/* Text story background picker */}
                      {storyType === 'text' && (
                        <div className="space-y-2.5 animate-fade-in">
                          <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">CHOOSE STORY BACKGROUND GRADIENT:</span>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { id: 'sunset', css: 'from-orange-600 to-rose-600' },
                              { id: 'cosmic', css: 'from-purple-800 via-violet-900 to-fuchsia-800' },
                              { id: 'emerald', css: 'from-emerald-600 to-teal-800' },
                              { id: 'amber', css: 'from-amber-500 to-red-600' },
                              { id: 'slate', css: 'from-zinc-900 to-slate-800' },
                              { id: 'neon', css: 'from-black via-zinc-900 to-[var(--neon-green)]/40' }
                            ].map(preset => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  playGlitchClickSound();
                                  setStoryGradientPreset(preset.id);
                                }}
                                className={`w-8 h-8 rounded-full bg-gradient-to-tr ${preset.css} border-2 transition transform active:scale-95 ${
                                  storyGradientPreset === preset.id ? 'border-white scale-110 shadow-lg' : 'border-[var(--neon-green-border)]'
                                }`}
                                title={preset.id}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Image story uploader */}
                      {storyType === 'image' && (
                        <div className="space-y-1.5 animate-fade-in">
                          <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">
                            ATTACH IMAGE (DIRECT FILE UPLOAD):
                          </span>
                          <div className="relative border-2 border-dashed border-[var(--neon-green-border)] rounded-xl p-5 bg-[var(--color-surface)] hover:border-[var(--neon-green)]/40 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[110px]">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const compressed = await compressImage(file, 800, 800, 0.65);
                                    setStoryImg(compressed);
                                  } catch (err) {
                                    console.warn("Failed to compress image, falling back to original:", err);
                                    const reader = new FileReader();
                                    reader.onload = (uploadEvent) => {
                                      setStoryImg(uploadEvent.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />
                            {storyImg ? (
                              <div className="space-y-2 relative z-20">
                                <img
                                  src={storyImg}
                                  alt="Story preview"
                                  className="max-h-24 mx-auto rounded-lg object-cover border border-[var(--neon-green-border)]"
                                />
                                <p className="text-[9px] text-[var(--neon-green)] font-mono font-bold uppercase tracking-wider animate-pulse">
                                  ✓ Image Ready for Deployment
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStoryImg('');
                                  }}
                                  className="text-[9px] text-red-500 hover:underline font-mono uppercase font-black"
                                >
                                  [ Remove Image ]
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Upload className="w-5 h-5 text-zinc-500 mx-auto mb-1 animate-bounce" />
                                <p className="text-[10px] text-zinc-300 font-mono font-bold uppercase">
                                  Click or drag file to upload
                                </p>
                                <p className="text-[8px] text-zinc-600 font-mono">
                                  PNG, JPG, GIF up to 5MB (Base64 secured)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Video story uploader */}
                      {storyType === 'video' && (
                        <div className="space-y-1.5 animate-fade-in">
                          <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">
                            ATTACH VIDEO (DIRECT FILE UPLOAD):
                          </span>
                          <div className="relative border-2 border-dashed border-[var(--neon-green-border)] rounded-xl p-5 bg-[var(--color-surface)] hover:border-[var(--neon-green)]/40 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[110px]">
                            <input
                              type="file"
                              accept="video/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 8 * 1024 * 1024) {
                                    showBrutalistToast('MAX SIZE EXCEEDED', 'Video exceeds size limit (8MB maximum).', 'error');
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = (uploadEvent) => {
                                    setStoryVideo(uploadEvent.target?.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />
                            {storyVideo ? (
                              <div className="space-y-2 relative z-20 w-full">
                                <video
                                  src={storyVideo}
                                  className="max-h-24 mx-auto rounded-lg object-contain border border-[var(--neon-green-border)]"
                                  controls
                                />
                                <p className="text-[9px] text-[var(--neon-green)] font-mono font-bold uppercase tracking-wider animate-pulse">
                                  ✓ Video Stream Ready
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStoryVideo('');
                                  }}
                                  className="text-[9px] text-red-500 hover:underline font-mono uppercase font-black"
                                >
                                  [ Remove Video ]
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Upload className="w-5 h-5 text-zinc-500 mx-auto mb-1 animate-bounce" />
                                <p className="text-[10px] text-zinc-300 font-mono font-bold uppercase">
                                  Click to upload video stream
                                </p>
                                <p className="text-[8px] text-zinc-600 font-mono">
                                  MP4, WebM up to 8MB (Base64 encoded)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Audio story uploader with track details */}
                      {storyType === 'audio' && (
                        <div className="space-y-3.5 animate-fade-in">
                          <div className="space-y-1.5">
                            <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">
                              ATTACH AUDIO / SOUNDTRACK (DIRECT FILE UPLOAD):
                            </span>
                            <div className="relative border-2 border-dashed border-[var(--neon-green-border)] rounded-xl p-5 bg-[var(--color-surface)] hover:border-[var(--neon-green)]/40 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[110px]">
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 8 * 1024 * 1024) {
                                      showBrutalistToast('MAX SIZE EXCEEDED', 'Audio track exceeds size limit (8MB maximum).', 'error');
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (uploadEvent) => {
                                      setStoryAudio(uploadEvent.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                              />
                              {storyAudio ? (
                                <div className="space-y-2 relative z-20 w-full">
                                  <div className="p-3 bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-lg flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />
                                      <span className="text-[10px] font-mono text-zinc-300 truncate max-w-[150px]">Sound Track Attached</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStoryAudio('');
                                      }}
                                      className="text-[9px] text-red-500 hover:underline font-mono uppercase font-black"
                                    >
                                      [ Remove ]
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Music className="w-5 h-5 text-zinc-500 mx-auto mb-1 animate-pulse" />
                                  <p className="text-[10px] text-zinc-300 font-mono font-bold uppercase">
                                    Click to upload audio track
                                  </p>
                                  <p className="text-[8px] text-zinc-600 font-mono">
                                    MP3, WAV, M4A up to 8MB
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">Track Title:</span>
                              <input
                                type="text"
                                value={storyMusicTitle}
                                onChange={(e) => setStoryMusicTitle(e.target.value)}
                                placeholder="E.g., Virtual Synth"
                                className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)]"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">Artist Name:</span>
                              <input
                                type="text"
                                value={storyMusicArtist}
                                onChange={(e) => setStoryMusicArtist(e.target.value)}
                                placeholder="E.g., Faratech Labs"
                                className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Social post attachment */}
                      <div className="space-y-1.5">
                        <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">
                          ATTACH IMAGE (DIRECT FILE UPLOAD):
                        </span>
                        <div className="relative border-2 border-dashed border-[var(--neon-green-border)] rounded-xl p-5 bg-[var(--color-surface)] hover:border-[var(--neon-green)]/40 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[110px]">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const compressed = await compressImage(file, 800, 800, 0.65);
                                  setPostImage(compressed);
                                } catch (err) {
                                  console.warn("Failed to compress image, falling back to original:", err);
                                  const reader = new FileReader();
                                  reader.onload = (uploadEvent) => {
                                    setPostImage(uploadEvent.target?.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          {postImage ? (
                            <div className="space-y-2 relative z-20">
                              <img
                                src={postImage}
                                alt="Direct upload preview"
                                className="max-h-24 mx-auto rounded-lg object-cover border border-[var(--neon-green-border)]"
                              />
                              <p className="text-[9px] text-[var(--neon-green)] font-mono font-bold uppercase tracking-wider animate-pulse">
                                ✓ Image Ready for Deployment
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPostImage('');
                                }}
                                className="text-[9px] text-red-500 hover:underline font-mono uppercase font-black"
                              >
                                [ Remove Image ]
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Upload className="w-5 h-5 text-zinc-500 mx-auto mb-1 animate-bounce" />
                              <p className="text-[10px] text-zinc-300 font-mono font-bold uppercase">
                                Click or drag file to upload
                              </p>
                              <p className="text-[8px] text-zinc-600 font-mono">
                                PNG, JPG, GIF up to 5MB (Base64 secured)
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">
                          VIDEO LINK / INSTAGRAM REEL / YOUTUBE EMBED:
                        </span>
                        <input
                          type="url"
                          value={postVideo}
                          onChange={(e) => setPostVideo(e.target.value)}
                          placeholder="Paste Instagram Reel/Post, YouTube link, or raw MP4 URL..."
                          className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)]"
                        />
                        <p className="text-[7.5px] text-zinc-500 font-mono leading-relaxed uppercase">
                          Supports full embedded in-feed playback for Instagram reels, YouTube videos, and direct video clips.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 border-t border-[var(--neon-green-border)] bg-[var(--color-surface)] flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPostCreator(false)}
                  className="flex-1 text-center py-3 bg-[var(--color-surface)] hover:bg-zinc-800 text-zinc-400 hover:text-[var(--color-text)] font-mono text-xs uppercase font-black rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={postCreatorType === 'story' ? handlePublishStory : handlePublishPost}
                  disabled={isUploadingStory || isPublishingPost}
                  className="flex-1 text-center py-3 bg-[var(--neon-green)] hover:bg-white text-black font-mono text-xs uppercase font-black rounded-xl transition disabled:opacity-40"
                >
                  {isUploadingStory ? 'Broadcasting...' : isPublishingPost ? 'Deploying...' : '[ DEPLOY PACKET ]'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* =================================== GROUP CREATE POPUP =================================== */}
      <AnimatePresence>
        {showCreateGroup && (
          <div data-overlay="true" className="fixed inset-0 bg-[var(--color-surface)]/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-[var(--neon-green-border)] flex items-center justify-between">
                <span className="text-[9px] font-mono font-black uppercase text-blue-400">DEPLOY GROUP CONDUIT</span>
                <button onClick={() => setShowCreateGroup(false)} className="p-1 text-zinc-400 hover:text-[var(--color-text)] transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div className="space-y-1.5">
                  <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">Group Concourse Name:</span>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="E.g., COMPUTER SCIENCE 300L"
                    className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">Concourse Purpose / Description:</span>
                  <textarea
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Describe study guides, class coordinates, fellowship schedules..."
                    rows={3}
                    className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <span className="block text-[8px] font-mono text-zinc-500 uppercase font-bold mb-1">CONDUIT CLASSIFICATION:</span>
                    <select
                      value={newGroupType}
                      onChange={(e) => setNewGroupType(e.target.value as any)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] p-2 text-[var(--color-text)] text-xs font-mono rounded"
                    >
                      <option value="school">SCHOOL</option>
                      <option value="friends">FRIENDS</option>
                      <option value="custom">CUSTOM</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-[8px] font-mono text-zinc-500 uppercase font-bold mb-1">PRIVACY SCHEDULER:</span>
                    <select
                      value={newGroupPrivacy}
                      onChange={(e) => setNewGroupPrivacy(e.target.value as any)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] p-2 text-[var(--color-text)] text-xs font-mono rounded"
                    >
                      <option value="public">PUBLIC CONCOURSE</option>
                      <option value="private">PRIVATE LOCKED</option>
                    </select>
                  </div>
                </div>

                {newGroupPrivacy === 'private' && (
                  <div className="space-y-1.5">
                    <span className="block text-[8px] font-mono text-zinc-500 uppercase font-black">ENCRYPTION ENTRANCE CODE (JOIN PASS):</span>
                    <input
                      type="text"
                      value={newGroupPass}
                      onChange={(e) => setNewGroupPass(e.target.value)}
                      placeholder="CYBERPASS101"
                      className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[var(--neon-green-border)] bg-[var(--color-surface)] flex gap-3">
                <button
                  onClick={() => setShowCreateGroup(false)}
                  className="flex-1 text-center py-3 bg-[var(--color-surface)] text-zinc-400 hover:text-[var(--color-text)] font-mono text-xs uppercase font-black rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeployGroup}
                  className="flex-1 text-center py-3 bg-blue-600 hover:bg-blue-500 text-[var(--color-text)] font-mono text-xs uppercase font-black rounded-xl"
                >
                  [ DEPLOY GROUP ]
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* =================================== DISCUSSIONS / COMMENTS SHEET =================================== */}
      <AnimatePresence>
        {activeDiscussionPost && (
          <div data-overlay="true" className="fixed inset-0 bg-[var(--color-surface)]/95 z-[150] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
              {/* Header */}
              <div className="p-4 border-b border-[var(--neon-green-border)] flex items-center justify-between">
                <span className="text-[9px] font-mono font-black uppercase text-[var(--neon-green)]">DISPATCH DISCUSSION CONCOURSE</span>
                <button onClick={() => setActiveDiscussionPost(null)} className="p-1 text-zinc-400 hover:text-[var(--color-text)] transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* OP Post Preview */}
              <div className="p-4 bg-[var(--color-background)]/40 border-b border-[var(--neon-green-border)]/60 font-mono text-[11px] text-zinc-400">
                <span className="text-[7.5px] text-zinc-500 font-bold block uppercase">ORIGINAL MESSAGE BROADCAST:</span>
                <p className="mt-1 italic">"{activeDiscussionPost.content.substring(0, 150)}..."</p>
              </div>

              {/* Comments Scrollable lists */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px]">
                {currentPostComments.length === 0 ? (
                  <div className="py-20 text-center text-zinc-500 italic">
                    No replies have been logged on this conduit.
                  </div>
                ) : (
                  currentPostComments.map((c, ci) => (
                    <div key={c.id || ci} className="p-3.5 bg-[var(--color-surface)]/30 border border-[var(--neon-green-border)] rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <img src={c.authorPhoto} alt="" className="w-6 h-6 rounded-full border border-[var(--neon-green-border)]" />
                          <span className="font-black text-[var(--color-text)]">{c.authorName}</span>
                        </div>
                        <span className="text-[8px] text-zinc-500">
                          {c.createdAt instanceof Date ? c.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed font-sans">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment form */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCommentText.trim() || !profile || isSendingComment) return;
                  
                  playGlitchClickSound();
                  triggerVibration('medium');
                  const inputVal = newCommentText.trim();
                  setIsSendingComment(true);
                  setNewCommentText('');
                  const toastId = 'comment-post';

                  try {
                    showBrutalistToast('TRANSMITTING...', 'Broadcasting reply packet to peer spectrum...', 'loading', undefined, toastId);
                    await createComment(
                      activeDiscussionPost.id,
                      activeDiscussionPost.authorId,
                      activeDiscussionPost.content,
                      {
                        authorId: profile.uid,
                        authorName: profile.displayName,
                        authorPhoto: profile.photoURL,
                        content: inputVal
                      }
                    );
                    showBrutalistToast('SUCCESS ✓', 'Reply packet successfully transmitted!', 'success', undefined, toastId);
                  } catch (err: any) {
                    console.warn("Failed to post comment:", err);
                    setNewCommentText(inputVal); // Restore text in draft so they never lose it!
                    showBrutalistToast('ERROR ×', 'Reply packet failed to send: ' + sanitizeErrorMessage(err), 'error', undefined, toastId);
                  } finally {
                    setIsSendingComment(false);
                  }
                }}
                className="p-4 border-t border-[var(--neon-green-border)] flex gap-2 bg-[var(--color-surface)]"
              >
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  disabled={isSendingComment}
                  placeholder={isSendingComment ? "TRANSFERS ACTIVE..." : "Transmit reply to OP..."}
                  className="flex-1 bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-xl px-4 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isSendingComment}
                  className="p-3 bg-[var(--neon-green)] hover:bg-white text-black font-black font-mono text-xs uppercase rounded-xl disabled:opacity-40"
                >
                  {isSendingComment ? '...' : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* =================================== IMAGE LIGHTBOX MAGNIFIER =================================== */}
      {zoomImg && (
        <div
          data-overlay="true"
          className="fixed inset-0 bg-[var(--color-surface)]/95 flex items-center justify-center z-[9999] p-4 pointer-events-auto cursor-zoom-out"
          onClick={() => setZoomImg(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img src={zoomImg} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl m-auto border border-[var(--neon-green-border)]" alt="Magnified Campus Narrative" />
            <div className="absolute bottom-[-32px] left-0 right-0 text-center text-[10px] text-zinc-400 font-mono tracking-wider">
              TAP ANYWHERE TO EXIT MAGNIFIER
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
