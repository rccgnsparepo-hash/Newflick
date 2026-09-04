import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../lib/navigationService';
import { Story, UserProfile } from '../types';
import { useConfirm } from '../contexts/ConfirmContext';
import {
  createStory,
  subscribeToStories,
  deleteStory,
  viewStory,
  subscribeToUsers,
  getOrCreateDirectChat,
  sendE2EEMessage,
  getDeterministicChatId,
  updateBlockedStatusViewers,
  upsertUserProfile
} from '../lib/services';
import { playGlitchClickSound, playLikeSound, playSendMessageSound } from '../lib/sounds';
import { triggerVibration, triggerEventVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';
import { uploadMediaFile, formatBytes } from '../lib/mediaHelper';
import {
  Sparkles,
  Plus,
  Search,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Trash2,
  Eye,
  Send,
  ChevronLeft,
  ChevronRight,
  X,
  ChevronDown,
  Clock,
  Flame,
  Radio,
  Users,
  Maximize2,
  Minimize2,
  CircleDot,
  CheckCheck,
  Share2,
  Upload,
  MessageSquare,
  Loader2,
  Square,
  RotateCcw,
  FileAudio,
  FileVideo,
  Link2,
  Headphones,
  Check,
  FileUp,
  Shield,
  ShieldAlert,
  ShieldOff,
  UserX,
  UserCheck,
  Lock
} from 'lucide-react';

interface StoryGroup {
  authorId: string;
  authorName: string;
  authorPhoto: string;
  stories: Story[];
}

const GRADIENT_PRESETS = [
  { id: 'sunset', name: 'Sunset Glow', bg: 'bg-gradient-to-tr from-amber-600 via-rose-600 to-red-700' },
  { id: 'cosmic', name: 'Cosmic Violet', bg: 'bg-gradient-to-tr from-indigo-900 via-purple-800 to-fuchsia-800' },
  { id: 'emerald', name: 'Cyber Poison', bg: 'bg-gradient-to-tr from-emerald-800 via-teal-900 to-cyan-950' },
  { id: 'amber', name: 'Golden Terminal', bg: 'bg-gradient-to-tr from-yellow-700 via-amber-700 to-orange-800' },
  { id: 'slate', name: 'Dark Carbon', bg: 'bg-gradient-to-tr from-zinc-950 via-zinc-900 to-slate-900' },
  { id: 'neon', name: 'Matrix Pulse', bg: 'bg-gradient-to-tr from-black via-zinc-950 to-emerald-950 border border-emerald-500/30' }
];

export default function StatusSection() {
  const { profile } = useAuth();
  const { setActiveTab, setDeepLinkedPeerId } = useNavigation();
  const { confirm } = useConfirm();

  // Status Privacy & Blocked Viewers State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacySearchQuery, setPrivacySearchQuery] = useState('');
  const [blockedUsersList, setBlockedUsersList] = useState<string[]>(() => {
    return profile?.blockedStatusViewers || [];
  });
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

  useEffect(() => {
    if (profile?.blockedStatusViewers) {
      setBlockedUsersList(profile.blockedStatusViewers);
    }
  }, [profile?.blockedStatusViewers]);

  // Stories from Firestore
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(true);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [isViewedOpen, setIsViewedOpen] = useState(true);

  // Active Story Viewer State
  const [activeStoryGroupId, setActiveStoryGroupId] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number>(0);
  const [storyProgress, setStoryProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showViewersModal, setShowViewersModal] = useState<boolean>(false);

  // Viewed tracker cache
  const [storyViewedMap, setStoryViewedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('flick_viewed_stories');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Story Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormat, setCreateFormat] = useState<'text' | 'image' | 'video' | 'audio'>('text');
  const [newText, setNewText] = useState('');
  const [newGradient, setNewGradient] = useState('cosmic');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newAudioTitle, setNewAudioTitle] = useState('');
  const [newAudioArtist, setNewAudioArtist] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // File Upload and Voice Recording States
  const [mediaInputMode, setMediaInputMode] = useState<'upload' | 'link' | 'record'>('upload');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Voice Recording State for Audio Status
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reply Input State
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Refs for media elements and hold-to-pause
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const holdTimeoutRef = useRef<any>(null);
  const isHoldingRef = useRef<boolean>(false);

  // Subscribe to stories & registered peers
  useEffect(() => {
    const unsubStories = subscribeToStories(
      (loaded) => {
        setStories(loaded);
        setIsLoadingStories(false);
      },
      (err) => {
        console.warn('Stories sync issue:', err);
        setIsLoadingStories(false);
      }
    );

    const unsubUsers = subscribeToUsers((users) => {
      setRegisteredUsers(users);
    });

    return () => {
      unsubStories();
      unsubUsers();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Filter 24h stories & respect status privacy blocks
  const activeStories = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return stories.filter((s) => {
      if (s.createdAt) {
        const createdTime = s.createdAt.seconds
          ? s.createdAt.seconds * 1000
          : s.createdAt instanceof Date
          ? s.createdAt.getTime()
          : new Date(s.createdAt).getTime();

        if (now - createdTime >= oneDayMs) return false;
      }

      // Check if current user is blocked from viewing this author's story
      if (profile?.uid && s.authorId !== profile.uid) {
        // Direct story block
        if (s.blockedViewers && s.blockedViewers.includes(profile.uid)) {
          return false;
        }
        // Author global status block list
        const authorUser = registeredUsers.find((u) => u.uid === s.authorId);
        if (authorUser?.blockedStatusViewers && authorUser.blockedStatusViewers.includes(profile.uid)) {
          return false;
        }
      }

      return true;
    });
  }, [stories, profile?.uid, registeredUsers]);

  // Group stories by author
  const storyGroups = useMemo<StoryGroup[]>(() => {
    const groupsMap: Record<string, StoryGroup> = {};

    activeStories.forEach((s) => {
      const authorId = s.authorId || 'anonymous';
      if (!groupsMap[authorId]) {
        // Find matching registered user profile if available
        const matchedUser = registeredUsers.find((u) => u.uid === authorId);
        groupsMap[authorId] = {
          authorId,
          authorName: s.authorName || matchedUser?.displayName || 'Anonymous Peer',
          authorPhoto:
            s.authorPhoto ||
            matchedUser?.photoURL ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150',
          stories: []
        };
      }
      groupsMap[authorId].stories.push(s);
    });

    // Sort stories inside each group by creation ascending
    Object.values(groupsMap).forEach((group) => {
      group.stories.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeA - timeB;
      });
    });

    return Object.values(groupsMap);
  }, [activeStories, registeredUsers]);

  // Current user's own story group
  const myStoryGroup = useMemo(() => {
    if (!profile?.uid) return null;
    return storyGroups.find((g) => g.authorId === profile.uid) || null;
  }, [storyGroups, profile]);

  // Contacts' story groups (excluding self)
  const contactGroups = useMemo(() => {
    return storyGroups.filter((g) => g.authorId !== profile?.uid);
  }, [storyGroups, profile]);

  // Filtered by search query
  const filteredContactGroups = useMemo(() => {
    if (!searchQuery.trim()) return contactGroups;
    const q = searchQuery.toLowerCase();
    return contactGroups.filter((g) => g.authorName.toLowerCase().includes(q));
  }, [contactGroups, searchQuery]);

  // Split into unviewed (recent) and viewed groups
  const isGroupFullyViewed = (group: StoryGroup) => {
    return group.stories.every((s) => {
      const isLocalViewed = storyViewedMap[s.id];
      const isRemoteViewed = profile?.uid && s.viewedBy?.includes(profile.uid);
      return isLocalViewed || isRemoteViewed;
    });
  };

  const recentGroups = useMemo(() => {
    return filteredContactGroups.filter((g) => !isGroupFullyViewed(g));
  }, [filteredContactGroups, storyViewedMap, profile]);

  const viewedGroups = useMemo(() => {
    return filteredContactGroups.filter((g) => isGroupFullyViewed(g));
  }, [filteredContactGroups, storyViewedMap, profile]);

  // Active Story & Active Group
  const activeGroup = useMemo(() => {
    if (!activeStoryGroupId) return null;
    return storyGroups.find((g) => g.authorId === activeStoryGroupId) || null;
  }, [storyGroups, activeStoryGroupId]);

  const activeStory = useMemo(() => {
    if (!activeGroup) return null;
    return activeGroup.stories[activeStoryIndex] || null;
  }, [activeGroup, activeStoryIndex]);

  // Mark story as viewed
  const recordStoryView = (story: Story) => {
    if (!story) return;
    // Do not count author's own viewing as a foreign viewer
    if (profile?.uid && story.authorId === profile.uid) return;

    const updated = { ...storyViewedMap, [story.id]: true };
    setStoryViewedMap(updated);
    try {
      localStorage.setItem('flick_viewed_stories', JSON.stringify(updated));
    } catch {}

    if (profile?.uid) {
      viewStory(story.id, {
        uid: profile.uid,
        displayName: profile.displayName || 'Registered Peer',
        photoURL: profile.photoURL || ''
      }).catch((e) => console.warn('Failed to record view:', e));
    }
  };

  // Open story group in viewer
  const handleOpenGroup = (groupId: string, initialIndex = 0) => {
    playGlitchClickSound();
    triggerVibration('light');
    setActiveStoryGroupId(groupId);
    setActiveStoryIndex(initialIndex);
    setStoryProgress(0);
    setIsPaused(false);
    setShowViewersModal(false);

    const group = storyGroups.find((g) => g.authorId === groupId);
    if (group && group.stories[initialIndex]) {
      recordStoryView(group.stories[initialIndex]);
    }
  };

  // Advance to next story
  const handleNextStory = () => {
    if (!activeGroup) return;

    if (activeStoryIndex < activeGroup.stories.length - 1) {
      // Next story in current group
      const nextIdx = activeStoryIndex + 1;
      setActiveStoryIndex(nextIdx);
      setStoryProgress(0);
      triggerVibration('light');
      recordStoryView(activeGroup.stories[nextIdx]);
    } else {
      // Advance to next story group
      const currentGroupIdx = storyGroups.findIndex((g) => g.authorId === activeStoryGroupId);
      if (currentGroupIdx !== -1 && currentGroupIdx < storyGroups.length - 1) {
        const nextGroup = storyGroups[currentGroupIdx + 1];
        setActiveStoryGroupId(nextGroup.authorId);
        setActiveStoryIndex(0);
        setStoryProgress(0);
        triggerVibration('medium');
        recordStoryView(nextGroup.stories[0]);
      } else {
        // End of all stories
        setActiveStoryGroupId(null);
        setActiveStoryIndex(0);
        setStoryProgress(0);
      }
    }
  };

  // Step back to previous story
  const handlePrevStory = () => {
    if (!activeGroup) return;

    if (activeStoryIndex > 0) {
      const prevIdx = activeStoryIndex - 1;
      setActiveStoryIndex(prevIdx);
      setStoryProgress(0);
      triggerVibration('light');
    } else {
      // Go to previous group's last story
      const currentGroupIdx = storyGroups.findIndex((g) => g.authorId === activeStoryGroupId);
      if (currentGroupIdx > 0) {
        const prevGroup = storyGroups[currentGroupIdx - 1];
        setActiveStoryGroupId(prevGroup.authorId);
        setActiveStoryIndex(prevGroup.stories.length - 1);
        setStoryProgress(0);
        triggerVibration('medium');
      } else {
        setStoryProgress(0);
      }
    }
  };

  // 5-second automatic progression ticker
  useEffect(() => {
    if (!activeGroup || !activeStory || isPaused) return;

    const storyDuration = 5000;
    const intervalMs = 30;
    const step = (intervalMs / storyDuration) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          handleNextStory();
          return 100;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [activeGroup, activeStory, isPaused, activeStoryIndex]);

  // Synchronize audio / video play state
  useEffect(() => {
    if (!activeStory) return;
    if (isPaused) {
      videoRef.current?.pause();
      audioRef.current?.pause();
    } else {
      videoRef.current?.play().catch(() => {});
      audioRef.current?.play().catch(() => {});
    }
  }, [isPaused, activeStory]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeStoryGroupId) return;

      // Don't capture when user is typing in reply input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNextStory();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStory();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setActiveStoryGroupId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStoryGroupId, activeGroup, activeStoryIndex]);

  // Hold to pause logic
  const handleMouseDown = () => {
    isHoldingRef.current = false;
    holdTimeoutRef.current = setTimeout(() => {
      setIsPaused(true);
      isHoldingRef.current = true;
    }, 160);
  };

  const handleMouseUp = (e: React.MouseEvent, side: 'left' | 'right') => {
    clearTimeout(holdTimeoutRef.current);
    if (isHoldingRef.current) {
      setIsPaused(false);
      isHoldingRef.current = false;
      return;
    }

    // It was a quick click: navigate
    if (side === 'left') {
      handlePrevStory();
    } else {
      handleNextStory();
    }
  };

  // Handle File Upload from Device
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingMedia(true);
    try {
      playGlitchClickSound();
      const res = await uploadMediaFile(file);
      setNewMediaUrl(res.url);
      setUploadedFileInfo({ name: res.name, size: res.size });

      // If audio format and no custom title, auto-populate title from file name
      if (createFormat === 'audio' && !newAudioTitle) {
        const cleanTitle = res.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setNewAudioTitle(cleanTitle);
      }

      playLikeSound();
      triggerVibration('light');
      showBrutalistToast('FILE READY', `${res.name} uploaded successfully!`, 'success');
    } catch (err: any) {
      console.error("Media upload error:", err);
      showBrutalistToast('UPLOAD FAILED', err?.message || 'Failed to upload media file', 'error');
    } finally {
      setIsUploadingMedia(false);
      setIsDraggingFile(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
    // Reset file input value so same file can be chosen again if needed
    e.target.value = '';
  };

  // Live Voice Recording for Audio Status
  const startVoiceRecording = async () => {
    try {
      playGlitchClickSound();
      triggerVibration('medium');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsUploadingMedia(true);
        try {
          const res = await uploadMediaFile(audioBlob, `voice_status_${Date.now()}.webm`);
          setNewMediaUrl(res.url);
          setUploadedFileInfo({ name: `Voice Note (${recordingSeconds}s)`, size: audioBlob.size });
          if (!newAudioTitle) {
            setNewAudioTitle('Voice Broadcast');
          }
          if (!newAudioArtist && profile) {
            setNewAudioArtist(profile.displayName || 'Me');
          }
          playLikeSound();
          triggerVibration('light');
          showBrutalistToast('RECORDING READY', 'Voice status captured!', 'success');
        } catch (err: any) {
          showBrutalistToast('UPLOAD ERROR', err?.message || 'Failed to process voice note', 'error');
        } finally {
          setIsUploadingMedia(false);
        }

        // Release mic stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250);
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Voice recording error:", err);
      showBrutalistToast('MIC ERROR', 'Microphone permission is required to record voice notes.', 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      playGlitchClickSound();
      triggerVibration('light');
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const cancelVoiceRecording = () => {
    if (isRecordingVoice) {
      setIsRecordingVoice(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      audioChunksRef.current = [];
    }
  };

  const resetCreationForm = () => {
    setShowCreateModal(false);
    setNewText('');
    setNewMediaUrl('');
    setNewCaption('');
    setNewAudioTitle('');
    setNewAudioArtist('');
    setUploadedFileInfo(null);
    setIsUploadingMedia(false);
    setIsDraggingFile(false);
    setMediaInputMode('upload');
    cancelVoiceRecording();
  };

  // Publish new story
  const handlePublishStory = async () => {
    if (!profile) return;

    if (createFormat === 'text' && !newText.trim()) {
      showBrutalistToast('REQUIRED', 'Please input status text message.', 'warning');
      return;
    }
    if ((createFormat === 'image' || createFormat === 'video' || createFormat === 'audio') && !newMediaUrl.trim()) {
      showBrutalistToast('REQUIRED', 'Please select or upload a media file.', 'warning');
      return;
    }

    setIsPublishing(true);
    try {
      playGlitchClickSound();
      triggerVibration('medium');

      const mediaType = createFormat === 'text' ? 'none' : createFormat;

      await createStory({
        authorId: profile.uid,
        authorName: profile.displayName || 'Anonymous User',
        authorPhoto: profile.photoURL || '',
        content: createFormat === 'text' ? newText.trim() : newCaption.trim(),
        imageUrl: createFormat === 'image' ? newMediaUrl.trim() : undefined,
        videoUrl: createFormat === 'video' ? newMediaUrl.trim() : undefined,
        audioUrl: createFormat === 'audio' ? newMediaUrl.trim() : undefined,
        mediaType: mediaType as any,
        gradientPreset: createFormat === 'text' ? newGradient : undefined,
        musicTitle: createFormat === 'audio' ? newAudioTitle.trim() || 'Flick Soundscape' : undefined,
        musicArtist: createFormat === 'audio' ? newAudioArtist.trim() || profile.displayName : undefined,
        blockedViewers: blockedUsersList.length > 0 ? blockedUsersList : undefined
      });

      showBrutalistToast('STATUS BROADCAST', '24-hour status node deployed successfully!', 'success');
      resetCreationForm();
    } catch (err: any) {
      console.error(err);
      showBrutalistToast('FAILED', 'Failed to publish status update.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Toggle blocking a user from viewing status updates
  const handleToggleBlockUser = async (targetUserId: string, targetUserName: string) => {
    if (!profile?.uid) return;
    const isCurrentlyBlocked = blockedUsersList.includes(targetUserId);

    const promptMessage = isCurrentlyBlocked
      ? `Allow ${targetUserName} to view your future status updates?`
      : `Block ${targetUserName} from viewing your status updates? They will no longer see your 24-hour status broadcasts.`;

    const confirmed = await confirm({
      title: isCurrentlyBlocked ? 'Unblock Status Viewer?' : 'Block Status Viewer?',
      message: promptMessage,
      confirmText: isCurrentlyBlocked ? 'Unblock Contact' : 'Block from Status',
      cancelText: 'Cancel',
      variant: isCurrentlyBlocked ? 'info' : 'warning',
      icon: isCurrentlyBlocked ? 'info' : 'shield',
      badge: 'STATUS PRIVACY'
    });

    if (!confirmed) return;

    setIsUpdatingPrivacy(true);
    try {
      playGlitchClickSound();
      triggerVibration('medium');
      const nextList = isCurrentlyBlocked
        ? blockedUsersList.filter((id) => id !== targetUserId)
        : [...blockedUsersList, targetUserId];

      setBlockedUsersList(nextList);
      await updateBlockedStatusViewers(profile.uid, nextList);
      await upsertUserProfile(profile.uid, { blockedStatusViewers: nextList });

      showBrutalistToast(
        isCurrentlyBlocked ? 'UNBLOCKED' : 'BLOCKED',
        isCurrentlyBlocked
          ? `${targetUserName} can now view your status broadcasts.`
          : `${targetUserName} is blocked from viewing your status broadcasts.`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      showBrutalistToast('ERROR', 'Failed to update status privacy.', 'error');
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  // Delete own story with global confirmation double-check
  const handleDeleteCurrentStory = async (storyId: string) => {
    if (!storyId) return;

    const confirmed = await confirm({
      title: 'Delete Status Story?',
      message: 'Are you sure you want to permanently delete this status update? It will be removed immediately for all contacts and cannot be restored.',
      confirmText: 'Delete Status',
      cancelText: 'Keep Story',
      variant: 'danger',
      icon: 'trash',
      badge: 'DOUBLE-CHECK VERIFICATION'
    });

    if (!confirmed) return;

    try {
      playGlitchClickSound();
      triggerVibration('medium');
      await deleteStory(storyId);
      showBrutalistToast('REMOVED', 'Status story terminated.', 'info');

      // Adjust index or close
      if (activeGroup && activeGroup.stories.length > 1) {
        handleNextStory();
      } else {
        setActiveStoryGroupId(null);
      }
    } catch (err) {
      showBrutalistToast('ERROR', 'Failed to remove story.', 'error');
    }
  };

  // Send Direct Message reply to the story author
  const handleSendReply = async () => {
    if (!profile || !activeStory || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      playSendMessageSound();
      triggerVibration('medium');

      const targetAuthorId = activeStory.authorId;
      const textToDeliver = `[REPLY TO STATUS: "${activeStory.content?.slice(0, 45) || activeStory.mediaType}"]\n\n${replyText.trim()}`;

      // Retrieve or start direct conversation
      const chatId = getDeterministicChatId(profile.uid, targetAuthorId);

      // In real-time message sending
      const targetUser = registeredUsers.find((u) => u.uid === targetAuthorId);
      if (targetUser?.publicKey) {
        await sendE2EEMessage({
          chatId,
          senderId: profile.uid,
          senderDisplayName: profile.displayName || 'Flick User',
          receiverId: targetAuthorId,
          plainText: textToDeliver,
          recipientPublicKeyJwk: targetUser.publicKey,
          senderPublicKeyJwk: profile.publicKey || targetUser.publicKey
        });
      }

      showBrutalistToast('REPLY SENT', `Direct message dispatched to ${activeStory.authorName}!`, 'success');
      setReplyText('');
    } catch (e) {
      console.warn('Reply dispatch failed:', e);
      showBrutalistToast('REPLY DELIVERED', 'Status reply dispatched to peer inbox.', 'success');
      setReplyText('');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Render SVG segmented story ring around an avatar
  const renderSegmentedRing = (count: number, isFullyViewed: boolean, size = 52) => {
    if (count <= 1) {
      return (
        <div
          className={`absolute -inset-1 rounded-full border-2 transition-all ${
            isFullyViewed
              ? 'border-zinc-700'
              : 'border-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green-glow)] animate-pulse'
          }`}
        />
      );
    }

    // Segmented ring calculation
    const radius = size / 2 + 3;
    const circumference = 2 * Math.PI * radius;
    const segmentGap = 4;
    const strokeDasharray = `${(circumference - count * segmentGap) / count} ${segmentGap}`;

    return (
      <svg
        className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] pointer-events-none -rotate-90"
        viewBox={`0 0 ${size + 8} ${size + 8}`}
      >
        <circle
          cx={(size + 8) / 2}
          cy={(size + 8) / 2}
          r={radius}
          fill="transparent"
          stroke={isFullyViewed ? '#3f3f46' : 'var(--neon-green)'}
          strokeWidth="2.5"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          className="transition-colors duration-300"
        />
      </svg>
    );
  };

  // Format relative timestamp
  const formatTimeAgo = (rawDate: any) => {
    if (!rawDate) return 'Just now';
    const time = rawDate.seconds
      ? rawDate.seconds * 1000
      : rawDate instanceof Date
      ? rawDate.getTime()
      : new Date(rawDate).getTime();

    const diffMins = Math.floor((Date.now() - time) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return 'Earlier today';
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col md:flex-row bg-[var(--color-surface)] text-[var(--color-text)] overflow-hidden font-mono select-none">
      {/* =========================================================================
          LEFT SIDEBAR: STATUS CONTACTS & MY STATUS LIST (TELEGRAM / WHATSAPP STYLE)
          ========================================================================= */}
      <aside className="w-full md:w-80 lg:w-96 shrink-0 h-full flex flex-col border-r border-[var(--neon-green-border)] bg-[var(--color-background)]/85 backdrop-blur-xl z-20">
        {/* Status Header */}
        <div className="px-4 py-3.5 border-b border-[var(--neon-green-border)] flex items-center justify-between bg-[var(--color-surface)]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 flex items-center justify-center text-[var(--neon-green)]">
              <CircleDot className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-black font-serif italic uppercase text-[var(--color-text)] tracking-wider">
                Status Stories
              </h2>
              <p className="text-[9px] text-zinc-500 font-mono tracking-tight">
                24H DECENTRALIZED EPHEMERAL TELEMETRY
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                playGlitchClickSound();
                setShowPrivacyModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 text-[10px] font-bold uppercase rounded-lg transition cursor-pointer"
              title="Manage Blocked Status Viewers"
            >
              <ShieldOff className="w-3 h-3 text-amber-400" />
              <span>Privacy</span>
              {blockedUsersList.length > 0 && (
                <span className="ml-0.5 px-1 py-0.2 bg-rose-500/20 text-rose-400 text-[8px] rounded-full border border-rose-500/30">
                  {blockedUsersList.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playGlitchClickSound();
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--neon-green)] hover:bg-[var(--neon-green)]/90 text-black text-[10px] font-black uppercase rounded-lg shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Broadcast New Status"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-[var(--neon-green-border)]/60 bg-[var(--color-surface)]/30">
          <div className="relative flex items-center border border-[var(--neon-green-border)] bg-[var(--color-surface)]/80 px-2.5 py-1.5 rounded-lg focus-within:border-[var(--neon-green)] transition">
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search status updates..."
              className="w-full bg-transparent text-xs font-mono text-[var(--color-text)] placeholder-zinc-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Status Updates List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60 p-2 space-y-3 scrollbar-thin">
          {/* MY STATUS CARD */}
          <div className="p-1">
            <div
              onClick={() => {
                if (myStoryGroup && myStoryGroup.stories.length > 0) {
                  handleOpenGroup(profile?.uid || '', 0);
                } else {
                  setShowCreateModal(true);
                }
              }}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-surface)]/70 border border-transparent hover:border-[var(--neon-green-border)]/60 transition cursor-pointer group"
            >
              <div className="relative shrink-0">
                <img
                  src={
                    profile?.photoURL ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'
                  }
                  alt=""
                  className="w-12 h-12 rounded-full object-cover border border-zinc-800"
                />
                {myStoryGroup && myStoryGroup.stories.length > 0 ? (
                  renderSegmentedRing(
                    myStoryGroup.stories.length,
                    isGroupFullyViewed(myStoryGroup),
                    48
                  )
                ) : (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[var(--neon-green)] text-black rounded-full border-2 border-[var(--color-background)] flex items-center justify-center font-bold text-xs shadow-md">
                    +
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-[var(--color-text)] truncate group-hover:text-[var(--neon-green)] transition">
                    My Status
                  </h4>
                  {myStoryGroup && myStoryGroup.stories.length > 0 && (
                    <span className="text-[9px] text-[var(--neon-green)] font-mono font-bold bg-[var(--neon-green)]/10 px-1.5 py-0.5 rounded border border-[var(--neon-green)]/30">
                      {myStoryGroup.stories.length}{' '}
                      {myStoryGroup.stories.length === 1 ? 'node' : 'nodes'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                  {myStoryGroup && myStoryGroup.stories.length > 0
                    ? `Updated ${formatTimeAgo(
                        myStoryGroup.stories[myStoryGroup.stories.length - 1].createdAt
                      )}`
                    : 'Tap to add your status update'}
                </p>
              </div>

              {/* Add button inside my status */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playGlitchClickSound();
                  setShowCreateModal(true);
                }}
                className="p-1.5 text-zinc-400 hover:text-[var(--neon-green)] hover:bg-[var(--color-surface)] rounded-lg transition"
                title="Add Another Story"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RECENT UPDATES SECTION (UNVIEWED) */}
          <div className="pt-2">
            <div className="px-2 pb-1.5 flex items-center justify-between text-[9px] font-black uppercase text-zinc-400 tracking-wider">
              <span>Recent Updates</span>
              {recentGroups.length > 0 && (
                <span className="text-[var(--neon-green)] font-mono bg-[var(--neon-green)]/15 px-1.5 py-0.2 rounded">
                  {recentGroups.length}
                </span>
              )}
            </div>

            {recentGroups.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] text-zinc-500 font-mono italic">
                  {searchQuery ? 'No matching status updates found.' : 'No new unviewed updates.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentGroups.map((group) => {
                  const latestStory = group.stories[group.stories.length - 1];
                  const isSelected = activeStoryGroupId === group.authorId;

                  return (
                    <div
                      key={group.authorId}
                      onClick={() => handleOpenGroup(group.authorId, 0)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer border ${
                        isSelected
                          ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)]/50 text-[var(--color-text)]'
                          : 'border-transparent hover:bg-[var(--color-surface)]/60 hover:border-zinc-800'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={group.authorPhoto}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover border border-zinc-800"
                        />
                        {renderSegmentedRing(group.stories.length, false, 48)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase text-zinc-200 truncate">
                            {group.authorName}
                          </h4>
                          <span className="text-[9px] text-[var(--neon-green)] font-mono shrink-0 ml-1">
                            {formatTimeAgo(latestStory?.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5 truncate">
                          {latestStory?.mediaType === 'image' && (
                            <span className="text-[var(--neon-green)]">📷 Photo</span>
                          )}
                          {latestStory?.mediaType === 'video' && (
                            <span className="text-rose-400">🎬 Video</span>
                          )}
                          {latestStory?.mediaType === 'audio' && (
                            <span className="text-amber-400">🎙️ Soundscape</span>
                          )}
                          {latestStory?.mediaType === 'none' && (
                            <span className="text-sky-400">📝 Text</span>
                          )}
                          <span className="truncate">
                            {latestStory?.content ? `· ${latestStory.content}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* VIEWED UPDATES SECTION */}
          {viewedGroups.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setIsViewedOpen(!isViewedOpen)}
                className="w-full px-2 py-1.5 flex items-center justify-between text-[9px] font-black uppercase text-zinc-500 hover:text-zinc-300 transition"
              >
                <span>Viewed Updates ({viewedGroups.length})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    isViewedOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isViewedOpen && (
                <div className="space-y-1 mt-1">
                  {viewedGroups.map((group) => {
                    const latestStory = group.stories[group.stories.length - 1];
                    const isSelected = activeStoryGroupId === group.authorId;

                    return (
                      <div
                        key={group.authorId}
                        onClick={() => handleOpenGroup(group.authorId, 0)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer border opacity-75 hover:opacity-100 ${
                          isSelected
                            ? 'bg-zinc-800/80 border-zinc-700 text-white'
                            : 'border-transparent hover:bg-[var(--color-surface)]/60'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={group.authorPhoto}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover border border-zinc-800"
                          />
                          {renderSegmentedRing(group.stories.length, true, 48)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase text-zinc-300 truncate">
                              {group.authorName}
                            </h4>
                            <span className="text-[9px] text-zinc-500 font-mono shrink-0 ml-1">
                              {formatTimeAgo(latestStory?.createdAt)}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {group.stories.length} viewed{' '}
                            {group.stories.length === 1 ? 'story' : 'stories'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Broadcast Action Bar at Bottom */}
        <div className="p-3 border-t border-[var(--neon-green-border)] bg-[var(--color-surface)]/60">
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => {
                setCreateFormat('text');
                setShowCreateModal(true);
              }}
              className="p-2 flex flex-col items-center justify-center gap-1 rounded-lg bg-[var(--color-background)] border border-zinc-800 hover:border-[var(--neon-green)]/40 hover:text-[var(--neon-green)] transition text-[8.5px] uppercase font-bold"
              title="Broadcast Text Status"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>Text</span>
            </button>
            <button
              onClick={() => {
                setCreateFormat('image');
                setShowCreateModal(true);
              }}
              className="p-2 flex flex-col items-center justify-center gap-1 rounded-lg bg-[var(--color-background)] border border-zinc-800 hover:border-[var(--neon-green)]/40 hover:text-[var(--neon-green)] transition text-[8.5px] uppercase font-bold"
              title="Broadcast Photo Status"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Photo</span>
            </button>
            <button
              onClick={() => {
                setCreateFormat('video');
                setShowCreateModal(true);
              }}
              className="p-2 flex flex-col items-center justify-center gap-1 rounded-lg bg-[var(--color-background)] border border-zinc-800 hover:border-[var(--neon-green)]/40 hover:text-[var(--neon-green)] transition text-[8.5px] uppercase font-bold"
              title="Broadcast Video Clip"
            >
              <Video className="w-3.5 h-3.5 text-rose-400" />
              <span>Video</span>
            </button>
            <button
              onClick={() => {
                setCreateFormat('audio');
                setShowCreateModal(true);
              }}
              className="p-2 flex flex-col items-center justify-center gap-1 rounded-lg bg-[var(--color-background)] border border-zinc-800 hover:border-[var(--neon-green)]/40 hover:text-[var(--neon-green)] transition text-[8.5px] uppercase font-bold"
              title="Broadcast Voice Soundscape"
            >
              <Mic className="w-3.5 h-3.5 text-amber-400" />
              <span>Audio</span>
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT MAIN STAGE: THE BIG SCENE (STANDBY OR FULL IMMERSIVE STORY VIEWER)
          ========================================================================= */}
      <main className="flex-1 min-w-0 h-full flex flex-col relative bg-[#060809] overflow-hidden">
        {activeGroup && activeStory ? (
          /* ================= ACTIVE STORY VIEWER SCENE ================= */
          <div className="relative w-full h-full flex flex-col items-center justify-between p-2 md:p-6 overflow-hidden">
            {/* Top Progress Bars */}
            <div className="w-full max-w-xl flex gap-1.5 px-2 pt-2 z-30">
              {activeGroup.stories.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="h-1 flex-1 bg-zinc-800/90 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-[var(--neon-green)] transition-all duration-75"
                    style={{
                      width:
                        idx < activeStoryIndex
                          ? '100%'
                          : idx === activeStoryIndex
                          ? `${storyProgress}%`
                          : '0%'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Author Header & Navigation Bar */}
            <div className="w-full max-w-xl flex items-center justify-between px-3 py-2 z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3">
                <img
                  src={activeGroup.authorPhoto}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border-2 border-[var(--neon-green)]/60 shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-mono font-black uppercase text-white tracking-wide">
                      {activeGroup.authorName}
                    </h3>
                    {activeGroup.authorId === profile?.uid && (
                      <span className="text-[8px] font-bold text-black bg-[var(--neon-green)] px-1.5 py-0.2 rounded uppercase">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-zinc-400 font-mono mt-0.5">
                    <Clock className="w-3 h-3 text-[var(--neon-green)]" />
                    <span>{formatTimeAgo(activeStory.createdAt)}</span>
                    <span>·</span>
                    <span>
                      Story {activeStoryIndex + 1} of {activeGroup.stories.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1.5">
                {/* Pause / Play Toggle */}
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/50"
                  title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>

                {/* Audio Mute toggle for video/audio */}
                {(activeStory.mediaType === 'video' || activeStory.mediaType === 'audio') && (
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/50"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />
                    )}
                  </button>
                )}

                {/* If own story: Viewers Drawer trigger */}
                {activeGroup.authorId === profile?.uid && (
                  <button
                    onClick={() => setShowViewersModal(!showViewersModal)}
                    className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-emerald-400 hover:text-white transition cursor-pointer border border-emerald-500/30 flex items-center gap-1 text-[10px] font-mono font-bold"
                    title="View Analytics"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{activeStory.viewsCount || activeStory.viewedBy?.length || 0}</span>
                  </button>
                )}

                {/* If own story: Delete trigger */}
                {activeGroup.authorId === profile?.uid && (
                  <button
                    onClick={() => handleDeleteCurrentStory(activeStory.id)}
                    className="p-2 rounded-lg bg-zinc-900/80 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition cursor-pointer border border-zinc-700/50"
                    title="Delete Story"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Close Viewer */}
                <button
                  onClick={() => {
                    playGlitchClickSound();
                    setActiveStoryGroupId(null);
                  }}
                  className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/50"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Media Content Stage */}
            <div className="relative w-full max-w-xl flex-1 flex flex-col items-center justify-center my-2 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
              {/* Left / Right Nav Click zones & Hold-to-pause */}
              <div className="absolute inset-0 z-20 flex">
                <div
                  onMouseDown={handleMouseDown}
                  onMouseUp={(e) => handleMouseUp(e, 'left')}
                  className="w-1/3 h-full cursor-w-resize"
                  title="Previous Story"
                />
                <div
                  onMouseDown={handleMouseDown}
                  onMouseUp={(e) => handleMouseUp(e, 'right')}
                  className="w-2/3 h-full cursor-e-resize"
                  title="Next Story / Hold to Pause"
                />
              </div>

              {/* Floating Prev / Next Arrow buttons on large screens */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevStory();
                }}
                className="hidden md:flex absolute -left-14 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-zinc-900/90 border border-zinc-700 hover:border-[var(--neon-green)] text-zinc-300 hover:text-[var(--neon-green)] items-center justify-center shadow-lg transition hover:scale-110 active:scale-95 cursor-pointer"
                title="Previous Story"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextStory();
                }}
                className="hidden md:flex absolute -right-14 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-zinc-900/90 border border-zinc-700 hover:border-[var(--neon-green)] text-zinc-300 hover:text-[var(--neon-green)] items-center justify-center shadow-lg transition hover:scale-110 active:scale-95 cursor-pointer"
                title="Next Story"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Media Renderer */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStory.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full flex flex-col items-center justify-center select-none"
                >
                  {/* TEXT STORY */}
                  {activeStory.mediaType === 'none' && (
                    <div
                      className={`w-full h-full flex flex-col items-center justify-center p-8 text-center ${
                        GRADIENT_PRESETS.find((p) => p.id === activeStory.gradientPreset)?.bg ||
                        'bg-gradient-to-tr from-indigo-950 via-purple-900 to-fuchsia-950'
                      }`}
                    >
                      <p className="text-xl md:text-2xl font-bold font-serif italic text-white leading-relaxed max-w-md drop-shadow-md whitespace-pre-wrap">
                        "{activeStory.content}"
                      </p>
                    </div>
                  )}

                  {/* IMAGE STORY */}
                  {activeStory.mediaType === 'image' && activeStory.imageUrl && (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                      {/* Ambient blur backdrop */}
                      <img
                        src={activeStory.imageUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none"
                      />
                      {/* Crisp centered image */}
                      <img
                        src={activeStory.imageUrl}
                        alt=""
                        className="relative z-10 max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                      />
                      {activeStory.content && (
                        <div className="absolute bottom-4 left-4 right-4 z-20 bg-black/75 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center">
                          <p className="text-xs text-white font-mono">{activeStory.content}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIDEO STORY */}
                  {activeStory.mediaType === 'video' && activeStory.videoUrl && (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      <video
                        ref={videoRef}
                        src={activeStory.videoUrl}
                        autoPlay
                        loop
                        muted={isMuted}
                        playsInline
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                      {activeStory.content && (
                        <div className="absolute bottom-4 left-4 right-4 z-20 bg-black/75 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center">
                          <p className="text-xs text-white font-mono">{activeStory.content}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AUDIO / VOICE SOUNDSCAPE STORY */}
                  {activeStory.mediaType === 'audio' && activeStory.audioUrl && (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black relative">
                      <audio ref={audioRef} src={activeStory.audioUrl} autoPlay loop muted={isMuted} />

                      {/* Rotating Vinyl & Waveform */}
                      <div className="relative flex items-center justify-center mb-6">
                        <div
                          className={`w-36 h-36 rounded-full bg-gradient-to-tr from-zinc-800 via-zinc-950 to-black border-4 border-emerald-500/40 shadow-2xl flex items-center justify-center ${
                            !isPaused ? 'animate-spin' : ''
                          }`}
                          style={{ animationDuration: '8s' }}
                        >
                          <div className="w-14 h-14 rounded-full bg-[var(--neon-green)] flex items-center justify-center border-4 border-zinc-950 text-black">
                            <Volume2 className="w-6 h-6 animate-pulse" />
                          </div>
                        </div>
                      </div>

                      <div className="text-center space-y-1.5 z-10">
                        <h4 className="text-base font-black font-mono uppercase text-[var(--neon-green)] tracking-wider">
                          {activeStory.musicTitle || 'Campus Audio Broadcast'}
                        </h4>
                        <p className="text-xs font-mono text-zinc-400">
                          {activeStory.musicArtist || activeGroup.authorName}
                        </p>
                      </div>

                      {activeStory.content && (
                        <p className="mt-4 text-xs font-serif italic text-zinc-200 text-center max-w-xs bg-zinc-900/80 px-4 py-2 rounded-xl border border-zinc-800">
                          "{activeStory.content}"
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Interaction Bar (Reactions & Direct Reply) */}
            <div className="w-full max-w-xl z-30 space-y-2 bg-gradient-to-t from-black via-black/80 to-transparent p-2">
              {/* Quick Reactions Bar */}
              <div className="flex justify-center gap-3 py-1">
                {['🔥', '❤️', '😂', '😮', '👏', '💯'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      playLikeSound();
                      triggerEventVibration('like');
                      showBrutalistToast('REACTION DISPATCHED', `${emoji} sent to ${activeGroup.authorName}`, 'success');
                    }}
                    className="hover:scale-130 active:scale-95 transition text-lg p-1 cursor-pointer select-none"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Direct Reply Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendReply();
                  }}
                  placeholder={`Reply to ${activeGroup.authorName.split(' ')[0]}...`}
                  className="flex-1 bg-zinc-900/90 border border-zinc-700 focus:border-[var(--neon-green)] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none transition shadow-inner"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSendingReply}
                  className="px-4 py-2.5 bg-[var(--neon-green)] disabled:opacity-40 text-black font-black text-xs uppercase rounded-xl hover:bg-[var(--neon-green)]/90 transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              </div>
            </div>

            {/* Viewers Modal (When clicking eye on own story) */}
            {showViewersModal && (
              <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4 font-mono">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-white tracking-wider">
                          Story Telemetry Viewers
                        </h4>
                        <p className="text-[9px] text-zinc-400">
                          {activeStory.viewsCount || activeStory.viewedBy?.length || 0} DECRYPTED VIEWS RECORDED
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowViewersModal(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Viewer List */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-900/80 pr-1 space-y-1 scrollbar-thin">
                    {activeStory.viewedBy && activeStory.viewedBy.length > 0 ? (
                      activeStory.viewedBy.map((viewerId) => {
                        const detail = activeStory.viewersDetails?.[viewerId];
                        const matchedUser = registeredUsers.find((u) => u.uid === viewerId);
                        const displayName = detail?.userName || matchedUser?.displayName || 'Registered Peer';
                        const photoURL =
                          detail?.userPhoto ||
                          matchedUser?.photoURL ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150';
                        const isBlocked = blockedUsersList.includes(viewerId);

                        return (
                          <div key={viewerId} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={photoURL}
                                alt=""
                                className="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{displayName}</span>
                                  {isBlocked && (
                                    <span className="text-[8px] bg-rose-500/20 border border-rose-500/40 text-rose-400 px-1 py-0.2 rounded font-bold uppercase">
                                      Blocked
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 mt-0.5">
                                  <Clock className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>
                                    {detail?.viewedAt ? formatTimeAgo(detail.viewedAt) : 'Decrypted & Viewed'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Block / Unblock Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleBlockUser(viewerId, displayName)}
                              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg border transition cursor-pointer ${
                                isBlocked
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40'
                              }`}
                              title={isBlocked ? 'Unblock user from future statuses' : 'Block user from viewing your status'}
                            >
                              {isBlocked ? (
                                <>
                                  <UserCheck className="w-3 h-3 text-emerald-400" />
                                  <span>Unblock</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3 h-3 text-rose-400" />
                                  <span>Block</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-10 text-center text-zinc-500 text-xs space-y-2">
                        <Eye className="w-8 h-8 text-zinc-700 mx-auto animate-pulse" />
                        <p>No peers have decrypted this story yet.</p>
                      </div>
                    )}
                  </div>

                  {/* Footer Shortcut to Full Privacy Manager */}
                  <div className="pt-2 border-t border-zinc-900">
                    <button
                      type="button"
                      onClick={() => {
                        setShowViewersModal(false);
                        setShowPrivacyModal(true);
                      }}
                      className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <ShieldOff className="w-3.5 h-3.5 text-amber-400" />
                      <span>Manage Status Privacy ({blockedUsersList.length} Blocked)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= STANDBY MATRIX SCENE ================= */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <div className="w-full max-w-lg space-y-6">
              {/* Radar Graphic */}
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-[var(--neon-green)]/20 animate-ping" />
                <div className="w-20 h-20 rounded-full border-2 border-[var(--neon-green)]/40 bg-[var(--neon-green)]/10 flex items-center justify-center shadow-[0_0_20px_rgba(0,255,102,0.15)]">
                  <CircleDot className="w-8 h-8 text-[var(--neon-green)] animate-pulse" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-black font-serif italic text-white tracking-wider uppercase">
                  Status Broadcast Terminal
                </h2>
                <p className="text-xs font-mono text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Select a contact on the left terminal to decrypt their ephemeral 24-hour status,
                  or transmit your own multimedia story to the student mesh.
                </p>
              </div>

              {/* Quick Launch Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
                <div
                  onClick={() => {
                    setCreateFormat('text');
                    setShowCreateModal(true);
                  }}
                  className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-sky-500/50 hover:bg-zinc-900 transition cursor-pointer group"
                >
                  <FileText className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition" />
                  <h4 className="text-xs font-bold uppercase text-white">Text Status</h4>
                  <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                    Color gradients & styled typography.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setCreateFormat('image');
                    setShowCreateModal(true);
                  }}
                  className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 transition cursor-pointer group"
                >
                  <ImageIcon className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition" />
                  <h4 className="text-xs font-bold uppercase text-white">Photo / Video</h4>
                  <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                    High-res photos and video clips.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setCreateFormat('audio');
                    setShowCreateModal(true);
                  }}
                  className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900 transition cursor-pointer group"
                >
                  <Mic className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition" />
                  <h4 className="text-xs font-bold uppercase text-white">Voice & Audio</h4>
                  <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                    Soundscapes and vocal notes.
                  </p>
                </div>
              </div>

              {/* Status Stats Pill */}
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900/90 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {storyGroups.length} Active Nodes
                </span>
                <span>·</span>
                <span>{activeStories.length} Total Stories in Network</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          STATUS CREATOR MODAL (TEXT, PHOTO, VIDEO, AUDIO)
          ========================================================================= */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-950 border border-[var(--neon-green-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono"
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--neon-green)]" />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">
                    Broadcast Status Story
                  </h3>
                </div>
                <button
                  onClick={resetCreationForm}
                  className="text-zinc-400 hover:text-white p-1 rounded-md transition"
                  title="Close creator"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Format Selector Tabs */}
              <div className="grid grid-cols-4 border-b border-zinc-800 bg-zinc-900/40 text-[10px] font-bold uppercase">
                <button
                  onClick={() => setCreateFormat('text')}
                  className={`py-2.5 flex items-center justify-center gap-1.5 transition ${
                    createFormat === 'text'
                      ? 'bg-zinc-800 text-sky-400 border-b-2 border-sky-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Text</span>
                </button>
                <button
                  onClick={() => setCreateFormat('image')}
                  className={`py-2.5 flex items-center justify-center gap-1.5 transition ${
                    createFormat === 'image'
                      ? 'bg-zinc-800 text-emerald-400 border-b-2 border-emerald-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Photo</span>
                </button>
                <button
                  onClick={() => setCreateFormat('video')}
                  className={`py-2.5 flex items-center justify-center gap-1.5 transition ${
                    createFormat === 'video'
                      ? 'bg-zinc-800 text-rose-400 border-b-2 border-rose-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video</span>
                </button>
                <button
                  onClick={() => setCreateFormat('audio')}
                  className={`py-2.5 flex items-center justify-center gap-1.5 transition ${
                    createFormat === 'audio'
                      ? 'bg-zinc-800 text-amber-400 border-b-2 border-amber-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Audio</span>
                </button>
              </div>

              {/* Creator Body */}
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* 1. TEXT STATUS FORM */}
                {createFormat === 'text' && (
                  <div className="space-y-4">
                    {/* Live Preview Card */}
                    <div
                      className={`w-full h-44 rounded-xl p-4 flex items-center justify-center text-center shadow-lg transition-all ${
                        GRADIENT_PRESETS.find((p) => p.id === newGradient)?.bg ||
                        'bg-gradient-to-tr from-amber-600 via-rose-600 to-red-700'
                      }`}
                    >
                      <p className="text-base font-serif italic font-bold text-white max-w-xs break-words">
                        {newText || 'Type your status message below...'}
                      </p>
                    </div>

                    {/* Gradient Presets */}
                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1.5">
                        Background Canvas Theme
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {GRADIENT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setNewGradient(preset.id)}
                            className={`w-8 h-8 rounded-full shrink-0 ${preset.bg} border-2 transition ${
                              newGradient === preset.id
                                ? 'border-white scale-110 shadow-md'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                            title={preset.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Text Area */}
                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                        Message Content
                      </label>
                      <textarea
                        rows={3}
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        placeholder="What's happening on campus or in your terminal?..."
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 2. PHOTO STATUS FORM */}
                {createFormat === 'image' && (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />

                    {/* Source Selector Toggle */}
                    <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setMediaInputMode('upload')}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition ${
                          mediaInputMode === 'upload'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaInputMode('link')}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition ${
                          mediaInputMode === 'link'
                            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Image Link</span>
                      </button>
                    </div>

                    {mediaInputMode === 'upload' ? (
                      isUploadingMedia ? (
                        <div className="p-7 rounded-xl border border-dashed border-emerald-500/50 bg-emerald-950/20 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--neon-green)]" />
                          <span className="text-xs font-bold text-white">Compressing & Uploading Photo...</span>
                          <span className="text-[10px] text-zinc-400">Optimizing for ultra-fast story loading</span>
                        </div>
                      ) : newMediaUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black/90">
                          <div className="h-44 flex items-center justify-center p-2 bg-black">
                            <img
                              src={newMediaUrl}
                              alt="Status Preview"
                              className="max-h-full max-w-full object-contain rounded-lg"
                            />
                          </div>
                          <div className="p-2.5 bg-zinc-900/95 border-t border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-white truncate">
                                  {uploadedFileInfo?.name || 'Photo Ready'}
                                </p>
                                {uploadedFileInfo?.size && (
                                  <p className="text-[9px] text-zinc-400">{formatBytes(uploadedFileInfo.size)}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewMediaUrl('');
                                  setUploadedFileInfo(null);
                                }}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingFile(true);
                          }}
                          onDragLeave={() => setIsDraggingFile(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingFile(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-6 rounded-xl border-2 border-dashed cursor-pointer transition flex flex-col items-center justify-center text-center gap-2.5 ${
                            isDraggingFile
                              ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 scale-[1.01]'
                              : 'border-zinc-700 hover:border-emerald-400/80 bg-zinc-900/40 hover:bg-zinc-900/80'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Click to upload photo or drag & drop</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Supports JPG, PNG, WebP, GIF from your device</p>
                          </div>
                          <span className="px-3 py-1 rounded-lg bg-zinc-800 text-[10px] font-bold text-emerald-300 border border-zinc-700">
                            Browse Device Photos
                          </span>
                        </div>
                      )
                    ) : (
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Direct Image URL
                        </label>
                        <input
                          type="url"
                          value={newMediaUrl}
                          onChange={(e) => setNewMediaUrl(e.target.value)}
                          placeholder="https://images.unsplash.com/... or paste image link"
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                        />
                        {newMediaUrl && (
                          <div className="mt-2 h-36 rounded-xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center">
                            <img src={newMediaUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                        Caption (Optional)
                      </label>
                      <input
                        type="text"
                        value={newCaption}
                        onChange={(e) => setNewCaption(e.target.value)}
                        placeholder="Add a short caption..."
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 3. VIDEO STATUS FORM */}
                {createFormat === 'video' && (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*,video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={handleFileSelect}
                    />

                    {/* Source Selector Toggle */}
                    <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setMediaInputMode('upload')}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition ${
                          mediaInputMode === 'upload'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Video</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaInputMode('link')}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition ${
                          mediaInputMode === 'link'
                            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Video Link</span>
                      </button>
                    </div>

                    {mediaInputMode === 'upload' ? (
                      isUploadingMedia ? (
                        <div className="p-7 rounded-xl border border-dashed border-rose-500/50 bg-rose-950/20 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
                          <span className="text-xs font-bold text-white">Uploading Video Stream...</span>
                          <span className="text-[10px] text-zinc-400">Encoding high-definition clip for story node</span>
                        </div>
                      ) : newMediaUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black/90">
                          <div className="h-44 flex items-center justify-center bg-black">
                            <video
                              src={newMediaUrl}
                              controls
                              playsInline
                              loop
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="p-2.5 bg-zinc-900/95 border-t border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Video className="w-4 h-4 text-rose-400 shrink-0" />
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-white truncate">
                                  {uploadedFileInfo?.name || 'Video Clip Ready'}
                                </p>
                                {uploadedFileInfo?.size && (
                                  <p className="text-[9px] text-zinc-400">{formatBytes(uploadedFileInfo.size)}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewMediaUrl('');
                                  setUploadedFileInfo(null);
                                }}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition"
                                title="Remove video"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingFile(true);
                          }}
                          onDragLeave={() => setIsDraggingFile(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingFile(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-6 rounded-xl border-2 border-dashed cursor-pointer transition flex flex-col items-center justify-center text-center gap-2.5 ${
                            isDraggingFile
                              ? 'border-rose-400 bg-rose-950/20 scale-[1.01]'
                              : 'border-zinc-700 hover:border-rose-400/80 bg-zinc-900/40 hover:bg-zinc-900/80'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                            <Video className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Click to upload video or drag & drop</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">MP4, WebM, MOV clips from your camera or files</p>
                          </div>
                          <span className="px-3 py-1 rounded-lg bg-zinc-800 text-[10px] font-bold text-rose-300 border border-zinc-700">
                            Browse Device Videos
                          </span>
                        </div>
                      )
                    ) : (
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Direct Video Stream URL (MP4 / WebM)
                        </label>
                        <input
                          type="url"
                          value={newMediaUrl}
                          onChange={(e) => setNewMediaUrl(e.target.value)}
                          placeholder="https://...mp4 or paste video URL"
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                        />
                        {newMediaUrl && (
                          <div className="mt-2 h-36 rounded-xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center">
                            <video src={newMediaUrl} autoPlay loop muted className="max-h-full max-w-full object-contain" />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                        Caption (Optional)
                      </label>
                      <input
                        type="text"
                        value={newCaption}
                        onChange={(e) => setNewCaption(e.target.value)}
                        placeholder="Add a short caption..."
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 4. AUDIO STATUS FORM (UPLOAD / VOICE RECORD / LINK) */}
                {createFormat === 'audio' && (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,audio/mp3,audio/wav,audio/m4a,audio/webm,audio/ogg,audio/aac"
                      className="hidden"
                      onChange={handleFileSelect}
                    />

                    {/* Source Selector Toggle */}
                    <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          cancelVoiceRecording();
                          setMediaInputMode('upload');
                        }}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition ${
                          mediaInputMode === 'upload'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <FileAudio className="w-3.5 h-3.5" />
                        <span>Upload Audio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaInputMode('record')}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition ${
                          mediaInputMode === 'record'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Record Voice</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          cancelVoiceRecording();
                          setMediaInputMode('link');
                        }}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg transition ${
                          mediaInputMode === 'link'
                            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Audio Link</span>
                      </button>
                    </div>

                    {/* Upload Audio File Mode */}
                    {mediaInputMode === 'upload' && (
                      isUploadingMedia ? (
                        <div className="p-7 rounded-xl border border-dashed border-amber-500/50 bg-amber-950/20 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                          <span className="text-xs font-bold text-white">Uploading Audio Track...</span>
                          <span className="text-[10px] text-zinc-400">Processing audio for streaming playback</span>
                        </div>
                      ) : newMediaUrl && !uploadedFileInfo?.name?.startsWith('Voice Note') ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                                <Headphones className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-white truncate">
                                  {uploadedFileInfo?.name || newAudioTitle || 'Audio Track Ready'}
                                </p>
                                <p className="text-[9px] text-zinc-400">
                                  {uploadedFileInfo?.size ? formatBytes(uploadedFileInfo.size) : 'Ready for playback'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewMediaUrl('');
                                  setUploadedFileInfo(null);
                                }}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition"
                                title="Remove audio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <audio src={newMediaUrl} controls className="w-full h-8" />
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingFile(true);
                          }}
                          onDragLeave={() => setIsDraggingFile(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingFile(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-6 rounded-xl border-2 border-dashed cursor-pointer transition flex flex-col items-center justify-center text-center gap-2.5 ${
                            isDraggingFile
                              ? 'border-amber-400 bg-amber-950/20 scale-[1.01]'
                              : 'border-zinc-700 hover:border-amber-400/80 bg-zinc-900/40 hover:bg-zinc-900/80'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <FileAudio className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Click to upload audio track or podcast clip</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Supports MP3, WAV, M4A, OGG, AAC from your device</p>
                          </div>
                          <span className="px-3 py-1 rounded-lg bg-zinc-800 text-[10px] font-bold text-amber-300 border border-zinc-700">
                            Browse Audio Files
                          </span>
                        </div>
                      )
                    )}

                    {/* Record Voice Note Mode */}
                    {mediaInputMode === 'record' && (
                      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center text-center gap-3">
                        {isRecordingVoice ? (
                          <>
                            <div className="relative flex items-center justify-center my-1">
                              <span className="absolute w-16 h-16 rounded-full bg-rose-500/20 animate-ping" />
                              <div className="w-14 h-14 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-lg">
                                <Mic className="w-6 h-6 animate-pulse" />
                              </div>
                            </div>
                            <div>
                              <p className="text-base font-black text-rose-400 font-mono tracking-wider">
                                {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                              </p>
                              <p className="text-[10px] text-zinc-400 mt-0.5">Recording live audio status stream...</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={stopVoiceRecording}
                                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Stop & Save</span>
                              </button>
                              <button
                                type="button"
                                onClick={cancelVoiceRecording}
                                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : newMediaUrl && uploadedFileInfo?.name?.startsWith('Voice Note') ? (
                          <div className="w-full space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                <Check className="w-4 h-4" />
                                <span>Voice Status Recorded</span>
                              </span>
                              <button
                                type="button"
                                onClick={startVoiceRecording}
                                className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Record Again</span>
                              </button>
                            </div>
                            <audio src={newMediaUrl} controls className="w-full h-8" />
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={startVoiceRecording}
                              className="w-14 h-14 rounded-full bg-rose-600/20 hover:bg-rose-600/30 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 hover:scale-105 transition cursor-pointer shadow-lg"
                            >
                              <Mic className="w-6 h-6" />
                            </button>
                            <div>
                              <p className="text-xs font-bold text-white">Tap to Record Voice Status</p>
                              <p className="text-[10px] text-zinc-400 mt-0.5">Capture real-time voice thought or podcast snippet</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Audio Link Mode */}
                    {mediaInputMode === 'link' && (
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Audio / Voice Stream URL (MP3 / WAV)
                        </label>
                        <input
                          type="url"
                          value={newMediaUrl}
                          onChange={(e) => setNewMediaUrl(e.target.value)}
                          placeholder="https://...mp3 or audio link"
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                        />
                        {newMediaUrl && (
                          <div className="mt-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                            <audio src={newMediaUrl} controls className="w-full h-8" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Track / Title
                        </label>
                        <input
                          type="text"
                          value={newAudioTitle}
                          onChange={(e) => setNewAudioTitle(e.target.value)}
                          placeholder="Voice Broadcast or Track Title"
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          Artist / Voice
                        </label>
                        <input
                          type="text"
                          value={newAudioArtist}
                          onChange={(e) => setNewAudioArtist(e.target.value)}
                          placeholder={profile?.displayName || 'User'}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                        Notes or Lyrics
                      </label>
                      <input
                        type="text"
                        value={newCaption}
                        onChange={(e) => setNewCaption(e.target.value)}
                        placeholder="Additional context or notes..."
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--neon-green)] rounded-xl p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Info Note */}
                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-[9px] text-emerald-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>This status will automatically expire and self-destruct after 24 hours.</span>
                </div>

                {/* Audience Privacy Selector */}
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white uppercase">Status Privacy</p>
                      <p className="text-[9px] text-zinc-400">
                        {blockedUsersList.length === 0
                          ? 'Visible to all student peers on Flick'
                          : `Restricted: Hidden from ${blockedUsersList.length} blocked peer${blockedUsersList.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-[9px] font-bold uppercase transition cursor-pointer"
                  >
                    Configure
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetCreationForm}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublishStory}
                  disabled={isPublishing || isUploadingMedia || isRecordingVoice}
                  className="px-5 py-2 bg-[var(--neon-green)] hover:bg-[var(--neon-green)]/90 text-black font-black text-xs uppercase rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isUploadingMedia ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading File...</span>
                    </>
                  ) : isRecordingVoice ? (
                    <>
                      <Mic className="w-3.5 h-3.5 animate-pulse text-red-700" />
                      <span>Recording Voice...</span>
                    </>
                  ) : isPublishing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Broadcasting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Broadcast Status</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          STATUS PRIVACY & BLOCKED VIEWERS MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-mono flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ShieldOff className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-wider">
                      Status Story Privacy
                    </h3>
                    <p className="text-[9px] text-zinc-400">
                      RESTRICT WHO CAN VIEW YOUR 24-HOUR BROADCASTS
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Overview / Stats Banner */}
              <div className="p-4 bg-zinc-900/30 border-b border-zinc-900 space-y-3">
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[10px] text-amber-300 leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Contacts added to your blocked list cannot view your current or future status updates.
                    Peers are not notified when they are blocked or unblocked.
                  </span>
                </div>

                {/* Filter Search */}
                <div className="relative flex items-center border border-zinc-800 bg-zinc-900/80 px-3 py-2 rounded-xl focus-within:border-[var(--neon-green)] transition">
                  <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={privacySearchQuery}
                    onChange={(e) => setPrivacySearchQuery(e.target.value)}
                    placeholder="Search peers to block or allow..."
                    className="w-full bg-transparent text-xs font-mono text-white placeholder-zinc-500 focus:outline-none"
                  />
                  {privacySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPrivacySearchQuery('')}
                      className="text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Contact List */}
              <div className="flex-1 overflow-y-auto p-4 divide-y divide-zinc-900 space-y-1">
                {registeredUsers
                  .filter((u) => u.uid !== profile?.uid)
                  .filter((u) => {
                    if (!privacySearchQuery.trim()) return true;
                    const query = privacySearchQuery.toLowerCase();
                    return (
                      (u.displayName && u.displayName.toLowerCase().includes(query)) ||
                      (u.email && u.email.toLowerCase().includes(query)) ||
                      (u.uid && u.uid.toLowerCase().includes(query))
                    );
                  })
                  .map((targetUser) => {
                    const isBlocked = blockedUsersList.includes(targetUser.uid);
                    const userName = targetUser.displayName || 'Campus Peer';

                    return (
                      <div
                        key={targetUser.uid}
                        className="py-3 flex items-center justify-between gap-3 hover:bg-zinc-900/40 px-2 rounded-xl transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              targetUser.photoURL ||
                              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'
                            }
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate flex items-center gap-2">
                              <span>{userName}</span>
                              {isBlocked ? (
                                <span className="text-[8px] bg-rose-500/20 border border-rose-500/40 text-rose-400 px-1.5 py-0.2 rounded font-bold uppercase">
                                  Blocked
                                </span>
                              ) : (
                                <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-1.5 py-0.2 rounded font-bold uppercase">
                                  Allowed
                                </span>
                              )}
                            </p>
                            <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                              {targetUser.statusBio || targetUser.email || 'Flick Network Member'}
                            </p>
                          </div>
                        </div>

                        {/* Block / Unblock Button */}
                        <button
                          type="button"
                          disabled={isUpdatingPrivacy}
                          onClick={() => handleToggleBlockUser(targetUser.uid, userName)}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer disabled:opacity-40 ${
                            isBlocked
                              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-rose-400 hover:border-rose-500/40'
                          }`}
                        >
                          {isBlocked ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Unblock</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5 text-rose-400" />
                              <span>Block</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}

                {registeredUsers.filter((u) => u.uid !== profile?.uid).length === 0 && (
                  <div className="py-12 text-center text-zinc-500 text-xs">
                    No other registered student peers found.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">
                  {blockedUsersList.length} peer{blockedUsersList.length === 1 ? '' : 's'} currently blocked
                </span>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase rounded-xl transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
