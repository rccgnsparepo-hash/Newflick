import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Share2,
  Heart,
  Flame,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Type,
  Sun,
  Moon,
  Coffee,
  Globe,
  BookOpen,
  MessageSquare,
  Repeat2,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  Flag,
  Copy,
  Check,
  Eye,
  Info,
  RotateCw,
  ExternalLink,
  Lock
} from 'lucide-react';
import { NewsArticle, FullArticleContent, NewsComment, InAppReaderPreferences } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { getBackendUrl } from '../../lib/bootstrap';
import { playGlitchClickSound, playLikeSound } from '../../lib/sounds';
import { NewsRealtimeLoader } from './NewsRealtimeLoader';
import { StoryGroupCluster } from './StoryGroupCluster';

interface InAppArticleReaderProps {
  article: NewsArticle | null;
  allArticles?: NewsArticle[];
  currentIndex?: number;
  onNavigateArticle?: (article: NewsArticle) => void;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (articleId: string, e: React.MouseEvent) => void;
  onShare: (article: NewsArticle) => void;
  onShareToTimeline?: (article: NewsArticle, comment?: string) => void;
  currentUser?: any;
  followedSources: Set<string>;
  onToggleFollow: (sourceId: string) => void;
  showToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const InAppArticleReader: React.FC<InAppArticleReaderProps> = ({
  article,
  allArticles = [],
  currentIndex = 0,
  onNavigateArticle,
  onClose,
  isSaved,
  onToggleSave,
  onShare,
  onShareToTimeline,
  currentUser,
  followedSources,
  onToggleFollow,
  showToast
}) => {
  const [fullContent, setFullContent] = useState<FullArticleContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [viewMode, setViewMode] = useState<'reader' | 'webview'>('reader');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [readerTheme, setReaderTheme] = useState<'pitch' | 'dark' | 'sepia' | 'paper'>('pitch');
  const [readingProgress, setReadingProgress] = useState(0);

  // Audio Speech synthesis
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Comments & Social state
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [reactions, setReactions] = useState<{ [type: string]: number }>({});
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineThought, setTimelineThought] = useState('');
  const [isZoomImageOpen, setIsZoomImageOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Load preferences from newsService
  useEffect(() => {
    const prefs = newsService.getInAppReaderPreferences();
    if (prefs.fontSize) setFontSize(prefs.fontSize);
    if (prefs.theme) setReaderTheme(prefs.theme);
  }, []);

  // Fetch full article content when article changes
  useEffect(() => {
    if (!article) return;

    // Reset speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }

    // Instantly populate reader with tailored article data so user immediately sees their specific story
    setFullContent(newsService.createInstantArticleContent(article));
    setIsLoadingContent(true);
    newsService.recordView(article.id);

    // Baseline stats
    setReactions({
      like: article.reactionCount || 14,
      fire: Math.floor((article.reactionCount || 10) * 0.45),
      insight: Math.floor((article.reactionCount || 10) * 0.28)
    });
    setUserReaction(article.userReactionType || null);

    // Load comments
    newsService.getComments(article.id).then(setComments);

    // Fetch full extracted article content (no redirect)
    newsService.getFullArticleContent(article.articleUrl, article.id, article).then(data => {
      if (data) {
        setFullContent(data);
      }
      setIsLoadingContent(false);
    }).catch(() => {
      setIsLoadingContent(false);
    });
  }, [article?.id, article?.articleUrl]);

  // Handle Scroll Reading Progress
  const handleScroll = () => {
    if (!contentContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentContainerRef.current;
    if (scrollHeight <= clientHeight) {
      setReadingProgress(100);
      return;
    }
    const percent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    setReadingProgress(Math.min(100, Math.max(0, percent)));
  };

  // Keyboard navigation for reading in one go: Left/Right arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, allArticles]);

  if (!article) return null;

  const currentStoryIndex = allArticles.findIndex(a => a.id === article.id);
  const totalStories = allArticles.length;
  const hasPrev = currentStoryIndex > 0;
  const hasNext = currentStoryIndex >= 0 && currentStoryIndex < totalStories - 1;

  const handlePrev = () => {
    if (hasPrev && onNavigateArticle) {
      playGlitchClickSound();
      onNavigateArticle(allArticles[currentStoryIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigateArticle) {
      playGlitchClickSound();
      onNavigateArticle(allArticles[currentStoryIndex + 1]);
    }
  };

  // Text to Speech
  const toggleSpeech = () => {
    if (!window.speechSynthesis) {
      if (showToast) showToast('AUDIO ERROR', 'Speech synthesis is not supported on this browser device.', 'warning');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();

    const titleText = fullContent?.title || article.title;
    const bodyText = fullContent?.paragraphs?.map(p => p.text).filter(Boolean).join('. ') || article.excerpt;
    const speechText = `${titleText}. By ${fullContent?.byline || article.sourceName}. ${bodyText}`;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    if (showToast) showToast('AUDIO WIRE', 'Streaming voice narration of full story...', 'info');
  };

  const changeFontSize = (next: 'sm' | 'base' | 'lg' | 'xl') => {
    playGlitchClickSound();
    setFontSize(next);
    newsService.saveInAppReaderPreferences({ fontSize: next });
  };

  const changeTheme = (next: 'pitch' | 'dark' | 'sepia' | 'paper') => {
    playGlitchClickSound();
    setReaderTheme(next);
    newsService.saveInAppReaderPreferences({ theme: next });
  };

  const handleReactionClick = (type: string) => {
    playLikeSound();
    const isRemoving = userReaction === type;
    const nextType = isRemoving ? '' : type;
    setUserReaction(isRemoving ? null : type);

    setReactions(prev => ({
      ...prev,
      [type]: Math.max(0, (prev[type] || 0) + (isRemoving ? -1 : 1))
    }));

    newsService.reactToArticle(article.id, nextType, currentUser?.id);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setIsSubmittingComment(true);
    playGlitchClickSound();

    const comment = await newsService.postComment(article.id, {
      userId: currentUser?.id || 'local-user',
      userName: currentUser?.displayName || currentUser?.name || 'FLICK Citizen',
      userUsername: currentUser?.username || 'user',
      userPhoto: currentUser?.photoURL,
      userVerified: currentUser?.verified || false,
      content: newCommentText.trim(),
      replyToId: replyTo?.id,
      replyToUserName: replyTo?.name
    });

    if (comment) {
      setComments(prev => [comment, ...prev]);
      setNewCommentText('');
      setReplyTo(null);
      playLikeSound();
      if (showToast) showToast('COMMENT POSTED', 'Your perspective was recorded on the wire.', 'success');
    }
    setIsSubmittingComment(false);
  };

  const handleCopyLink = () => {
    playGlitchClickSound();
    navigator.clipboard.writeText(article.articleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (showToast) showToast('COPIED', 'Article link copied to clipboard.', 'success');
  };

  const handleTimelineShare = () => {
    if (onShareToTimeline) {
      onShareToTimeline(article, timelineThought);
      setShowTimelineModal(false);
      setTimelineThought('');
    }
  };

  // Theme styling classes
  const getThemeContainerClass = () => {
    switch (readerTheme) {
      case 'paper':
        return 'bg-[#fbfbf8] text-[#1c1917] border-zinc-300';
      case 'sepia':
        return 'bg-[#f4ecd8] text-[#3f2e18] border-[#dfd0b2]';
      case 'dark':
        return 'bg-zinc-900 text-zinc-100 border-zinc-800';
      case 'pitch':
      default:
        return 'bg-zinc-950 text-zinc-100 border-zinc-800';
    }
  };

  const getThemeTextClass = () => {
    switch (readerTheme) {
      case 'paper':
        return 'text-[#292524]';
      case 'sepia':
        return 'text-[#443019]';
      case 'dark':
        return 'text-zinc-200';
      case 'pitch':
      default:
        return 'text-zinc-200';
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm':
        return 'text-sm leading-relaxed';
      case 'lg':
        return 'text-lg sm:text-xl leading-loose';
      case 'xl':
        return 'text-xl sm:text-2xl leading-loose';
      case 'base':
      default:
        return 'text-base sm:text-lg leading-relaxed';
    }
  };

  const isFollowing = followedSources.has(article.sourceId);
  const leadPhoto = fullContent?.leadImage || newsService.getHighResImageUrl(article.imageUrl, article.category);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-3 overflow-hidden font-mono select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 15 }}
        className="w-full h-full max-w-5xl bg-zinc-950 border-2 border-zinc-800 shadow-[10px_10px_0_0_#000] flex flex-col overflow-hidden relative"
      >
        {/* Sticky Top Reading Progress Line */}
        <div className="w-full h-1 bg-zinc-900 shrink-0 relative overflow-hidden">
          <div
            className="h-full bg-[var(--neon-green)] transition-all duration-150 ease-out"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {/* Top Floating Control Bar */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0 gap-2 flex-wrap sm:flex-nowrap">
          {/* Source attribution and follow */}
          <div className="flex items-center gap-2 min-w-0">
            {article.sourceLogo && (
              <img
                src={article.sourceLogo}
                alt={article.sourceName}
                className="w-5 h-5 object-contain rounded-sm"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            )}
            <div className="truncate flex items-center gap-1.5">
              <span className="text-xs font-black text-white truncate">
                {article.sourceName}
              </span>
              {article.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--neon-green)] fill-black shrink-0" />
              )}
            </div>

            <button
              onClick={() => onToggleFollow(article.sourceId)}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase border transition cursor-pointer shrink-0 ${
                isFollowing
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  : 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-black'
              }`}
            >
              {isFollowing ? 'Following' : '+ Follow'}
            </button>
          </div>

          {/* Center Navigation: "Read in One Go" Prev / Next story controls */}
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 border border-zinc-800 rounded-sm">
            <button
              onClick={handlePrev}
              disabled={!hasPrev}
              className={`p-1 flex items-center gap-1 text-[11px] font-bold uppercase transition ${
                hasPrev
                  ? 'text-zinc-300 hover:text-[var(--neon-green)] cursor-pointer'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
              title="Previous story (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden md:inline">Prev</span>
            </button>

            {totalStories > 0 && (
              <span className="text-[10px] text-zinc-400 font-mono px-1.5 border-x border-zinc-800">
                {currentStoryIndex + 1} / {totalStories}
              </span>
            )}

            <button
              onClick={handleNext}
              disabled={!hasNext}
              className={`p-1 flex items-center gap-1 text-[11px] font-bold uppercase transition ${
                hasNext
                  ? 'text-zinc-300 hover:text-[var(--neon-green)] cursor-pointer'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
              title="Next story (Right Arrow)"
            >
              <span className="hidden md:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Action Tools: Font Scale, Themes, TTS, Save, Repost, Close */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* View Mode Toggle: Clean Reader vs In-App Web View */}
            <div className="flex items-center border border-zinc-700 bg-zinc-950 p-0.5 text-[10px]">
              <button
                onClick={() => setViewMode('reader')}
                className={`px-2 py-1 font-bold uppercase transition cursor-pointer flex items-center gap-1 ${
                  viewMode === 'reader' ? 'bg-[var(--neon-green)] text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span className="hidden sm:inline">Reader</span>
              </button>
              <button
                onClick={() => setViewMode('webview')}
                className={`px-2 py-1 font-bold uppercase transition cursor-pointer flex items-center gap-1 ${
                  viewMode === 'webview' ? 'bg-[var(--neon-green)] text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span className="hidden sm:inline">Wire Frame</span>
              </button>
            </div>

            {/* Font Size Selector */}
            <div className="hidden lg:flex items-center bg-zinc-950 border border-zinc-850 px-1 py-0.5 text-[10px] gap-1 text-zinc-400">
              <button
                onClick={() => changeFontSize('sm')}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${fontSize === 'sm' ? 'bg-zinc-800 text-[var(--neon-green)] font-bold' : ''}`}
                title="Small font"
              >
                A-
              </button>
              <button
                onClick={() => changeFontSize('base')}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${fontSize === 'base' ? 'bg-zinc-800 text-[var(--neon-green)] font-bold' : ''}`}
                title="Standard font"
              >
                A
              </button>
              <button
                onClick={() => changeFontSize('lg')}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${fontSize === 'lg' ? 'bg-zinc-800 text-[var(--neon-green)] font-bold' : ''}`}
                title="Large font"
              >
                A+
              </button>
              <button
                onClick={() => changeFontSize('xl')}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${fontSize === 'xl' ? 'bg-zinc-800 text-[var(--neon-green)] font-bold' : ''}`}
                title="Extra large font"
              >
                A++
              </button>
            </div>

            {/* Reading Theme Selector */}
            <div className="hidden md:flex items-center bg-zinc-950 border border-zinc-850 px-1 py-0.5 text-[10px] gap-1 text-zinc-400">
              <button
                onClick={() => changeTheme('pitch')}
                className={`p-1 rounded cursor-pointer ${readerTheme === 'pitch' ? 'bg-zinc-800 text-[var(--neon-green)]' : ''}`}
                title="OLED Pitch Black"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => changeTheme('sepia')}
                className={`p-1 rounded cursor-pointer ${readerTheme === 'sepia' ? 'bg-amber-900/50 text-amber-300' : ''}`}
                title="Vintage Sepia"
              >
                <Coffee className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => changeTheme('paper')}
                className={`p-1 rounded cursor-pointer ${readerTheme === 'paper' ? 'bg-zinc-200 text-zinc-900' : ''}`}
                title="Editorial Paper Light"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Text To Speech Narration */}
            <button
              onClick={toggleSpeech}
              className={`p-1.5 border transition cursor-pointer flex items-center gap-1 text-xs ${
                isPlayingAudio
                  ? 'bg-rose-950 text-rose-300 border-rose-500 animate-pulse'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
              }`}
              title={isPlayingAudio ? "Stop Narration" : "Listen to Story"}
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Save Bookmark */}
            <button
              onClick={(e) => onToggleSave(article.id, e)}
              className={`p-1.5 border transition cursor-pointer ${
                isSaved
                  ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-bold'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
              }`}
              title={isSaved ? "Saved in Vault" : "Save Article"}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>

            {/* Repost to Timeline */}
            {onShareToTimeline && (
              <button
                onClick={() => setShowTimelineModal(true)}
                className="p-1.5 bg-zinc-800 hover:bg-emerald-950 text-zinc-300 hover:text-[var(--neon-green)] border border-zinc-700 hover:border-[var(--neon-green)] transition cursor-pointer"
                title="Repost to FLICK Social Timeline"
              >
                <Repeat2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 border border-zinc-700 hover:border-rose-500 transition cursor-pointer"
              title="Close reader (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div
          ref={contentContainerRef}
          onScroll={handleScroll}
          className={`flex-1 overflow-y-auto ${getThemeContainerClass()} transition-colors duration-200`}
        >
          {viewMode === 'webview' ? (
            /* In-App Live Wire Web Frame (Zero redirection, authentic live webpage) */
            <div className="w-full h-full flex flex-col bg-zinc-950">
              {/* In-App Browser Address & Controls Bar */}
              <div className="p-2.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between gap-2 text-xs text-zinc-400 font-mono">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={() => {
                      setIsIframeLoading(true);
                      setIframeKey(k => k + 1);
                      playGlitchClickSound();
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition cursor-pointer shrink-0"
                    title="Reload live page"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isIframeLoading ? 'animate-spin text-[var(--neon-green)]' : ''}`} />
                  </button>

                  <div className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 px-2.5 py-1 flex items-center gap-2 text-[11px] truncate">
                    <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-zinc-500 shrink-0">Live Wire:</span>
                    <span className="text-zinc-300 truncate select-all">{article.articleUrl}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setViewMode('reader');
                      playGlitchClickSound();
                    }}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 flex items-center gap-1 cursor-pointer text-[11px] font-sans"
                    title="Switch to Clean Reader mode"
                  >
                    <BookOpen className="w-3 h-3 text-[var(--neon-green)]" />
                    <span className="hidden sm:inline">Clean Reader</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="px-2 py-1 bg-zinc-800 text-zinc-300 border border-zinc-700 hover:text-white flex items-center gap-1 cursor-pointer text-[11px]"
                    title="Copy Article URL"
                  >
                    {copied ? <Check className="w-3 h-3 text-[var(--neon-green)]" /> : <Copy className="w-3 h-3" />}
                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <a
                    href={article.articleUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="p-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 hover:text-white flex items-center gap-1 cursor-pointer"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Live Webview Container */}
              <div className="relative w-full flex-1 min-h-[500px] bg-zinc-950">
                {isIframeLoading && (
                  <div className="absolute inset-0 z-10 bg-zinc-950/85 backdrop-blur-xs flex items-center justify-center p-4">
                    <NewsRealtimeLoader
                      isCompact={true}
                      statusText={`CONNECTING DIRECT WIRE STREAM: ${article.sourceName.toUpperCase()}...`}
                    />
                  </div>
                )}
                <iframe
                  key={iframeKey}
                  src={`${getBackendUrl()}/api/news/proxy-article?url=${encodeURIComponent(article.articleUrl)}`}
                  className="w-full h-full min-h-[600px] border-0 bg-white"
                  title={article.title}
                  onLoad={() => setIsIframeLoading(false)}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
                />
              </div>
            </div>
          ) : (
            /* Clean Rich In-App Reader */
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
              {isLoadingContent ? (
                <NewsRealtimeLoader
                  isCompact={false}
                  statusText="DECODING FULL WIRE ARTICLE & HIGH-RES MEDIA..."
                />
              ) : (
                <>
                  {/* Category, Date & Read Time Badges */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono opacity-80 border-b border-current/15 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-[var(--neon-green)] text-black font-black uppercase tracking-wider text-[10px]">
                        {article.category} {article.subCategory ? `· ${article.subCategory}` : ''}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-bold">
                        <Clock className="w-3 h-3" />
                        {fullContent?.readTime || article.readTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono opacity-70">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(fullContent?.publishedAt || article.publishedAt).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  </div>

                  {/* Master Headline */}
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-snug font-sans">
                    {fullContent?.title || article.title}
                  </h1>

                  {/* Byline / Author Attribution */}
                  <div className="flex items-center justify-between gap-3 text-xs font-mono opacity-80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="opacity-60">Reported by:</span>
                      <span className="font-bold underline decoration-[var(--neon-green)]">
                        {fullContent?.byline || article.author || article.sourceName}
                      </span>
                      <span className="opacity-40">·</span>
                      <span className="opacity-70 font-semibold">{article.sourceName} Verified Desk</span>
                    </div>
                  </div>

                  {/* High-Resolution Lead Photography */}
                  {leadPhoto && (
                    <div className="w-full space-y-2 group">
                      <div
                        onClick={() => setIsZoomImageOpen(true)}
                        className="w-full bg-black/40 border border-current/20 overflow-hidden relative cursor-zoom-in"
                      >
                        <img
                          src={leadPhoto}
                          alt={article.title}
                          className="w-full max-h-[480px] object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                          referrerPolicy="no-referrer"
                          loading="eager"
                        />
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm border border-zinc-700 text-[10px] font-mono text-zinc-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <Maximize2 className="w-3 h-3" /> Zoom 4K
                        </div>
                      </div>
                      <div className="px-1 text-[11px] font-mono opacity-60 flex items-center justify-between">
                        <span>Photo: {article.sourceName} editorial wire</span>
                        <span>High-Resolution uncompressed capture</span>
                      </div>
                    </div>
                  )}

                  {/* Key Takeaways Box if available */}
                  {fullContent?.summaryPoints && fullContent.summaryPoints.length > 0 && (
                    <div className="p-4 bg-current/5 border-l-4 border-[var(--neon-green)] text-sm font-sans space-y-2">
                      <div className="text-xs font-mono font-black uppercase tracking-widest text-[var(--neon-green)] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> KEY WIRE DISPATCH
                      </div>
                      {fullContent.summaryPoints.map((pt, i) => (
                        <p key={i} className="leading-relaxed font-medium">
                          {pt}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Full Extracted Article Body Paragraphs */}
                  <div className={`space-y-5 font-sans ${getThemeTextClass()} ${getFontSizeClass()}`}>
                    {fullContent?.paragraphs?.map((p, idx) => {
                      if (p.type === 'h2') {
                        return (
                          <h2 key={idx} className="text-xl sm:text-2xl font-black pt-4 font-sans tracking-tight border-b border-current/10 pb-2">
                            {p.text}
                          </h2>
                        );
                      }
                      if (p.type === 'h3') {
                        return (
                          <h3 key={idx} className="text-lg sm:text-xl font-bold pt-2 font-sans">
                            {p.text}
                          </h3>
                        );
                      }
                      if (p.type === 'blockquote') {
                        return (
                          <blockquote key={idx} className="my-6 pl-4 border-l-4 border-[var(--neon-green)] italic opacity-95 text-base sm:text-lg bg-current/5 py-2 pr-3">
                            {p.text}
                          </blockquote>
                        );
                      }
                      if (p.type === 'image' && p.src) {
                        return (
                          <div key={idx} className="my-6 space-y-1.5">
                            <img
                              src={p.src}
                              alt={p.caption || 'Article image'}
                              className="w-full max-h-96 object-cover border border-current/20"
                              referrerPolicy="no-referrer"
                            />
                            {p.caption && (
                              <p className="text-xs font-mono opacity-60 italic">{p.caption}</p>
                            )}
                          </div>
                        );
                      }
                      if (p.type === 'lead') {
                        return (
                          <p key={idx} className="text-lg sm:text-xl font-semibold leading-relaxed border-b border-current/10 pb-4">
                            {p.text}
                          </p>
                        );
                      }
                      return (
                        <p key={idx} className="leading-relaxed text-justify sm:text-left">
                          {p.text}
                        </p>
                      );
                    })}
                  </div>

                  {/* Clustered coverage across other verified outlets */}
                  {article.clusterSources && article.clusterSources.length > 0 && (
                    <div className="p-4 bg-zinc-900 border border-zinc-800 mt-6">
                      <StoryGroupCluster sources={article.clusterSources} />
                    </div>
                  )}

                  {/* In-App Source Transparency Banner */}
                  <div className="p-4 bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300 space-y-2 mt-8">
                    <div className="flex items-center gap-2 text-white font-bold">
                      <ShieldCheck className="w-4 h-4 text-[var(--neon-green)]" />
                      <span>FLICK ZERO-REDIRECTION JOURNALISM GUARANTEE</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed">
                      This article was aggregated from verified RSS wire feeds provided by {article.sourceName}. FLICK displays the full text natively inside your current session with no forced external browser popups.
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-bold uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied Link' : 'Copy Original Wire URL'}</span>
                      </button>
                      <button
                        onClick={() => setViewMode('webview')}
                        className="px-3 py-1.5 bg-[var(--neon-green)] text-black font-bold uppercase text-[11px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Switch to In-App Web Frame</span>
                      </button>
                    </div>
                  </div>

                  {/* Social Reactions Bar */}
                  <div className="flex items-center justify-between gap-3 p-4 bg-zinc-900 border border-zinc-800 flex-wrap mt-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase">REACTIONS:</span>
                      <button
                        onClick={() => handleReactionClick('like')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition cursor-pointer ${
                          userReaction === 'like'
                            ? 'bg-rose-950 text-rose-400 border-rose-500 font-bold'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${userReaction === 'like' ? 'fill-rose-500' : ''}`} />
                        <span>{reactions.like || 0}</span>
                      </button>

                      <button
                        onClick={() => handleReactionClick('fire')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition cursor-pointer ${
                          userReaction === 'fire'
                            ? 'bg-amber-950 text-amber-400 border-amber-500 font-bold'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        <Flame className={`w-4 h-4 ${userReaction === 'fire' ? 'fill-amber-400 text-amber-400' : ''}`} />
                        <span>{reactions.fire || 0}</span>
                      </button>

                      <button
                        onClick={() => handleReactionClick('insight')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition cursor-pointer ${
                          userReaction === 'insight'
                            ? 'bg-blue-950 text-blue-400 border-blue-500 font-bold'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span>{reactions.insight || 0}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {onShareToTimeline && (
                        <button
                          onClick={() => setShowTimelineModal(true)}
                          className="px-3 py-1.5 bg-[var(--neon-green)] text-black font-black text-xs uppercase flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Repeat2 className="w-3.5 h-3.5" />
                          <span>Repost to FLICK</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowReportModal(true)}
                        className="text-xs text-zinc-500 hover:text-rose-400 flex items-center gap-1 p-1 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Read in One Go: Bottom Next Story Prompt */}
                  {hasNext && (
                    <div className="p-5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-[var(--neon-green)]/40 flex items-center justify-between gap-4 mt-8">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono text-[var(--neon-green)] font-black uppercase tracking-wider">
                          CONTINUE READING IN ONE GO (NEXT STORY)
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-white truncate mt-1">
                          {allArticles[currentStoryIndex + 1]?.title}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate">
                          {allArticles[currentStoryIndex + 1]?.sourceName} · {allArticles[currentStoryIndex + 1]?.readTime}
                        </p>
                      </div>
                      <button
                        onClick={handleNext}
                        className="px-4 py-2.5 bg-[var(--neon-green)] hover:bg-emerald-400 text-black font-black text-xs uppercase flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-[4px_4px_0_0_#000]"
                      >
                        <span>NEXT STORY</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Community Discussion Section */}
                  <div className="border-t border-zinc-800 pt-8 mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[var(--neon-green)]" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          CITIZEN DISCUSSION ({comments.length})
                        </h3>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Realtime in-app thread
                      </span>
                    </div>

                    {/* Post Comment Input */}
                    <form onSubmit={handlePostComment} className="mb-6 bg-zinc-900 p-3.5 border border-zinc-800">
                      {replyTo && (
                        <div className="flex items-center justify-between text-xs text-[var(--neon-green)] bg-zinc-950 px-2.5 py-1 mb-2 border border-zinc-800">
                          <span>Replying to @{replyTo.name}</span>
                          <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Add your verified analysis or commentary on this dispatch..."
                        className="w-full bg-zinc-950 text-xs text-white p-3 border border-zinc-800 focus:border-[var(--neon-green)] focus:outline-none resize-none font-mono min-h-[70px]"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-zinc-500">
                          Posting as {currentUser?.displayName || 'Citizen'}
                        </span>
                        <button
                          type="submit"
                          disabled={isSubmittingComment || !newCommentText.trim()}
                          className="px-4 py-1.5 bg-[var(--neon-green)] hover:bg-emerald-400 text-black font-black text-xs uppercase flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Transmit</span>
                        </button>
                      </div>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-3">
                      {comments.length === 0 ? (
                        <div className="p-6 text-center text-xs text-zinc-600 bg-zinc-900/40 border border-zinc-850">
                          No citizen commentary recorded yet. Be the first to discuss.
                        </div>
                      ) : (
                        comments.map((comm) => (
                          <div key={comm.id} className="p-3.5 bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-[var(--neon-green)]">
                                  {comm.userName ? comm.userName[0].toUpperCase() : 'U'}
                                </div>
                                <span className="font-bold text-white">{comm.userName}</span>
                                {comm.userVerified && (
                                  <CheckCircle2 className="w-3 h-3 text-[var(--neon-green)] fill-black" />
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 font-mono leading-relaxed pl-7">
                              {comm.replyToUserName && (
                                <span className="text-[var(--neon-green)] mr-1.5">@{comm.replyToUserName}</span>
                              )}
                              {comm.content}
                            </p>
                            <div className="flex items-center justify-end gap-3 pl-7 pt-1 text-[11px] text-zinc-500">
                              <button
                                onClick={() => setReplyTo({ id: comm.id, name: comm.userName })}
                                className="hover:text-[var(--neon-green)] transition cursor-pointer"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* High-Res Fullscreen Image Zoom Modal */}
      <AnimatePresence>
        {isZoomImageOpen && leadPhoto && (
          <div
            onClick={() => setIsZoomImageOpen(false)}
            className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-6xl max-h-[90vh] flex flex-col items-center"
            >
              <img
                src={leadPhoto}
                alt={article.title}
                className="max-w-full max-h-[85vh] object-contain border-2 border-zinc-700 shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="mt-3 p-2 bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 text-center">
                <span>{article.sourceName} Verified High-Resolution Photography · Tap anywhere to close</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Repost to FLICK Social Timeline Dialog */}
      <AnimatePresence>
        {showTimelineModal && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-950 border-2 border-zinc-700 p-5 space-y-4 font-mono shadow-[8px_8px_0_0_#000]"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                  <Repeat2 className="w-4 h-4 text-[var(--neon-green)]" />
                  REPOST WIRE DISPATCH TO SOCIAL TIMELINE
                </span>
                <button onClick={() => setShowTimelineModal(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-zinc-900 border border-zinc-800 text-xs">
                <span className="text-[10px] text-[var(--neon-green)] font-bold uppercase block mb-1">
                  [{article.sourceName}]
                </span>
                <p className="font-bold text-white line-clamp-2">{article.title}</p>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Your Analysis or Perspective (Optional):
                </label>
                <textarea
                  value={timelineThought}
                  onChange={(e) => setTimelineThought(e.target.value)}
                  placeholder="What's your take on this development?"
                  className="w-full bg-zinc-900 text-xs text-white p-3 border border-zinc-800 focus:border-[var(--neon-green)] focus:outline-none resize-none min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowTimelineModal(false)}
                  className="px-3 py-1.5 bg-zinc-900 text-zinc-400 hover:text-white text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTimelineShare}
                  className="px-4 py-1.5 bg-[var(--neon-green)] text-black font-black text-xs uppercase flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Deploy Post</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Moderation Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-950 border-2 border-rose-900 p-5 space-y-3 font-mono">
              <h4 className="text-xs font-bold text-rose-400 uppercase flex items-center gap-1.5">
                <Flag className="w-4 h-4" /> REPORT WIRE CONTENT
              </h4>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe inaccuracy, copyright concern, or policy violation..."
                className="w-full bg-zinc-900 text-xs text-white p-2.5 border border-zinc-800 min-h-[70px]"
              />
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setShowReportModal(false)} className="px-3 py-1 bg-zinc-900 text-xs text-zinc-400">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    newsService.reportContent(article.id, reportReason, currentUser?.id);
                    setShowReportModal(false);
                    setReportReason('');
                    if (showToast) showToast('REPORT FILED', 'Flagged for editorial moderation.', 'info');
                  }}
                  className="px-3 py-1 bg-rose-600 text-white font-bold text-xs"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
