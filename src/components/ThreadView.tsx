import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  X, MessageSquare, Send, CornerDownRight, Smile, 
  Lock, Check, CheckCheck, FileText, ZoomIn, Loader2
} from 'lucide-react';
import { ChatMessage, UserProfile } from '../types';
import { decryptE2EEMessage } from '../lib/crypto';
import { playGlitchClickSound, playSendMessageSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { VoicePlayerBubble } from './VoicePlayerBubble';

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
  } catch {
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

interface ThreadViewProps {
  parentMessage: ChatMessage;
  replies: ChatMessage[];
  currentUserId: string;
  currentUserDisplayName: string;
  localPrivateKey: string | null;
  chatId: string;
  isGroup: boolean;
  peerProfile?: UserProfile | null;
  onClose: () => void;
  onSendReply: (replyText: string) => Promise<void>;
  decryptedCache: Record<string, string>;
  onDecrypted?: (msgId: string, text: string) => void;
}

export function ThreadView({
  parentMessage,
  replies,
  currentUserId,
  currentUserDisplayName,
  localPrivateKey,
  chatId,
  isGroup,
  peerProfile,
  onClose,
  onSendReply,
  decryptedCache,
  onDecrypted
}: ThreadViewProps) {
  const [replyInput, setReplyInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  
  const repliesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom of replies when replies list updates
  useEffect(() => {
    if (repliesContainerRef.current) {
      repliesContainerRef.current.scrollTop = repliesContainerRef.current.scrollHeight;
    }
  }, [replies.length]);

  // Focus reply input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = replyInput.trim();
    if (!trimmed || isSending) return;

    try {
      setIsSending(true);
      playSendMessageSound();
      triggerVibration('medium');
      await onSendReply(trimmed);
      setReplyInput('');
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed to dispatch thread reply:', err);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const pickerEmojis = ['👍', '❤️', '🔥', '🚀', '⚡', '🤯', '😂', '🎯', '👏', '💯', '🤝', '👀'];

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="absolute inset-y-0 right-0 w-full sm:w-96 md:w-[420px] bg-[var(--color-surface)] border-l border-[var(--neon-green)]/25 flex flex-col z-30 shadow-2xl font-mono text-[var(--color-text)] select-text"
    >
      {/* Lightbox zoom modal for attachments in thread */}
      {zoomImg && (
        <div 
          onClick={() => setZoomImg(null)} 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={zoomImg} alt="Attachment zoom" className="max-h-[90vh] max-w-[90vw] object-contain border border-[var(--neon-green)]/40 shadow-2xl" />
        </div>
      )}

      {/* Header */}
      <header className="p-3.5 border-b border-[var(--neon-green)]/20 bg-[var(--color-surface)]/95 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded border border-[var(--neon-green)]/40 bg-[var(--neon-green)]/10 flex items-center justify-center text-[var(--neon-green)] shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--neon-green)]">
                SUB-THREAD
              </span>
              <span className="text-[9px] bg-[var(--neon-green)]/15 text-[var(--neon-green)] px-1.5 py-0.2 rounded font-bold">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            </div>
            <p className="text-[9px] text-zinc-500 truncate">
              Branch off @{parentMessage.senderDisplayName || (parentMessage.senderId === currentUserId ? 'You' : 'Peer')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playGlitchClickSound();
            onClose();
          }}
          className="p-1 px-2 border border-[var(--neon-green)]/35 text-[9px] uppercase font-bold text-zinc-400 hover:text-[var(--neon-green)] hover:border-[var(--neon-green)] transition cursor-pointer flex items-center gap-1"
          title="Close sub-thread (Esc)"
        >
          <span>CLOSE</span>
          <X className="w-3 h-3" />
        </button>
      </header>

      {/* Parent Root Message Card */}
      <div className="p-3.5 border-b border-[var(--neon-green)]/15 bg-black/30 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] uppercase tracking-widest text-[var(--neon-green)] font-extrabold flex items-center gap-1">
            <CornerDownRight className="w-2.5 h-2.5" />
            ROOT TRANSMISSION
          </span>
          <span className="text-[8px] text-zinc-500 font-mono">
            {getRelativeTimestamp(parentMessage.createdAt)}
          </span>
        </div>

        <div className="flex items-start space-x-2.5">
          <div className="w-7 h-7 rounded-full border border-[var(--neon-green)]/40 bg-zinc-900 flex items-center justify-center font-bold text-[10px] text-[var(--neon-green)] shrink-0 overflow-hidden">
            {parentMessage.senderId === currentUserId ? 'YOU' : (parentMessage.senderDisplayName ? parentMessage.senderDisplayName.slice(0, 2).toUpperCase() : 'PE')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-[var(--color-text)] flex items-center space-x-1.5">
              <span>{parentMessage.senderDisplayName || (parentMessage.senderId === currentUserId ? 'You' : 'Peer')}</span>
              {parentMessage.senderId === currentUserId && (
                <span className="text-[7.5px] uppercase font-mono text-[var(--neon-green)] bg-[var(--neon-green)]/15 px-1 rounded">
                  YOU
                </span>
              )}
            </div>

            <ThreadMessageContent 
              message={parentMessage}
              currentUserId={currentUserId}
              localPrivateKey={localPrivateKey}
              chatId={chatId}
              decryptedCache={decryptedCache}
              onDecrypted={onDecrypted}
              onZoomImg={setZoomImg}
            />
          </div>
        </div>
      </div>

      {/* Replies Divider */}
      <div className="px-3.5 py-1.5 bg-[var(--color-surface)]/80 border-b border-[var(--neon-green)]/10 flex items-center justify-between text-[8.5px] text-zinc-500 uppercase tracking-widest font-bold shrink-0">
        <span>REPLIES STREAM</span>
        <span>{replies.length} TRANSMISSIONS</span>
      </div>

      {/* Replies History Stream */}
      <div 
        ref={repliesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5 scrollbar"
      >
        {replies.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-10 h-10 rounded-full border border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5 flex items-center justify-center text-[var(--neon-green)] mb-2.5">
              <CornerDownRight className="w-5 h-5 opacity-70" />
            </div>
            <p className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider mb-1">
              NO REPLIES YET
            </p>
            <p className="text-[9.5px] text-zinc-500 max-w-[240px] leading-relaxed">
              Start this conversation thread. Transmissions will branch from this root coordinate.
            </p>
          </div>
        ) : (
          replies.map((reply) => {
            const isMe = reply.senderId === currentUserId;
            return (
              <div 
                key={reply.id} 
                className={`flex items-start space-x-2.5 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full border ${isMe ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/20 text-[var(--neon-green)]' : 'border-zinc-700 bg-zinc-900 text-zinc-400'} flex items-center justify-center text-[9px] font-bold shrink-0`}>
                  {isMe ? 'Y' : (reply.senderDisplayName ? reply.senderDisplayName.slice(0, 1).toUpperCase() : 'P')}
                </div>

                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center space-x-1.5 text-[8.5px] text-zinc-500 mb-0.5 font-mono">
                    <span className="font-bold text-[var(--color-text)]">
                      {isMe ? 'You' : (reply.senderDisplayName || 'Peer')}
                    </span>
                    <span>·</span>
                    <span>{getRelativeTimestamp(reply.createdAt)}</span>
                  </div>

                  <div className={`p-2.5 border text-[11px] font-sans break-words [overflow-wrap:anywhere] rounded-xl shadow-sm ${
                    isMe 
                      ? 'bg-[var(--neon-green)]/15 text-[var(--color-text)] border-[var(--neon-green)]/40 rounded-tr-none' 
                      : 'bg-black/50 text-zinc-200 border-[var(--neon-green)]/15 rounded-tl-none'
                  }`}>
                    <ThreadMessageContent 
                      message={reply}
                      currentUserId={currentUserId}
                      localPrivateKey={localPrivateKey}
                      chatId={chatId}
                      decryptedCache={decryptedCache}
                      onDecrypted={onDecrypted}
                      onZoomImg={setZoomImg}
                    />

                    {isMe && (
                      <div className="flex justify-end mt-1 text-[8px] font-mono text-[var(--neon-green)]/70 space-x-1">
                        <CheckCheck className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Emoji Quick Picker Overlay */}
      {showEmojiPicker && (
        <div className="p-2 border-t border-[var(--neon-green)]/20 bg-black/80 flex items-center justify-between gap-1 flex-wrap shrink-0">
          {pickerEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setReplyInput(prev => prev + emoji);
                setShowEmojiPicker(false);
                inputRef.current?.focus();
              }}
              className="text-base p-1 hover:scale-125 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <footer className="p-3 border-t border-[var(--neon-green)]/25 bg-[var(--color-surface)] shrink-0">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-zinc-500 hover:text-[var(--neon-green)] transition cursor-pointer shrink-0"
            title="Insert emoji reaction"
          >
            <Smile className="w-4 h-4" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            placeholder={`Reply to thread... (Enter to send)`}
            disabled={isSending}
            className="flex-1 bg-black/40 border border-[var(--neon-green)]/35 text-xs text-[var(--color-text)] px-3 py-2 outline-none focus:border-[var(--neon-green)] tracking-wide font-sans placeholder-zinc-500 transition-colors"
          />

          <button
            type="submit"
            disabled={!replyInput.trim() || isSending}
            className={`p-2 px-3 border uppercase font-bold text-[10px] tracking-wider transition cursor-pointer flex items-center space-x-1 shrink-0 ${
              replyInput.trim() && !isSending
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] hover:bg-[var(--neon-green)]/80 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                : 'border-zinc-800 text-zinc-600 bg-transparent cursor-not-allowed'
            }`}
            title="Transmit thread reply"
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline">SEND</span>
                <Send className="w-3 h-3" />
              </>
            )}
          </button>
        </form>
      </footer>
    </motion.aside>
  );
}

// Sub-component for decrypting and rendering individual message/reply bodies in ThreadView
function ThreadMessageContent({
  message,
  currentUserId,
  localPrivateKey,
  chatId,
  decryptedCache,
  onDecrypted,
  onZoomImg
}: {
  message: ChatMessage;
  currentUserId: string;
  localPrivateKey: string | null;
  chatId: string;
  decryptedCache: Record<string, string>;
  onDecrypted?: (msgId: string, text: string) => void;
  onZoomImg: (url: string) => void;
}) {
  const [text, setText] = useState<string>(() => {
    return decryptedCache[message.id] || message.plainText || '';
  });

  useEffect(() => {
    if (decryptedCache[message.id]) {
      setText(decryptedCache[message.id]);
      return;
    }
    if (message.plainText) {
      setText(message.plainText);
      return;
    }
    if (message.isDeleted) {
      setText('🚫 This message was deleted.');
      return;
    }

    if (localPrivateKey && message.encryptedText) {
      let active = true;
      const wrappedKey = message.senderId === currentUserId ? message.senderEncryptedKey : message.encryptedKey;
      decryptE2EEMessage(message.encryptedText, wrappedKey, localPrivateKey)
        .then((resolved) => {
          if (active && resolved) {
            setText(resolved);
            onDecrypted?.(message.id, resolved);
          }
        })
        .catch(() => {
          if (active) {
            const fallback = message.encryptedText && !message.encryptedText.includes(':') ? message.encryptedText : 'Message';
            setText(fallback);
          }
        });
      return () => { active = false; };
    }
  }, [message.id, message.plainText, message.encryptedText, message.isDeleted, localPrivateKey, currentUserId, decryptedCache, onDecrypted]);

  // Decode JSON attachments if any
  let caption = text;
  let attachmentUrl = message.mediaUrl || '';
  let attachmentType = message.mediaType || 'none';
  let attachmentName = message.mediaName || '';
  let audioDuration = 0;
  let audioWaveform: number[] = [];
  let audioTranscript = '';

  if (text.trim().startsWith('{') && text.includes('attachmentUrl')) {
    try {
      const parsed = JSON.parse(text);
      caption = parsed.text || '';
      attachmentUrl = parsed.attachmentUrl || '';
      attachmentType = parsed.attachmentType || 'none';
      attachmentName = parsed.attachmentName || '';
      audioDuration = parsed.duration || 0;
      audioWaveform = parsed.waveform || [];
      audioTranscript = parsed.transcript || '';
    } catch {
      // Fallback
    }
  }

  return (
    <div className="mt-1 space-y-1.5 leading-relaxed text-[11px]">
      {/* Media Attachments */}
      {attachmentUrl && (
        <div className="overflow-hidden rounded border border-[var(--neon-green)]/20 my-1">
          {attachmentType === 'image' || attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
            <div 
              onClick={() => onZoomImg(attachmentUrl)} 
              className="relative group cursor-pointer"
            >
              <img src={attachmentUrl} alt="Attached media" className="max-h-48 w-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-4 h-4 text-[var(--neon-green)]" />
              </div>
            </div>
          ) : attachmentType === 'video' ? (
            <video src={attachmentUrl} controls className="max-h-48 w-full" />
          ) : attachmentType === 'audio' ? (
            <VoicePlayerBubble
              messageId={message.id}
              chatId={chatId}
              audioUrl={attachmentUrl}
              duration={audioDuration}
              waveform={audioWaveform}
              transcript={audioTranscript}
              senderName={message.senderDisplayName || 'Peer'}
              senderId={message.senderId}
              isMe={message.senderId === currentUserId}
              timestamp=""
            />
          ) : (
            <div className="flex items-center space-x-2 p-2 bg-black/40">
              <FileText className="w-4 h-4 text-[var(--neon-green)] shrink-0" />
              <span className="text-[10px] truncate flex-1">{attachmentName || 'Document attachment'}</span>
              <a href={attachmentUrl} download={attachmentName || 'download'} className="text-[9px] text-[var(--neon-green)] font-bold uppercase hover:underline">
                DL
              </a>
            </div>
          )}
        </div>
      )}

      {/* Caption or message text */}
      {caption && (
        <p className="whitespace-pre-wrap select-text break-words">
          {caption}
        </p>
      )}
    </div>
  );
}
