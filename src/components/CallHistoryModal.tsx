import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  Users,
  Clock,
  Calendar,
  X,
  Search,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Radio,
  Trash2,
  ExternalLink,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { CallLogItem } from '../types';
import { subscribeToCallHistory, deleteCallRecord, clearAllCallHistory } from '../lib/services';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';

interface CallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  currentUserPhoto?: string;
  onInitiateCall: (targetUser: { uid: string; name: string; photo?: string }, type: 'voice' | 'video') => void;
  onOpenChat?: (targetUserId: string) => void;
}

export default function CallHistoryModal({
  isOpen,
  onClose,
  currentUserId,
  currentUserName,
  currentUserPhoto,
  onInitiateCall,
  onOpenChat
}: CallHistoryModalProps) {
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'missed' | 'audio' | 'video' | 'group'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    setLoading(true);

    const unsub = subscribeToCallHistory(currentUserId, (logs) => {
      setCallLogs(logs);
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

  const handleDeleteItem = async (e: React.MouseEvent, callId: string) => {
    e.stopPropagation();
    playGlitchClickSound();
    triggerVibration('light');
    try {
      await deleteCallRecord(callId);
      setCallLogs(prev => prev.filter(c => c.id !== callId));
      showBrutalistToast('CALL LOG ENTRY REMOVED', 'success');
    } catch (err) {
      showBrutalistToast('FAILED TO REMOVE LOG', 'error');
    }
  };

  const handleClearAll = async () => {
    playGlitchClickSound();
    triggerVibration('medium');
    setIsClearing(true);
    try {
      const count = await clearAllCallHistory(currentUserId);
      setCallLogs([]);
      setShowConfirmClear(false);
      showBrutalistToast(`PURGED ${count} CALL LOGS`, 'success');
    } catch (err) {
      showBrutalistToast('FAILED TO PURGE CALL LOGS', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const formatDuration = (totalSec?: number) => {
    if (!totalSec || totalSec <= 0) return '0s';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Filter logs
  const filteredLogs = callLogs.filter((log) => {
    const isIncoming = log.receiverId === currentUserId;
    const isMissed = isIncoming && (log.status === 'missed' || log.status === 'rejected' || log.status === 'declined');

    if (activeFilter === 'missed' && !isMissed) return false;
    if (activeFilter === 'audio' && log.type !== 'voice') return false;
    if (activeFilter === 'video' && log.type !== 'video') return false;
    if (activeFilter === 'group' && !log.isGroup) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const peerName = (isIncoming ? log.callerName : log.receiverName) || '';
      const groupName = log.groupName || '';
      return peerName.toLowerCase().includes(q) || groupName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0a0a0f] border-2 border-[var(--neon-green)] shadow-[8px_8px_0_0_#000000] flex flex-col max-h-[85vh] font-mono text-[var(--color-text)] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[var(--color-surface)] border-b-2 border-[var(--neon-green)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black border border-[var(--neon-green)] text-[var(--neon-green)]">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>SECURE CALL REGISTRY</span>
                <span className="text-[9px] bg-[var(--neon-green)]/20 text-[var(--neon-green)] px-2 py-0.5 border border-[var(--neon-green)]/40 font-bold">
                  {callLogs.length} LOGS
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400">Real-time WebRTC Call Dispatch Logs</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {callLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  playGlitchClickSound();
                  setShowConfirmClear(true);
                }}
                className="px-2.5 py-1.5 bg-black hover:bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                title="Purge all call records"
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">PURGE LOGS</span>
              </button>
            )}

            <button
              onClick={() => {
                playGlitchClickSound();
                onClose();
              }}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Confirmation Banner */}
        {showConfirmClear && (
          <div className="p-3 bg-zinc-900 border-b border-[var(--neon-green)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-[var(--neon-green)] shrink-0" />
              <span>Permanently delete all {callLogs.length} call logs from this device and network?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-3 py-1 bg-black border border-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={isClearing}
                className="px-3 py-1 bg-[var(--neon-green)] hover:bg-white text-black text-[10px] font-black uppercase cursor-pointer flex items-center gap-1.5"
              >
                {isClearing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                <span>Confirm Purge</span>
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="p-3 border-b border-zinc-800 bg-black/60 space-y-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by caller, peer or group name..."
              className="w-full bg-[#111] border border-zinc-700 pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--neon-green)]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] uppercase font-bold">
            {(['all', 'missed', 'audio', 'video', 'group'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  playGlitchClickSound();
                  setActiveFilter(tab);
                }}
                className={`px-3 py-1 border transition cursor-pointer whitespace-nowrap ${
                  activeFilter === tab
                    ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-extrabold'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {tab === 'all' && 'All Calls'}
                {tab === 'missed' && 'Missed'}
                {tab === 'audio' && 'Voice'}
                {tab === 'video' && 'Video'}
                {tab === 'group' && 'Group Channels'}
              </button>
            ))}
          </div>
        </div>

        {/* Call Logs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[250px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-zinc-500">
              <RefreshCw className="w-8 h-8 animate-spin text-[var(--neon-green)]" />
              <p className="text-xs tracking-widest uppercase">Decentralized Log Sync...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2 text-center text-zinc-500">
              <PhoneOff className="w-10 h-10 text-zinc-700" />
              <p className="text-xs uppercase font-bold text-zinc-400">No Call Records Found</p>
              <p className="text-[10px] text-zinc-600">All logs are clean. New calls will appear here in real time.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isIncoming = log.receiverId === currentUserId;
              const isGroup = log.isGroup;
              const peerName = isGroup 
                ? (log.groupName || 'Group Audio Conduit') 
                : (isIncoming ? log.callerName : log.receiverName);
              const peerPhoto = isIncoming ? log.callerPhoto : log.receiverPhoto;
              const peerUid = isIncoming ? log.callerId : log.receiverId;

              const isMissed = isIncoming && (log.status === 'missed' || log.status === 'rejected' || log.status === 'declined');
              const isCompleted = log.status === 'completed';

              return (
                <div
                  key={log.id}
                  className="p-3 border transition flex items-center justify-between gap-3 bg-[#111218] border-zinc-800 hover:border-[var(--neon-green)]/60 group"
                >
                  {/* Left: Direction Icon & Peer Avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={peerPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(peerName || 'peer')}`}
                        alt={peerName}
                        className="w-10 h-10 border border-zinc-700 object-cover bg-zinc-900"
                        referrerPolicy="no-referrer"
                      />
                      {/* Direction badge */}
                      <span className="absolute -bottom-1 -right-1 p-0.5 border bg-black text-[var(--neon-green)] border-zinc-700">
                        {isGroup ? (
                          <Users className="w-2.5 h-2.5" />
                        ) : isMissed ? (
                          <PhoneMissed className="w-2.5 h-2.5 text-zinc-400" />
                        ) : isIncoming ? (
                          <PhoneIncoming className="w-2.5 h-2.5" />
                        ) : (
                          <PhoneOutgoing className="w-2.5 h-2.5 text-zinc-300" />
                        )}
                      </span>
                    </div>

                    {/* Middle details */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate text-white">
                          {peerName}
                        </span>
                        {log.type === 'video' ? (
                          <span className="p-0.5 bg-black text-[var(--neon-green)] border border-zinc-700 text-[8px] flex items-center gap-0.5">
                            <Video className="w-2.5 h-2.5" /> VID
                          </span>
                        ) : (
                          <span className="p-0.5 bg-black text-[var(--neon-green)] border border-zinc-700 text-[8px] flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" /> VOX
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-bold text-zinc-300">
                          <Clock className="w-3 h-3 text-[var(--neon-green)]" />
                          {formatDuration(log.duration)}
                        </span>
                        <span>•</span>
                        <span className="uppercase font-bold text-zinc-400">
                          {log.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Delete single log record */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(e, log.id)}
                      className="p-2 bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                      title="Delete Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Direct Chat Shortcut */}
                    {onOpenChat && !isGroup && peerUid && (
                      <button
                        type="button"
                        onClick={() => {
                          playGlitchClickSound();
                          onClose();
                          onOpenChat(peerUid);
                        }}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                        title="Open Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Callback Voice */}
                    {!isGroup && peerUid && (
                      <button
                        type="button"
                        onClick={() => {
                          playLikeSound();
                          triggerVibration('medium');
                          onClose();
                          onInitiateCall({ uid: peerUid, name: peerName, photo: peerPhoto }, 'voice');
                        }}
                        className="p-2 bg-[var(--neon-green)] hover:bg-white text-black font-bold transition cursor-pointer border border-black shadow-[2px_2px_0_0_#000000]"
                        title="Callback (Voice)"
                      >
                        <Phone className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    )}

                    {/* Callback Video */}
                    {!isGroup && peerUid && (
                      <button
                        type="button"
                        onClick={() => {
                          playLikeSound();
                          triggerVibration('medium');
                          onClose();
                          onInitiateCall({ uid: peerUid, name: peerName, photo: peerPhoto }, 'video');
                        }}
                        className="p-2 bg-black hover:bg-zinc-900 text-[var(--neon-green)] font-bold transition cursor-pointer border border-[var(--neon-green)] shadow-[2px_2px_0_0_#000000]"
                        title="Callback (Video)"
                      >
                        <Video className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[var(--color-surface)] border-t border-zinc-800 flex items-center justify-between text-[9px] text-zinc-500">
          <div className="flex items-center gap-1.5 text-[var(--neon-green)]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>END-TO-END SECURE WEBRTC DISPATCH REGISTRY</span>
          </div>
          <button
            onClick={() => {
              playGlitchClickSound();
              onClose();
            }}
            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer font-bold uppercase"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
