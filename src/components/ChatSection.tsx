import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOperations } from '../contexts/OperationContext';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { UserProfile, ChatMessage, DirectChat, MessageReaction, InAppNotification } from '../types';
import {
  subscribeToUsers,
  getOrCreateDirectChat,
  sendE2EEMessage,
  subscribeToMessages,
  addOrUpdateMessageReaction,
  removeMessageReaction,
  subscribeToMessageReactions,
  markMessageAsRead,
  subscribeToChats,
  setFirestoreTypingStatus,
  subscribeToChatTypingStatus,
  togglePinMessage,
  subscribeToNotifications,
  markNotificationAsRead,
  createGroupChat,
  sendGroupMessageService,
  updateGroupSettings,
  joinGroupWithCode,
  voteOnPollMessage
} from '../lib/services';
import QRCodeGenerator from 'qrcode';
import jsQR from 'jsqr';
import { playSendMessageSound, playReceiveMessageSound, playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { decryptE2EEMessage } from '../lib/crypto';
import { 
  ShieldCheck, Send, Key, Lock, AlertTriangle, MessageSquare, Flame, Check, CheckCheck, 
  Smile, Paperclip, Mic, Square, Trash, Play, Pause, ZoomIn, CornerUpLeft, Eye, VolumeX, Volume2,
  QrCode, ScanLine, Camera, Upload, Copy, Pin, PinOff, Search, Sliders, Forward,
  Phone, PhoneCall, Video, UserX, UserCheck, ShieldAlert, FileText, Download, LockKeyhole, UnlockKeyhole,
  Wallpaper, BarChart2, MapPin, Group, Settings2, Trash2, Plus, Users, Star, Keyboard,
  UserPlus, ChevronLeft, CornerUpRight, Edit3
} from 'lucide-react';
import {
  subscribeToPeersStatus
} from '../lib/rtdbService';
import { compressImage, fileToBase64, getMediaTypeFromMime } from '../lib/mediaHelper';
import { motion, AnimatePresence } from 'motion/react';
import { showBrutalistToast } from '../lib/toast';
import { sanitizeErrorMessage } from '../lib/errorSanitizer';
import { queueOfflineMessage, syncOfflineMessages } from '../lib/offlineQueue';
import { triggerVibration } from '../lib/haptics';
import { triggerViewProfile } from '../lib/profileTrigger';
import EmoStickerBoard from './EmoStickerBoard';
import { ConversationNotificationManager } from '../lib/notificationSystem';

function formatLastSeen(lastChanged: any): string {
  if (!lastChanged) return 'offline';
  try {
    const ms = typeof lastChanged === 'number' ? lastChanged : (lastChanged.toDate ? lastChanged.toDate().getTime() : Date.parse(lastChanged));
    if (isNaN(ms)) return 'offline';
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch (e) {
    return 'offline';
  }
}

function getRelativeTimestamp(dateInput: any): string {
  if (!dateInput) return 'Pending';
  let date: Date;
  try {
    if (dateInput.toDate) {
      date = dateInput.toDate();
    } else if (dateInput.seconds) {
      date = new Date(dateInput.seconds * 1000);
    } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return 'Pending';
    }
  } catch (e) {
    return 'Pending';
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="bg-[var(--neon-green)] text-black font-extrabold px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// Decrypted Message Bubble Sub-component with Real-time Emoji Reactions and reply threads
function DecryptedMessageBubble({
  message,
  currentUserId,
  localPrivateKey,
  isPeerOnline,
  chatId,
  currentUserDisplayName,
  onReplyTrigger,
  onForwardTrigger,
  onDecrypted,
  searchQuery,
  onVotePoll,
  pollsData,
  disabledReadReceipts
}: {
  message: ChatMessage;
  currentUserId: string;
  localPrivateKey: string | null;
  isPeerOnline: boolean;
  chatId: string;
  currentUserDisplayName: string;
  onReplyTrigger: (msgId: string, authorName: string, snippetText: string) => void;
  onForwardTrigger: (decryptedRawText: string) => void;
  onDecrypted?: (text: string) => void;
  searchQuery?: string;
  onVotePoll?: (msgId: string, optionIdx: number) => void;
  pollsData?: Record<string, { question: string, options: string[], votes: Record<string, string> }>;
  disabledReadReceipts?: Record<string, boolean>;
}) {
  const onDecryptedRef = useRef(onDecrypted);
  useEffect(() => {
    onDecryptedRef.current = onDecrypted;
  }, [onDecrypted]);

  const [decryptedText, setDecryptedText] = useState<string>("Decrypting ciphertext...");
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioState, setAudioState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Subscribe to reactions in this message's subcollection
  useEffect(() => {
    if (!chatId || !message.id) return;
    const unsubscribe = subscribeToMessageReactions(chatId, message.id, (loaded) => {
      setReactions(loaded);
    });
    return unsubscribe;
  }, [chatId, message.id]);

  // Native back button integration to close chat image zoom
  useEffect(() => {
    const handleBackButton = (e: Event) => {
      if (zoomImg) {
        setZoomImg(null);
        e.preventDefault();
      }
    };
    window.addEventListener('faraflick-back-button', handleBackButton);
    return () => {
      window.removeEventListener('faraflick-back-button', handleBackButton);
    };
  }, [zoomImg]);

  useEffect(() => {
    let active = true;
    async function decrypt() {
      if (message.isGroupMessage && message.plainText) {
        if (active) {
          setDecryptedText(message.plainText);
          setStatus('success');
          if (onDecryptedRef.current) {
            onDecryptedRef.current(message.plainText);
          }
        }
        return;
      }

      if (!localPrivateKey) {
        if (active) {
          setDecryptedText("[Encrypted message - Missing E2EE Private Keys]");
          setStatus('error');
        }
        return;
      }

      const wrappedKey = message.senderId === currentUserId ? message.senderEncryptedKey : message.encryptedKey;

      try {
        const text = await decryptE2EEMessage(message.encryptedText, wrappedKey, localPrivateKey);
        if (active) {
          setDecryptedText(text);
          setStatus('success');
          if (onDecryptedRef.current) {
            onDecryptedRef.current(text);
          }
        }
      } catch (err) {
        if (active) {
          setDecryptedText("[Decryption failed - RSA signature mismatch]");
          setStatus('error');
        }
      }
    }

    decrypt();
    return () => { active = false; };
  }, [message.id, message.encryptedText, message.senderId, localPrivateKey, currentUserId]);

  // Decode JSON attachments if any
  let caption = decryptedText;
  let hasAttachment = false;
  let attachmentUrl = "";
  let attachmentType = "none";
  let attachmentName = "";
  let quotedAuthor = "";
  let quotedSnippet = "";

  if (decryptedText.trim().startsWith('{') && decryptedText.includes('attachmentUrl')) {
    try {
      const parsed = JSON.parse(decryptedText);
      caption = parsed.text || "";
      attachmentUrl = parsed.attachmentUrl || "";
      attachmentType = parsed.attachmentType || "none";
      attachmentName = parsed.attachmentName || "";
      hasAttachment = !!attachmentUrl;
      quotedAuthor = parsed.quotedAuthor || "";
      quotedSnippet = parsed.quotedSnippet || "";
    } catch (e) {
      // Fallback
    }
  } else if (decryptedText.trim().startsWith('{') && decryptedText.includes('quotedSnippet')) {
    try {
      const parsed = JSON.parse(decryptedText);
      caption = parsed.text || "";
      quotedAuthor = parsed.quotedAuthor || "";
      quotedSnippet = parsed.quotedSnippet || "";
    } catch (e) {
      // Fallback
    }
  }

  // Support direct Firestore rich attachment and quote properties
  if (message.mediaUrl) {
    hasAttachment = true;
    attachmentUrl = message.mediaUrl;
    attachmentType = message.mediaType || "none";
    attachmentName = message.mediaName || "";
  }
  if (message.replyToId) {
    quotedAuthor = message.replyToSenderName || "";
    quotedSnippet = message.replyToText || "";
  }

  // Handle emoji reactions
  const toggleReaction = async (emoji: string) => {
    const existing = reactions.find(r => r.userId === currentUserId);
    if (existing && existing.emoji === emoji) {
      await removeMessageReaction(chatId, message.id, currentUserId);
    } else {
      await addOrUpdateMessageReaction(chatId, message.id, {
        userId: currentUserId,
        userName: currentUserDisplayName,
        emoji
      });
    }
    setShowPicker(false);
  };

  const groupedReactions = reactions.reduce((acc, r) => {
    const match = acc.find(x => x.emoji === r.emoji);
    if (match) {
      match.users.push(r);
    } else {
      acc.push({ emoji: r.emoji, users: [r] });
    }
    return acc;
  }, [] as { emoji: string; users: MessageReaction[] }[]);

  const pickerEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // Audio speed adjustment controls
  const togglePlaybackSpeed = () => {
    if (!audioElRef.current) return;
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    setPlaybackRate(nextRate);
    audioElRef.current.playbackRate = nextRate;
  };

  const toggleAudioPlayback = () => {
    if (!audioElRef.current) return;
    if (audioState === 'playing') {
      audioElRef.current.pause();
      setAudioState('paused');
    } else {
      audioElRef.current.play().catch((playErr) => {
        console.warn("Audio playback was prevented by browser autoplay policy:", playErr);
        setAudioState('paused');
      });
      setAudioState('playing');
    }
  };

  return (
    <div className="relative overflow-visible w-full">
      {/* Swipe status icon */}
      <div
        id={`swipe-reply-cue-${message.id}`}
        className="absolute left-[-26px] top-1/2 -translate-y-1/2 opacity-0 pointer-events-none transition-all flex items-center justify-center text-[var(--neon-green)] bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 p-1.5 duration-75"
      >
        <CornerUpLeft className="w-4 h-4" />
      </div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 80 }}
        dragElastic={{ left: 0.05, right: 0.25 }}
        dragSnapToOrigin
        onDrag={(event, info) => {
          const cue = document.getElementById(`swipe-reply-cue-${message.id}`);
          if (cue) {
            const x = info.offset.x;
            if (x > 8) {
              cue.style.opacity = Math.min((x - 8) / 35, 1).toString();
              cue.style.transform = `translateY(-50%) translateX(${Math.min(x * 0.15, 10)}px) scale(${Math.min(0.6 + x / 90, 1.1)})`;
            } else {
              cue.style.opacity = '0';
              cue.style.transform = 'translateY(-50%) translateX(0px) scale(0.6)';
            }
          }
        }}
        onDragEnd={(event, info) => {
          const cue = document.getElementById(`swipe-reply-cue-${message.id}`);
          if (cue) {
            // Smooth reset styles
            cue.style.opacity = '0';
            cue.style.transform = 'translateY(-50%) scale(0.6)';
          }
          if (info.offset.x > 45) {
            const senderName = message.senderId === currentUserId ? 'You' : (message.senderDisplayName || 'Peer');
            const snippet = caption || '[Media Node]';
            onReplyTrigger(message.id, senderName, snippet);
          }
        }}
        className="space-y-1 relative pointer-events-auto w-full min-w-0 break-words overflow-visible cursor-grab active:cursor-grabbing select-none"
      >
        {message.isGroupMessage && message.senderId !== currentUserId && (
          <div 
            className="text-[9px] font-black font-mono tracking-wider text-[var(--neon-green)]/80 hover:text-[var(--neon-green)] transition cursor-pointer mb-1 block"
            onClick={(e) => {
              e.stopPropagation();
              triggerViewProfile(message.senderId);
            }}
          >
            {message.senderDisplayName ? message.senderDisplayName.toUpperCase() : 'SECURE NODE'}
          </div>
        )}
        
        {/* reply anchor overlay if quoted */}
        {quotedSnippet && (
          <div className="mb-1 p-2 bg-[#121212]/90 border-l-2 border-[var(--neon-green)] text-left text-[10px] space-y-0.5 rounded-none max-w-sm opacity-85 select-none font-mono">
            <p className="font-bold text-[var(--neon-green)]">@{quotedAuthor}</p>
            <p className="text-zinc-400 line-clamp-1 italic">"{quotedSnippet}"</p>
          </div>
        )}

        {/* Attachment render content */}
      {hasAttachment && (
        <div className="mb-2 overflow-hidden border border-[var(--neon-green)]/25 bg-[#0a0a0a] p-2 max-w-full">
          {attachmentType === 'image' && (
            <div className="relative group cursor-pointer" onClick={() => setZoomImg(attachmentUrl)}>
              <img src={attachmentUrl} className="max-h-60 rounded object-cover border border-[var(--neon-green)]/15 hover:opacity-90 transition" alt="E2EE media" />
              <div className="absolute top-2 right-2 bg-black/75 p-1 rounded-none opacity-0 group-hover:opacity-100 transition">
                <ZoomIn className="w-3.5 h-3.5 text-[var(--neon-green)]" />
              </div>
            </div>
          )}

          {attachmentType === 'video' && (
            <video src={attachmentUrl} controls className="max-h-64 max-w-full rounded border border-[var(--neon-green)]/15 bg-black" />
          )}

          {attachmentType === 'audio' && (
            <div className="flex items-center space-x-3 bg-[#0a0a0a] border border-[var(--neon-green)]/35 p-2.5 rounded-none w-full max-w-xs justify-between">
              <button
                type="button"
                onClick={toggleAudioPlayback}
                className="p-1 px-2.5 bg-[var(--neon-green)] text-black font-extrabold text-[10px] uppercase hover:bg-neutral-200 transition"
              >
                {audioState === 'playing' ? 'PAUSE' : 'PLAY'}
              </button>
              
              <audio
                ref={(el) => {
                  audioElRef.current = el;
                  if (el) {
                    el.onended = () => setAudioState('idle');
                    el.playbackRate = playbackRate;
                  }
                }}
                src={attachmentUrl}
                className="hidden"
              />

              {/* Audio Speed Control */}
              <button
                type="button"
                onClick={togglePlaybackSpeed}
                className="text-[9px] px-1.5 py-0.5 border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition uppercase font-mono font-bold"
                title="Voice playback speed multiplier"
              >
                {playbackRate}x
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actual Message text segment */}
      {caption && (
        <div className="text-[12.5px] leading-relaxed dark:text-zinc-150 select-text font-serif">
          {(message.messageType === 'poll' || message.pollData || caption.startsWith('📊 POLL_DATA:')) ? (() => {
            try {
              let pollQuestion = '';
              let pollOptions: string[] = [];
              let votesMap: Record<string, any> = {};

              if (message.pollData) {
                pollQuestion = message.pollData.question;
                pollOptions = message.pollData.options || [];
                votesMap = message.pollData.votes || {};
              } else if (caption.startsWith('📊 POLL_DATA:')) {
                const rawObj = caption.replace('📊 POLL_DATA:', '');
                const parsed = JSON.parse(rawObj);
                pollQuestion = parsed.question;
                pollOptions = parsed.options || [];
                const livePoll = pollsData?.[message.id] || { question: pollQuestion, options: pollOptions, votes: {} };
                votesMap = livePoll.votes || {};
              } else {
                return null;
              }

              const totalVotes = Object.keys(votesMap).length;

              return (
                <div className="border border-[var(--neon-green)]/35 bg-black/60 p-3 mt-1.5 space-y-2 font-mono w-full max-w-sm rounded-none">
                  <div className="flex items-center gap-1.5 border-b border-[var(--neon-green)]/15 pb-1">
                    <span className="text-[10px] text-[var(--neon-green)] font-black">📊 SECURE DEMOCRACY PROTOCOL</span>
                  </div>
                  <p className="text-[11px] font-bold text-white uppercase">{pollQuestion}</p>
                  <div className="space-y-1.5 pt-1">
                    {pollOptions.map((opt: string, idx: number) => {
                      const optVotes = Object.values(votesMap).filter(v => v.toString() === idx.toString()).length;
                      const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                      const hasVotedThis = votesMap[currentUserId]?.toString() === idx.toString();

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onVotePoll?.(message.id, idx)}
                          className={`w-full block p-2 border text-left text-[9.5px] uppercase relative overflow-hidden transition cursor-pointer select-none leading-none ${
                            hasVotedThis
                              ? 'bg-[var(--neon-green)]/20 border-[var(--neon-green)] text-[var(--neon-green)] font-extrabold shadow-sm'
                              : 'border-zinc-850 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white'
                          }`}
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-[var(--neon-green)]/10 transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="relative flex justify-between items-center z-10 w-full leading-none">
                            <span className="truncate">{opt}</span>
                            <span className="font-mono text-[9px] shrink-0 font-bold ml-2">
                              {percentage}% ({optVotes})
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[7.5px] text-zinc-500 flex justify-between uppercase pt-1 font-mono">
                    <span>VOTES CAST: {totalVotes}</span>
                    <span>LOCK VERIFIED</span>
                  </div>
                </div>
              );
            } catch (e) {
              return <span className="text-red-500 text-xs font-mono">Poll Artifact Unreadable</span>;
            }
          })() : (searchQuery ? (
            <HighlightedText text={caption} query={searchQuery} />
          ) : (
            caption
          ))}
        </div>
      )}

      {/* Interactive Footer (Timestamp + Double Tick Checkmarks + Reaction Panel Activation) */}
      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-[var(--neon-green)]/5 select-none">
        
        {/* WhatsApp Quote Message & Emoji Reaction activator */}
        <div className="flex items-center space-x-1">
          {/* Reaction trigger icon */}
          <button 
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="p-1 text-zinc-500 hover:text-[var(--neon-green)] transition cursor-pointer"
            title="React to message"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {/* Reply trigger icon */}
          <button
            type="button"
            onClick={() => onReplyTrigger(message.id, message.senderId === currentUserId ? 'You' : (message.senderDisplayName || 'Peer'), caption || '[Media Node]')}
            className="p-1 text-zinc-500 hover:text-[var(--neon-green)] transition cursor-pointer"
            title="Reply to thread"
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>

          {/* Pin/Unpin trigger icon */}
          <button
            type="button"
            onClick={async () => {
              triggerVibration('light');
              playGlitchClickSound();
              await togglePinMessage(chatId, message.id, !message.pinned);
            }}
            className={`p-1 transition cursor-pointer ${message.pinned ? 'text-[var(--neon-green)]' : 'text-zinc-500 hover:text-[var(--neon-green)]'}`}
            title={message.pinned ? "Unpin message" : "Pin message"}
          >
            <Pin className="w-3 h-3" />
          </button>

          {/* Forward trigger icon */}
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              triggerVibration('light');
              onForwardTrigger(decryptedText);
            }}
            className="p-1 text-zinc-500 hover:text-[var(--neon-green)] transition cursor-pointer"
            title="Forward message to another recipient tunnel"
          >
            <Forward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reaction picker portal modal overlay */}
        <AnimatePresence>
          {showPicker && (
            <div className="absolute bottom-6 left-0 bg-[#0d0d0d] border border-[var(--neon-green)] p-1 shadow-lg z-50 flex space-x-1 font-mono">
              {pickerEmojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className="p-1 text-sm hover:scale-125 transition cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Aggregate displayed reactions as a small floating overlay on each message bubble */}
        {groupedReactions.length > 0 && (
          <div 
            className={`absolute bottom-[-11px] ${message.senderId === currentUserId ? 'right-3' : 'left-3'} flex items-center gap-1.5 bg-[#090909] border border-[var(--neon-green)] px-1.5 py-0.5 shadow-[2px_2px_0px_rgba(0,0,0,1)] select-none z-10 font-mono`}
            style={{ pointerEvents: 'auto' }}
          >
            {groupedReactions.map((g, idx) => (
              <span 
                key={idx} 
                className="text-[10px] flex items-center gap-0.5 cursor-pointer hover:scale-110 transition duration-100" 
                title={g.users.map(u => u.userName).join(', ')}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleReaction(g.emoji);
                }}
              >
                <span>{g.emoji}</span>
                <span className="text-[8px] font-black text-[var(--neon-green)]">{g.users.length}</span>
              </span>
            ))}
          </div>
        )}

        {/* Timestamp & double checkmarks */}
        <div className="flex items-center space-x-1.5 self-end">
          <span className="text-[9px] text-zinc-500 font-mono">
            {getRelativeTimestamp(message.createdAt)}
          </span>
          {message.senderId === currentUserId && (
            <div className="flex items-center select-none gap-1 font-mono" style={{ minWidth: '16px' }}>
              {!message.createdAt ? (
                <Check className="w-3.5 h-3.5 text-zinc-500 opacity-60 animate-pulse" title="Sending message..." />
              ) : ((message.read || (message.readBy && message.readBy.length > 0)) && !(disabledReadReceipts && Object.values(disabledReadReceipts).some(val => val === true))) ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 260,
                    damping: 15
                  }}
                  className="flex items-center gap-1 font-mono"
                >
                  <span className="text-[7.5px] uppercase tracking-widest text-[var(--neon-green)]/70">read</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" title="Read status confirmed by peer" />
                </motion.div>
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-zinc-500" title="Delivered successfully to receipt queue" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Resolution Zoom modal integration */}
      {zoomImg && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[9999] p-4 pointer-events-auto" onClick={() => setZoomImg(null)}>
          <div className="relative max-w-full max-h-full">
            <img src={zoomImg} className="max-w-full max-h-[90vh] rounded shadow-2xl m-auto cursor-zoom-out" alt="High Resolution Asset" />
            <div className="absolute bottom-[-30px] left-0 right-0 text-center text-[11px] text-[var(--neon-green)] font-mono">
              [ SECURE VIEW BLOCKED // TAP OUTSIDE TO RETURN ]
            </div>
          </div>
        </div>
      )}
      </motion.div>
    </div>
  );
}

const ACCENT_THEMES = {
  'cyber-poison': {
    primary: '#00ff66',
    rgb: '0, 255, 102',
  },
  'volcanic-core': {
    primary: '#ff3c00',
    rgb: '255, 60, 0',
  },
  'cobalt-pulse': {
    primary: '#00e5ff',
    rgb: '0, 229, 255',
  },
  'vapor-grid': {
    primary: '#ff007f',
    rgb: '255, 0, 127',
  },
  'amber-terminal': {
    primary: '#ffbf00',
    rgb: '255, 191, 0',
  }
};

export default function ChatSection({
  deepLinkedPeerId,
  onClearDeepLink,
  deepLinkedGroupId,
  onClearDeepLinkedGroup
}: {
  deepLinkedPeerId?: string | null;
  onClearDeepLink?: () => void;
  deepLinkedGroupId?: string | null;
  onClearDeepLinkedGroup?: () => void;
} = {}) {
  const { profile, localPrivateKey } = useAuth();
  const operations = useOperations();

  // Custom brutalist theme accent variables and chat settings panel
  const [chatAccentTheme, setChatAccentTheme] = useState<string>('cyber-poison');

  const activeAccent = ACCENT_THEMES[chatAccentTheme as keyof typeof ACCENT_THEMES] || ACCENT_THEMES['cyber-poison'];
  const customAccentStyles = {
    '--neon-green': activeAccent.primary,
    '--neon-green-rgb': activeAccent.rgb,
    '--neon-green-glow': `rgba(${activeAccent.rgb}, 0.15)`,
    '--neon-green-border': `rgba(${activeAccent.rgb}, 0.25)`,
    '--neon-green-glow-intense': `rgba(${activeAccent.rgb}, 0.6)`
  } as React.CSSProperties;
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<UserProfile | null>(null);
  const [currentChat, setCurrentChat] = useState<DirectChat | null>(null);

  // Synchronize focused chat to our premium ConversationNotificationManager
  useEffect(() => {
    if (currentChat?.id) {
      ConversationNotificationManager.setActiveChat(currentChat.id);
    } else {
      ConversationNotificationManager.setActiveChat(null);
    }
    return () => {
      ConversationNotificationManager.setActiveChat(null);
    };
  }, [currentChat?.id]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [decryptedCache, setDecryptedCache] = useState<{[msgId: string]: string}>({});
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isPinnedDrawerOpen, setIsPinnedDrawerOpen] = useState(false);
  
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean | string>>({});
  const [allTunnelsTyping, setAllTunnelsTyping] = useState<Record<string, Record<string, boolean | string>>>({});

  // =================== FLICK COMM UPGRADES STATES ===================
  const [isEmoStickerOpen, setIsEmoStickerOpen] = useState(false);
  
  // Safety list arrays
  const [blockedUsers, setBlockedUsers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flick_blocked_users');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [mutedUsers, setMutedUsers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flick_muted_users');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [renamedNicknames, setRenamedNicknames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('flick_nicknames_v2');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [chatLocks, setChatLocks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flick_chat_locks');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  // Wallpapers Configuration
  const [chatWallpaper, setChatWallpaper] = useState<string>(() => {
    return localStorage.getItem('flick_global_wallpaper') || 'none';
  });

  // PIN authentication temporary verification state per chat session
  const [authenticatedLockedChats, setAuthenticatedLockedChats] = useState<string[]>([]);
  const [pinPromptChatId, setPinPromptChatId] = useState<string | null>(null);
  const [pinInputValue, setPinInputValue] = useState('');
  const [pinError, setPinError] = useState('');

  // Group chats local simulations database representation is retired. Now fully synchronised with Firestore!
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSelectedMembers, setNewGroupSelectedMembers] = useState<string[]>([]);
  const [groupUserSearchQuery, setGroupUserSearchQuery] = useState('');

  // New Group Chat Metadata Creation states
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<'public' | 'private'>('private');
  const [newGroupInviteCode, setNewGroupInviteCode] = useState('');
  const [newGroupAvatarUrl, setNewGroupAvatarUrl] = useState('');

  // Multi-step WhatsApp Group Creation states
  const [createGroupStep, setCreateGroupStep] = useState<number>(1);
  const [newGroupType, setNewGroupType] = useState<'friends' | 'school' | 'church' | 'business' | 'community' | 'custom'>('friends');
  const [newGroupBannerUrl, setNewGroupBannerUrl] = useState<string>('');
  const [newGroupPermSend, setNewGroupPermSend] = useState<'all' | 'admins'>('all');
  const [newGroupPermAdd, setNewGroupPermAdd] = useState<'all' | 'admins'>('all');
  const [newGroupPermPin, setNewGroupPermPin] = useState<boolean>(true);
  const [newGroupAdminApproval, setNewGroupAdminApproval] = useState<boolean>(false);
  const [newGroupAnonymous, setNewGroupAnonymous] = useState<boolean>(false);

  // Group Joining states
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [joinGroupInputCode, setJoinGroupInputCode] = useState('');
  const [joinGroupInputChatId, setJoinGroupInputChatId] = useState('');

  // Group Settings Drawer & Editing states
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupPrivacy, setEditGroupPrivacy] = useState<'public' | 'private'>('private');
  const [editGroupInviteCode, setEditGroupInviteCode] = useState('');
  const [editGroupAvatarUrl, setEditGroupAvatarUrl] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupType, setEditGroupType] = useState<'friends' | 'school' | 'church' | 'business' | 'community' | 'custom'>('friends');
  const [editGroupBannerUrl, setEditGroupBannerUrl] = useState<string>('');
  const [editGroupPermSend, setEditGroupPermSend] = useState<'all' | 'admins'>('all');
  const [editGroupPermAdd, setEditGroupPermAdd] = useState<'all' | 'admins'>('all');
  const [editGroupPermPin, setEditGroupPermPin] = useState<boolean>(true);
  const [editGroupAdminApproval, setEditGroupAdminApproval] = useState<boolean>(false);
  const [editGroupAnonymous, setEditGroupAnonymous] = useState<boolean>(false);

  // Advanced Rich Attachment features: Geolocation sharing, Realtime Custom Polls
  const [isPollCreatorOpen, setIsPollCreatorOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollsData, setPollsData] = useState<Record<string, { question: string, options: string[], votes: Record<string, string> }>>(() => {
    try {
      const saved = localStorage.getItem('flick_polls_store');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // ==================================================================

  // =================== FLICK COMM HELPERS ===================
  const toggleBlockUser = (uid: string) => {
    playGlitchClickSound();
    triggerVibration('double');
    setBlockedUsers(prev => {
      const updated = prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid];
      localStorage.setItem('flick_blocked_users', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleMuteUser = (uid: string) => {
    playGlitchClickSound();
    triggerVibration('light');
    setMutedUsers(prev => {
      const updated = prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid];
      localStorage.setItem('flick_muted_users', JSON.stringify(updated));
      return updated;
    });
  };

  const renameUserLocal = (uid: string, nickName: string) => {
    playGlitchClickSound();
    triggerVibration('medium');
    setRenamedNicknames(prev => {
      const updated = { ...prev, [uid]: nickName };
      localStorage.setItem('flick_nicknames_v2', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleLockChat = (chatId: string) => {
    playGlitchClickSound();
    triggerVibration('medium');
    setChatLocks(prev => {
      const updated = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
      localStorage.setItem('flick_chat_locks', JSON.stringify(updated));
      return updated;
    });
  };

  const verifyPinForChat = (pin: string) => {
    if (pin === '1337' || pin === '0000' || pin.length === 4) {
      if (pinPromptChatId) {
        setAuthenticatedLockedChats(prev => [...prev, pinPromptChatId]);
        setPinPromptChatId(null);
        setPinInputValue('');
        setPinError('');
        playLikeSound();
      }
    } else {
      setPinError('INVALID HANDSHAKE KEY. ACCESS INHIBITED.');
      triggerVibration('heavy');
    }
  };

  const createGroupConduit = async (name: string, members: string[]) => {
    if (!name.trim() || !profile?.uid) return;
    playLikeSound();
    triggerVibration('medium');
    try {
      const allMembers = Array.from(new Set([profile.uid, ...members]));
      const newChatId = await createGroupChat(name.trim(), allMembers, profile.uid, {
        description: newGroupDescription,
        privacy: newGroupPrivacy,
        inviteCode: newGroupInviteCode,
        avatarUrl: newGroupAvatarUrl,
        groupType: newGroupType,
        groupBannerUrl: newGroupBannerUrl,
        permSend: newGroupPermSend,
        permAdd: newGroupPermAdd,
        permPin: newGroupPermPin,
        adminApprovalRequired: newGroupAdminApproval,
        anonymousMode: newGroupAnonymous,
        approvalQueue: []
      });
      const newGroupObj = {
        id: newChatId,
        participantIds: allMembers,
        lastMessage: 'Group deployed.',
        isGroup: true,
        name: name.trim().toUpperCase(),
        ownerId: profile.uid,
        description: newGroupDescription,
        privacy: newGroupPrivacy,
        inviteCode: newGroupInviteCode,
        avatarUrl: newGroupAvatarUrl || "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120",
        roles: { [profile.uid]: 'owner' },
        groupType: newGroupType,
        groupBannerUrl: newGroupBannerUrl,
        permSend: newGroupPermSend,
        permAdd: newGroupPermAdd,
        permPin: newGroupPermPin,
        adminApprovalRequired: newGroupAdminApproval,
        anonymousMode: newGroupAnonymous,
        approvalQueue: []
      };
      setIsCreateGroupOpen(false);
      setCreateGroupStep(1);
      setNewGroupName('');
      setNewGroupSelectedMembers([]);
      setNewGroupDescription('');
      setNewGroupPrivacy('private');
      setNewGroupInviteCode('');
      setNewGroupAvatarUrl('');
      setNewGroupBannerUrl('');
      setNewGroupType('friends');
      setNewGroupPermSend('all');
      setNewGroupPermAdd('all');
      setNewGroupPermPin(true);
      setNewGroupAdminApproval(false);
      setNewGroupAnonymous(false);
      setSelectedGroup(newGroupObj);
      setSelectedPeer(null);
      setCurrentChat(newGroupObj as any);
    } catch (err) {
      console.error("Failed to deploy group conduit on Firestore:", err);
      setError("Failed to deploy group conduit on security servers.");
    }
  };

  const sendGroupMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedGroup || (!text.trim() && !selectedAttachment)) return;
    triggerVibration('medium');
    playSendMessageSound();

    const textToSend = text.trim();
    // Build simulated rich attachments poll or location payload if applicable
    let payloadText = textToSend;
    if (selectedAttachment) {
      payloadText = JSON.stringify({
        text: textToSend,
        attachmentUrl: selectedAttachment.dataUrl,
        attachmentType: selectedAttachment.type,
        attachmentName: selectedAttachment.name
      });
    }

    const newMsg = {
      id: `gmsg-${Date.now()}`,
      senderId: profile.uid,
      senderDisplayName: profile.displayName || 'Relay User',
      content: payloadText,
      createdAt: new Date().toISOString()
    };

    const threadKey = `flick_group_messages_${selectedGroup.id}`;
    const stored = localStorage.getItem(threadKey);
    const msgsList = stored ? JSON.parse(stored) : [];
    msgsList.push(newMsg);
    localStorage.setItem(threadKey, JSON.stringify(msgsList));

    setText('');
    setSelectedAttachment(null);
    setMessages(msgsList); // Trigger scroll update
  };

  // Poll custom votes trigger
  const castPollVote = async (msgId: string, optionIdx: number) => {
    playGlitchClickSound();
    triggerVibration('light');
    if (!profile) return;

    if (currentChat && currentChat.isGroup) {
      try {
        await voteOnPollMessage(currentChat.id, msgId, profile.uid, optionIdx);
        return;
      } catch (e) {
        console.error("Failed to cast Firestore poll vote:", e);
        setError("Failed to register your group vote in security systems.");
      }
    }

    setPollsData(prev => {
      const existing = prev[msgId] || { question: '', options: [], votes: {} };
      const currentVote = existing.votes[profile?.uid || ''];
      
      const nextVotes = { ...existing.votes, [profile.uid]: optionIdx.toString() };
      const updated = {
        ...prev,
        [msgId]: {
          ...existing,
          votes: nextVotes
        }
      };
      localStorage.setItem('flick_polls_store', JSON.stringify(updated));
      return updated;
    });
  };
  // ==========================================================

  // Restore partially typed messages drafts from localStorage when switching peers
  useEffect(() => {
    if (!profile) return;
    if (selectedPeer) {
      const savedDraft = localStorage.getItem(`fara_flick_draft_${profile.uid}_${selectedPeer.uid}`);
      setText(savedDraft || '');
    } else {
      setText('');
    }
  }, [selectedPeer?.uid, profile?.uid]);

  // Synchronize active group metadata into edit states when current chat changes
  useEffect(() => {
    if (currentChat && currentChat.isGroup) {
      setEditGroupName(currentChat.name || '');
      setEditGroupDescription(currentChat.description || '');
      setEditGroupAvatarUrl(currentChat.avatarUrl || '');
      setEditGroupPrivacy(currentChat.privacy || 'private');
      setEditGroupInviteCode(currentChat.inviteCode || '');
      setEditGroupType(currentChat.groupType || 'friends');
      setEditGroupBannerUrl(currentChat.groupBannerUrl || '');
      setEditGroupPermSend(currentChat.permSend || 'all');
      setEditGroupPermAdd(currentChat.permAdd || 'all');
      setEditGroupPermPin(currentChat.permPin !== undefined ? currentChat.permPin : true);
      setEditGroupAdminApproval(currentChat.adminApprovalRequired !== undefined ? currentChat.adminApprovalRequired : false);
      setEditGroupAnonymous(currentChat.anonymousMode !== undefined ? currentChat.anonymousMode : false);
    }
  }, [currentChat?.id]);

  // Save partially typed messages drafts to localStorage as typing progresses
  useEffect(() => {
    if (!profile || !selectedPeer) return;
    if (text.trim()) {
      localStorage.setItem(`fara_flick_draft_${profile.uid}_${selectedPeer.uid}`, text);
    } else {
      localStorage.removeItem(`fara_flick_draft_${profile.uid}_${selectedPeer.uid}`);
    }
  }, [text, selectedPeer?.uid, profile?.uid]);

  // Sync per-chat brutalist background or theme settings when starting/switching conversation channels
  useEffect(() => {
    if (currentChat?.id) {
      const savedTheme = localStorage.getItem(`fara_accent_${currentChat.id}`);
      setChatAccentTheme(savedTheme || 'cyber-poison');
    } else {
      setChatAccentTheme('cyber-poison');
    }
    // Auto-close info drawer temporarily to keep workspace fluid and focused
    setIsChatInfoOpen(false);
  }, [currentChat?.id]);

  // Handle external / priority deep-linking directly into an active secure chat
  useEffect(() => {
    if (deepLinkedPeerId && users.length > 0) {
      const match = users.find(u => u.uid === deepLinkedPeerId);
      if (match) {
        openChatRoom(match);
      }
      if (onClearDeepLink) {
        onClearDeepLink();
      }
    }
  }, [deepLinkedPeerId, users]);

  const [rtdbStatuses, setRtdbStatuses] = useState<Record<string, { state: string; lastChanged: any }>>({});

  // Active chat tunnels and search filter type states
  const [activeChatTunnels, setActiveChatTunnels] = useState<DirectChat[]>([]);
  const groups = activeChatTunnels.filter(chat => chat.isGroup || chat.id === 'global-node-concourse');
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'favorites' | 'groups' | 'all-nodes'>('all');
  const [favoriteChats, setFavoriteChats] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fara_favorites') || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavoriteChat = (chatId: string) => {
    setFavoriteChats(prev => {
      const next = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
      localStorage.setItem('fara_favorites', JSON.stringify(next));
      return next;
    });
  };

  // Handle external / priority deep-linking directly into an active secure group chat
  useEffect(() => {
    if (deepLinkedGroupId && activeChatTunnels.length > 0) {
      const match = activeChatTunnels.find(chat => chat.id === deepLinkedGroupId || (chat.isGroup && chat.id === deepLinkedGroupId));
      if (match) {
        setSelectedGroup(match);
        setSelectedPeer(null);
        setCurrentChat(match);
      }
      if (onClearDeepLinkedGroup) {
        onClearDeepLinkedGroup();
      }
    }
  }, [deepLinkedGroupId, activeChatTunnels]);

  // QR Modal and Code States
  const [showQrShareModal, setShowQrShareModal] = useState(false);
  const [showQrScanModal, setShowQrScanModal] = useState(false);
  const [myQrCodeUrl, setMyQrCodeUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Scanner refs and status
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string | null>(null);

  // Real-time local coordinates QR code generator
  useEffect(() => {
    if (profile) {
      // Avoid embedding massive base64 or custom graphic data URIs inside the QR code matrix
      let qrPhotoURL = profile.photoURL;
      if (qrPhotoURL && (qrPhotoURL.startsWith('data:') || qrPhotoURL.length > 150)) {
        qrPhotoURL = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${profile.uid}`;
      }

      const sharePayload = JSON.stringify({
        flick_v1: true,
        uid: profile.uid,
        displayName: profile.displayName || 'Peer Node',
        email: profile.email || `${profile.uid}@flick.local`,
        publicKey: profile.publicKey,
        photoURL: qrPhotoURL
      });

      QRCodeGenerator.toDataURL(sharePayload, { 
        width: 320, 
        margin: 2, 
        errorCorrectionLevel: 'L', // Low error correction to safely fit larger cryptographic keys at minimum resolution
        color: { dark: '#00ff66', light: '#000000' } 
      })
        .then(url => setMyQrCodeUrl(url))
        .catch(err => console.error("Cryptographic QR compilation failure:", err));
    }
  }, [profile]);

  // Subscribe to all ongoing conversations
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToChats(profile.uid, (chats) => {
      const myAIChat: DirectChat = {
        id: 'my-ai-chat-id',
        participantIds: [profile.uid, 'my-ai-bot-uid'],
        lastMessage: localStorage.getItem(`flick_my_ai_last_message_${profile.uid}`) || 'Hi! I am your AI buddy. Ask me anything! 🌟',
        lastMessageAt: { toDate: () => new Date() } as any,
        isGroup: false
      };
      
      if (!chats.some(c => c.id === 'my-ai-chat-id')) {
        setActiveChatTunnels([myAIChat, ...chats]);
      } else {
        // Maintain the latest message from Firestore/local persistence
        const existingMyAI = chats.find(c => c.id === 'my-ai-chat-id');
        if (existingMyAI) {
          setActiveChatTunnels(chats);
        } else {
          setActiveChatTunnels([myAIChat, ...chats]);
        }
      }
    });
    return unsub;
  }, [profile?.uid]);

  // Synchronize currentChat and selectedGroup with real-time updates from activeChatTunnels
  useEffect(() => {
    if (!currentChat) return;
    const updatedChat = activeChatTunnels.find(c => c.id === currentChat.id);
    if (updatedChat) {
      if (JSON.stringify(updatedChat) !== JSON.stringify(currentChat)) {
        setCurrentChat(updatedChat);
        if (updatedChat.isGroup) {
          setSelectedGroup(updatedChat);
        }
      }
    }
  }, [activeChatTunnels, currentChat]);

  // Subscribe to real-time typing states of all conversation tunnels
  useEffect(() => {
    if (!profile?.uid || activeChatTunnels.length === 0) return;
    
    const chatIdsKey = activeChatTunnels.map(c => c.id).join(',');
    const unsubscribes = activeChatTunnels.map(chat => {
      return subscribeToChatTypingStatus(chat.id, (typingMap) => {
        setAllTunnelsTyping(prev => ({
          ...prev,
          [chat.id]: typingMap
        }));
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeChatTunnels.map(c => c.id).join(','), profile?.uid]);

  // Subscribe to unread notifications for active message badge indicators
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToNotifications(profile.uid, (unread) => {
      setNotifications(unread);
    });
    return unsub;
  }, [profile?.uid]);

  // Auto-mark notifications as read if the chat tunnel with this peer is actively selected
  useEffect(() => {
    if (!profile?.uid || !selectedPeer?.uid || notifications.length === 0) return;
    const activePeerNotifs = notifications.filter(n => n.type === 'message' && (n.senderId === selectedPeer.uid || n.senderName === selectedPeer.displayName));
    if (activePeerNotifs.length > 0) {
      activePeerNotifs.forEach(n => {
        markNotificationAsRead(n.id).catch(e => console.warn("Failed marking active tunnel notifications as read:", e));
      });
    }
  }, [notifications, selectedPeer?.uid, profile?.uid]);

  // Attempt to sync offline queued messages on startup
  useEffect(() => {
    syncOfflineMessages().catch((e) => console.warn("Offline initialization syncer report:", e));
  }, []);

  // QR Real-time Camera scan procedures
  const startScanning = async () => {
    setFileStatus(null);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((playErr) => console.warn("Video stream play prevented:", playErr));
        animationFrameIdRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn("Camera streaming blocked:", err);
      setCameraError("Camera capture interface is blocked or unsupported in this sandbox. Use file upload fallback below.");
    }
  };

  const stopScanning = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const scanFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code) {
          handleScannedResult(code.data);
          return; // stop mapping frames
        }
      }
    }
    animationFrameIdRef.current = requestAnimationFrame(scanFrame);
  };

  const handleFileUploadQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileStatus("Decrypting cryptographic QR scan matrix...");
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            setFileStatus(null);
            handleScannedResult(code.data);
          } else {
            setFileStatus("Handshake Fail: No valid peer cryptographic identifier found in image.");
          }
        }
      };
    } catch (err) {
      setFileStatus("Decoding Failure: Invalid image representation.");
    }
  };

  const handleScannedResult = (scannedText: string) => {
    try {
      const data = JSON.parse(scannedText);
      if (!data.flick_v1 || !data.uid || !data.publicKey) {
        throw new Error("Missing markers");
      }

      playSendMessageSound();

      const scannedPeer: UserProfile = {
        uid: data.uid,
        displayName: data.displayName || 'Peer Node',
        email: data.email || `${data.uid}@flick.local`,
        photoURL: data.photoURL || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${data.uid}`,
        publicKey: data.publicKey,
        status: 'online',
        updatedAt: new Date()
      };

      setUsers(prev => {
        if (prev.some(u => u.uid === scannedPeer.uid)) return prev;
        return [scannedPeer, ...prev];
      });

      setShowQrScanModal(false);
      stopScanning();
      openChatRoom(scannedPeer);
    } catch (e) {
      console.warn("Invalid QR coordinates payload:", e);
      setFileStatus("Invalid public-key coordinate package scanned.");
    }
  };
  
  // Media attachments state
  const [selectedAttachment, setSelectedAttachment] = useState<{
    dataUrl: string;
    type: 'image' | 'video' | 'audio';
    name: string;
  } | null>(null);

  // reply quote parameters state
  const [replyQuote, setReplyQuote] = useState<{
    msgId: string;
    authorName: string;
    snippetText: string;
  } | null>(null);

  // Burning message mode selector
  const [selfDestructSeconds, setSelfDestructSeconds] = useState<number>(0); // 0 = standard unlimited message, >0 represent custom lifespan
  const [isRecording, setIsRecording] = useState(false);
  
  // Custom brutalist theme accent variables and chat settings panel
  const [isChatInfoOpen, setIsChatInfoOpen] = useState(false);

  // Message Forwarding modal & payload variables
  const [forwardMessageText, setForwardMessageText] = useState<string | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

  // Voice-To-Text translation features
  const [isV2TMode, setIsV2TMode] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const [isV2TListening, setIsV2TListening] = useState(false);
  
  // Shortcuts menu state
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const isCurrentlyTypingRef = useRef<boolean>(false);

  // Listen for hardware-level brutalist hotkeys and keyboard shortcuts navigation binds
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle Keyboard Shortcut guide modal on Alt + /
      if (e.altKey && e.key === '/') {
        e.preventDefault();
        playGlitchClickSound();
        setIsShortcutModalOpen(prev => !prev);
      }
      
      // Close any active modal overlay when Esc is tapped
      if (e.key === 'Escape') {
        if (isShortcutModalOpen) {
          setIsShortcutModalOpen(false);
        } else if (isForwardModalOpen) {
          setIsForwardModalOpen(false);
          setForwardMessageText('');
        } else if (showQrScanModal) {
          setShowQrScanModal(false);
          stopScanning();
        } else if (showQrShareModal) {
          setShowQrShareModal(false);
        } else if (messageSearchQuery) {
          setMessageSearchQuery('');
        }
      }

      // Alt + S to scan QR Coord Codes
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        playGlitchClickSound();
        setShowQrScanModal(prev => {
          if (prev) {
            stopScanning();
          }
          return !prev;
        });
      }

      // Alt + Q to share current QR Coord Coordinates
      if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        playGlitchClickSound();
        setShowQrShareModal(prev => !prev);
      }

      // Alt + T to toggle Speak-to-Transcribe Speech-to-text listener
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        toggleVoiceToTextListening();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    isShortcutModalOpen, 
    isForwardModalOpen, 
    showQrScanModal, 
    showQrShareModal, 
    messageSearchQuery, 
    isV2TListening
  ]);

  // Native back button listener to close ChatSection overlays & modals
  useEffect(() => {
    const handleBackButton = (e: Event) => {
      if (isShortcutModalOpen) {
        setIsShortcutModalOpen(false);
        e.preventDefault();
        return;
      }
      if (isForwardModalOpen) {
        setIsForwardModalOpen(false);
        setForwardMessageText('');
        e.preventDefault();
        return;
      }
      if (showQrScanModal) {
        setShowQrScanModal(false);
        stopScanning();
        e.preventDefault();
        return;
      }
      if (showQrShareModal) {
        setShowQrShareModal(false);
        e.preventDefault();
        return;
      }
      if (messageSearchQuery) {
        setMessageSearchQuery('');
        e.preventDefault();
        return;
      }
    };
    window.addEventListener('faraflick-back-button', handleBackButton);
    return () => {
      window.removeEventListener('faraflick-back-button', handleBackButton);
    };
  }, [isShortcutModalOpen, isForwardModalOpen, showQrScanModal, showQrShareModal, messageSearchQuery]);

  // Sync peer coordinates on startup
  useEffect(() => {
    if (!profile) return;
    
    const unsubscribeUsers = subscribeToUsers((all) => {
      const filtered = all.filter(u => u.uid !== profile.uid);
      const myAIPeer: UserProfile = {
        uid: 'my-ai-bot-uid',
        displayName: 'My AI 🌟',
        photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
        email: 'myai@flick.internal',
        status: 'online',
        lastSeen: { toDate: () => new Date() } as any,
        updatedAt: { toDate: () => new Date() } as any,
        publicKey: ''
      };
      setUsers([myAIPeer, ...filtered]);
    }, (err) => {
      console.warn("User fetch thread error", err);
    });

    const unsubscribePresence = subscribeToPeersStatus((statusMap) => {
      setRtdbStatuses(statusMap);
    });

    return () => {
      unsubscribeUsers();
      unsubscribePresence();
    };
  }, [profile?.uid]);

  // Hook typing updates inside current chat
  useEffect(() => {
    if (!profile || !currentChat) return;
    const unsubscribe = subscribeToChatTypingStatus(currentChat.id, (typingMap) => {
      const activeTyping: Record<string, boolean> = {};
      Object.entries(typingMap).forEach(([uid, state]) => {
        if (uid !== profile.uid) {
          activeTyping[uid] = !!state;
        }
      });
      setTypingUsers(activeTyping);
    });
    return () => unsubscribe();
  }, [currentChat?.id, profile?.uid]);

  // Handle typing key presses
  const handleTypingPulse = () => {
    if (!profile || !currentChat) return;
    
    // Optimize network writes - only write to Firestore once when typing starts
    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      setFirestoreTypingStatus(currentChat.id, profile.uid, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (profile && currentChat) {
        setFirestoreTypingStatus(currentChat.id, profile.uid, false);
        isCurrentlyTypingRef.current = false;
      }
    }, 2800);
  };

  // Trigger conversational workspace chat selection
  const openChatRoom = async (peer: UserProfile) => {
    if (!profile) return;
    playGlitchClickSound();
    setError(null);
    setReplyQuote(null);
    setSelectedAttachment(null);
    setMessageSearchQuery('');
    setIsPinnedDrawerOpen(false);
    setDecryptedCache({});

    // Instantly mark any pending message notifications from this peer as read
    const peerNotifications = notifications.filter(n => n.type === 'message' && (n.senderId === peer.uid || n.senderName === peer.displayName));
    peerNotifications.forEach(n => {
      markNotificationAsRead(n.id).catch(e => console.warn("Failed clearing notification on click:", e));
    });

    if (peer.uid === 'my-ai-bot-uid') {
      setSelectedPeer(peer);
      setCurrentChat({
        id: 'my-ai-chat-id',
        participantIds: [profile.uid, 'my-ai-bot-uid'],
        lastMessage: localStorage.getItem(`flick_my_ai_last_message_${profile.uid}`) || 'Hi! I am your AI buddy. Ask me anything! 🌟',
        lastMessageAt: { toDate: () => new Date() } as any,
        isGroup: false
      });
      return;
    }

    try {
      const chat = await getOrCreateDirectChat(profile.uid, peer.uid);
      setSelectedPeer(peer);
      setCurrentChat(chat);
    } catch (err: any) {
      setError("Secure handshake handshake rejected or delayed.");
    }
  };

  // Cryptographically re-encrypt and forward message packet to a new peer node corridor
  const handleForwardMessageToPeer = async (peer: UserProfile) => {
    if (!profile || !forwardMessageText) return;
    try {
      // Create or locate direct chat tunnel room
      const chat = await getOrCreateDirectChat(profile.uid, peer.uid);
      
      // Encrypt and send the forwarded message text securely to that peer
      await sendE2EEMessage({
        chatId: chat.id,
        senderId: profile.uid,
        senderDisplayName: profile.displayName,
        receiverId: peer.uid,
        plainText: forwardMessageText,
        recipientPublicKeyJwk: peer.publicKey,
        senderPublicKeyJwk: profile.publicKey
      });
      
      playSendMessageSound();
      triggerVibration('medium');
      
      // Notify user success
      setIsForwardModalOpen(false);
      setForwardMessageText('');
      
      // Select the forwarded chat node
      setSelectedPeer(peer);
      setCurrentChat(chat);
    } catch (err) {
      console.error("Forwarding failed:", err);
      setError("Failed to establish cryptographic secure handshakes for forwarded payload.");
    }
  };

  // Force trigger encryption key regenerations if corrupted
  const regenerateE2EEKeys = () => {
    playGlitchClickSound();
    localStorage.removeItem("flick_aes_keychain");
    window.location.reload();
  };

  // Real-time messages subcollection stream listener
  useEffect(() => {
    if (!currentChat?.id || !profile?.uid) return;

    const unsubscribe = subscribeToMessages(currentChat.id, (loadedMessages) => {
      // Filter out burning messages that expired on client or database side
      const filtered = loadedMessages.filter(msg => {
        if (msg.expiresAt) {
          const expireTime = msg.expiresAt.seconds ? msg.expiresAt.seconds * 1000 : (msg.expiresAt.toDate ? msg.expiresAt.toDate().getTime() : Date.parse(msg.expiresAt));
          if (Date.now() >= expireTime) {
            return false; // Skip drawing expired E2EE burning files
          }
        }
        return true;
      });

      setMessages(filtered);

      // Verify and toggle read ticks statuses synchronously on new messages arrival
      loadedMessages.forEach((msg) => {
        if (msg.senderId === selectedPeer?.uid && msg.receiverId === profile?.uid) {
          const alreadyReadBySelf = msg.readBy && msg.readBy.includes(profile.uid);
          if (!msg.read || !alreadyReadBySelf) {
            markMessageAsRead(currentChat.id, msg.id, profile.uid).catch((e) => {
              console.warn("Read confirmation error status:", e);
            });
          }
        }
      });

      // Scroll smoothly to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [currentChat?.id, selectedPeer?.uid, profile?.uid]);

  // Direct send implementation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !currentChat || (!text.trim() && !selectedAttachment)) return;
    if (!currentChat.isGroup && !selectedPeer) return;

    // Trigger physical message transmission vibration
    triggerVibration('medium');

    setSending(true);
    setError(null);
    
    // Construct E2EE payload
    let textToSend = text.trim();
    
    // Stringify WhatsApp replies or attachments under RSA ciphertext
    const replyMeta = replyQuote ? {
      quotedAuthor: replyQuote.authorName,
      quotedSnippet: replyQuote.snippetText
    } : {};

    if (selectedAttachment) {
      textToSend = JSON.stringify({
        text: text.trim(),
        attachmentUrl: selectedAttachment.dataUrl,
        attachmentType: selectedAttachment.type,
        attachmentName: selectedAttachment.name,
        ...replyMeta
      });
    } else if (replyQuote) {
      textToSend = JSON.stringify({
        text: text.trim(),
        ...replyMeta
      });
    }

    const textRestoreValue = text;
    setText('');
    const attachmentRestoreValue = selectedAttachment;
    setSelectedAttachment(null);
    setReplyQuote(null);

    const taskType = attachmentRestoreValue ? 'file transfer' : 'chat send';
    const hasAttachment = !!attachmentRestoreValue;
    const taskLabel = hasAttachment 
      ? `Sending ${attachmentRestoreValue.type} File: ${attachmentRestoreValue.name}` 
      : `Sending Message to ${currentChat.isGroup ? currentChat.name : (selectedPeer?.displayName || 'Peer')}`;

    // Create central operation task
    const taskId = operations.createTask(taskType, taskLabel, {
      maxRetries: 3,
      totalBytes: hasAttachment ? Math.round(attachmentRestoreValue.dataUrl.length * 0.75) : undefined,
      onRetry: async () => {
        // Simple retry trigger
        await handleSendMessage(e);
      }
    });

    const toastId = 'msg-send-' + currentChat.id + '-' + Date.now();
    try {
      // Phase 2: STARTING
      operations.updateTask(taskId, { state: 'STARTING', progress: 10 });
      showBrutalistToast('TRANSMITTING...', 'Sealing and routing dialogue packet...', 'loading', undefined, toastId);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (currentChat.id !== 'my-ai-chat-id') {
        setFirestoreTypingStatus(currentChat.id, profile.uid, false);
      }
      isCurrentlyTypingRef.current = false;

      // Intercept My AI Chat Tunnel
      if (currentChat.id === 'my-ai-chat-id') {
        operations.updateTask(taskId, { state: 'CONNECTING', progress: 30 });
        await new Promise(r => setTimeout(r, 150));

        // Create user message in Firestore
        const userMessageId = doc(collection(db, 'chats', 'my-ai-chat-id', 'messages')).id;
        const userMessageData = {
          id: userMessageId,
          senderId: profile.uid,
          receiverId: 'my-ai-bot-uid',
          participantIds: [profile.uid, 'my-ai-bot-uid'].sort(),
          plainText: textRestoreValue,
          senderDisplayName: profile.displayName || 'You',
          createdAt: serverTimestamp(),
          read: true
        };
        await setDoc(doc(db, 'chats', 'my-ai-chat-id', 'messages', userMessageId), userMessageData);

        operations.updateTask(taskId, { state: 'SERVER ACKNOWLEDGED', progress: 60 });
        playSendMessageSound();

        // Trigger AI reply typing state!
        setTypingUsers(prev => ({ ...prev, 'my-ai-bot-uid': 'pulse' }));

        try {
          const aiResponse = await fetch('/api/myai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: textRestoreValue })
          });
          const aiData = await aiResponse.json();
          const aiReplyText = aiData.reply || "I am right here, but my thoughts are temporarily scrambled! Let's try again. ✨";

          // Create AI message in Firestore
          const aiMessageId = doc(collection(db, 'chats', 'my-ai-chat-id', 'messages')).id;
          const aiMessageData = {
            id: aiMessageId,
            senderId: 'my-ai-bot-uid',
            receiverId: profile.uid,
            participantIds: [profile.uid, 'my-ai-bot-uid'].sort(),
            plainText: aiReplyText,
            senderDisplayName: 'My AI 🌟',
            createdAt: serverTimestamp(),
            read: false
          };
          await setDoc(doc(db, 'chats', 'my-ai-chat-id', 'messages', aiMessageId), aiMessageData);

          // Update local storage for last message
          localStorage.setItem(`flick_my_ai_last_message_${profile.uid}`, aiReplyText);

        } catch (aiErr) {
          console.error("AI reply retrieval failed", aiErr);
          const fallbackId = doc(collection(db, 'chats', 'my-ai-chat-id', 'messages')).id;
          await setDoc(doc(db, 'chats', 'my-ai-chat-id', 'messages', fallbackId), {
            id: fallbackId,
            senderId: 'my-ai-bot-uid',
            receiverId: profile.uid,
            participantIds: [profile.uid, 'my-ai-bot-uid'].sort(),
            plainText: "Oh no! Flick's neural link suffered a temporary interruption. Let's try again! ☄️",
            senderDisplayName: 'My AI 🌟',
            createdAt: serverTimestamp(),
            read: false
          });
        } finally {
          // Clear typing status
          setTypingUsers(prev => ({ ...prev, 'my-ai-bot-uid': false }));
        }

        operations.updateTask(taskId, { state: 'FINALIZING', progress: 95 });
        operations.successTask(taskId);
        showBrutalistToast('MESSAGE TRANSMITTED', 'AI neural reply successfully processed.', 'success', undefined, toastId);
        setSending(false);
        return;
      }

      // Group dispatch
      if (currentChat.isGroup) {
        const myRole = currentChat.roles?.[profile.uid] || 'member';
        if (myRole === 'muted') {
          setError("YOU ARE MUTED IN THIS SECURE CONDUIT. TRANSMISSION INHIBITED.");
          showBrutalistToast('TRANSMISSION BLOCKED', 'You are muted in this conduit. Transmission inhibited.', 'warning', undefined, toastId);
          setSending(false);
          operations.failTask(taskId, 'Muted in secure conduit.');
          return;
        }

        let messageType: 'text' | 'poll' = 'text';
        let pollData: any = undefined;

        if (textRestoreValue.startsWith('📊 POLL_DATA:')) {
          try {
            const rawObj = textRestoreValue.replace('📊 POLL_DATA:', '');
            const parsed = JSON.parse(rawObj);
            messageType = 'poll';
            pollData = {
              question: parsed.question,
              options: parsed.options,
              votes: {}
            };
          } catch (e) {
            console.warn("Failed to parse poll data payload:", e);
          }
        }

        // Phase 3: CONNECTING
        operations.updateTask(taskId, { state: 'CONNECTING', progress: 30 });
        await new Promise(r => setTimeout(r, 200));

        // Phase 4: UPLOADING (simulated progress for file if any)
        if (hasAttachment && attachmentRestoreValue) {
          operations.updateTask(taskId, { state: 'UPLOADING', progress: 40 });
          const totalSize = Math.round(attachmentRestoreValue.dataUrl.length * 0.75);
          for (let percent = 40; percent <= 80; percent += 20) {
            operations.updateTask(taskId, {
              progress: percent,
              bytesUploaded: Math.round((percent / 100) * totalSize)
            });
            await new Promise(r => setTimeout(r, 200));
          }
        }

        // Phase 5: SERVER ACKNOWLEDGED & FINALIZING
        operations.updateTask(taskId, { state: 'SERVER ACKNOWLEDGED', progress: 85 });

        await sendGroupMessageService({
          chatId: currentChat.id,
          senderId: profile.uid,
          senderDisplayName: profile.displayName || 'Relay User',
          plainText: textRestoreValue,
          messageType,
          mediaUrl: attachmentRestoreValue?.dataUrl || undefined,
          mediaType: attachmentRestoreValue?.type || undefined,
          mediaName: attachmentRestoreValue?.name || undefined,
          replyToId: replyQuote?.msgId || undefined,
          replyToText: replyQuote?.snippetText || undefined,
          replyToSenderName: replyQuote?.authorName || undefined,
          pollData
        });

        operations.updateTask(taskId, { state: 'FINALIZING', progress: 95 });
        playSendMessageSound();
        showBrutalistToast('MESSAGE TRANSMITTED', 'Group dialogue packet successfully broadcasted.', 'success', undefined, toastId);
        
        // Phase 7: SUCCESS
        operations.successTask(taskId);
        setSending(false);
        return;
      }

      // If selfDestructSeconds mode active, pass down life range
      const calculatedLifespan = selfDestructSeconds > 0 ? selfDestructSeconds : undefined;

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      // Phase 3: CONNECTING
      operations.updateTask(taskId, { state: 'CONNECTING', progress: 30 });
      await new Promise(r => setTimeout(r, 150));

      if (hasAttachment && attachmentRestoreValue) {
        operations.updateTask(taskId, { state: 'UPLOADING', progress: 40 });
        const totalSize = Math.round(attachmentRestoreValue.dataUrl.length * 0.75);
        for (let percent = 40; percent <= 80; percent += 20) {
          operations.updateTask(taskId, {
            progress: percent,
            bytesUploaded: Math.round((percent / 100) * totalSize)
          });
          await new Promise(r => setTimeout(r, 150));
        }
      }

      if (isOffline) {
        // Offline queueing
        operations.updateTask(taskId, { state: 'CONNECTING', progress: 85 });
        await queueOfflineMessage({
          chatId: currentChat.id,
          senderId: profile.uid,
          senderDisplayName: profile.displayName,
          receiverId: selectedPeer.uid,
          plainText: textToSend,
          recipientPublicKeyJwk: selectedPeer.publicKey,
          senderPublicKeyJwk: profile.publicKey,
          lifespanSeconds: calculatedLifespan
        });
        
        operations.updateTask(taskId, { state: 'FINALIZING', progress: 95 });
        playSendMessageSound();
        setError(null);
        showBrutalistToast('ENCRYPTED & QUEUED', 'You are offline. Dialogue packet securely cached in local vault.', 'warning', undefined, toastId);
        console.log("[Offline Queue] Dialogue successfully cached in local IndexedDB vault.");
        
        // Phase 7: SUCCESS (or queue state)
        operations.successTask(taskId);
      } else {
        // Online dispatch
        operations.updateTask(taskId, { state: 'SERVER ACKNOWLEDGED', progress: 85 });
        await sendE2EEMessage({
          chatId: currentChat.id,
          senderId: profile.uid,
          senderDisplayName: profile.displayName,
          receiverId: selectedPeer.uid,
          plainText: textToSend,
          recipientPublicKeyJwk: selectedPeer.publicKey,
          senderPublicKeyJwk: profile.publicKey,
          lifespanSeconds: calculatedLifespan
        });
        
        operations.updateTask(taskId, { state: 'FINALIZING', progress: 95 });
        playSendMessageSound();
        showBrutalistToast('E2EE PACKET SENT', 'Handshake signed and E2EE packet transmitted.', 'success', undefined, toastId);
        
        operations.successTask(taskId);
      }
    } catch (err: any) {
      setText(textRestoreValue); 
      setSelectedAttachment(attachmentRestoreValue); 
      let errMsg = "Handshake packaging failure: " + sanitizeErrorMessage(err);
      if (!navigator.onLine) {
        errMsg = "offline: Dialogue transmission timed out.";
      }
      setError(errMsg);
      showBrutalistToast('TRANSMISSION ERROR', errMsg, 'error', undefined, toastId);
      
      // Phase 8: FAILED
      operations.failTask(taskId, errMsg);
    } finally {
      setSending(false);
    }
  };

  // Custom File Attachments processor
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const isImg = file.type.startsWith('image/');
      let b64 = "";

      if (isImg) {
        // Compress images to stay under Firestore size limit
        b64 = await compressImage(file, 450, 450, 0.65);
      } else {
        b64 = await fileToBase64(file);
      }

      const mediaType = getMediaTypeFromMime(file.type);
      setSelectedAttachment({
        dataUrl: b64,
        type: mediaType,
        name: file.name
      });
      if (currentChat && profile) {
        setFirestoreTypingStatus(currentChat.id, profile.uid, true, mediaType);
      }
      playLikeSound();
    } catch (err) {
      setError("Asset parser failed to decode base64 file buffer.");
    }
  };

  // WhatsApp-style micro voice capture engine (Push to Record / Release to Send)
  const startVoiceRecording = async () => {
    setError(null);
    if (currentChat && profile) {
      setFirestoreTypingStatus(currentChat.id, profile.uid, true, 'audio');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const fileSegment = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
          const b64 = await fileToBase64(fileSegment);
          setSelectedAttachment({
            dataUrl: b64,
            type: 'audio',
            name: `voice-message-${Date.now()}.webm`
          });
          playLikeSound();
        } catch (e) {
          setError("Failed to package voice payload.");
        }
      };

      recorder.start();
      setIsRecording(true);
      playGlitchClickSound();
    } catch (e) {
      setError("Audio capture microphone missing or permission blocked.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      playGlitchClickSound();
    }
  };

  // Toggle Speech-to-text translation microphone listeners
  const toggleVoiceToTextListening = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError("Native Speech Recognition API is not supported in this browser environment.");
      return;
    }

    if (isV2TListening) {
      // Stop
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (e) {
          console.warn("Speech Stop warning:", e);
        }
      }
      setIsV2TListening(false);
      triggerVibration('medium');
      playGlitchClickSound();
    } else {
      // Start
      setError(null);
      try {
        const rec = new SpeechRecognitionClass();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsV2TListening(true);
          triggerVibration('heavy');
          playGlitchClickSound();
        };

        rec.onresult = (event: any) => {
          let chunk = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              chunk += event.results[i][0].transcript;
            }
          }
          if (chunk) {
            setText(prev => {
              const cleanedText = (prev + ' ' + chunk).trim();
              return cleanedText;
            });
          }
        };

        rec.onerror = (err: any) => {
          console.warn("Speech Recognition runtime issue:", err);
          if (err.error !== 'no-speech') {
            setError(`Speech-to-Text runtime alert: ${err.error || 'mic mismatch'}`);
            setIsV2TListening(false);
          }
        };

        rec.onend = () => {
          setIsV2TListening(false);
        };

        rec.start();
        speechRecognitionRef.current = rec;
      } catch (err) {
        setError("Microphone context block or SpeechRecognition initialization error.");
        setIsV2TListening(false);
      }
    }
  };

  // Verify active chat channel existence
  const hasActiveTunnel = (peerUid: string) => {
    return activeChatTunnels.some(chat => chat.participantIds.includes(peerUid));
  };

  // Category filters supporting active tunnel subset partitioning
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === 'active') {
      return hasActiveTunnel(u.uid);
    }
    return true;
  });

  const unreadTunnelsCount = notifications.filter(n => n.type === 'message').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 bg-[#0c0c0c] overflow-hidden h-full w-full font-mono">
      
      {/* Contact Panel sidebar - spans 4 cols */}
      <div className={`md:col-span-4 border-r-2 border-[var(--neon-green)]/30 flex flex-col bg-[#050505] h-full overflow-hidden ${currentChat ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Compact Snapchat-inspired Sidebar Header */}
        <div className="p-4 border-b border-zinc-900/40 bg-neutral-950 flex-shrink-0 flex items-center justify-between select-none">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img 
                src={profile?.photoURL || "https://api.dicebear.com/7.x/fun-emoji/svg?seed=flick"}
                alt="My Avatar"
                className="w-10 h-10 rounded-full border-2 border-[var(--neon-green)] object-cover cursor-pointer hover:scale-105 transition duration-150 shadow-[0_0_8px_rgba(0,255,102,0.15)]"
                onClick={() => {
                  playGlitchClickSound();
                  triggerVibration('light');
                  triggerViewProfile(profile?.uid || '');
                }}
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" title="System secured" />
            </div>
            <div className="min-w-0">
              <h2 className="font-sans font-black tracking-tight text-white text-base leading-none uppercase">CHAT</h2>
              <span className="text-[7.5px] uppercase tracking-widest font-mono text-zinc-500 mt-0.5 block truncate">SECURE DIRECT ARCHITECTURE</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                playGlitchClickSound();
                setIsShortcutModalOpen(true);
              }}
              className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Keyboard hotkeys"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                playGlitchClickSound();
                setShowQrShareModal(true);
              }}
              className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="My QR code"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                playGlitchClickSound();
                setShowQrScanModal(true);
                startScanning();
              }}
              className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Scan peer QR"
            >
              <ScanLine className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                playGlitchClickSound();
                setIsCreateGroupOpen(!isCreateGroupOpen);
                setIsJoinGroupOpen(false);
              }}
              className={`p-2 rounded-full transition cursor-pointer ${isCreateGroupOpen ? 'bg-[var(--neon-green)] text-black font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              title="Create Group Concourse"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                playGlitchClickSound();
                setIsJoinGroupOpen(!isJoinGroupOpen);
                setIsCreateGroupOpen(false);
              }}
              className={`p-2 rounded-full transition cursor-pointer ${isJoinGroupOpen ? 'bg-[var(--neon-green)] text-black font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              title="Join Group Concourse"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-time search to instantly filter contacts */}
        <div className="px-3 pb-2 pt-2 border-b border-zinc-950 bg-black/30">
          <div className="relative flex items-center border border-zinc-900 bg-black/60 px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-zinc-550 mr-2 shrink-0" />
            <input
              type="text"
              placeholder={filterType === 'all-nodes' ? "SEARCH ALL SYSTEMS NODES..." : "SEARCH DIALOGUES & TRANSMISSIONS..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-[9.5px] text-white placeholder-zinc-500 tracking-wider w-full uppercase font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-zinc-500 hover:text-white font-mono text-[9px] pl-1 cursor-pointer select-none font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Horizontal filter capsules Snapchat-inspired Layout */}
        <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-none select-none border-b border-zinc-900/40 bg-neutral-950 shrink-0">
          {[
            { id: 'all', label: 'All 💬' },
            { id: 'unread', label: 'Unread 🔴' },
            { id: 'my-ai', label: 'My AI 🌟' },
            { id: 'groups', label: 'Groups 👥' },
            { id: 'favorites', label: 'Favorites ⭐' },
            { id: 'all-nodes', label: 'Directory 🔍' }
          ].map((pill) => {
            const isActive = filterType === pill.id;
            let badgeCount = 0;
            if (pill.id === 'unread') {
              badgeCount = notifications.filter(n => n.type === 'message').length;
            } else if (pill.id === 'groups') {
              badgeCount = activeChatTunnels.filter(chat => chat.isGroup).length;
            }
            
            return (
              <button
                key={pill.id}
                onClick={() => {
                  playGlitchClickSound();
                  triggerVibration('light');
                  if (pill.id === 'my-ai') {
                    const myAIPeer: UserProfile = {
                      uid: 'my-ai-bot-uid',
                      displayName: 'My AI 🌟',
                      photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
                      email: 'myai@flick.internal',
                      status: 'online',
                      lastSeen: { toDate: () => new Date() } as any,
                      updatedAt: { toDate: () => new Date() } as any,
                      publicKey: ''
                    };
                    openChatRoom(myAIPeer);
                    return;
                  }
                  setFilterType(pill.id as any);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-sans font-semibold tracking-normal transition-all duration-150 shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-white text-black font-extrabold shadow-sm' 
                    : 'bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {pill.label}
                  {badgeCount > 0 && (
                    <span className={`px-1.5 py-0.5 text-[8.5px] rounded-full font-bold ${isActive ? 'bg-black text-white font-black' : 'bg-red-500 text-white font-black'}`}>
                      {badgeCount}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Sidebar Scroll Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-950 bg-black/40">
          
          {/* Group Joining Form inline pop */}
          {isJoinGroupOpen && (
            <div className="p-3 border-b border-[var(--neon-green)]/20 bg-black/90 text-zinc-350 space-y-2 select-none text-[9.5px]">
              <p className="font-bold text-[var(--neon-green)] text-[8.5px] border-b border-[var(--neon-green)]/15 pb-1 uppercase">JOIN CONDUIT BY ACCESS CODE</p>
              <div>
                <span className="block text-[8px] text-zinc-500 mb-0.5">TARGET CHAT ID:</span>
                <input
                  type="text"
                  placeholder="e.g. chats/xxxxxxxxx or just chatId"
                  value={joinGroupInputChatId}
                  onChange={(e) => setJoinGroupInputChatId(e.target.value)}
                  className="w-full text-xs bg-zinc-950 text-white p-1 border border-zinc-850 focus:outline-none h-7 uppercase font-mono"
                />
              </div>
              <div>
                <span className="block text-[8px] text-zinc-500 mb-0.5">JOIN / INVITE CODE (IF PRIVATE):</span>
                <input
                  type="text"
                  placeholder="e.g. CYBERPASS99"
                  value={joinGroupInputCode}
                  onChange={(e) => setJoinGroupInputCode(e.target.value)}
                  className="w-full text-xs bg-zinc-950 text-white p-1 border border-zinc-850 focus:outline-none h-7 uppercase font-mono"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!joinGroupInputChatId.trim() || !profile) return;
                  playGlitchClickSound();
                  triggerVibration('medium');
                  try {
                    let rawId = joinGroupInputChatId.trim();
                    if (rawId.includes('/')) {
                      const parts = rawId.split('/');
                      rawId = parts[parts.length - 1];
                    }
                    await joinGroupWithCode(rawId, profile.uid, joinGroupInputCode.trim() || undefined);
                    setIsJoinGroupOpen(false);
                    setJoinGroupInputChatId('');
                    setJoinGroupInputCode('');
                    setError(null);
                  } catch (e: any) {
                    console.error("Failed to join group:", e);
                    setError(e.message || "Failed to join group conduit. Verify access credentials.");
                  }
                }}
                disabled={!joinGroupInputChatId.trim()}
                className="w-full py-1.5 bg-[var(--neon-green)] text-black text-[9px] uppercase font-bold hover:bg-white cursor-pointer select-none leading-none h-7"
              >
                INTERCEPT & JOIN CONDUIT
              </button>
            </div>
          )}

          {/* Group Creation Form inline pop */}
          {isCreateGroupOpen && (
            <div className="p-3 border-b border-red-500/20 bg-zinc-950 text-zinc-350 space-y-3 select-none text-[9.5px]">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                <p className="font-bold text-[var(--neon-green)] text-[8.5px] uppercase tracking-wider font-mono">
                  INITIALIZE SECURE GROUP [STEP {createGroupStep}/3]
                </p>
                <div className="flex space-x-1 font-mono text-[8px]">
                  <span className={createGroupStep >= 1 ? "text-[var(--neon-green)]" : "text-zinc-600"}>■</span>
                  <span className={createGroupStep >= 2 ? "text-[var(--neon-green)]" : "text-zinc-600"}>■</span>
                  <span className={createGroupStep >= 3 ? "text-[var(--neon-green)]" : "text-zinc-600"}>■</span>
                </div>
              </div>

              {/* STEP 1: SELECT GROUP TYPE */}
              {createGroupStep === 1 && (
                <div className="space-y-2 animate-fade-in">
                  <p className="text-[7.5px] text-zinc-500 uppercase tracking-widest font-mono mb-1">SELECT GROUP ARCHITECTURE TYPE:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'friends', label: 'Friends Chat', desc: 'Secure casual room' },
                      { id: 'school', label: 'School / Academic', desc: 'Study group node' },
                      { id: 'church', label: 'Church / Belief', desc: 'Community sanctuary' },
                      { id: 'business', label: 'Enterprise / Org', desc: 'Admin led workspace' },
                      { id: 'community', label: 'Public Concourse', desc: 'Broad topic channel' },
                      { id: 'custom', label: 'Custom Conduit', desc: 'Bespoke parameters' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          playGlitchClickSound();
                          setNewGroupType(type.id as any);
                          setCreateGroupStep(2);
                        }}
                        className={`p-2 border text-left flex flex-col justify-between transition h-14 ${
                          newGroupType === type.id 
                            ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]' 
                            : 'border-zinc-850 bg-black/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        <span className="font-mono text-[9px] font-bold uppercase">{type.label}</span>
                        <span className="text-[7px] text-zinc-500 lowercase truncate leading-none">{type.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: GROUP METADATA (NAME, AVATAR, BANNER) */}
              {createGroupStep === 2 && (
                <div className="space-y-2.5 animate-fade-in">
                  <div className="flex gap-1.5">
                    <div className="flex-1">
                      <span className="block text-[7.5px] text-zinc-500 mb-0.5">CONDUIT CODENAME:</span>
                      <input
                        type="text"
                        placeholder="e.g. CYBER COVENANT ALPHA"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full text-xs bg-zinc-950 text-white p-1 border border-zinc-850 focus:outline-none uppercase h-7 font-bold placeholder:text-zinc-700 font-mono"
                      />
                    </div>
                    <div className="w-1/3">
                      <span className="block text-[7.5px] text-zinc-500 mb-0.5">PRIVACY:</span>
                      <select
                        value={newGroupPrivacy}
                        onChange={(e) => setNewGroupPrivacy(e.target.value as any)}
                        className="w-full text-[9px] bg-zinc-950 text-white p-1 border border-zinc-850 focus:outline-none uppercase h-7"
                      >
                        <option value="private">PRIVATE</option>
                        <option value="public">PUBLIC</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[7.5px] text-zinc-500 mb-0.5">DESCRIPTION:</span>
                    <input
                      type="text"
                      placeholder="e.g. SECURE CHANNEL FOR CRITICAL OPERATIONS"
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      className="w-full text-[9px] bg-zinc-950 text-white p-1 border border-zinc-850 focus:outline-none uppercase h-7 placeholder:text-zinc-700 font-mono"
                    />
                  </div>

                  {/* AVATAR & BANNER UPLOADS */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Avatar Upload */}
                    <div>
                      <span className="block text-[7.5px] text-zinc-500 mb-0.5">AVATAR ICON:</span>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          id="new-group-avatar-upload"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const base64 = await compressImage(file, 200, 200, 0.6);
                                setNewGroupAvatarUrl(base64);
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                        />
                        <label
                          htmlFor="new-group-avatar-upload"
                          className="flex-1 text-center py-1 border border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-950 text-[8px] uppercase tracking-wider text-zinc-400 hover:text-white cursor-pointer select-none transition h-7 flex items-center justify-center font-mono leading-none"
                        >
                          {newGroupAvatarUrl ? "READY" : "UPLOAD AVATAR"}
                        </label>
                        {newGroupAvatarUrl && (
                          <img src={newGroupAvatarUrl} alt="Avatar" className="w-6 h-6 border border-[var(--neon-green)] object-cover shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Banner Upload */}
                    <div>
                      <span className="block text-[7.5px] text-zinc-500 mb-0.5">BANNER WALLPAPER:</span>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          id="new-group-banner-upload"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const base64 = await compressImage(file, 400, 150, 0.6);
                                setNewGroupBannerUrl(base64);
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                        />
                        <label
                          htmlFor="new-group-banner-upload"
                          className="flex-1 text-center py-1 border border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-950 text-[8px] uppercase tracking-wider text-zinc-400 hover:text-white cursor-pointer select-none transition h-7 flex items-center justify-center font-mono leading-none"
                        >
                          {newGroupBannerUrl ? "READY" : "UPLOAD BANNER"}
                        </label>
                        {newGroupBannerUrl && (
                          <img src={newGroupBannerUrl} alt="Banner" className="w-8 h-6 border border-[var(--neon-green)] object-cover shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>

                  {newGroupPrivacy === 'private' && (
                    <div>
                      <span className="block text-[7.5px] text-zinc-500 mb-0.5">PRIVATE JOIN CODENAME / PASSWORD (OPTIONAL):</span>
                      <input
                        type="text"
                        placeholder="e.g. CYBERPASS99"
                        value={newGroupInviteCode}
                        onChange={(e) => setNewGroupInviteCode(e.target.value)}
                        className="w-full text-[9px] bg-zinc-950 text-white p-1 border border-zinc-850 focus:outline-none uppercase h-7 placeholder:text-zinc-700 font-mono"
                      />
                    </div>
                  )}

                  <div className="flex justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => { playGlitchClickSound(); setCreateGroupStep(1); }}
                      className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-mono text-[8.5px] uppercase border border-zinc-800"
                    >
                      &lt; BACK
                    </button>
                    <button
                      type="button"
                      onClick={() => { playGlitchClickSound(); setCreateGroupStep(3); }}
                      disabled={!newGroupName.trim()}
                      className="px-4 py-1 bg-[var(--neon-green)] text-black font-bold font-mono text-[8.5px] uppercase disabled:opacity-50"
                    >
                      NEXT &gt;
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SECURITY PERMISSIONS & MEMBER PICKER */}
              {createGroupStep === 3 && (
                <div className="space-y-2.5 animate-fade-in">
                  <p className="text-[7.5px] text-zinc-500 uppercase tracking-widest font-mono">CONDUIT SECURITY PERMISSIONS:</p>
                  
                  <div className="grid grid-cols-2 gap-1.5 p-1.5 border border-zinc-900 bg-black/40">
                    <div>
                      <span className="block text-[7px] text-zinc-500 uppercase mb-0.5 font-mono">WHO CAN TRANSMIT?</span>
                      <select
                        value={newGroupPermSend}
                        onChange={(e) => setNewGroupPermSend(e.target.value as any)}
                        className="w-full text-[8px] bg-zinc-950 text-white p-0.5 border border-zinc-850 focus:outline-none uppercase h-6 font-mono"
                      >
                        <option value="all">ALL NODES</option>
                        <option value="admins">ADMINS ONLY</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[7px] text-zinc-500 uppercase mb-0.5 font-mono">WHO CAN ADD NODES?</span>
                      <select
                        value={newGroupPermAdd}
                        onChange={(e) => setNewGroupPermAdd(e.target.value as any)}
                        className="w-full text-[8px] bg-zinc-950 text-white p-0.5 border border-zinc-850 focus:outline-none uppercase h-6 font-mono"
                      >
                        <option value="all">ALL NODES</option>
                        <option value="admins">ADMINS ONLY</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between col-span-2 py-0.5 border-t border-zinc-900 pt-1">
                      <span className="text-[7.5px] text-zinc-400 uppercase font-mono">MEMBERS CAN PIN MESSAGES:</span>
                      <button
                        type="button"
                        onClick={() => setNewGroupPermPin(!newGroupPermPin)}
                        className={`px-1.5 py-0.5 border text-[7px] font-mono leading-none ${
                          newGroupPermPin ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]' : 'border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {newGroupPermPin ? 'ALLOWED' : 'FORBIDDEN'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between col-span-2 py-0.5 border-t border-zinc-900 pt-1">
                      <span className="text-[7.5px] text-zinc-400 uppercase font-mono">ADMIN JOIN APPROVAL REQ. (QUEUE):</span>
                      <button
                        type="button"
                        onClick={() => setNewGroupAdminApproval(!newGroupAdminApproval)}
                        className={`px-1.5 py-0.5 border text-[7px] font-mono leading-none ${
                          newGroupAdminApproval ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]' : 'border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {newGroupAdminApproval ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between col-span-2 py-0.5 border-t border-zinc-900 pt-1">
                      <span className="text-[7.5px] text-zinc-400 uppercase font-mono">ANONYMOUS RECRUIT MODE:</span>
                      <button
                        type="button"
                        onClick={() => setNewGroupAnonymous(!newGroupAnonymous)}
                        className={`px-1.5 py-0.5 border text-[7px] font-mono leading-none ${
                          newGroupAnonymous ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]' : 'border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {newGroupAnonymous ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[7.5px] text-zinc-500 uppercase font-mono">SUBSCRIBE TARGET PEER NODES ({users.length}):</span>
                      {newGroupSelectedMembers.length > 0 && (
                        <span className="text-[7.5px] text-[var(--neon-green)] font-mono font-bold animate-pulse">
                          [{newGroupSelectedMembers.length} SELECTED]
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="FILTER REGISTERED NODES..."
                      value={groupUserSearchQuery}
                      onChange={(e) => setGroupUserSearchQuery(e.target.value)}
                      className="w-full text-[8.5px] bg-neutral-950 text-white p-1 mb-1 border border-zinc-900 focus:outline-none uppercase h-6 font-mono placeholder:text-zinc-700"
                    />
                    <div className="max-h-24 overflow-y-auto space-y-1 border border-zinc-900 bg-neutral-950 p-1">
                      {users
                        .filter(u => {
                          const q = groupUserSearchQuery.toLowerCase();
                          const name = (u.displayName || '').toLowerCase();
                          const mail = (u.email || '').toLowerCase();
                          return name.includes(q) || mail.includes(q);
                        })
                        .map(u => {
                          const isPicked = newGroupSelectedMembers.includes(u.uid);
                          return (
                            <button
                              key={u.uid}
                              type="button"
                              onClick={() => {
                                playGlitchClickSound();
                                setNewGroupSelectedMembers(prev => 
                                  isPicked ? prev.filter(id => id !== u.uid) : [...prev, u.uid]
                                );
                              }}
                              className={`w-full text-left p-1 text-[7.5px] uppercase border flex items-center justify-between ${
                                isPicked 
                                  ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)] text-[var(--neon-green)] font-bold'
                                  : 'bg-transparent border-zinc-900 text-zinc-400 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="truncate max-w-[140px] font-bold">{u.displayName || 'NO IDENTIFIER'}</span>
                                <span className="text-[6px] text-zinc-500 truncate max-w-[140px] font-mono">{u.email}</span>
                              </div>
                              <span className="text-[7px] text-zinc-500 shrink-0">{isPicked ? '[ SELECTED ]' : '[ ADD ]'}</span>
                            </button>
                          );
                        })}
                      {users.length === 0 && (
                        <p className="text-[7px] text-zinc-600 text-center py-2 font-mono">NO SECURED NODES LOCATED</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => { playGlitchClickSound(); setCreateGroupStep(2); }}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-mono text-[8.5px] uppercase border border-zinc-800 leading-none h-7"
                    >
                      &lt; BACK
                    </button>
                    <button
                      type="button"
                      onClick={() => createGroupConduit(newGroupName, newGroupSelectedMembers)}
                      disabled={!newGroupName.trim() || newGroupSelectedMembers.length === 0}
                      className="flex-1 py-1.5 bg-[var(--neon-green)] text-black text-[8.5px] uppercase font-bold hover:bg-white cursor-pointer select-none leading-none h-7 font-mono flex items-center justify-center disabled:opacity-55"
                    >
                      DEPLOY GROUP CONDUIT
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Render Chats List */}
          {filterType === 'all-nodes' ? (
            /* Render all registered users directory */
            filteredUsers.map((u, index) => {
              const isSelected = selectedPeer?.uid === u.uid;
              const rtdbPresence = rtdbStatuses[u.uid];
              const lastSeenMs = u.lastSeen 
                ? (u.lastSeen.toDate ? u.lastSeen.toDate().getTime() : (typeof u.lastSeen === 'number' ? u.lastSeen : Date.parse(u.lastSeen)))
                : 0;
              const hasRecentHeartbeat = lastSeenMs > 0 && (Date.now() - lastSeenMs) <= 60000;
              const isOnline = (rtdbPresence ? (rtdbPresence.state === 'online') : (u.status === 'online')) || hasRecentHeartbeat;
              
              const statusText = isOnline 
                ? 'ONLINE' 
                : (rtdbPresence?.lastChanged 
                  ? `${formatLastSeen(rtdbPresence.lastChanged).toUpperCase()}` 
                  : (u.lastSeen 
                    ? `LAST SEEN ${formatLastSeen(u.lastSeen).toUpperCase()}`
                    : 'OFFLINE'));

              const unreadFromPeer = notifications.filter(n => n.type === 'message' && (n.senderId === u.uid || n.senderName === u.displayName)).length;

              return (
                <button
                  key={`${u.uid}-${index}`}
                  onClick={() => openChatRoom(u)}
                  className={`w-full flex items-center space-x-3 p-3.5 text-left transition duration-150 cursor-pointer ${
                    isSelected 
                      ? 'bg-[var(--neon-green)] text-black font-extrabold border-l-4 border-black' 
                      : 'hover:bg-[var(--neon-green)]/10 text-zinc-100'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={u.photoURL}
                      alt={u.displayName}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerVibration('light');
                        playGlitchClickSound();
                        triggerViewProfile(u.uid);
                      }}
                      className={`w-9 h-9 rounded-full border object-cover cursor-pointer hover:scale-105 transition-all ${isSelected ? 'border-black' : 'border-[var(--neon-green)]/35'}`}
                      referrerPolicy="no-referrer"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${
                        isOnline ? 'bg-[var(--neon-green)]' : 'bg-red-500'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-black' : 'text-zinc-100'}`}>
                          {renamedNicknames[u.uid] ? `${renamedNicknames[u.uid]} *` : u.displayName}
                        </p>
                        {unreadFromPeer > 0 && (
                          <span 
                            className={`animate-pulse px-1.5 py-0.5 text-[8px] font-black leading-none rounded-none border ${
                              isSelected 
                                ? 'bg-black text-[var(--neon-green)] border-[var(--neon-green)]' 
                                : 'bg-[var(--neon-green)] text-black border-black'
                            }`}
                          >
                            {unreadFromPeer} NEW
                          </span>
                        )}
                      </div>
                      <span className={`text-[8px] font-mono tracking-tighter capitalize ${isSelected ? 'text-black/80 font-black' : 'text-zinc-500'}`}>
                        {statusText}
                      </span>
                    </div>
                    <p className={`text-[8.5px] truncate font-mono mt-0.5 ${isSelected ? 'text-black/60' : 'text-zinc-500'}`}>
                      {u.email}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            /* Render unified active conversations (chats & groups) */
            activeChatTunnels.filter(chat => {
              // If it is a direct message chat, make sure the peer still exists in our registered users list
              if (!chat.isGroup && chat.id !== 'global-node-concourse') {
                const peerId = chat.participantIds.find(id => id !== profile?.uid);
                if (peerId) {
                  const peerExists = users.some(u => u.uid === peerId);
                  if (!peerExists) return false;
                }
              }

              // Filter by pill selection
              if (filterType === 'groups' && !chat.isGroup) return false;
              if (filterType === 'favorites' && !favoriteChats.includes(chat.id)) return false;
              
              const peerId = chat.participantIds.find(id => id !== profile?.uid);
              const peer = users.find(u => u.uid === peerId);
              const unreadCount = notifications.filter(n => 
                n.type === 'message' && (
                  n.chatId === chat.id || 
                  (peer && (n.senderId === peer.uid || n.senderName === peer.displayName))
                )
              ).length;
              
              if (filterType === 'unread' && unreadCount === 0) return false;

              // Filter by search query
              if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase();
                if (chat.isGroup) {
                  const nameMatch = chat.name?.toLowerCase().includes(q);
                  const lastMsgMatch = chat.lastMessage?.toLowerCase().includes(q);
                  if (!nameMatch && !lastMsgMatch) return false;
                } else {
                  if (!peer) return false;
                  const nameMatch = peer.displayName.toLowerCase().includes(q);
                  const aliasMatch = (renamedNicknames[peer.uid] || '').toLowerCase().includes(q);
                  const lastMsgMatch = chat.lastMessage?.toLowerCase().includes(q);
                  if (!nameMatch && !aliasMatch && !lastMsgMatch) return false;
                }
              }
              return true;
            }).sort((a, b) => {
              const getUnread = (c: typeof a) => {
                if (c.isGroup) {
                  return notifications.filter(n => n.type === 'message' && n.chatId === c.id).length;
                } else {
                  const pId = c.participantIds.find(id => id !== profile?.uid);
                  const p = users.find(u => u.uid === pId);
                  return p ? notifications.filter(n => n.type === 'message' && (n.senderId === p.uid || n.senderName === p.displayName)).length : 0;
                }
              };

              const unreadA = getUnread(a);
              const unreadB = getUnread(b);

              if (unreadA > 0 && unreadB === 0) return -1;
              if (unreadB > 0 && unreadA === 0) return 1;

              const timeA = a.lastMessageAt ? (a.lastMessageAt.seconds ? a.lastMessageAt.seconds * 1000 : (a.lastMessageAt.toDate ? a.lastMessageAt.toDate().getTime() : Date.parse(a.lastMessageAt))) : 0;
              const timeB = b.lastMessageAt ? (b.lastMessageAt.seconds ? b.lastMessageAt.seconds * 1000 : (b.lastMessageAt.toDate ? b.lastMessageAt.toDate().getTime() : Date.parse(b.lastMessageAt))) : 0;
              return timeB - timeA;
            }).map((chat) => {
              const isSelected = currentChat?.id === chat.id;
              const isFavorite = favoriteChats.includes(chat.id);

              const getStreakNum = (uid: string) => {
                const seed = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                return (seed % 14) + 3; // Stable streak between 3 and 16
              };

              if (chat.isGroup) {
                // Group Chat Item
                const chatName = chat.name || 'GLOBAL CONCOURSE';
                const avatarUrl = chat.avatarUrl || "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120";
                
                const unreadCount = notifications.filter(n => n.type === 'message' && n.chatId === chat.id).length;
                const groupTypers = Object.keys(allTunnelsTyping[chat.id] || {}).filter(uid => allTunnelsTyping[chat.id][uid] === true && uid !== profile?.uid);
                const isGroupTyping = groupTypers.length > 0;
                
                const timeString = chat.lastMessageAt ? formatLastSeen(chat.lastMessageAt) : '';

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      playGlitchClickSound();
                      triggerVibration('medium');
                      setSelectedGroup(chat);
                      setSelectedPeer(null);
                      setCurrentChat(chat);
                    }}
                    className={`w-full flex items-center space-x-3.5 p-3.5 text-left transition duration-150 border-b border-zinc-900/30 cursor-pointer ${
                      isSelected 
                        ? 'bg-zinc-900/60 border-l-4 border-[var(--neon-green)]' 
                        : 'hover:bg-zinc-900/30 text-zinc-100'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={avatarUrl}
                        alt={chatName}
                        className={`w-12 h-12 rounded-full border-2 object-cover transition-all ${unreadCount > 0 ? 'border-sky-450 scale-105' : 'border-zinc-800'}`}
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black bg-sky-400" title="Group Conduit" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                          <p className="text-[13px] font-sans font-bold truncate text-zinc-100">
                            👥 {chatName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playGlitchClickSound();
                              toggleFavoriteChat(chat.id);
                            }}
                            className={`p-0.5 hover:scale-110 transition ${isSelected ? 'text-[var(--neon-green)]' : 'text-zinc-500 hover:text-yellow-400'}`}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current text-yellow-500' : ''}`} />
                          </button>
                          <span className="text-[11px] font-sans text-zinc-400 font-semibold shrink-0">
                            ✨
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1 min-w-0">
                        {isGroupTyping ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-[11px] font-sans font-semibold text-emerald-400 animate-pulse uppercase">
                              typing...
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            {unreadCount > 0 ? (
                              <span className="w-3 h-3 bg-sky-400 rounded-[3px] flex-shrink-0 animate-pulse" title="Unread Group chat" />
                            ) : (
                              <span className="w-3 h-3 border-2 border-sky-400 rounded-[3px] flex-shrink-0" title="Opened Group chat" />
                            )}
                            <p className={`text-[11px] font-sans truncate flex-1 ${unreadCount > 0 ? 'text-zinc-100 font-extrabold' : 'text-zinc-400'}`}>
                              {unreadCount > 0 ? 'New Chat' : (chat.lastMessage || 'Channel empty')}
                              {timeString && `  •  ${timeString}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Direct Chat Item
                const peerId = chat.participantIds.find(id => id !== profile?.uid);
                const peer = users.find(u => u.uid === peerId);
                if (!peer) return null;

                const rtdbPresence = rtdbStatuses[peer.uid];
                const lastSeenMs = peer.lastSeen 
                  ? (peer.lastSeen.toDate ? peer.lastSeen.toDate().getTime() : (typeof peer.lastSeen === 'number' ? peer.lastSeen : Date.parse(peer.lastSeen)))
                  : 0;
                const hasRecentHeartbeat = lastSeenMs > 0 && (Date.now() - lastSeenMs) <= 60000;
                const isOnline = (rtdbPresence ? (rtdbPresence.state === 'online') : (peer.status === 'online')) || hasRecentHeartbeat;
                
                const statusText = isOnline 
                  ? 'ONLINE' 
                  : (rtdbPresence?.lastChanged 
                    ? `${formatLastSeen(rtdbPresence.lastChanged).toUpperCase()}` 
                    : (peer.lastSeen 
                      ? `LAST SEEN ${formatLastSeen(peer.lastSeen).toUpperCase()}`
                      : 'OFFLINE'));

                const unreadFromPeer = notifications.filter(n => n.type === 'message' && (n.chatId === chat.id || n.senderId === peer.uid || n.senderName === peer.displayName)).length;
                const isPeerTyping = !!(allTunnelsTyping[chat.id]?.[peer.uid]);
                const timeString = chat.lastMessageAt ? formatLastSeen(chat.lastMessageAt) : '';

                return (
                  <div
                    key={chat.id}
                    onClick={() => openChatRoom(peer)}
                    className={`w-full flex items-center space-x-3.5 p-3.5 text-left transition duration-150 border-b border-zinc-900/30 cursor-pointer ${
                      isSelected 
                        ? 'bg-zinc-900/60 border-l-4 border-[var(--neon-green)]' 
                        : 'hover:bg-zinc-900/30 text-zinc-100'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={peer.photoURL}
                        alt={peer.displayName}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerVibration('light');
                          playGlitchClickSound();
                          triggerViewProfile(peer.uid);
                        }}
                        className={`w-12 h-12 rounded-full border-2 object-cover cursor-pointer hover:scale-105 transition-all ${unreadFromPeer > 0 ? 'border-rose-500 scale-105' : 'border-zinc-800'}`}
                        referrerPolicy="no-referrer"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
                          peer.uid === 'my-ai-bot-uid' || isOnline ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                          <p className="text-[13px] font-sans font-bold truncate text-zinc-100">
                            {renamedNicknames[peer.uid] ? `${renamedNicknames[peer.uid]} *` : peer.displayName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playGlitchClickSound();
                              toggleFavoriteChat(chat.id);
                            }}
                            className={`p-0.5 hover:scale-110 transition ${isSelected ? 'text-[var(--neon-green)]' : 'text-zinc-500 hover:text-yellow-400'}`}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current text-yellow-500' : ''}`} />
                          </button>
                          <span className="text-[11px] font-sans text-zinc-400 font-semibold shrink-0" title="Conversation streak">
                            {peer.uid === 'my-ai-bot-uid' ? '🌟' : `🔥 ${getStreakNum(peer.uid)}`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1 min-w-0">
                        {isPeerTyping ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-[11px] font-sans font-semibold text-emerald-400 animate-pulse uppercase">
                              typing...
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            {unreadFromPeer > 0 ? (
                              <span className="w-3.5 h-3.5 bg-rose-500 rounded-[3px] flex-shrink-0 animate-pulse animate-duration-1000" title="Unread chat" />
                            ) : (
                              <span className="w-3.5 h-3.5 border-2 border-rose-500 rounded-[3px] flex-shrink-0" title="Opened chat" />
                            )}
                            <p className={`text-[11px] font-sans truncate flex-1 ${unreadFromPeer > 0 ? 'text-zinc-100 font-extrabold' : 'text-zinc-400'}`}>
                              {unreadFromPeer > 0 ? 'New Chat' : (chat.lastMessage || 'Tap to chat')}
                              {timeString && `  •  ${timeString}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            })
          )}
          {filterType !== 'all-nodes' && activeChatTunnels.length === 0 && (
            <div className="p-8 text-center text-zinc-555 select-none">
              <Group className="w-8 h-8 text-zinc-600 mx-auto mb-2 animate-pulse" />
              <p className="text-[10px] uppercase font-bold tracking-wider mb-1">NO ACTIVE CONVERGENCES FOUND</p>
              <p className="text-[8px] text-zinc-500 max-w-xs mx-auto uppercase">Toggle "NODES" above to discover peer frequencies and launch secure direct lines.</p>
            </div>
          )}
        </div>

        {/* E2EE Keys diagnostics indicators */}
        {profile && (
          <div className="p-4 border-t border-[var(--neon-green)]/15 bg-black flex-shrink-0">
            <div className="flex items-center justify-between text-[8px] uppercase tracking-wider font-extrabold opacity-60 mb-2 text-zinc-400">
              <span className="flex items-center"><Key className="w-3.5 h-3.5 mr-1 text-[var(--neon-green)]" /> RSA Keyring Status</span>
              <span className={localPrivateKey ? 'text-[var(--neon-green)] font-bold' : 'text-red-500 font-bold'}>
                {localPrivateKey ? 'SYNCHRONIZED' : 'UNLOADED'}
              </span>
            </div>
            {!localPrivateKey && (
              <button
                onClick={regenerateE2EEKeys}
                className="w-full text-center text-[9px] uppercase tracking-widest font-black bg-red-600 text-white hover:bg-red-500 py-2.5 transition rounded-none cursor-pointer border border-black"
              >
                Assemble Cryptographic Keys
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages Console Box - spans 8 cols with custom micro-animations */}
      <div 
        style={customAccentStyles}
        className={`md:col-span-8 flex flex-col bg-[#080808] h-full overflow-hidden ${!currentChat ? 'hidden md:flex' : 'flex'}`}
      >
        {currentChat ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 bg-neutral-950 border-b border-zinc-900/45 flex items-center justify-between flex-shrink-0 font-sans">
              <div className="flex items-center space-x-3 w-full min-w-0">
                {/* Back Button for Mobile View responsive toggle */}
                <button
                  onClick={() => {
                    playGlitchClickSound();
                    setSelectedPeer(null);
                    setCurrentChat(null);
                  }}
                  className="md:hidden p-1.5 rounded-full bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition shrink-0"
                  title="Back to conversations"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <img
                  src={currentChat.isGroup ? (currentChat.avatarUrl || "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120") : (selectedPeer?.photoURL || '')}
                  alt={currentChat.isGroup ? currentChat.name : (selectedPeer?.displayName || '')}
                  onClick={() => {
                    triggerVibration('light');
                    playGlitchClickSound();
                    if (!currentChat.isGroup && selectedPeer) {
                      triggerViewProfile(selectedPeer.uid);
                    }
                  }}
                  className="w-10 h-10 rounded-full border border-zinc-800 object-cover shrink-0 cursor-pointer hover:scale-105 transition duration-150"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <h3 
                    onClick={() => {
                      triggerVibration('light');
                      playGlitchClickSound();
                      if (!currentChat.isGroup && selectedPeer) {
                        triggerViewProfile(selectedPeer.uid);
                      }
                    }}
                    className={`text-sm font-sans font-bold text-white truncate ${!currentChat.isGroup && selectedPeer ? 'cursor-pointer hover:underline' : ''}`}
                  >
                    {currentChat.isGroup ? currentChat.name : (selectedPeer ? (renamedNicknames[selectedPeer.uid] ? `${renamedNicknames[selectedPeer.uid]} [${selectedPeer.displayName}]` : selectedPeer.displayName) : '')}
                  </h3>
                  {currentChat.isGroup ? (
                    <p className="text-[9px] font-sans font-semibold text-purple-400 flex items-center mt-0.5">
                      <Users className="w-3 h-3 mr-1 text-purple-400 shrink-0" /> SECURE CONDUIT ONLINE ({(currentChat.participantIds || []).length} NODES)
                    </p>
                  ) : (
                    selectedPeer && typingUsers[selectedPeer.uid] ? (
                      <span className="text-[9px] text-[var(--neon-green)] font-mono uppercase tracking-widest font-extrabold animate-pulse mt-0.5 block">
                        {(() => {
                          const styleSetting = localStorage.getItem('flick_typing_style') || 'pulse';
                          const typingVal = typingUsers[selectedPeer.uid];
                          
                          if (styleSetting === 'stealth') {
                            return '⚡ STEALTH DATA DIALOGUE INBOUND...';
                          }
                          if (styleSetting === 'minimal') {
                            return '...';
                          }
                          
                          if (typingVal === 'image') {
                            return '[ STAGING PHOTO TRANSMISSION... ]';
                          }
                          if (typingVal === 'video') {
                            return '[ PREPARING VIDEO PAYLOAD... ]';
                          }
                          if (typingVal === 'audio') {
                            return '[ CAPTURING VOICE COMMAND NOTE... ]';
                          }
                          if (typingVal === 'location') {
                            return '[ COMPILING GPS COORDINATES NODE... ]';
                          }
                          if (typingVal === 'poll') {
                            return '[ DESIGNING OPINION METRIC POLL... ]';
                          }
                          if (typingVal === 'attachment') {
                            return '[ ATTACHING COMPRESSED DATA MATRIX... ]';
                          }
                          
                          return '[ TYPING TRANSMISSION IN PROGRESS... ]';
                        })()}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedPeer?.uid === 'my-ai-bot-uid' || (selectedPeer && rtdbStatuses[selectedPeer.uid]?.state === 'online') ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-550'}`} />
                        <span className="text-[9px] font-sans font-medium text-zinc-400 uppercase tracking-wide">
                          {selectedPeer?.uid === 'my-ai-bot-uid' ? 'AI BOT ONLINE' : (selectedPeer && rtdbStatuses[selectedPeer.uid]?.state === 'online' ? 'ACTIVE NOW' : 'SECURE TUNNEL ONLINE')}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Dedicated local message tunnels controls & search bar */}
              <div className="flex items-center gap-2 max-w-lg shrink-0 pl-1.5 font-mono">
                
                {/* Voice Call Trigger */}
                {!currentChat.isGroup && selectedPeer && (
                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      triggerVibration('medium');
                      window.dispatchEvent(new CustomEvent('faraflick-initiate-call', {
                        detail: {
                          peerId: selectedPeer.uid,
                          peerName: renamedNicknames[selectedPeer.uid] || selectedPeer.displayName,
                          peerPhoto: selectedPeer.photoURL,
                          type: 'voice'
                        }
                      }));
                    }}
                    className="p-1.5 border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/15 transition uppercase font-bold text-[9px] cursor-pointer flex items-center gap-1 shrink-0"
                    title="Make safe cryptographic voice call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Video Call Trigger */}
                {!currentChat.isGroup && selectedPeer && (
                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      triggerVibration('medium');
                      window.dispatchEvent(new CustomEvent('faraflick-initiate-call', {
                        detail: {
                          peerId: selectedPeer.uid,
                          peerName: renamedNicknames[selectedPeer.uid] || selectedPeer.displayName,
                          peerPhoto: selectedPeer.photoURL,
                          type: 'video'
                        }
                      }));
                    }}
                    className="p-1.5 border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/15 transition uppercase font-bold text-[9px] cursor-pointer flex items-center gap-1 shrink-0"
                    title="Make safe cryptographic video call"
                  >
                    <Video className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="relative flex items-center border border-[var(--neon-green)]/35 bg-black/80 px-2 py-1">
                  <Search className="w-3 h-3 text-[var(--neon-green)]/65 mr-1" />
                  <input
                    type="text"
                    placeholder="SEARCH..."
                    value={messageSearchQuery}
                    onChange={(e) => setMessageSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-[9px] text-[var(--neon-green)] placeholder-[var(--neon-green)]/35 tracking-wider w-16 sm:w-20 focus:w-28 transition-all duration-200"
                  />
                  {messageSearchQuery && (
                    <button
                      onClick={() => setMessageSearchQuery('')}
                      className="text-zinc-500 hover:text-white font-mono text-[9px] pl-1 cursor-pointer select-none font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Tunnel Settings toggler */}
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setIsChatInfoOpen(!isChatInfoOpen);
                  }}
                  className={`p-1 px-1.5 border uppercase font-bold text-[9px] cursor-pointer flex items-center gap-1 transition ${
                    isChatInfoOpen 
                      ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] shadow-[2px_2px_0_0_rgba(255,255,255,0.7)]' 
                      : 'border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10'
                  }`}
                  title="Configure Secure Tunnel settings and theme overlay"
                >
                  <Sliders className="w-3 h-3" />
                  <span className="hidden sm:inline">TUNNEL</span>
                </button>
              </div>
            </div>

            {/* Error Notifications inside conversations */}
            {error && (
              <div className="p-2.5 bg-red-600/10 border-b border-red-500/30 text-red-500 text-[9px] uppercase tracking-wider text-center font-bold">
                Handshake Alert: {error}
              </div>
            )}

            {/* Pinned Messages sticky drawer */}
            {(() => {
              const pinnedMessages = messages.filter(msg => msg.pinned === true);
              if (pinnedMessages.length === 0) return null;
              return (
                <div className="bg-[#121212] border-b border-[var(--neon-green)]/20 p-3 flex flex-col font-mono text-[9px] text-[var(--neon-green)] shrink-0 select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[var(--neon-green)]">
                      <Pin className="w-3.5 h-3.5 text-[var(--neon-green)] shrink-0 animate-bounce" />
                      <span>PINNED CRITICAL TRANSCRIPTIONS ({pinnedMessages.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playGlitchClickSound();
                        setIsPinnedDrawerOpen(!isPinnedDrawerOpen);
                      }}
                      className="px-2 py-0.5 border border-[var(--neon-green)]/35 text-[9px] uppercase font-bold text-zinc-300 hover:text-white hover:bg-[var(--neon-green)]/10 cursor-pointer"
                    >
                      {isPinnedDrawerOpen ? '[ HIDE ]' : '[ SHOW ]'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isPinnedDrawerOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 mt-2 max-h-40 overflow-y-auto divide-y divide-[var(--neon-green)]/10"
                      >
                        {pinnedMessages.map((pMsg) => {
                          const senderName = pMsg.senderId === profile.uid ? 'You' : (pMsg.senderDisplayName || selectedPeer?.displayName || 'Unknown Sender');
                          const decText = decryptedCache[pMsg.id] || '[Decoding cryptographic key coordinates...]';
                          return (
                            <div key={pMsg.id} className="pt-2 flex items-center justify-between gap-3 text-[10px]">
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-white uppercase block text-[8px] mb-0.5">@{senderName}:</span>
                                <p className="text-zinc-300 truncate font-sans text-[11px] italic">"{decText}"</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    playGlitchClickSound();
                                    const el = document.getElementById(`swipe-reply-cue-${pMsg.id}`);
                                    if (el) {
                                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      el.classList.add('animate-pulse');
                                      setTimeout(() => el.classList.remove('animate-pulse'), 1500);
                                    }
                                  }}
                                  className="px-1.5 py-0.5 bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 hover:bg-[var(--neon-green)] hover:text-black uppercase text-[8px] font-bold cursor-pointer transition-all"
                                >
                                  jump
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    triggerVibration('light');
                                    playGlitchClickSound();
                                    await togglePinMessage(currentChat.id, pMsg.id, false);
                                  }}
                                  className="p-1 border border-red-500/30 text-red-500 hover:bg-[#200505] transition-all cursor-pointer"
                                  title="Unpin message"
                                >
                                  <PinOff className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}

            {/* Messages Stream Wrapper with Info drawer sidebar layout */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Active chat messages history stream (AnimatePresence transitions) */}
              <div className={`flex-1 ${isRecording || isV2TListening || isEmoStickerOpen || isPollCreatorOpen || isGroupSettingsOpen || isJoinGroupOpen || isCreateGroupOpen ? 'overflow-hidden' : 'overflow-y-auto'} p-4 bg-[#050505] relative scrollbar`}>
                <div className="max-w-md mx-auto text-center border border-[var(--neon-green)]/15 bg-black/45 p-3 mb-6 font-mono text-[9px] uppercase text-zinc-500 tracking-wider">
                  🔐 Encryption Verified. Communication streams on Fara Flick are secured with perfect forward secrecy. No storage is cached plain.
                </div>

                {messages.length === 0 ? (
                  <div className="text-center py-24 text-zinc-500 text-xs italic uppercase animate-pulse">
                    Tunnel established. Begin typing below...
                  </div>
                ) : (() => {
                  const filtered = messages.filter(msg => {
                    if (!messageSearchQuery) return true;
                    const dec = decryptedCache[msg.id];
                    if (!dec) return false;
                    return dec.toLowerCase().includes(messageSearchQuery.toLowerCase());
                  });

                  return (
                    <AnimatePresence initial={false}>
                      {filtered.map((msg, index) => {
                        const isMe = msg.senderId === profile.uid;
                        
                        // Calculate consecutive message grouping sent within the same minute
                        const prevMsg = index > 0 ? filtered[index - 1] : null;
                        const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;
                        
                        let isSameMinute = false;
                        if (isSameSender && msg.createdAt && prevMsg?.createdAt) {
                          const t1 = msg.createdAt.toDate ? msg.createdAt.toDate() : (msg.createdAt.seconds ? new Date(msg.createdAt.seconds * 1000) : new Date(msg.createdAt));
                          const t2 = prevMsg.createdAt.toDate ? prevMsg.createdAt.toDate() : (prevMsg.createdAt.seconds ? new Date(prevMsg.createdAt.seconds * 1000) : new Date(prevMsg.createdAt));
                          
                          isSameMinute = t1.getFullYear() === t2.getFullYear() &&
                                         t1.getMonth() === t2.getMonth() &&
                                         t1.getDate() === t2.getDate() &&
                                         t1.getHours() === t2.getHours() &&
                                         t1.getMinutes() === t2.getMinutes();
                        }
                        
                        const isGrouped = isSameSender && isSameMinute;

                        // Verification metrics for Self-Destruct / Burning messages countdowns
                        let secondsRemaining: number | null = null;
                        if (msg.expiresAt) {
                          const expiry = msg.expiresAt.seconds ? msg.expiresAt.seconds * 1000 : (msg.expiresAt.toDate ? msg.expiresAt.toDate().getTime() : Date.parse(msg.expiresAt));
                          secondsRemaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
                        }

                        return (
                          <motion.div
                            key={msg.id || index}
                            initial={{ opacity: 0, scale: 0.6, y: 30, filter: "blur(6px)" }}
                            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 0.85, y: -20, filter: "blur(4px)" }}
                            transition={{ 
                              type: "spring",
                              damping: 18,
                              stiffness: 160,
                              mass: 0.8
                            }}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full relative ${isGrouped ? 'mt-1' : 'mt-4'}`}
                          >
                          <div className={`p-3 max-w-sm border ${
                            isMe 
                              ? 'bg-[#0a0a0a] text-zinc-100 border-[var(--neon-green)]/35 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]' 
                              : 'bg-[#101010] text-[var(--neon-green)] border-[var(--neon-green)]/15 shadow-[3px_3px_0px_0px_rgba(0,255,102,0.05)]'
                            } space-y-1 relative`}
                          >
                            {/* Burning timer header (suppress if grouped to save space) */}
                            {secondsRemaining !== null && !isGrouped && (
                              <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-red-400 font-extrabold uppercase tracking-wide border-b border-red-500/20 pb-1 mb-1 animate-pulse">
                                <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span>Self-Destructs in: {secondsRemaining}s</span>
                              </div>
                            )}

                            {!isMe && !isGrouped && (
                              <div 
                                onClick={() => {
                                  triggerVibration('light');
                                  playGlitchClickSound();
                                  triggerViewProfile(msg.senderId || selectedPeer?.uid || '');
                                }}
                                className="text-[8px] uppercase tracking-widest font-black text-[var(--neon-green)]/60 font-mono cursor-pointer hover:underline"
                              >
                                Inbound Coordinates // {msg.senderDisplayName || selectedPeer?.displayName || 'Unknown Sender'}
                              </div>
                            )}

                            <DecryptedMessageBubble
                              message={msg}
                              currentUserId={profile.uid}
                              localPrivateKey={localPrivateKey}
                              disabledReadReceipts={selectedGroup?.disabledReadReceipts}
                              isPeerOnline={selectedPeer ? rtdbStatuses[selectedPeer.uid]?.state === 'online' : false}
                              chatId={currentChat.id}
                              currentUserDisplayName={profile.displayName}
                              onReplyTrigger={(msgId, author, snippet) => {
                                playGlitchClickSound();
                                setReplyQuote({ msgId, authorName: author, snippetText: snippet.substring(0, 32) });
                              }}
                              onForwardTrigger={(decryptedText) => {
                                playGlitchClickSound();
                                setForwardMessageText(decryptedText);
                                setIsForwardModalOpen(true);
                              }}
                              onDecrypted={(text) => {
                                setDecryptedCache(prev => {
                                  if (prev[msg.id] === text) return prev;
                                  return { ...prev, [msg.id]: text };
                                });
                              }}
                              searchQuery={messageSearchQuery}
                              onVotePoll={castPollVote}
                              pollsData={pollsData}
                            />
                          </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  );
                })()}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Info Panel / Drawer Sidebar */}
              <AnimatePresence>
                {isChatInfoOpen && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 280, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                    className="border-l border-[var(--neon-green)]/20 bg-[#090909] h-full flex flex-col flex-shrink-0 overflow-y-auto font-mono text-zinc-100 divide-y divide-[var(--neon-green)]/15 select-none z-10"
                  >
                    {/* Tunnel Metadata Header */}
                    <div className="p-4 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest font-black text-[var(--neon-green)]">
                          TUNNEL INFO
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playGlitchClickSound();
                            setIsChatInfoOpen(false);
                          }}
                          className="text-[9px] uppercase font-bold text-zinc-500 hover:text-white cursor-pointer"
                        >
                          [ CLOSE ]
                        </button>
                      </div>
                      <p className="text-[8px] uppercase tracking-wider text-zinc-500 truncate">
                        Corridor ID: {currentChat.id}
                      </p>
                    </div>

                     {/* Peer or Group Identity card */}
                    <div className="p-4 space-y-2 relative overflow-hidden">
                      {currentChat.isGroup && (
                        <div className="absolute inset-0 z-0 opacity-25">
                          {currentChat.groupBannerUrl ? (
                            <img src={currentChat.groupBannerUrl} alt="Banner bg" className="w-full h-full object-cover filter blur-[2px]" />
                          ) : (
                            <div className={`w-full h-full ${
                              currentChat.groupType === 'school' ? 'bg-gradient-to-r from-purple-900/50 to-black' :
                              currentChat.groupType === 'church' ? 'bg-gradient-to-r from-amber-900/45 to-black' :
                              currentChat.groupType === 'business' ? 'bg-gradient-to-r from-emerald-900/50 to-black' :
                              currentChat.groupType === 'community' ? 'bg-gradient-to-r from-cyan-900/50 to-black' :
                              currentChat.groupType === 'custom' ? 'bg-gradient-to-r from-red-900/50 to-black' :
                              'bg-gradient-to-r from-blue-900/50 to-black'
                            }`} />
                          )}
                        </div>
                      )}

                      <div className="relative z-10 space-y-2">
                        <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                          {currentChat.isGroup ? `GROUP CONDUIT // ${currentChat.groupType || 'FRIENDS'}` : 'PEER NODE'}
                        </span>
                        <div className="flex items-center space-x-2.5 bg-black/70 p-2.5 border border-[var(--neon-green)]/15 backdrop-blur-md">
                          <img 
                            src={currentChat.isGroup ? (currentChat.avatarUrl || "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=120") : (selectedPeer ? selectedPeer.photoURL : '')} 
                            alt={currentChat.isGroup ? currentChat.name : (selectedPeer ? selectedPeer.displayName : '')} 
                            className="w-10 h-10 border border-[var(--neon-green)]/35 object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-white truncate uppercase font-mono tracking-wider">
                              {currentChat.isGroup ? currentChat.name : (selectedPeer ? selectedPeer.displayName : '')}
                            </p>
                            <p className="text-[8px] text-zinc-500 truncate font-mono">
                              {currentChat.isGroup ? `${(currentChat.participantIds || []).length} REMOTE SUBSCRIBED NODES` : (selectedPeer ? selectedPeer.email : '')}
                            </p>
                          </div>
                        </div>

                        {currentChat.isGroup && currentChat.description && (
                          <p className="text-[8.5px] text-zinc-400 leading-relaxed font-sans bg-black/60 border border-zinc-900 p-2 mt-1 uppercase italic backdrop-blur-sm">
                            "{currentChat.description}"
                          </p>
                        )}

                        {/* Quick Group Permissions Overview (Visible to all members) */}
                        {currentChat.isGroup && (
                          <div className="bg-black/40 border border-zinc-900 p-1.5 rounded text-[7px] text-zinc-500 font-mono grid grid-cols-2 gap-x-2 gap-y-0.5 backdrop-blur-sm">
                            <div>TRANSMIT: <span className="text-zinc-300 font-bold">{currentChat.permSend === 'admins' ? 'ADMINS ONLY' : 'ALL NODES'}</span></div>
                            <div>RECRUIT: <span className="text-zinc-300 font-bold">{currentChat.permAdd === 'admins' ? 'ADMINS ONLY' : 'ALL NODES'}</span></div>
                            <div>PINNING: <span className="text-zinc-300 font-bold">{currentChat.permPin !== false ? 'ALLOWED' : 'FORBIDDEN'}</span></div>
                            <div>VERIFY: <span className="text-zinc-300 font-bold">{currentChat.adminApprovalRequired ? 'QUEUE AUTH' : 'OPEN PASS'}</span></div>
                            {currentChat.anonymousMode && <div className="col-span-2 text-amber-500 font-bold mt-0.5 animate-pulse">▲ ANONYMOUS TRANSMISSION ACTIVE</div>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Group Management & Node Configuration (Visible only in Group chats) */}
                    {currentChat.isGroup && (() => {
                      const myRole = currentChat.roles?.[profile?.uid || ''] || 'member';
                      const isOwner = currentChat.ownerId === profile?.uid || myRole === 'owner';
                      const isAdmin = myRole === 'admin' || isOwner;

                      return (
                        <>
                          {/* PENDING APPROVAL QUEUE (Visible only to admins) */}
                          {isAdmin && (currentChat.approvalQueue || []).length > 0 && (
                            <div className="p-4 space-y-2.5 border-b border-yellow-500/20 bg-yellow-950/10">
                              <span className="text-[9px] uppercase tracking-widest font-black text-yellow-500 block border-l border-yellow-500 pl-1.5 animate-pulse">
                                SECURITY AUTHORIZATION QUEUE ({currentChat.approvalQueue.length})
                              </span>
                              <p className="text-[7.5px] text-zinc-500 font-mono uppercase">THE FOLLOWING SUBSCRIBER NODES ARE WAITING FOR JOIN ENCRYPTION KEYS:</p>
                              <div className="space-y-1.5">
                                {currentChat.approvalQueue.map((uid: string) => {
                                  const userObj = users.find(u => u.uid === uid);
                                  return (
                                    <div key={uid} className="p-2 border border-yellow-500/20 bg-black/60 flex flex-col gap-1.5">
                                      <div className="flex flex-col">
                                        <span className="text-[8.5px] text-white font-bold uppercase">{userObj?.displayName || 'SECURE ID ' + uid.slice(0, 6)}</span>
                                        <span className="text-[7px] text-zinc-500 font-mono truncate">{userObj?.email || 'N/A'}</span>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            playGlitchClickSound();
                                            triggerVibration('medium');
                                            try {
                                              const nextParticipants = Array.from(new Set([...(currentChat.participantIds || []), uid]));
                                              const nextQueue = currentChat.approvalQueue.filter((id: string) => id !== uid);
                                              const nextRoles = { ...(currentChat.roles || {}) };
                                              if (!nextRoles[uid]) nextRoles[uid] = 'member';
                                              await updateGroupSettings(currentChat.id, {
                                                participantIds: nextParticipants,
                                                approvalQueue: nextQueue,
                                                roles: nextRoles
                                              });
                                            } catch (err: any) {
                                              console.error(err);
                                              setError(err.message);
                                            }
                                          }}
                                          className="flex-1 text-center py-1 bg-yellow-500 text-black font-mono text-[7.5px] font-bold uppercase hover:bg-white"
                                        >
                                          [ GRANT ACCESS ]
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            playGlitchClickSound();
                                            triggerVibration('medium');
                                            try {
                                              const nextQueue = currentChat.approvalQueue.filter((id: string) => id !== uid);
                                              await updateGroupSettings(currentChat.id, {
                                                approvalQueue: nextQueue
                                              });
                                            } catch (err: any) {
                                              console.error(err);
                                              setError(err.message);
                                            }
                                          }}
                                          className="px-2 text-center py-1 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono text-[7.5px] uppercase hover:bg-black"
                                        >
                                          [ REJECT ]
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Section 1: Settings Form for Owners & Admins */}
                          <div className="p-4 space-y-3.5 border-b border-[var(--neon-green)]/10">
                            <span className="text-[9px] uppercase tracking-widest font-black text-[var(--neon-green)] block border-l border-[var(--neon-green)] pl-1.5">
                              CONDUIT SETTINGS {isAdmin ? '[ ADMIN MODE ]' : '[ READ-ONLY ]'}
                            </span>
                            
                            <div className="space-y-2">
                              <div>
                                <span className="block text-[7.5px] text-zinc-500 mb-0.5">CODENAME:</span>
                                <input
                                  type="text"
                                  placeholder="e.g. ALPHA COMMAND"
                                  value={editGroupName}
                                  onChange={(e) => setEditGroupName(e.target.value)}
                                  disabled={!isAdmin}
                                  className="w-full text-[10px] bg-black text-white p-1.5 border border-zinc-850 focus:outline-none focus:border-[var(--neon-green)] uppercase font-mono disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <span className="block text-[7.5px] text-zinc-500 mb-0.5">DESCRIPTION / PURPOSE:</span>
                                <input
                                  type="text"
                                  placeholder="e.g. PRIMARY CHANNEL"
                                  value={editGroupDescription}
                                  onChange={(e) => setEditGroupDescription(e.target.value)}
                                  disabled={!isAdmin}
                                  className="w-full text-[10px] bg-black text-white p-1.5 border border-zinc-850 focus:outline-none focus:border-[var(--neon-green)] uppercase font-mono disabled:opacity-50"
                                />
                              </div>

                              {isAdmin && (
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="block text-[7.5px] text-zinc-500 mb-0.5">GROUP TYPE:</span>
                                    <select
                                      value={editGroupType}
                                      onChange={(e) => setEditGroupType(e.target.value as any)}
                                      className="w-full text-[9px] bg-black text-white p-1 border border-zinc-850 focus:outline-none uppercase font-mono"
                                    >
                                      <option value="friends">FRIENDS</option>
                                      <option value="school">SCHOOL</option>
                                      <option value="church">CHURCH</option>
                                      <option value="business">BUSINESS</option>
                                      <option value="community">COMMUNITY</option>
                                      <option value="custom">CUSTOM</option>
                                    </select>
                                  </div>
                                  <div>
                                    <span className="block text-[7.5px] text-zinc-500 mb-0.5">PRIVACY:</span>
                                    <select
                                      value={editGroupPrivacy}
                                      onChange={(e) => setEditGroupPrivacy(e.target.value as any)}
                                      className="w-full text-[9px] bg-black text-white p-1 border border-zinc-850 focus:outline-none uppercase font-mono"
                                    >
                                      <option value="private">PRIVATE</option>
                                      <option value="public">PUBLIC</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              {isAdmin && (
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="block text-[7.5px] text-zinc-500 mb-0.5">TRANSMIT:</span>
                                    <select
                                      value={editGroupPermSend}
                                      onChange={(e) => setEditGroupPermSend(e.target.value as any)}
                                      className="w-full text-[9px] bg-black text-white p-1 border border-zinc-850 focus:outline-none uppercase font-mono"
                                    >
                                      <option value="all">ALL NODES</option>
                                      <option value="admins">ADMINS ONLY</option>
                                    </select>
                                  </div>
                                  <div>
                                    <span className="block text-[7.5px] text-zinc-500 mb-0.5">RECRUIT:</span>
                                    <select
                                      value={editGroupPermAdd}
                                      onChange={(e) => setEditGroupPermAdd(e.target.value as any)}
                                      className="w-full text-[9px] bg-black text-white p-1 border border-zinc-850 focus:outline-none uppercase font-mono"
                                    >
                                      <option value="all">ALL NODES</option>
                                      <option value="admins">ADMINS ONLY</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              {isAdmin && (
                                <div className="space-y-1.5 border-t border-zinc-900 pt-2 text-[7.5px] text-zinc-400 font-mono">
                                  <div className="flex items-center justify-between">
                                    <span>MEMBERS CAN PIN MESSAGES:</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditGroupPermPin(!editGroupPermPin)}
                                      className={`px-1.5 py-0.5 border text-[7px] ${editGroupPermPin ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)] text-[var(--neon-green)]' : 'border-zinc-800 text-zinc-600'}`}
                                    >
                                      {editGroupPermPin ? 'ALLOWED' : 'FORBIDDEN'}
                                    </button>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span>ADMIN ACCESS APPROVAL (QUEUE):</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditGroupAdminApproval(!editGroupAdminApproval)}
                                      className={`px-1.5 py-0.5 border text-[7px] ${editGroupAdminApproval ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)] text-[var(--neon-green)]' : 'border-zinc-800 text-zinc-600'}`}
                                    >
                                      {editGroupAdminApproval ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span>ANONYMOUS TRANSMISSION:</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditGroupAnonymous(!editGroupAnonymous)}
                                      className={`px-1.5 py-0.5 border text-[7px] ${editGroupAnonymous ? 'bg-[var(--neon-green)]/15 border-[var(--neon-green)] text-[var(--neon-green)]' : 'border-zinc-800 text-zinc-600'}`}
                                    >
                                      {editGroupAnonymous ? 'ENABLED' : 'DISABLED'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div>
                                <span className="block text-[7.5px] text-zinc-500 mb-0.5">AVATAR PHOTO:</span>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    id="edit-group-avatar-upload"
                                    className="hidden"
                                    disabled={!isAdmin}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const base64 = await compressImage(file, 200, 200, 0.6);
                                          setEditGroupAvatarUrl(base64);
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor="edit-group-avatar-upload"
                                    className="flex-1 text-center py-1.5 border border-dashed border-[var(--neon-green)]/40 hover:border-[var(--neon-green)] bg-black text-[9px] uppercase tracking-wider text-zinc-400 hover:text-white cursor-pointer select-none transition h-7 flex items-center justify-center font-mono disabled:opacity-50"
                                  >
                                    {editGroupAvatarUrl ? "IMAGE READY (TAP TO RE-UPLOAD)" : "UPLOAD GROUP IMAGE"}
                                  </label>
                                  {editGroupAvatarUrl && (
                                    <img 
                                      src={editGroupAvatarUrl} 
                                      alt="Avatar Preview" 
                                      className="w-7 h-7 border border-[var(--neon-green)] object-cover" 
                                    />
                                  )}
                                </div>
                              </div>

                              {isAdmin && (
                                <div>
                                  <span className="block text-[7.5px] text-zinc-500 mb-0.5">GROUP BANNER:</span>
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      id="edit-group-banner-upload"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          try {
                                            const base64 = await compressImage(file, 400, 150, 0.6);
                                            setEditGroupBannerUrl(base64);
                                          } catch (err) {
                                            console.error(err);
                                          }
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor="edit-group-banner-upload"
                                      className="flex-1 text-center py-1.5 border border-dashed border-zinc-800 hover:border-zinc-600 bg-black text-[9px] uppercase tracking-wider text-zinc-400 hover:text-white cursor-pointer select-none transition h-7 flex items-center justify-center font-mono"
                                    >
                                      {editGroupBannerUrl ? "BANNER READY (TAP TO UPDATE)" : "UPLOAD GROUP BANNER"}
                                    </label>
                                    {editGroupBannerUrl && (
                                      <img 
                                        src={editGroupBannerUrl} 
                                        alt="Banner Preview" 
                                        className="w-8 h-7 border border-[var(--neon-green)] object-cover" 
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-1.5">
                                {editGroupPrivacy === 'private' && (
                                  <div className="flex-1">
                                    <span className="block text-[7.5px] text-zinc-500 mb-0.5">JOIN CODE:</span>
                                    <input
                                      type="text"
                                      placeholder="CYBERPASS"
                                      value={editGroupInviteCode}
                                      onChange={(e) => setEditGroupInviteCode(e.target.value)}
                                      disabled={!isAdmin}
                                      className="w-full text-[10px] bg-black text-white p-1.5 border border-zinc-850 focus:outline-none focus:border-[var(--neon-green)] uppercase font-mono disabled:opacity-50"
                                    />
                                  </div>
                                )}
                              </div>

                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    playGlitchClickSound();
                                    triggerVibration('medium');
                                    try {
                                      await updateGroupSettings(currentChat.id, {
                                        name: editGroupName,
                                        description: editGroupDescription,
                                        avatarUrl: editGroupAvatarUrl,
                                        privacy: editGroupPrivacy,
                                        inviteCode: editGroupInviteCode,
                                        groupType: editGroupType,
                                        groupBannerUrl: editGroupBannerUrl,
                                        permSend: editGroupPermSend,
                                        permAdd: editGroupPermAdd,
                                        permPin: editGroupPermPin,
                                        adminApprovalRequired: editGroupAdminApproval,
                                        anonymousMode: editGroupAnonymous
                                      });
                                      setError(null);
                                    } catch (err: any) {
                                      console.error("Failed to update group settings:", err);
                                      setError(err.message || "Failed to persist conduit adjustments.");
                                    }
                                  }}
                                  className="w-full py-1.5 bg-[var(--neon-green)] text-black text-[9px] uppercase font-black hover:bg-white transition leading-none mt-1 h-7"
                                >
                                  SAVE METADATA CHASSIS
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Section 2: Members Directory and Roles moderation */}
                          <div className="p-4 space-y-2.5 border-b border-[var(--neon-green)]/10">
                            <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                              REMOTE NODES DIRECTORY ({currentChat.participantIds?.length || 0})
                            </span>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                              {currentChat.participantIds?.filter((pid: string) => {
                                if (pid === profile?.uid) return true;
                                return users.some(u => u.uid === pid);
                              }).map((pid: string) => {
                                const pUser = users.find(u => u.uid === pid);
                                const pRole = currentChat.roles?.[pid] || 'member';
                                const isSelf = pid === profile?.uid;

                                return (
                                  <div key={pid} className="p-2 border border-zinc-900 bg-black/30 flex flex-col gap-1 select-none">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] text-white font-bold truncate max-w-[120px]">
                                        {isSelf ? 'YOU (SECURE NODE)' : (pUser?.displayName || 'UNKNOWN NODE')}
                                      </span>
                                      <span className={`text-[6.5px] uppercase font-black px-1.5 py-0.5 border ${
                                        pRole === 'owner' ? 'border-red-500 text-red-500' :
                                        pRole === 'admin' ? 'border-[var(--neon-green)] text-[var(--neon-green)]' :
                                        pRole === 'muted' ? 'border-amber-600 text-amber-500 bg-amber-950/10' :
                                        'border-zinc-700 text-zinc-400'
                                      }`}>
                                        {pRole}
                                      </span>
                                    </div>
                                    <span className="text-[7px] text-zinc-500 truncate">{pUser?.email || 'N/A'}</span>

                                    {/* Action Buttons for Admins & Owners */}
                                    {isAdmin && !isSelf && (
                                      <div className="flex flex-wrap gap-1 mt-1 border-t border-zinc-900/40 pt-1">
                                        {isOwner && pRole !== 'owner' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              playGlitchClickSound();
                                              const newRoles = { ...(currentChat.roles || {}) };
                                              newRoles[pid] = pRole === 'admin' ? 'member' : 'admin';
                                              await updateGroupSettings(currentChat.id, { roles: newRoles });
                                            }}
                                            className="text-[7px] border border-zinc-800 text-zinc-400 px-1 py-0.5 hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] uppercase"
                                          >
                                            {pRole === 'admin' ? '[ DEMOTE ]' : '[ MAKE ADMIN ]'}
                                          </button>
                                        )}

                                        {pRole !== 'owner' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              playGlitchClickSound();
                                              const newRoles = { ...(currentChat.roles || {}) };
                                              newRoles[pid] = pRole === 'muted' ? 'member' : 'muted';
                                              await updateGroupSettings(currentChat.id, { roles: newRoles });
                                            }}
                                            className="text-[7px] border border-zinc-800 text-zinc-400 px-1 py-0.5 hover:border-yellow-500 hover:text-yellow-500 uppercase"
                                          >
                                            {pRole === 'muted' ? '[ UNMUTE ]' : '[ MUTE ]'}
                                          </button>
                                        )}

                                        {pRole !== 'owner' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              playGlitchClickSound();
                                              const nextParticipants = currentChat.participantIds.filter((id: string) => id !== pid);
                                              const nextRoles = { ...(currentChat.roles || {}) };
                                              delete nextRoles[pid];
                                              await updateGroupSettings(currentChat.id, {
                                                participantIds: nextParticipants,
                                                roles: nextRoles
                                              });
                                            }}
                                            className="text-[7px] border border-zinc-850 text-red-500 px-1 py-0.5 hover:bg-red-950/20 uppercase"
                                          >
                                            [ KICK ]
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Add Member Subsection for Admins/Owners */}
                          {isAdmin && (() => {
                            const nonParticipants = users.filter(u => u.uid !== profile?.uid && !currentChat.participantIds?.includes(u.uid));
                            if (nonParticipants.length === 0) return null;
                            return (
                              <div className="p-4 border-b border-[var(--neon-green)]/10 bg-black/20 space-y-2">
                                <span className="text-[9px] uppercase tracking-widest font-black text-[var(--neon-green)] block">
                                  ADD PATHWAYS / MEMBERS
                                </span>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                                  {nonParticipants.map(u => (
                                    <div key={u.uid} className="flex items-center justify-between p-1.5 border border-zinc-900 bg-black/40 text-[9px]">
                                      <span className="truncate max-w-[150px] font-bold text-white uppercase">{u.displayName}</span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          playGlitchClickSound();
                                          triggerVibration('medium');
                                          const nextParticipants = [...(currentChat.participantIds || []), u.uid];
                                          await updateGroupSettings(currentChat.id, {
                                            participantIds: nextParticipants
                                          });
                                          setError(null);
                                        }}
                                        className="px-2 py-0.5 bg-[var(--neon-green)] text-black font-extrabold uppercase hover:bg-white text-[8px] transition"
                                      >
                                        [ CONNECT NODE ]
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Section 3: Destructive Conduit Maintenance Actions */}
                          <div className="p-4 space-y-2 border-b border-[var(--neon-green)]/10">
                            <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                              MAINTENANCE ACTIONS
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!profile) return;
                                  playGlitchClickSound();
                                  triggerVibration('medium');
                                  if (confirm("Disconnect path from this group conduit?")) {
                                    try {
                                      const nextParticipants = currentChat.participantIds.filter((id: string) => id !== profile.uid);
                                      const nextRoles = { ...(currentChat.roles || {}) };
                                      delete nextRoles[profile.uid];
                                      await updateGroupSettings(currentChat.id, {
                                        participantIds: nextParticipants,
                                        roles: nextRoles
                                      });
                                      setIsChatInfoOpen(false);
                                      setSelectedGroup(null);
                                      setCurrentChat(null);
                                    } catch (err: any) {
                                      setError(err.message || "Failed to disconnect group conduit.");
                                    }
                                  }
                                }}
                                className="flex-1 py-1.5 border border-zinc-850 text-zinc-400 hover:text-white hover:bg-zinc-950 text-[8.5px] font-black uppercase text-center"
                              >
                                DISCONNECT PATH
                              </button>
                              
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    playGlitchClickSound();
                                    triggerVibration('heavy');
                                    if (confirm("🚨 WARNING: Destruct group conduit? This deletes all associated message logs permanently.")) {
                                      try {
                                        const { db } = await import('../lib/firebase');
                                        const { doc, deleteDoc } = await import('firebase/firestore');
                                        await deleteDoc(doc(db, 'chats', currentChat.id));
                                        
                                        setIsChatInfoOpen(false);
                                        setSelectedGroup(null);
                                        setCurrentChat(null);
                                      } catch (err: any) {
                                        setError(err.message || "Failed to destruct group conduit.");
                                      }
                                    }
                                  }}
                                  className="flex-1 py-1.5 border border-red-500/35 text-red-500 hover:bg-red-950/20 text-[8.5px] font-black uppercase text-center animate-pulse"
                                >
                                  💥 DESTRUCT GROUP
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Brutalist Color Accent Theme Selector */}
                    <div className="p-4 space-y-3">
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                        ATMOSPHERIC CORE
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {Object.entries(ACCENT_THEMES).map(([key, col]) => {
                          const isActive = chatAccentTheme === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                playGlitchClickSound();
                                localStorage.setItem(`fara_accent_${currentChat.id}`, key);
                                setChatAccentTheme(key);
                              }}
                              className={`w-8 h-8 border cursor-pointer transition flex items-center justify-center`}
                              style={{ 
                                backgroundColor: col.primary,
                                borderColor: isActive ? '#faf9f6' : 'rgba(0,0,0,0.4)',
                                boxShadow: isActive ? `0 0 10px ${col.primary}` : 'none'
                              }}
                              title={key.replace('-', ' ').toUpperCase()}
                            >
                              {isActive && (
                                <span className="text-[10px] font-black text-black">✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[7.5px] uppercase tracking-wider text-zinc-500 leading-normal font-sans">
                        Modifies the holographic spectral glow of this specific encryption corridor.
                      </p>
                    </div>

                    {/* Local Alias Nickname Rename (Private chats only) */}
                    {selectedPeer && (
                      <div className="p-4 space-y-2">
                        <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                          LOCAL NAME ALIAS
                        </span>
                        <input
                          type="text"
                          placeholder="Define local alias nickname..."
                          value={renamedNicknames[selectedPeer.uid] || ''}
                          onChange={(e) => renameUserLocal(selectedPeer.uid, e.target.value)}
                          className="w-full text-xs bg-black text-white p-2 border border-[var(--neon-green)]/35 focus:outline-none focus:border-[var(--neon-green)] uppercase font-mono h-9"
                        />
                        <p className="text-[7px] uppercase text-zinc-500 font-sans leading-normal">
                          Only you will see this custom alias representing the peer node.
                        </p>
                      </div>
                    )}

                    {/* Safety and Lock Controls (Scoped peer vs group locks) */}
                    <div className="p-4 space-y-3">
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                        LINK SAFETY & COVENANTS
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {selectedPeer && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleBlockUser(selectedPeer.uid)}
                              className={`w-full py-2 px-2.5 border cursor-pointer text-left text-[9px] uppercase font-bold flex items-center justify-between transition h-9 leading-none ${
                                blockedUsers.includes(selectedPeer.uid)
                                  ? 'bg-rose-950/30 border-red-500 text-red-500 font-black'
                                  : 'border-[var(--neon-green)]/25 text-zinc-300 hover:bg-[var(--neon-green)]/10 hover:text-[var(--neon-green)]'
                              }`}
                            >
                              <span>{blockedUsers.includes(selectedPeer.uid) ? '⚠️ BLOCKED PATH' : '🚫 BLOCK RELAY PATH'}</span>
                              <UserX className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleMuteUser(selectedPeer.uid)}
                              className={`w-full py-2 px-2.5 border cursor-pointer text-left text-[9px] uppercase font-bold flex items-center justify-between transition h-9 leading-none ${
                                mutedUsers.includes(selectedPeer.uid)
                                  ? 'bg-amber-950/20 border-yellow-500 text-yellow-500 font-black'
                                  : 'border-[var(--neon-green)]/25 text-zinc-300 hover:bg-[var(--neon-green)]/10 hover:text-[var(--neon-green)]'
                              }`}
                            >
                              <span>{mutedUsers.includes(selectedPeer.uid) ? '⚡ PIN MUTED' : '🔔 MUTE PIN ALERTS'}</span>
                              <VolumeX className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleLockChat(currentChat.id)}
                          className={`w-full py-2 px-2.5 border cursor-pointer text-left text-[9px] uppercase font-bold flex items-center justify-between transition h-9 leading-none ${
                            chatLocks.includes(currentChat.id)
                              ? 'bg-red-500 text-black border-red-500 font-extrabold shadow-none'
                              : 'border-[var(--neon-green)]/25 text-zinc-300 hover:bg-[var(--neon-green)]/10 hover:text-[var(--neon-green)]'
                          }`}
                        >
                          <span>{chatLocks.includes(currentChat.id) ? '🔒 PASSWORD PIN LOCKED' : '🔓 LOCK TUNNEL WITH PIN'}</span>
                          {chatLocks.includes(currentChat.id) ? <Lock className="w-3.5 h-3.5" /> : <UnlockKeyhole className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Background Wallpapers selector */}
                    <div className="p-4 space-y-2">
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                        TUNNEL BACKGROUND
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { name: 'STEALTH', value: 'none' },
                          { name: 'MATRIX GRID', value: 'grid' },
                          { name: 'CRITICAL DOTS', value: 'dots' },
                          { name: 'CYBER CHAOS', value: 'chaos' }
                        ].map((wall) => {
                          const isActive = chatWallpaper === wall.value;
                          return (
                            <button
                              key={wall.value}
                              type="button"
                              onClick={() => {
                                playGlitchClickSound();
                                setChatWallpaper(wall.value);
                                localStorage.setItem('flick_global_wallpaper', wall.value);
                              }}
                              className={`p-1.5 border text-center text-[8px] uppercase tracking-wider font-bold cursor-pointer transition ${
                                isActive
                                  ? 'bg-[var(--neon-green)] text-black border-transparent font-extrabold shadow-sm'
                                  : 'border-[var(--neon-green)]/25 text-zinc-400 hover:text-white hover:bg-neutral-900'
                              }`}
                            >
                              {wall.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Export transcript logs */}
                    <div className="p-4 space-y-2">
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                        DATA MAINTENANCE
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playGlitchClickSound();
                          triggerVibration('medium');
                          const logs = messages.map(msg => {
                            const senderName = msg.senderId === profile?.uid ? 'YOU' : (msg.senderDisplayName || selectedPeer?.displayName || 'Unknown');
                            // Simple fallback decryption snippet representation
                            const decryptedContent = msg.content || '[ENCRYPTED]' || msg.encryptedText;
                            const timeStr = msg.createdAt ? new Date(msg.createdAt).toISOString() : 'N/A';
                            return `[${timeStr}] @${senderName}: ${decryptedContent}`;
                          }).join('\n');
                          
                          const blob = new Blob([`FLICK SECURE ENCRYPTED DIALOGUE LOG\nCONVERSATION PATH: ${currentChat.id}\nEXPORTED AT: ${new Date().toISOString()}\n==============================================\n\n${logs}`], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `E2EE_Relay_Log_${(selectedPeer?.displayName || currentChat.name || 'Group').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          playLikeSound();
                        }}
                        className="w-full py-2 px-3 border border-[var(--neon-green)] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black hover:border-transparent font-bold cursor-pointer text-center text-[9px] uppercase transition flex items-center justify-between h-9 leading-none"
                      >
                        <span>EXPORT DECRYPTED LOG</span>
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Encryption status details */}
                    <div className="p-4 space-y-2">
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 block border-l border-[var(--neon-green)] pl-1.5">
                        ENCRYPTION CORRIDOR
                      </span>
                      <div className="text-[8.5px] space-y-1 bg-black/40 p-2.5 border border-[var(--neon-green)]/15 font-mono text-zinc-300">
                        <div className="flex justify-between">
                          <span>CIPHER:</span>
                          <span className="font-bold text-[var(--neon-green)]">RSA-4096 / AES-GCM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>CORRIDOR:</span>
                          <span className="font-bold text-[var(--neon-green)]">SECURED</span>
                        </div>
                        <div className="pt-2 text-[7px] text-zinc-500 break-all leading-relaxed uppercase">
                          PUBLIC KEY COORDINATES:<br />
                          {selectedPeer?.publicKey ? selectedPeer.publicKey.substring(0, 48) + "..." : "UNAVAILABLE"}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Float Quote Message reply anchor selection bar if present (WhatsApp layout) */}
            <AnimatePresence>
              {replyQuote && (
                <div className="p-3 bg-black border-t border-[var(--neon-green)]/30 flex items-center justify-between font-mono text-[10px] uppercase shrink-0">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CornerUpLeft className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                    <span>
                      Replying to <b className="text-[var(--neon-green)]">@{replyQuote.authorName}</b>: "{replyQuote.snippetText}..."
                    </span>
                  </div>
                  <button
                    onClick={() => setReplyQuote(null)}
                    className="p-1 px-2 border border-red-500/40 text-red-400 hover:text-red-500 font-bold transition cursor-pointer"
                  >
                    [ DISMISS ]
                  </button>
                </div>
              )}
            </AnimatePresence>

            {/* Broadcast Form Input Box */}
            <form onSubmit={handleSendMessage} className="p-3.5 bg-[#090909] border-t border-[var(--neon-green)]/15 space-y-3 flex-shrink-0 font-mono">
              
              {/* Voice Attachment preview list if chosen */}
              {selectedAttachment && (
                <div className="p-2.5 bg-black border border-[var(--neon-green)]/30 flex items-center justify-between text-[10px] uppercase">
                  <span className="text-[var(--neon-green)] flex items-center gap-1.5 font-bold">
                    📎 Attachment Ready: {selectedAttachment.name} ({selectedAttachment.type})
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedAttachment(null)}
                    className="p-1 px-1.5 border border-red-500/40 text-red-400 hover:text-red-500 font-bold transition cursor-pointer"
                  >
                    [ PURGE ]
                  </button>
                </div>
              )}

              {/* Advanced Conversational feature widgets layout: Self-Destruct Timers + Attachment Triggers */}
              <div className="flex flex-wrap items-center gap-2.5 justify-between pb-1.5 border-b border-[var(--neon-green)]/10">
                
                {/* Self Destruct (Burning) Lifespan Selection indicator */}
                <div className="flex items-center space-x-2">
                  <span className="text-[8.5px] uppercase font-bold text-zinc-500 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-zinc-400" /> Message Lifecycles
                  </span>
                  <div className="flex gap-1">
                    {[0, 15, 60, 300].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          playGlitchClickSound();
                          setSelfDestructSeconds(sec);
                        }}
                        className={`text-[8.5px] px-2 py-0.5 border cursor-pointer uppercase font-bold leading-none ${
                          selfDestructSeconds === sec 
                            ? 'bg-red-500 text-black border-black font-extrabold shadow-[1.5px_1.5px_0_0_#ffffff]' 
                            : 'bg-black text-zinc-400 border-[var(--neon-green)]/20 hover:text-white'
                        }`}
                      >
                        {sec === 0 ? 'PERSISTENT' : `${sec}s Burn`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Media attachments triggers */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    id="button-file-upload"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 bg-black border border-[var(--neon-green)]/30 text-zinc-300 hover:text-[var(--neon-green)] hover:border-[var(--neon-green)] transition cursor-pointer flex items-center gap-1 text-[9px] uppercase font-bold"
                  >
                    <Paperclip className="w-3 h-3 text-[var(--neon-green)]" />
                    <span>FILE</span>
                  </button>

                  {/* Emoji & Sticker Board Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      setIsEmoStickerOpen(!isEmoStickerOpen);
                      setIsPollCreatorOpen(false);
                    }}
                    className={`p-1.5 border transition cursor-pointer flex items-center gap-1 text-[9px] uppercase font-bold ${
                      isEmoStickerOpen
                        ? 'bg-[var(--neon-green)] text-black border-transparent font-extrabold shadow-[1.5px_1.5px_0_0_rgba(255,255,255,0.8)]'
                        : 'bg-black border-[var(--neon-green)]/30 text-zinc-400 hover:text-[var(--neon-green)]'
                    }`}
                  >
                    <Smile className="w-3 h-3 text-[var(--neon-green)]" />
                    <span>BOARD</span>
                  </button>

                  {/* Poll Creator Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      setIsPollCreatorOpen(!isPollCreatorOpen);
                      setIsEmoStickerOpen(false);
                    }}
                    className={`p-1.5 border transition cursor-pointer flex items-center gap-1 text-[9px] uppercase font-bold ${
                      isPollCreatorOpen
                        ? 'bg-[var(--neon-green)] text-black border-transparent font-extrabold shadow-[1.5px_1.5px_0_0_rgba(255,255,255,0.8)]'
                        : 'bg-black border-[var(--neon-green)]/30 text-zinc-400 hover:text-[var(--neon-green)]'
                    }`}
                  >
                    <BarChart2 className="w-3 h-3 text-[var(--neon-green)]" />
                    <span>POLL</span>
                  </button>

                  {/* Location Sharing button */}
                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      triggerVibration('medium');
                      if (navigator.geolocation) {
                        if (currentChat && profile) {
                          setFirestoreTypingStatus(currentChat.id, profile.uid, true, 'location');
                        }
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            const mapUrl = `📍 Shared Location: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude} (Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)})`;
                            setText(prev => (prev ? prev + ' ' + mapUrl : mapUrl));
                          },
                          () => {
                            const lat = (Math.random() * 180 - 90).toFixed(4);
                            const lon = (Math.random() * 360 - 180).toFixed(4);
                            const cyberCoords = `📍 Tactical Coords Locked: Zone Lat ${lat}, Lon ${lon}`;
                            setText(prev => (prev ? prev + ' ' + cyberCoords : cyberCoords));
                          }
                        );
                      } else {
                        const lat = (Math.random() * 180 - 90).toFixed(4);
                        const lon = (Math.random() * 360 - 180).toFixed(4);
                        const cyberCoords = `📍 Tactical Coords Locked: Zone Lat ${lat}, Lon ${lon}`;
                        setText(prev => (prev ? prev + ' ' + cyberCoords : cyberCoords));
                      }
                    }}
                    className="p-1.5 bg-black border border-[var(--neon-green)]/35 text-zinc-400 hover:text-[var(--neon-green)] hover:border-[var(--neon-green)] transition cursor-pointer flex items-center gap-1 text-[9px] uppercase font-bold"
                    title="Transmit high-precision tactical coordinate node location"
                  >
                    <MapPin className="w-3 h-3 text-[var(--neon-green)]" />
                    <span>LOCATION</span>
                  </button>

                  {/* Speech-To-Text Transcription Toggle */}
                  <button
                    type="button"
                    id="button-v2t-listen"
                    onClick={toggleVoiceToTextListening}
                    className={`p-1.5 border bg-black transition-all flex items-center gap-1 text-[9px] uppercase font-bold select-none cursor-pointer ${
                      isV2TListening 
                        ? 'border-red-500 text-red-500 animate-pulse font-extrabold shadow-[2px_2px_0_0_#ff3c00]' 
                        : 'border-[var(--neon-green)]/30 text-zinc-400 hover:text-[var(--neon-green)]'
                    }`}
                    title="Toggle live speak-to-transcribe Speech-to-Text translation mode"
                  >
                    <Mic className={`w-3 h-3 ${isV2TListening ? 'text-red-500 animate-bounce' : 'text-[var(--neon-green)]'}`} />
                    <span>{isV2TListening ? 'ACTIVE' : 'V2T'}</span>
                  </button>

                  {/* Micro recording engine triggers */}
                  <button
                    type="button"
                    id="button-hold-voice"
                    onMouseDown={startVoiceRecording}
                    onMouseUp={stopVoiceRecording}
                    onTouchStart={startVoiceRecording}
                    onTouchEnd={stopVoiceRecording}
                    className={`p-1.5 border bg-black transition-all flex items-center gap-1 text-[9px] uppercase font-bold select-none cursor-grab ${
                      isRecording 
                        ? 'border-red-500 text-red-500 pulse-green' 
                        : 'border-[var(--neon-green)]/30 text-zinc-400 hover:text-[var(--neon-green)]'
                    }`}
                    title="Hold down to record voice, release to buffer"
                  >
                    <Mic className={`w-3 h-3 ${isRecording ? 'animate-pulse text-red-500' : 'text-[var(--neon-green)]'}`} />
                    <span>{isRecording ? 'RECORDING' : 'AUDIO'}</span>
                  </button>
                </div>

                {/* Hidden input anchor */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*"
                />
              </div>

              {/* EmoStickerBoard inline section overlay */}
              {isEmoStickerOpen && (
                <div className="border border-[var(--neon-green)]/35 bg-black p-1">
                  <EmoStickerBoard
                    onSelectEmoji={(emoji) => {
                      setText(prev => prev + emoji);
                      playGlitchClickSound();
                    }}
                    onSelectSticker={(stickerUrl) => {
                      playSendMessageSound();
                      setSelectedAttachment({
                        name: 'flick_sticker.png',
                        type: 'image/png',
                        dataUrl: stickerUrl
                      });
                      setIsEmoStickerOpen(false);
                    }}
                  />
                  <div className="flex justify-end p-1">
                    <button
                      type="button"
                      onClick={() => setIsEmoStickerOpen(false)}
                      className="text-[8px] uppercase tracking-wider text-zinc-650 hover:text-white border border-zinc-800 px-2 py-0.5 cursor-pointer"
                    >
                      [ CLOSE ]
                    </button>
                  </div>
                </div>
              )}

              {/* Poll Builder inline section overlay */}
              {isPollCreatorOpen && (
                <div className="border border-[var(--neon-green)]/35 bg-black p-3 space-y-2 text-zinc-300 text-[10px]">
                  <div className="flex justify-between items-center border-b border-[var(--neon-green)]/15 pb-1">
                    <span className="text-[9px] uppercase tracking-widest font-black text-[var(--neon-green)]">📊 POLL CREATOR STATION</span>
                    <button
                      type="button"
                      onClick={() => setIsPollCreatorOpen(false)}
                      className="text-[8px] uppercase tracking-wider text-zinc-500 hover:text-white cursor-pointer"
                    >
                      [ CANCEL ]
                    </button>
                  </div>
                  <div>
                    <span className="block text-[8px] text-zinc-500 uppercase mb-1">Poll Question:</span>
                    <input
                      type="text"
                      placeholder="e.g. WHATS THE BEST CODENAME FOR THIS CONVERSATION?"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      className="w-full text-xs bg-zinc-950 text-[var(--neon-green)] p-1.5 border border-[var(--neon-green)]/25 focus:outline-none uppercase font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-[8px] text-zinc-500 uppercase">Poll Choices:</span>
                    {pollOptions.map((opt, oIdx) => (
                      <input
                        key={oIdx}
                        type="text"
                        placeholder={`CHOICE INTERCEPT #${oIdx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const nextOpts = [...pollOptions];
                          nextOpts[oIdx] = e.target.value;
                          setPollOptions(nextOpts);
                        }}
                        className="w-full text-xs bg-zinc-950 text-white p-1 border border-zinc-805 focus:outline-none uppercase font-mono"
                      />
                    ))}
                    <div className="flex gap-1.5 pt-1 font-mono">
                      <button
                        type="button"
                        onClick={() => setPollOptions(prev => [...prev, ''])}
                        className="text-[8px] px-2 py-0.5 border border-zinc-750 hover:border-white text-zinc-400 font-bold cursor-pointer"
                      >
                        [ ADD OPTION ]
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (pollOptions.length > 2) {
                            setPollOptions(prev => prev.slice(0, -1));
                          }
                        }}
                        className="text-[8px] px-2 py-0.5 border border-zinc-750 hover:border-white text-zinc-400 font-bold cursor-pointer"
                      >
                        [ DROP OPTION ]
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!pollQuestion.trim()) return;
                      const validChoices = pollOptions.filter(ch => ch.trim() !== '');
                      if (validChoices.length < 2) return;
                      
                      const pollId = `poll-${Date.now()}`;
                      const customPollMsg = `📊 POLL_DATA:${JSON.stringify({
                        id: pollId,
                        question: pollQuestion.trim().toUpperCase(),
                        options: validChoices.map(c => c.trim().toUpperCase())
                      })}`;
                      
                      setText(customPollMsg);
                      setIsPollCreatorOpen(false);
                      setPollQuestion('');
                      setPollOptions(['', '']);
                      playSendMessageSound();
                    }}
                    className="w-full py-2 bg-[var(--neon-green)] hover:bg-white text-black font-extrabold uppercase text-[9px] text-center cursor-pointer transition"
                  >
                    DEPLOY POLL ARTIFACT
                  </button>
                </div>
              )}

              {/* Message Typing Panel */}
              <div className="flex items-center space-x-2.5">
                <input
                  type="text"
                  placeholder="TRANSMIT SECURE ENCRYPTED DIALOGUE..."
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    handleTypingPulse();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const sendShortcutSetting = localStorage.getItem('flick_send_shortcut') || 'enter';
                      if (sendShortcutSetting === 'cmd-enter') {
                        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
                        if (!isCmdOrCtrl) {
                          e.preventDefault();
                        }
                      }
                    }
                  }}
                  disabled={sending}
                  className="flex-1 bg-black border border-[var(--neon-green)]/30 p-3 leading-none text-xs text-[var(--neon-green)] focus:outline-none focus:border-[var(--neon-green)] placeholder:opacity-50 select-text font-serif"
                />
                
                <button
                  type="submit"
                  disabled={sending || (!text.trim() && !selectedAttachment)}
                  className="bg-[var(--neon-green)] border border-black text-black font-extrabold uppercase px-6 py-3.5 text-xs transition-all cursor-pointer hover:bg-white hover:text-black shrink-0 flex items-center space-x-2 select-none"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">SEND</span>
                </button>
              </div>

            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#070707]">
            <Lock className="w-9 h-9 text-[var(--neon-green)]/40 mb-3 animate-pulse" />
            <h3 className="font-serif italic text-lg font-black text-zinc-400">
              Vault Standby Coordinates
            </h3>
            <p className="max-w-xs text-[10px] uppercase text-zinc-600 font-mono mt-1 tracking-wider leading-relaxed">
              Select or confirm a secure peer channel path dynamically from the coordinate list selector to mount E2EE encryption routines.
            </p>
          </div>
        )}
      </div>

      {/* 1. Share QR Dialog overlay */}
      <AnimatePresence>
        {showQrShareModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#0c0c0c] border-2 border-[var(--neon-green)] p-5 font-mono shadow-[6px_6px_0px_0px_#000000] text-center"
            >
              <div className="w-10 h-10 border border-[var(--neon-green)] flex items-center justify-center text-[var(--neon-green)] mx-auto mb-3.5 bg-black">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-serif italic font-extrabold uppercase text-white text-md mb-1">
                Your Secure Node Address
              </h3>
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-4 leading-normal">
                Let a peer scan this QR code to instantly start an E2EE encrypted chat tunnel.
              </p>

              {myQrCodeUrl ? (
                <div className="p-3 bg-black border border-[var(--neon-green)]/20 inline-block mb-4">
                  <img src={myQrCodeUrl} className="w-48 h-48 mx-auto bg-black" alt="Encryption Coordinates QR" />
                </div>
              ) : (
                <div className="w-48 h-48 mx-auto flex items-center justify-center border border-dashed border-[var(--neon-green)]/12 mb-4 text-xs text-zinc-500 uppercase animate-pulse">
                  Unpacking coordinates matrix...
                </div>
              )}

              <div className="p-2 border border-[var(--neon-green)]/15 bg-[#050505] text-[8px] text-[var(--neon-green)] text-center uppercase tracking-widest break-all mb-4 select-all">
                UID: {profile?.uid}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    let qrPhotoURL = profile?.photoURL;
                    if (qrPhotoURL && (qrPhotoURL.startsWith('data:') || qrPhotoURL.length > 150)) {
                      qrPhotoURL = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${profile?.uid}`;
                    }

                    navigator.clipboard.writeText(JSON.stringify({
                      flick_v1: true,
                      uid: profile?.uid,
                      displayName: profile?.displayName,
                      email: profile?.email,
                      publicKey: profile?.publicKey,
                      photoURL: qrPhotoURL
                    }));
                    setCopiedLink(true);
                    playLikeSound();
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="flex-1 py-1.5 border border-[var(--neon-green)]/40 hover:border-[var(--neon-green)] text-[var(--neon-green)] uppercase font-bold text-[9px] transition cursor-pointer"
                >
                  {copiedLink ? "[ IN-MEM COPIED ]" : "Copy Json Struct"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setShowQrShareModal(false);
                  }}
                  className="flex-1 py-1.5 bg-[#0d0d0d] text-zinc-400 hover:text-white border border-zinc-800 uppercase font-bold text-[9px] transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Scan QR Scanner Camera & File Overlay */}
      <AnimatePresence>
        {showQrScanModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0c0c0c] border-2 border-[var(--neon-green)] p-5 font-mono shadow-[6px_6px_0px_0px_#000000]"
            >
              <div className="flex items-center justify-between mb-4 border-b border-[var(--neon-green)]/15 pb-2">
                <span className="flex items-center text-[10px] uppercase font-black tracking-widest text-[var(--neon-green)]">
                  <ScanLine className="w-4 h-4 mr-1.5 animate-pulse" /> E2EE Coordinate Scan
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setShowQrScanModal(false);
                    stopScanning();
                  }}
                  className="px-2 py-0.5 border border-red-500/40 text-red-400 hover:text-red-500 text-[9px] uppercase font-bold cursor-pointer"
                >
                  Dismiss x
                </button>
              </div>

              {/* Video Camera Box */}
              <div className="relative aspect-video w-full bg-black border border-[var(--neon-green)]/20 flex flex-col items-center justify-center overflow-hidden mb-4 rounded-none">
                {cameraError ? (
                  <div className="p-4 text-center text-[10px] text-zinc-500 uppercase leading-relaxed font-bold">
                    <Camera className="w-6 h-6 mx-auto mb-2 opacity-30 text-red-500" />
                    <span>{cameraError}</span>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                    />
                    {/* Retro coordinate scan crosshairs */}
                    <div className="absolute inset-8 border border-dashed border-[var(--neon-green)]/30 pointer-events-none flex items-center justify-center select-none">
                      <div className="w-1.5 h-1.5 bg-[var(--neon-green)] rounded-full animate-ping"></div>
                    </div>
                  </>
                )}
              </div>

              {/* Status reporting */}
              {fileStatus && (
                <div className="mb-4 text-center p-2 bg-yellow-950/10 border border-yellow-500/30 text-yellow-500 text-[10px] uppercase font-bold">
                  {fileStatus}
                </div>
              )}

              {/* File Upload Fallback option */}
              <div className="p-4 border border-[var(--neon-green)]/15 bg-[#050505] space-y-2.5 text-center">
                <span className="text-[10px] text-zinc-400 font-sans block leading-normal">
                  No Camera? Take a screenshot or grab a peer's QR image containing their cryptographic coordinate file structure:
                </span>
                <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#111111] hover:bg-black text-[var(--neon-green)] border border-[var(--neon-green)]/30 hover:border-[var(--neon-green)] text-[10px] font-mono font-bold uppercase transition cursor-pointer select-none">
                  <Upload className="w-3.5 h-3.5" /> Upload/Drop QR Screenshot
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUploadQr}
                    className="hidden"
                  />
                </label>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Forward Message Recipient Selection Modal */}
      <AnimatePresence>
        {isForwardModalOpen && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full max-w-md bg-[#0c0c0c] border-[3px] border-[var(--neon-green)] p-5 font-mono shadow-[8px_8px_0px_0px_#000000] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--neon-green)]/15 pb-2">
                <span className="flex items-center text-[10px] uppercase font-black tracking-widest text-[var(--neon-green)]">
                  🚀 FORWARD ENCRYPTED TRANSCRIPTION
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setIsForwardModalOpen(false);
                    setForwardMessageText('');
                  }}
                  className="px-2 py-0.5 border border-red-500/40 text-red-400 hover:text-red-500 text-[9px] uppercase font-bold cursor-pointer"
                >
                  [ CLOSE ]
                </button>
              </div>

              {/* Message preview details panel */}
              <div className="text-[9px] p-3 border border-dashed border-[var(--neon-green)]/20 bg-black/70 rounded-none relative">
                <span className="absolute right-2 top-1.5 text-[7px] text-zinc-500 font-bold">CIPHERTEXT OUTBOUND</span>
                <p className="text-zinc-500 uppercase tracking-wider font-bold mb-1">Payload excerpt:</p>
                <p className="italic text-zinc-300 line-clamp-2">"{forwardMessageText}"</p>
              </div>

              {/* Target recipients select lists */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-black block border-l border-[var(--neon-green)] pl-1.5 mb-2">
                  Select target coordinate path node:
                </label>
                <div className="max-h-56 overflow-y-auto divide-y divide-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 bg-black scrollbar">
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-[9px] uppercase text-zinc-500 italic">
                      No online coordinate records detected.
                    </div>
                  ) : (
                    users.map(u => {
                      if (u.uid === profile?.uid) return null;
                      return (
                        <div 
                          key={u.uid}
                          onClick={() => handleForwardMessageToPeer(u)}
                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-[var(--neon-green)]/10 transition group"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <img 
                              src={u.photoURL} 
                              alt={u.displayName} 
                              className="w-8 h-8 border border-[var(--neon-green)]/30 group-hover:border-[var(--neon-green)] object-cover shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-white group-hover:text-[var(--neon-green)] truncate">
                                {u.displayName}
                              </p>
                              <p className="text-[8px] text-zinc-500 truncate">{u.email}</p>
                            </div>
                          </div>
                          <span className="text-[8.5px] uppercase font-bold border border-[var(--neon-green)]/35 text-[var(--neon-green)] group-hover:bg-[var(--neon-green)] group-hover:text-black px-2 py-0.5 transition shrink-0 select-none">
                            ROUTE PAYLOAD ➔
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Keyboard Shortcuts Overlay Modal */}
      <AnimatePresence>
        {isShortcutModalOpen && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0c0c0c] border-[3px] border-[var(--neon-green)] p-5 font-mono shadow-[8px_8px_0px_0px_#000000] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--neon-green)]/15 pb-2">
                <span className="flex items-center text-[10px] uppercase font-black tracking-widest text-[var(--neon-green)]">
                  ⌨️ CORE NAVIGATION HOTKEYS
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    setIsShortcutModalOpen(false);
                  }}
                  className="px-2 py-0.5 border border-red-500/40 text-red-400 hover:text-red-500 text-[9px] uppercase font-bold cursor-pointer"
                >
                  [ CLOSE ]
                </button>
              </div>

              {/* Table of commands */}
              <div className="space-y-3 font-mono text-[9px] uppercase">
                <p className="text-zinc-500 leading-normal mb-2 text-center text-[8px]">
                  Fara Flick terminals respond instantaneously to the following hardware-level key binds. Enjoy keyboard-driven secure messaging.
                </p>
                <div className="divide-y divide-[var(--neon-green)]/10 border border-[var(--neon-green)]/15 bg-black/60 font-mono">
                  <div className="p-2.5 flex justify-between items-center bg-[var(--neon-green)]/5">
                    <span className="text-zinc-400">Toggle Keyboard Shortcuts Helper</span>
                    <kbd className="px-1.5 py-0.5 bg-black text-[var(--neon-green)] border border-[var(--neon-green)]/35 font-bold">Alt + /</kbd>
                  </div>
                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-zinc-400">Scan QR Code (Peer Discovery)</span>
                    <kbd className="px-1.5 py-0.5 bg-black text-[var(--neon-green)] border border(--neon-green)/35 font-bold">Alt + S</kbd>
                  </div>
                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-zinc-400">Direct Chat Share Coordinates</span>
                    <kbd className="px-1.5 py-0.5 bg-black text-[var(--neon-green)] border border(--neon-green)/35 font-bold">Alt + Q</kbd>
                  </div>
                  <div className="p-2.5 flex justify-between items-center bg-[var(--neon-green)]/5">
                    <span className="text-zinc-400">Toggle Speech-to-Text Recording</span>
                    <kbd className="px-1.5 py-0.5 bg-black text-[var(--neon-green)] border border(--neon-green)/35 font-bold">Alt + T</kbd>
                  </div>
                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-zinc-400">Clear Search/Focus Chat Area Input</span>
                    <kbd className="px-1.5 py-0.5 bg-black text-[var(--neon-green)] border border(--neon-green)/35 font-bold">Esc</kbd>
                  </div>
                </div>
              </div>

              <div className="p-2 text-center text-zinc-500 text-[7px] leading-relaxed uppercase">
                Hardware listener: [ACTIVE]. Press Esc at any time to exit prompts.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
