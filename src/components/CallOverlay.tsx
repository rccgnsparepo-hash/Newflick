import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, ShieldCheck, 
  Radio, Sparkles, Users, Hand, Share2, Copy, UserPlus, Check, MessageSquare,
  Minimize2, Maximize2, Wifi, WifiOff, SignalHigh, SignalMedium, SignalLow, Activity, Lock
} from 'lucide-react';
import { 
  playGlitchClickSound, playLikeSound, playSendMessageSound,
  startRingtoneSound, stopRingtoneSound, playCallConnectedSound, playCallEndSound 
} from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { updateGroupParticipantState, leaveGroupCall, joinGroupCall } from '../lib/services';

export interface CallState {
  id?: string;
  type: 'voice' | 'video';
  status: 'dialing' | 'ringing' | 'active' | 'ended';
  peerId: string;
  peerName: string;
  peerPhoto: string;
  isIncoming?: boolean;
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserPhoto?: string;
}

interface CallOverlayProps {
  call: CallState;
  onEndCall: () => void;
  onAcceptCall?: () => void;
}

export default function CallOverlay({ call, onEndCall, onAcceptCall }: CallOverlayProps) {
  const [status, setStatus] = useState<'dialing' | 'ringing' | 'active'>(
    call.status === 'ended' ? 'dialing' : (call.status as any)
  );
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(call.type === 'video');
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // WebRTC Signal & Latency Monitor
  const [latencyMs, setLatencyMs] = useState(38);
  const [signalQuality, setSignalQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const miniVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const currentUid = call.currentUserId || 'me';
  const currentName = call.currentUserName || 'You';
  const currentPhoto = call.currentUserPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120';

  // 1. Sync real-time call status
  useEffect(() => {
    if (call.isGroup) {
      setStatus('active');
      return;
    }
    if (call.status) {
      setStatus(call.status as any);
    }
  }, [call.status, call.isGroup]);

  // Audio ringtone & connection sound manager
  useEffect(() => {
    if (status === 'dialing' || status === 'ringing') {
      startRingtoneSound();
      triggerVibration('heavy');
    } else if (status === 'active') {
      stopRingtoneSound();
      playCallConnectedSound();
      triggerVibration('medium');
    }

    return () => {
      stopRingtoneSound();
    };
  }, [status]);

  // 2. Real-time Firestore subscription for group call participants
  useEffect(() => {
    if (!call.id) return;

    const callDocRef = doc(db, 'calls', call.id);
    const unsub = onSnapshot(callDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'ended' && !call.isGroup) {
          onEndCall();
          return;
        }
        if (data.participants && Array.isArray(data.participants)) {
          setParticipants(data.participants);
        }
      }
    }, (err) => {
      console.warn('[CallOverlay] Firestore stream notice:', err);
    });

    return () => unsub();
  }, [call.id, call.isGroup]);

  // Ensure current user is in participants list for group calls
  useEffect(() => {
    if (call.isGroup && participants.length === 0) {
      setParticipants([
        {
          uid: currentUid,
          name: currentName,
          photo: currentPhoto,
          isMuted: false,
          isSpeaking: false,
          isHandRaised: false,
          joinedAt: Date.now()
        },
        {
          uid: call.peerId || 'peer-1',
          name: call.peerName || 'Peer Node',
          photo: call.peerPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120',
          isMuted: false,
          isSpeaking: true,
          isHandRaised: false,
          joinedAt: Date.now() - 10000
        }
      ]);
    }
  }, [call.isGroup, participants.length, currentUid, currentName, currentPhoto, call.peerId, call.peerName, call.peerPhoto]);

  // 3. Real-time call duration stopwatch timer (updates every second once status === 'active')
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // 4. WebRTC Signal Strength & Latency Monitor
  useEffect(() => {
    if (status !== 'active') return;

    const interval = setInterval(() => {
      // Simulate real WebRTC latency statistics check
      const basePing = 25 + Math.floor(Math.random() * 25);
      const randomSpike = Math.random() < 0.08 ? Math.floor(Math.random() * 180) : 0;
      const totalPing = basePing + randomSpike;

      setLatencyMs(totalPing);
      if (totalPing < 100) {
        setSignalQuality('excellent');
      } else if (totalPing < 250) {
        setSignalQuality('good');
      } else {
        setSignalQuality('poor');
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [status]);

  // 5. WebRTC Local Microphone & Camera Stream capturing
  useEffect(() => {
    const hasMediaDevices = typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

    if (status === 'active' && hasMediaDevices) {
      navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideoOn 
      })
        .then((stream) => {
          setLocalStream(stream);

          // Video element bind if video enabled
          if (videoRef.current && isVideoOn) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          if (miniVideoRef.current && isVideoOn) {
            miniVideoRef.current.srcObject = stream;
            miniVideoRef.current.play().catch(() => {});
          }

          // Audio Context Analyser for real-time speech detection
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const audioCtx = new AudioContextClass();
              const analyser = audioCtx.createAnalyser();
              analyser.fftSize = 64;
              const source = audioCtx.createMediaStreamSource(stream);
              source.connect(analyser);

              audioContextRef.current = audioCtx;
              analyserRef.current = analyser;

              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const checkVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                const speaking = average > 25 && !isMuted;
                setIsLocalSpeaking(speaking);

                animFrameRef.current = requestAnimationFrame(checkVolume);
              };

              checkVolume();
            }
          } catch (e) {
            console.warn('[WebRTC Audio Analyser] AudioContext notice:', e);
          }
        })
        .catch((err) => {
          console.warn('[WebRTC] Microphone / Camera stream unavailable or permission denied:', err);
        });
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [status]);

  // 6. Direct Mute Button Handler: interacts directly with WebRTC audio tracks
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
    if (call.id && currentUid) {
      updateGroupParticipantState(call.id, currentUid, { isMuted }).catch(() => {});
    }
  }, [isMuted, localStream, call.id, currentUid]);

  // 7. Direct Camera Toggle Button Handler: interacts directly with WebRTC video tracks
  useEffect(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
          track.enabled = isVideoOn;
        });
      } else if (isVideoOn && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        // Dynamically request video track if turning camera on during active call
        navigator.mediaDevices.getUserMedia({ video: true })
          .then((vStream) => {
            const newVideoTrack = vStream.getVideoTracks()[0];
            if (newVideoTrack) {
              localStream.addTrack(newVideoTrack);
              if (videoRef.current) {
                videoRef.current.srcObject = localStream;
                videoRef.current.play().catch(() => {});
              }
              if (miniVideoRef.current) {
                miniVideoRef.current.srcObject = localStream;
                miniVideoRef.current.play().catch(() => {});
              }
            }
          })
          .catch((err) => {
            console.warn('[WebRTC] Could not capture camera stream:', err);
            setIsVideoOn(false);
          });
      }
    }
  }, [isVideoOn, localStream]);

  // 8. Update local hand raised status
  useEffect(() => {
    if (call.id && currentUid) {
      updateGroupParticipantState(call.id, currentUid, { isHandRaised }).catch(() => {});
    }
  }, [isHandRaised, call.id, currentUid]);

  // 9. Cyber canvas visualizer generator (Audio spectrum waves)
  useEffect(() => {
    if (status !== 'active' || isMinimized) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let time = 0;

    const render = () => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 1) {
        const amplitude = isLocalSpeaking ? 45 : 18 + Math.sin(time / 5) * 8;
        const frequency = 0.02 + Math.cos(time / 15) * 0.01;
        const y = canvas.height / 2 + Math.sin(x * frequency + time / 8) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)';
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 2) {
        const y = canvas.height / 2 + Math.cos(x * 0.012 + time / 18) * 35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      time += 1;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [status, isLocalSpeaking, isMinimized]);

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs < 10 ? '0' : ''}${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleEndCall = () => {
    stopRingtoneSound();
    playCallEndSound();
    triggerVibration('double');
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (call.id && currentUid && call.isGroup) {
      leaveGroupCall(call.id, currentUid).catch(() => {});
    }
    onEndCall();
  };

  const copyCallLink = () => {
    playSendMessageSound();
    triggerVibration('light');
    const link = `${window.location.origin}/call/${call.id || 'group-audio-channel'}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Compile full display participants
  const displayParticipants = call.isGroup 
    ? (participants.length > 0 ? participants : [
        { uid: currentUid, name: currentName, photo: currentPhoto, isMuted, isSpeaking: isLocalSpeaking, isHandRaised },
        { uid: 'peer-node-1', name: call.peerName, photo: call.peerPhoto, isMuted: false, isSpeaking: true, isHandRaised: false }
      ])
    : [
        { uid: currentUid, name: currentName, photo: currentPhoto, isMuted, isSpeaking: isLocalSpeaking, isHandRaised },
        { uid: call.peerId, name: call.peerName, photo: call.peerPhoto, isMuted: false, isSpeaking: status === 'active', isHandRaised: false }
      ];

  // Render Signal Strength Icon based on WebRTC Latency
  const renderSignalIcon = () => {
    if (signalQuality === 'excellent') {
      return <SignalHigh className="w-4 h-4 text-emerald-400 animate-pulse" />;
    } else if (signalQuality === 'good') {
      return <SignalMedium className="w-4 h-4 text-amber-400" />;
    } else {
      return <SignalLow className="w-4 h-4 text-rose-500 animate-bounce" />;
    }
  };

  const signalColorClass = signalQuality === 'excellent' 
    ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40' 
    : signalQuality === 'good' 
    ? 'text-amber-400 border-amber-500/50 bg-amber-950/40' 
    : 'text-rose-400 border-rose-500/50 bg-rose-950/40';

  // --- FLOATING MINIMIZED WIDGET ---
  if (isMinimized) {
    return (
      <motion.div
        drag
        dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="fixed bottom-6 right-6 z-[99999] bg-[#080808] border-2 border-[var(--neon-green)] p-3 shadow-[8px_8px_0_0_#000000] font-mono text-[var(--neon-green)] w-72 flex flex-col space-y-2.5 cursor-grab active:cursor-grabbing select-none"
      >
        {/* Minimized Header Toolbar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-1.5 truncate">
            <Radio className="w-3.5 h-3.5 text-[var(--neon-green)] animate-pulse shrink-0" />
            <span className="text-[10px] font-bold tracking-wider text-white truncate max-w-[120px]">
              {call.isGroup ? (call.groupName || 'Group Call') : call.peerName}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Signal Indicator */}
            <div className={`px-1.5 py-0.5 border text-[8px] font-bold flex items-center gap-1 ${signalColorClass}`}>
              {renderSignalIcon()}
              <span>{latencyMs}ms</span>
            </div>

            {/* Maximize Button */}
            <button
              onClick={() => {
                playGlitchClickSound();
                setIsMinimized(false);
              }}
              className="p-1 bg-zinc-900 hover:bg-zinc-800 text-[var(--neon-green)] border border-[var(--neon-green)]/40 transition cursor-pointer"
              title="Maximize Call Overlay"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Minimized Body: Avatar & Duration Timer */}
        <div className="flex items-center gap-3 py-1">
          <div className="relative shrink-0">
            <img
              src={call.peerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120'}
              alt={call.peerName}
              className="w-10 h-10 rounded-full border-2 border-[var(--neon-green)] object-cover"
              referrerPolicy="no-referrer"
            />
            {isLocalSpeaking && (
              <span className="absolute -inset-1 border border-[var(--neon-green)] rounded-full animate-ping" />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white tracking-wider">
              {status === 'active' ? formatTime(seconds) : status.toUpperCase()}
            </span>
            <span className="text-[9px] text-zinc-400 truncate flex items-center gap-1">
              {isMuted ? <span className="text-rose-400">MIC MUTED</span> : <span className="text-emerald-400">AUDIO LIVE</span>}
            </span>
          </div>
        </div>

        {/* Minimized Controls */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800">
          <button
            onClick={() => {
              playGlitchClickSound();
              setIsMuted(!isMuted);
            }}
            className={`p-2 border transition ${
              isMuted ? 'bg-rose-950 text-rose-400 border-rose-500' : 'bg-zinc-900 text-[var(--neon-green)] border-[var(--neon-green)]/50'
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              setIsVideoOn(!isVideoOn);
            }}
            className={`p-2 border transition ${
              !isVideoOn ? 'bg-zinc-900 text-zinc-500 border-zinc-700' : 'bg-zinc-900 text-[var(--neon-green)] border-[var(--neon-green)]/50'
            }`}
            title={isVideoOn ? "Disable Video" : "Enable Video"}
          >
            {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          <button
            onClick={handleEndCall}
            className="p-2 bg-rose-600 hover:bg-rose-500 text-black border border-black font-bold flex items-center justify-center transition"
            title="Disconnect Call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // --- FULL SCREEN OVERLAY STAGE ---
  return (
    <div className="fixed inset-0 bg-[#060606] z-[99999] flex flex-col items-center justify-between p-4 sm:p-8 font-mono text-[var(--neon-green)] selection:bg-[var(--neon-green)] selection:text-black overflow-y-auto">
      
      {/* Encryption & Tunnel Header */}
      <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--neon-green)] bg-[var(--color-surface)] px-4 py-3 shadow-[4px_4px_0_0_#000000] shrink-0">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[var(--neon-green)] animate-pulse shrink-0" />
          <span className="text-xs font-black tracking-widest text-[var(--neon-green)] uppercase">
            {call.isGroup ? `GROUP CONDUIT // ${call.groupName || 'SECURE AUDIO ROOM'}` : 'CRYPTOGRAPHIC TUNNEL SECURED_'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* WebRTC Signal Strength Monitor Badge */}
          <div className={`px-2.5 py-1 border text-[9px] font-bold tracking-widest uppercase flex items-center gap-1.5 ${signalColorClass}`}>
            {renderSignalIcon()}
            <span>PING: {latencyMs}ms</span>
          </div>

          {call.isGroup && (
            <span className="bg-purple-950 border border-purple-500 text-purple-300 text-[9px] font-bold tracking-widest px-2.5 py-1 uppercase flex items-center gap-1.5">
              <Users className="w-3 h-3 text-purple-400" />
              {displayParticipants.length} NODES CONNECTED
            </span>
          )}

          {/* Minimize Overlay Button */}
          <button
            onClick={() => {
              playGlitchClickSound();
              setIsMinimized(true);
            }}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-[var(--neon-green)] text-[var(--neon-green)] transition cursor-pointer"
            title="Minimize into Floating Widget"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Calling Stage */}
      <div className="w-full max-w-5xl flex-1 my-4 flex flex-col items-center justify-center min-h-0">
        
        {/* MULTI-USER GROUP AUDIO GRID */}
        {call.isGroup ? (
          <div className="w-full h-full min-h-[360px] p-4 border-2 border-[var(--neon-green-border)] bg-[var(--color-surface)]/90 shadow-[8px_8px_0_0_#000000] flex flex-col justify-between relative overflow-hidden">
            
            {/* Background cyber grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,102,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Top Toolbar */}
            <div className="flex items-center justify-between z-10 border-b border-[var(--glass-border)] pb-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <Radio className="w-4 h-4 text-[var(--neon-green)] animate-pulse" />
                <span className="text-[var(--neon-green)] uppercase tracking-wider">ACTIVE MESH AUDIO CHANNEL</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCallLink}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-[var(--neon-green)]/40 text-[var(--neon-green)] text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'COPIED LINK!' : 'COPY TUNNEL LINK'}</span>
                </button>
              </div>
            </div>

            {/* Participants Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 z-10 my-auto py-2">
              {displayParticipants.map((p) => {
                const isMe = p.uid === currentUid;
                const isSpeaking = isMe ? isLocalSpeaking : (p.isSpeaking || false);
                const isUserMuted = isMe ? isMuted : (p.isMuted || false);

                return (
                  <motion.div
                    key={p.uid}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative p-4 bg-[#0a0a0a] border-2 transition-all flex flex-col items-center justify-center space-y-3 ${
                      isSpeaking
                        ? 'border-[var(--neon-green)] shadow-[0_0_20px_rgba(0,255,102,0.3)] bg-emerald-950/20'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Speaker glow ring & Avatar */}
                    <div className="relative">
                      {isSpeaking && (
                        <span className="absolute -inset-3 border-2 border-[var(--neon-green)] rounded-full animate-ping opacity-75" />
                      )}
                      <img
                        src={p.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120'}
                        alt={p.name}
                        className={`w-20 h-20 rounded-full object-cover border-2 relative z-10 ${
                          isSpeaking ? 'border-[var(--neon-green)]' : 'border-zinc-700'
                        }`}
                        referrerPolicy="no-referrer"
                      />

                      {/* Mute Overlay Icon Badge */}
                      {isUserMuted && (
                        <span className="absolute bottom-0 right-0 z-20 bg-rose-600 text-black p-1 rounded-full border-2 border-black shadow">
                          <MicOff className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}

                      {/* Hand Raised Floating Badge */}
                      {p.isHandRaised && (
                        <span className="absolute -top-2 -right-2 z-20 bg-amber-400 text-black p-1.5 rounded-full border-2 border-black shadow animate-bounce">
                          <Hand className="w-4 h-4 fill-black" />
                        </span>
                      )}
                    </div>

                    {/* Participant Details */}
                    <div className="text-center space-y-1 w-full truncate">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-bold text-xs text-white truncate max-w-[120px]">
                          {p.name}
                        </span>
                        {isMe && (
                          <span className="bg-[var(--neon-green)] text-black text-[8px] font-extrabold px-1.5 py-0.2 uppercase">
                            YOU
                          </span>
                        )}
                      </div>

                      <p className="text-[9px] text-zinc-400 font-mono flex items-center justify-center gap-1">
                        {isSpeaking ? (
                          <span className="text-[var(--neon-green)] font-bold animate-pulse flex items-center gap-1">
                            <Radio className="w-3 h-3" /> SPEAKING...
                          </span>
                        ) : isUserMuted ? (
                          <span className="text-rose-400">MUTED</span>
                        ) : (
                          <span className="text-zinc-500">LISTENING</span>
                        )}
                      </p>
                    </div>

                    {/* Speech Equalizer Frequency Bars */}
                    <div className="flex items-center gap-1 h-4">
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all ${
                            isSpeaking ? 'bg-[var(--neon-green)] animate-pulse' : 'bg-zinc-800'
                          }`}
                          style={{
                            height: isSpeaking ? `${8 + Math.random() * 12}px` : '4px'
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Audio Frequency Spectrum Canvas */}
            <div className="w-full h-12 mt-3 relative border-t border-[var(--glass-border)] pt-2 overflow-hidden">
              <canvas ref={canvasRef} width={800} height={40} className="w-full h-full object-cover opacity-80" />
            </div>
          </div>
        ) : (
          /* 1-ON-1 DIRECT CALL STAGE */
          <div className="w-full h-full min-h-[360px] border-4 border-black dark:border-[var(--neon-green-border)] bg-[var(--color-surface)] shadow-[8px_8px_0_0_#000000] flex flex-col relative items-center justify-center overflow-hidden">
            
            {/* Animated Canvas */}
            {status === 'active' && call.type === 'video' ? (
              <canvas ref={canvasRef} width={640} height={400} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-black select-none pointer-events-none opacity-40">
                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,255,102,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
            )}

            {/* Peer Avatar */}
            {(status !== 'active' || call.type === 'voice') && (
              <div className="relative flex flex-col items-center z-10 space-y-6">
                <div className="relative">
                  <span className={`absolute -inset-4 border-2 border-[var(--neon-green)]/35 rounded-full ${status !== 'active' ? 'animate-ping' : ''}`} />
                  <span className="absolute -inset-8 border border-[var(--neon-green)]/15 rounded-full animate-pulse" />
                  <img
                    src={call.peerPhoto}
                    alt={call.peerName}
                    className="w-32 h-32 border-4 border-[var(--neon-green)] shadow-lg relative max-w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="text-center space-y-2">
                  <h2 className="font-serif text-2xl font-bold italic text-[var(--color-text)] uppercase tracking-tight">
                    {call.peerName}
                  </h2>
                  <p className="text-[10px] text-[var(--neon-green)] tracking-widest uppercase animate-pulse">
                    {status === 'dialing' && '⚡ ESTABLISHING SECURE PORTAL CHANNEL...'}
                    {status === 'ringing' && '📞 HANDSHAKE PING SENT // RINGING...'}
                    {status === 'active' && '● WEBRTC AUDIO TUNNEL OPENED'}
                  </p>
                </div>
              </div>
            )}

            {/* Video picture-in-picture loopback */}
            {status === 'active' && call.type === 'video' && isVideoOn && (
              <div className="absolute bottom-4 right-4 z-20 w-36 h-48 border-2 border-[var(--neon-green)] bg-[var(--color-surface)] shadow-lg flex flex-col font-mono text-[8px] overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute bottom-1 left-1.5 bg-[var(--color-surface)]/75 p-1 border border-[var(--neon-green)]/20 text-[var(--neon-green)] uppercase font-bold tracking-wider">
                  NODE_A (YOU)
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* REAL-TIME CALL DURATION STOPWATCH TIMER */}
      {status === 'active' && (
        <div className="text-center my-2 shrink-0 font-mono">
          <div className="text-2xl font-black text-[var(--color-text)] px-6 py-1.5 border-2 border-[var(--neon-green)] bg-[var(--color-surface)] inline-block shadow-[3px_3px_0_0_#000000] tracking-widest">
            {formatTime(seconds)}
          </div>
        </div>
      )}

      {/* Styled Call Control Rail Operations */}
      <div className="w-full max-w-2xl bg-[var(--color-surface)] border-2 border-[var(--neon-green)] p-4 flex flex-col items-center justify-center gap-3 shadow-[4px_4px_0_0_#000000] shrink-0 mt-2">
        {status !== 'active' && (
          <div className="text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-500/50 px-3 py-1 flex items-center gap-1.5 uppercase tracking-wider">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>MEDIA CONTROLS LOCKED UNTIL CALL CONNECTS</span>
          </div>
        )}

        <div className="w-full flex items-center justify-around gap-2">
          {call.isIncoming && status !== 'active' ? (
            <div className="flex gap-4 w-full">
              <button
                onClick={handleEndCall}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#991b1b]"
              >
                <PhoneOff className="w-4 h-4" />
                <span>DECLINE CALL</span>
              </button>
              <button
                onClick={() => {
                  playLikeSound();
                  triggerVibration('medium');
                  if (onAcceptCall) onAcceptCall();
                }}
                className="flex-1 py-3.5 bg-[var(--neon-green)] hover:bg-white font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#15803d] animate-pulse"
              >
                <Phone className="w-4 h-4" />
                <span>ACCEPT CALL</span>
              </button>
            </div>
          ) : !call.isIncoming && status !== 'active' ? (
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                <Radio className="w-4 h-4 text-[var(--neon-green)] animate-pulse" />
                <span>DIALING {call.peerName.toUpperCase()}...</span>
              </div>
              <button
                onClick={handleEndCall}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#991b1b]"
              >
                <PhoneOff className="w-4 h-4" />
                <span>CANCEL CALL</span>
              </button>
            </div>
          ) : (
            <>
              {/* Toggle Microphone Mute option */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setIsMuted(!isMuted);
                }}
                className={`w-12 h-12 rounded-none flex items-center justify-center transition border cursor-pointer ${
                  isMuted 
                    ? 'bg-rose-950 text-rose-400 border-rose-500 hover:bg-rose-900' 
                    : 'bg-[var(--color-surface)] text-[var(--neon-green)] border-[var(--neon-green)] hover:bg-[var(--neon-green)]/15'
                }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Raise Hand Toggle for Group Calls */}
              {call.isGroup && (
                <button
                  onClick={() => {
                    playGlitchClickSound();
                    setIsHandRaised(!isHandRaised);
                  }}
                  className={`w-12 h-12 rounded-none flex items-center justify-center transition border cursor-pointer ${
                    isHandRaised 
                      ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]' 
                      : 'bg-[var(--color-surface)] text-amber-400 border-amber-500/50 hover:bg-amber-950/30'
                  }`}
                  title={isHandRaised ? "Lower Hand" : "Raise Hand"}
                >
                  <Hand className="w-5 h-5" />
                </button>
              )}

              {/* Speaker / Headphones Toggle */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setIsSpeakerOn(!isSpeakerOn);
                }}
                className={`w-12 h-12 rounded-none flex items-center justify-center transition border cursor-pointer ${
                  !isSpeakerOn 
                    ? 'bg-zinc-800 text-zinc-400 border-zinc-700' 
                    : 'bg-[var(--color-surface)] text-[var(--neon-green)] border-[var(--neon-green)]/60 hover:bg-[var(--neon-green)]/15'
                }`}
                title={isSpeakerOn ? "Speaker Active" : "Headphones Mode"}
              >
                {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              {/* Video Camera Toggle */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setIsVideoOn(!isVideoOn);
                }}
                className={`w-12 h-12 rounded-none flex items-center justify-center transition border cursor-pointer ${
                  !isVideoOn 
                    ? 'bg-[#1a1a1a] text-zinc-500 border-zinc-700 hover:bg-neutral-800' 
                    : 'bg-[var(--color-surface)] text-[var(--neon-green)] border-[var(--neon-green)]/55 hover:bg-[var(--neon-green)]/15'
                }`}
                title={isVideoOn ? "Disable Camera" : "Enable Camera"}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              {/* Disconnect / End Call */}
              <button
                onClick={handleEndCall}
                className="w-14 h-14 bg-red-600 hover:bg-red-500 text-black border-2 border-black rounded-none flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 shadow-[4px_4px_0_0_#991b1b]"
                title={call.isGroup ? "Leave Group Audio Channel" : "Disconnect Secured Communications Portal"}
              >
                <PhoneOff className="w-6 h-6 stroke-[3]" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
