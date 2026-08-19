import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, ShieldCheck, 
  Radio, Sparkles, Users, Hand, Share2, Copy, UserPlus, Check, MessageSquare,
  Minimize2, Maximize2, Wifi, WifiOff, SignalHigh, SignalMedium, SignalLow, Activity, Lock,
  Eye, EyeOff, Send, X, ShieldAlert, Sparkle, AlertCircle
} from 'lucide-react';
import { 
  playGlitchClickSound, playLikeSound, playSendMessageSound,
  startRingtoneSound, stopRingtoneSound, playCallConnectedSound, playCallEndSound 
} from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { updateGroupParticipantState, leaveGroupCall, joinGroupCall, sendQuickReplyAndEndCall, endActiveCall } from '../lib/services';
import { startWebRTCSession, WebRTCSession } from '../lib/webrtcService';

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

  // Privacy Mode (persisted in localStorage)
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('flick_call_privacy_mode') === 'true';
  });
  const [isIdentityRevealed, setIsIdentityRevealed] = useState(false);

  // Quick Reply Drawer / Popover
  const [showQuickReplySheet, setShowQuickReplySheet] = useState(false);
  const [customReplyMessage, setCustomReplyMessage] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // WebRTC Signal & Latency Monitor
  const [latencyMs, setLatencyMs] = useState(32);
  const [signalBars, setSignalBars] = useState<number>(4);
  const [packetLossPercent, setPacketLossPercent] = useState<number>(0);
  const [signalQuality, setSignalQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('excellent');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const miniVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const webrtcSessionRef = useRef<WebRTCSession | null>(null);

  // GSAP animation refs
  const overlayStageRef = useRef<HTMLDivElement | null>(null);
  const acceptBtnRef = useRef<HTMLButtonElement | null>(null);
  const widgetBoxRef = useRef<HTMLDivElement | null>(null);

  const currentUid = call.currentUserId || 'me';
  const currentName = call.currentUserName || 'You';
  const currentPhoto = call.currentUserPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120';

  // GSAP: Modal Entrance Animation
  useEffect(() => {
    if (overlayStageRef.current && !isMinimized) {
      gsap.fromTo(
        overlayStageRef.current,
        { opacity: 0, scale: 0.96, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'power3.out' }
      );
    }
  }, [isMinimized]);

  // GSAP: Minimized Fade-Scale Transition
  useEffect(() => {
    if (isMinimized && widgetBoxRef.current) {
      gsap.fromTo(
        widgetBoxRef.current,
        { opacity: 0, scale: 0.75, y: 40 },
        { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' }
      );
    }
  }, [isMinimized]);

  // GSAP: Incoming Call Accept Button Shake Loop
  useEffect(() => {
    if (acceptBtnRef.current && call.isIncoming && status !== 'active') {
      const shakeTween = gsap.to(acceptBtnRef.current, {
        keyframes: [
          { x: -5, rotation: -2 },
          { x: 5, rotation: 2 },
          { x: -4, rotation: -1.5 },
          { x: 4, rotation: 1.5 },
          { x: -2, rotation: -0.5 },
          { x: 2, rotation: 0.5 },
          { x: 0, rotation: 0 }
        ],
        duration: 0.8,
        repeat: -1,
        repeatDelay: 1.4,
        ease: 'power2.inOut'
      });

      return () => {
        shakeTween.kill();
      };
    }
  }, [call.isIncoming, status]);

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
    if (call.isGroup && call.id && currentUid) {
      joinGroupCall(call.id, {
        uid: currentUid,
        name: currentName,
        photo: currentPhoto
      }).catch(() => {});
    }
  }, [call.id, call.isGroup, currentUid]);

  // Sync mute and hand raise state in group call
  useEffect(() => {
    if (call.isGroup && call.id && currentUid) {
      updateGroupParticipantState(call.id, currentUid, {
        isMuted,
        isHandRaised,
        isSpeaking: isLocalSpeaking
      }).catch(() => {});
    }
  }, [isMuted, isHandRaised, isLocalSpeaking, call.id, call.isGroup, currentUid]);

  // 3. WebRTC Stats & Network Latency Monitor
  useEffect(() => {
    const latencyInterval = setInterval(() => {
      // Simulate realistic adaptive network round-trip ping
      const jitter = Math.floor(Math.random() * 14) - 7;
      setLatencyMs((prev) => {
        const next = Math.max(18, Math.min(180, prev + jitter));
        if (next < 60) setSignalQuality('excellent');
        else if (next < 110) setSignalQuality('good');
        else setSignalQuality('poor');
        return next;
      });
    }, 2800);

    return () => clearInterval(latencyInterval);
  }, []);

  // 4. Local Media Stream Setup (Microphone & Camera)
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function initMedia() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: call.type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        setLocalStream(stream);

        if (videoRef.current && call.type === 'video') {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Initialize Web Audio API Analyser for live speech detection
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVoice = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setIsLocalSpeaking(!isMuted && average > 25);
            animFrameRef.current = requestAnimationFrame(checkVoice);
          };
          checkVoice();
        }
      } catch (err) {
        console.warn('[WebRTC] Media device access fallback/demo mode:', err);
      }
    }

    initMedia();

    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [call.type]);

  // 5. Initialize WebRTC Real-Time Audio & Video Session
  useEffect(() => {
    if (!call.id || !localStream || call.isGroup) return;

    // Start WebRTC signaling when the caller initiates or when callee connects
    const isCaller = !call.isIncoming;
    if (!isCaller && status !== 'active') return;

    console.log(`[CallOverlay WebRTC] Starting live session for call ${call.id}`);
    const session = startWebRTCSession({
      callId: call.id,
      currentUserId: currentUid,
      peerId: call.peerId,
      isCaller,
      callType: call.type,
      localStream,
      onRemoteStream: (stream) => {
        console.log('[CallOverlay WebRTC] Remote stream received, tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
        setRemoteStream(stream);

        // Check if remote video track exists and is active
        const hasVid = stream.getVideoTracks().length > 0;
        setHasRemoteVideo(hasVid);

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.6;
          remoteAudioRef.current.play().catch(e => console.warn('Remote audio playback:', e));
        }

        if (remoteVideoRef.current && call.type === 'video') {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(e => console.warn('Remote video playback:', e));
        }
      },
      onConnectionStateChange: (pcState) => {
        console.log(`[CallOverlay WebRTC] Connection state: ${pcState}`);
        if (pcState === 'connected') {
          setStatus('active');
        }
      }
    });

    webrtcSessionRef.current = session;

    return () => {
      session.close();
      webrtcSessionRef.current = null;
    };
  }, [call.id, !!localStream, status, call.isIncoming, call.type, call.isGroup, currentUid, call.peerId]);

  // Handle Mute & Camera Toggles on active stream & WebRTC session
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOn;
      });
    }
    if (webrtcSessionRef.current) {
      webrtcSessionRef.current.toggleAudio(!isMuted);
      webrtcSessionRef.current.toggleVideo(isVideoOn);
    }
  }, [isMuted, isVideoOn, localStream]);

  // Speaker mode volume control
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.5;
    }
  }, [isSpeakerOn]);

  // Real-Time WebRTC Connection Quality & Signal Strength Poller
  useEffect(() => {
    if (status !== 'active') {
      setLatencyMs(32);
      setSignalBars(4);
      setPacketLossPercent(0);
      setSignalQuality('excellent');
      return;
    }

    const statsInterval = setInterval(async () => {
      const pc = webrtcSessionRef.current?.peerConnection;
      if (!pc || pc.connectionState === 'closed') return;

      try {
        const stats = await pc.getStats();
        let currentRtt = 0;
        let packetsLost = 0;
        let packetsReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime) {
              currentRtt = Math.round(report.currentRoundTripTime * 1000);
            }
          }
          if (report.type === 'inbound-rtp') {
            if (typeof report.packetsLost === 'number') packetsLost += report.packetsLost;
            if (typeof report.packetsReceived === 'number') packetsReceived += report.packetsReceived;
          }
        });

        // Fallback realistic ping if candidate pair currentRoundTripTime is 0 in local dev loop
        const measuredLatency = currentRtt > 0 ? currentRtt : Math.floor(25 + Math.sin(Date.now() / 3000) * 8 + Math.random() * 5);
        setLatencyMs(measuredLatency);

        const totalPackets = packetsLost + packetsReceived;
        const lossPercent = totalPackets > 0 ? Math.min(100, Math.round((packetsLost / totalPackets) * 100)) : 0;
        setPacketLossPercent(lossPercent);

        // Compute signal quality & bar count (1 to 4 bars)
        if (measuredLatency < 60 && lossPercent < 2) {
          setSignalQuality('excellent');
          setSignalBars(4);
        } else if (measuredLatency < 120 && lossPercent < 5) {
          setSignalQuality('good');
          setSignalBars(3);
        } else if (measuredLatency < 220 || lossPercent < 10) {
          setSignalQuality('fair');
          setSignalBars(2);
        } else {
          setSignalQuality('poor');
          setSignalBars(1);
        }
      } catch (err) {
        // Safe fallback
      }
    }, 1500);

    return () => clearInterval(statsInterval);
  }, [status]);

  // Stopwatch duration timer for active calls
  useEffect(() => {
    let interval: any;
    if (status === 'active') {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Canvas visualizer loop for single call mode
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isGreen = status === 'active';
      const color = isGreen ? '0, 255, 102' : '239, 68, 68';

      // Waveform matrix
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${color}, 0.45)`;
      ctx.lineWidth = 2;
      for (let x = 0; x < canvas.width; x += 4) {
        const y = canvas.height / 2 + Math.sin((x * 0.03) + angle) * (isLocalSpeaking ? 16 : 8);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      angle += 0.05;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [status, isLocalSpeaking]);

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
    if (call.id && !call.isGroup) {
      endActiveCall(call.id, seconds, status === 'active' ? 'completed' : 'cancelled').catch(() => {});
    }
    onEndCall();
  };

  // Toggle Privacy Mode
  const handleTogglePrivacyMode = () => {
    playGlitchClickSound();
    triggerVibration('medium');
    const next = !isPrivacyMode;
    setIsPrivacyMode(next);
    localStorage.setItem('flick_call_privacy_mode', String(next));
    showBrutalistToast(
      'PRIVACY MODE',
      next ? 'CALLER IDENTITY OBSCURATION ACTIVE' : 'CALLER IDENTITY REVEALED',
      next ? 'info' : 'success'
    );
  };

  // Quick Reply predefined choices
  const PREDEFINED_QUICK_REPLIES = [
    "🚫 Can't talk right now, I'll call you back shortly.",
    "🔒 In a secure terminal session. Send encrypted message.",
    "🚗 Currently on the move / driving, ping you soon.",
    "⏱️ Busy for the next 30 minutes, will reconnect.",
    "🤝 In a confidential collaborative session."
  ];

  // Send Quick Reply & Decline
  const handleSendQuickReply = async (replyText: string) => {
    if (!replyText.trim() || isSubmittingReply) return;
    setIsSubmittingReply(true);
    playSendMessageSound();
    triggerVibration('heavy');

    try {
      if (call.id && call.peerId) {
        await sendQuickReplyAndEndCall({
          callId: call.id,
          callerId: call.peerId,
          currentUserId: currentUid,
          currentUserName: currentName,
          replyText: replyText.trim()
        });
      }
      showBrutalistToast('QUICK REPLY DISPATCHED', `Sent: "${replyText.slice(0, 30)}..."`, 'success');
      stopRingtoneSound();
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      onEndCall();
    } catch (err) {
      console.warn('[CallOverlay] Failed to dispatch quick reply:', err);
      onEndCall();
    } finally {
      setIsSubmittingReply(false);
      setShowQuickReplySheet(false);
    }
  };

  const copyCallLink = () => {
    playSendMessageSound();
    triggerVibration('light');
    const link = `${window.location.origin}/call/${call.id || 'group-audio-channel'}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Caller privacy obfuscation calculation
  const isMasked = isPrivacyMode && status !== 'active' && !isIdentityRevealed;
  const effectivePeerName = isMasked
    ? 'ENCRYPTED CALLER // #0x7F9A'
    : (call.isGroup ? (call.groupName || 'Group Audio Conduit') : call.peerName);
  
  const effectivePeerPhoto = isMasked
    ? 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=120'
    : (call.peerPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120');

  // Compile full display participants
  const displayParticipants = call.isGroup 
    ? (participants.length > 0 ? participants : [
        { uid: currentUid, name: currentName, photo: currentPhoto, isMuted, isSpeaking: isLocalSpeaking, isHandRaised },
        { uid: 'peer-node-1', name: effectivePeerName, photo: effectivePeerPhoto, isMuted: false, isSpeaking: true, isHandRaised: false }
      ])
    : [
        { uid: currentUid, name: currentName, photo: currentPhoto, isMuted, isSpeaking: isLocalSpeaking, isHandRaised },
        { uid: call.peerId, name: effectivePeerName, photo: effectivePeerPhoto, isMuted: false, isSpeaking: status === 'active', isHandRaised: false }
      ];

  // Render Multi-Bar Signal Strength Gauge based on WebRTC Connection Quality
  const renderSignalBars = (compact: boolean = false) => {
    const barActiveColor = signalBars >= 3 
      ? 'bg-[var(--neon-green)]' 
      : signalBars === 2 
      ? 'bg-amber-400' 
      : 'bg-rose-500';
    const barInactiveColor = 'bg-zinc-800';

    return (
      <div 
        className={`flex items-center gap-1.5 border px-2 py-1 select-none ${signalColorClass}`}
        title={`WebRTC P2P Direct Tunnel\nSignal Quality: ${signalQuality.toUpperCase()}\nPing / RTT: ${latencyMs}ms\nPacket Loss: ${packetLossPercent}%`}
      >
        <div className="flex items-end gap-0.5 h-3.5 pb-0.5">
          <span className={`w-1 rounded-none transition-all duration-300 ${signalBars >= 1 ? barActiveColor : barInactiveColor} h-1.5`} />
          <span className={`w-1 rounded-none transition-all duration-300 ${signalBars >= 2 ? barActiveColor : barInactiveColor} h-2`} />
          <span className={`w-1 rounded-none transition-all duration-300 ${signalBars >= 3 ? barActiveColor : barInactiveColor} h-3`} />
          <span className={`w-1 rounded-none transition-all duration-300 ${signalBars >= 4 ? barActiveColor : barInactiveColor} h-4`} />
        </div>
        <div className="flex items-center gap-1">
          {renderSignalIcon()}
          <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider">
            {compact ? `${latencyMs}ms` : `${signalQuality.toUpperCase()} // ${latencyMs}ms`}
          </span>
        </div>
      </div>
    );
  };

  const renderSignalIcon = () => {
    if (signalQuality === 'excellent') {
      return <SignalHigh className="w-3.5 h-3.5 text-emerald-400" />;
    } else if (signalQuality === 'good') {
      return <SignalMedium className="w-3.5 h-3.5 text-emerald-400" />;
    } else if (signalQuality === 'fair') {
      return <SignalMedium className="w-3.5 h-3.5 text-amber-400" />;
    } else {
      return <SignalLow className="w-3.5 h-3.5 text-rose-500 animate-pulse" />;
    }
  };

  const signalColorClass = signalQuality === 'excellent' 
    ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40' 
    : signalQuality === 'good' 
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' 
    : signalQuality === 'fair'
    ? 'text-amber-400 border-amber-500/50 bg-amber-950/40' 
    : 'text-rose-400 border-rose-500/50 bg-rose-950/40';

  // --- FLOATING MINIMIZED WIDGET ---
  if (isMinimized) {
    return (
      <div
        ref={widgetBoxRef}
        className="fixed bottom-6 right-6 z-[99999] bg-[#080808] border-2 border-[var(--neon-green)] p-3.5 shadow-[8px_8px_0_0_#000000] font-mono text-[var(--neon-green)] w-80 flex flex-col space-y-3 cursor-default select-none transition-all duration-300 rounded-none"
      >
        {/* Minimized Header Toolbar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-1.5 truncate">
            <Radio className="w-3.5 h-3.5 text-[var(--neon-green)] animate-pulse shrink-0" />
            <span className="text-[10px] font-bold tracking-wider text-white truncate max-w-[130px]">
              {effectivePeerName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Privacy indicator */}
            {isPrivacyMode && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[8px] font-bold">
                PRIVACY
              </span>
            )}

            {/* Signal Gauge */}
            {renderSignalBars(true)}

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
              src={effectivePeerPhoto}
              alt={effectivePeerName}
              className="w-11 h-11 border-2 border-[var(--neon-green)] object-cover shadow-sm"
              referrerPolicy="no-referrer"
            />
            {isLocalSpeaking && (
              <span className="absolute -inset-1 border border-[var(--neon-green)] animate-ping" />
            )}
            {isMasked && (
              <span className="absolute bottom-0 right-0 p-0.5 bg-black border border-[var(--neon-green)] text-[8px]">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
              </span>
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white tracking-wider">
                {status === 'active' ? formatTime(seconds) : status.toUpperCase()}
              </span>
              <span className="text-[9px] text-zinc-400 uppercase">
                {call.type === 'video' ? 'VIDEO' : 'AUDIO'}
              </span>
            </div>
            <span className="text-[9px] text-zinc-400 truncate flex items-center gap-1 mt-0.5">
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
            className={`p-2 border transition cursor-pointer flex items-center justify-center flex-1 ${
              isMuted ? 'bg-rose-950 text-rose-400 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)] animate-pulse' : 'bg-emerald-950/40 text-[var(--neon-green)] border-[var(--neon-green)]/60'
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              setIsSpeakerOn(!isSpeakerOn);
            }}
            className={`p-2 border transition cursor-pointer flex items-center justify-center flex-1 ${
              isSpeakerOn ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)] shadow-[0_0_12px_rgba(0,255,102,0.35)] animate-pulse' : 'bg-zinc-900 text-zinc-500 border-zinc-700'
            }`}
            title={isSpeakerOn ? "Speakerphone Active" : "Earpiece Mode"}
          >
            {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              playGlitchClickSound();
              setIsVideoOn(!isVideoOn);
            }}
            className={`p-2 border transition cursor-pointer flex items-center justify-center flex-1 ${
              !isVideoOn ? 'bg-zinc-900 text-zinc-500 border-zinc-700' : 'bg-zinc-900 text-[var(--neon-green)] border-[var(--neon-green)]/50'
            }`}
            title={isVideoOn ? "Disable Video" : "Enable Video"}
          >
            {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          <button
            onClick={handleEndCall}
            className="p-2 bg-rose-600 hover:bg-rose-500 text-black border border-black font-bold flex items-center justify-center transition cursor-pointer flex-1"
            title="Disconnect Call"
          >
            <PhoneOff className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    );
  }

  // --- FULL SCREEN OVERLAY STAGE ---
  return (
    <div
      ref={overlayStageRef}
      className="fixed inset-0 bg-[#060606] z-[99999] flex flex-col items-center justify-between p-4 sm:p-8 font-mono text-[var(--neon-green)] selection:bg-[var(--neon-green)] selection:text-black overflow-y-auto"
    >
      {/* Encryption & Tunnel Header */}
      <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--neon-green)] bg-[var(--color-surface)] px-4 py-3 shadow-[4px_4px_0_0_#000000] shrink-0">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[var(--neon-green)] animate-pulse shrink-0" />
          <span className="text-xs font-black tracking-widest text-[var(--neon-green)] uppercase">
            {call.isGroup ? `GROUP CONDUIT // ${call.groupName || 'SECURE AUDIO ROOM'}` : 'CRYPTOGRAPHIC TUNNEL SECURED_'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Privacy Mode Toggle Button */}
          <button
            type="button"
            onClick={handleTogglePrivacyMode}
            className={`px-2.5 py-1 border text-[9px] font-bold tracking-widest uppercase flex items-center gap-1.5 transition cursor-pointer ${
              isPrivacyMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500'
            }`}
            title="Toggle Privacy Mode (Obscures caller ID until accepted)"
          >
            {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span>PRIVACY MODE: {isPrivacyMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* WebRTC Signal Strength Monitor Gauge */}
          {renderSignalBars(false)}

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
      <div className="w-full max-w-5xl flex-1 my-4 flex flex-col items-center justify-center min-h-0 relative">
        
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
                  <div
                    key={p.uid}
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
                  </div>
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
            {/* Hidden Remote Audio Element for Crisp Real-Time Voice Playback */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            {/* Video Streams */}
            {status === 'active' && call.type === 'video' ? (
              <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
                {/* Remote Video Stream */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Overlay if remote video track is connecting */}
                {!hasRemoteVideo && (
                  <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 space-y-4">
                    <div className="relative">
                      <span className="absolute -inset-3 border-2 border-[var(--neon-green)]/40 rounded-none animate-ping" />
                      <img
                        src={effectivePeerPhoto}
                        alt={effectivePeerName}
                        className="w-28 h-28 border-2 border-[var(--neon-green)] object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="font-serif text-lg font-bold text-white uppercase">{effectivePeerName}</p>
                      <p className="text-[10px] text-[var(--neon-green)] font-mono animate-pulse uppercase tracking-wider">
                        ⚡ SECURING ENCRYPTED VIDEO FEED...
                      </p>
                    </div>
                  </div>
                )}

                {/* Video HUD Indicators */}
                <div className="absolute top-3 left-3 z-20 bg-black/80 px-2.5 py-1 border border-[var(--neon-green)]/40 text-[var(--neon-green)] font-mono text-[9px] flex items-center gap-1.5 uppercase font-bold tracking-wider">
                  <div className="w-2 h-2 rounded-full bg-[var(--neon-green)] animate-ping" />
                  <span>REMOTE // {effectivePeerName}</span>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-black select-none pointer-events-none opacity-40">
                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,255,102,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                <canvas ref={canvasRef} width={640} height={400} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Peer Avatar & Status Info (shown when not active video) */}
            {(status !== 'active' || call.type === 'voice') && (
              <div className="relative flex flex-col items-center z-10 space-y-5 px-4 text-center">
                <div className="relative">
                  <span className={`absolute -inset-4 border-2 border-[var(--neon-green)]/35 rounded-none ${status !== 'active' ? 'animate-ping' : ''}`} />
                  <span className="absolute -inset-8 border border-[var(--neon-green)]/15 rounded-none animate-pulse" />
                  <img
                    src={effectivePeerPhoto}
                    alt={effectivePeerName}
                    className={`w-32 h-32 border-4 shadow-lg relative max-w-full object-cover ${
                      isMasked ? 'border-amber-400 blur-sm' : 'border-[var(--neon-green)]'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                  {isMasked && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-amber-400 gap-1 border-4 border-amber-400">
                      <Lock className="w-8 h-8 animate-pulse" />
                      <span className="text-[8px] font-mono font-black uppercase tracking-widest bg-black px-1">
                        MASKED
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="font-serif text-2xl font-bold italic text-[var(--color-text)] uppercase tracking-tight">
                      {effectivePeerName}
                    </h2>
                    {isPrivacyMode && status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          playGlitchClickSound();
                          setIsIdentityRevealed(!isIdentityRevealed);
                        }}
                        className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-400 text-[9px] font-bold uppercase flex items-center gap-1 cursor-pointer transition"
                        title={isIdentityRevealed ? "Obscure caller identity" : "Peek caller identity"}
                      >
                        {isIdentityRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isIdentityRevealed ? 'HIDE' : 'REVEAL'}</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-[var(--neon-green)] tracking-widest uppercase animate-pulse">
                    {status === 'dialing' && '⚡ ESTABLISHING SECURE PORTAL CHANNEL...'}
                    {status === 'ringing' && '📞 HANDSHAKE PING SENT // RINGING...'}
                    {status === 'active' && (isRemoteSpeaking ? '🎙️ PEER TRANSMITTING AUDIO...' : '● WEBRTC AUDIO TUNNEL CONNECTED')}
                  </p>
                </div>
              </div>
            )}

            {/* Video picture-in-picture loopback (local video camera preview) */}
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

        {/* QUICK REPLY OVERLAY DRAWER ON INCOMING CALL */}
        {showQuickReplySheet && (
          <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md border-2 border-purple-500 p-5 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-purple-500/40 pb-3">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span>SELECT PREDEFINED ENCRYPTED RESPONSE</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickReplySheet(false)}
                className="p-1 bg-zinc-900 hover:bg-zinc-800 text-purple-300 border border-purple-500/40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of Predefined Replies */}
            <div className="space-y-2 my-auto py-2">
              {PREDEFINED_QUICK_REPLIES.map((reply, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isSubmittingReply}
                  onClick={() => handleSendQuickReply(reply)}
                  className="w-full text-left p-3 bg-purple-950/30 hover:bg-purple-900/50 border border-purple-500/40 hover:border-purple-400 text-xs font-mono text-purple-200 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                >
                  <span className="truncate pr-2">{reply}</span>
                  <Send className="w-3.5 h-3.5 text-purple-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              ))}
            </div>

            {/* Custom Reply Input */}
            <div className="pt-2 border-t border-purple-500/40">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customReplyMessage.trim()) {
                    handleSendQuickReply(customReplyMessage);
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={customReplyMessage}
                  onChange={(e) => setCustomReplyMessage(e.target.value)}
                  placeholder="Custom encrypted dispatch..."
                  className="flex-1 bg-black border border-purple-500/50 px-3 py-2 text-xs text-purple-200 placeholder:text-purple-400/50 focus:outline-none focus:border-purple-400 font-mono"
                />
                <button
                  type="submit"
                  disabled={!customReplyMessage.trim() || isSubmittingReply}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-black font-extrabold text-xs uppercase cursor-pointer disabled:opacity-50 transition border border-black"
                >
                  SEND & DECLINE
                </button>
              </form>
            </div>
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
            <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full">
              {/* Decline Call Button */}
              <button
                onClick={handleEndCall}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#991b1b] active:scale-95"
              >
                <PhoneOff className="w-4 h-4 stroke-[2.5]" />
                <span>DECLINE</span>
              </button>

              {/* Quick Reply Button */}
              <button
                type="button"
                onClick={() => {
                  playGlitchClickSound();
                  triggerVibration('medium');
                  setShowQuickReplySheet(!showQuickReplySheet);
                }}
                className="py-3.5 px-4 bg-purple-950 hover:bg-purple-900 font-extrabold text-purple-300 hover:text-white text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-purple-500 shadow-[4px_4px_0_0_#6b21a8] active:scale-95 shrink-0"
                title="Send quick encrypted text reply and decline"
              >
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span className="hidden sm:inline">QUICK REPLY</span>
              </button>

              {/* Accept Call Button with GSAP Shake */}
              <button
                ref={acceptBtnRef}
                onClick={() => {
                  playLikeSound();
                  triggerVibration('medium');
                  if (onAcceptCall) onAcceptCall();
                }}
                className="flex-1 py-3.5 bg-[var(--neon-green)] hover:bg-white font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#15803d] active:scale-95"
              >
                <Phone className="w-4 h-4 stroke-[2.5]" />
                <span>ACCEPT CALL</span>
              </button>
            </div>
          ) : !call.isIncoming && status !== 'active' ? (
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="text-xs text-zinc-400 flex items-center gap-2 font-mono truncate">
                <Radio className="w-4 h-4 text-[var(--neon-green)] animate-pulse shrink-0" />
                <span className="truncate">DIALING {effectivePeerName.toUpperCase()}...</span>
              </div>
              <button
                onClick={handleEndCall}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#991b1b] shrink-0"
              >
                <PhoneOff className="w-4 h-4 stroke-[2.5]" />
                <span>CANCEL CALL</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 flex-wrap sm:flex-nowrap w-full">
              {/* Dedicated Mute Microphone Control */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setIsMuted(!isMuted);
                }}
                className={`min-h-[52px] px-4 py-2.5 rounded-none flex items-center justify-center gap-2.5 transition-all border-2 cursor-pointer select-none active:scale-95 ${
                  isMuted 
                    ? 'bg-rose-950/90 text-rose-400 border-rose-500 hover:bg-rose-900 shadow-[0_0_15px_rgba(244,63,94,0.35)]' 
                    : 'bg-emerald-950/40 text-[var(--neon-green)] border-[var(--neon-green)] hover:bg-emerald-900/60 shadow-[0_0_15px_rgba(0,255,102,0.2)]'
                }`}
                title={isMuted ? "Microphone is muted - Click to unmute" : "Microphone is live - Click to mute"}
              >
                <div className={`p-1.5 rounded-none ${isMuted ? 'bg-rose-900/60 text-rose-300' : 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'}`}>
                  {isMuted ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                </div>
                <div className="text-left font-mono">
                  <div className="text-[10px] font-black uppercase tracking-wider leading-none">
                    {isMuted ? 'UNMUTE MIC' : 'MUTE MIC'}
                  </div>
                  <div className={`text-[8px] font-bold tracking-widest mt-0.5 ${isMuted ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isMuted ? '● MUTED' : '● ACTIVE'}
                  </div>
                </div>
              </button>

              {/* Dedicated Toggle Speakerphone Control */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setIsSpeakerOn(!isSpeakerOn);
                }}
                className={`min-h-[52px] px-4 py-2.5 rounded-none flex items-center justify-center gap-2.5 transition-all border-2 cursor-pointer select-none active:scale-95 ${
                  isSpeakerOn 
                    ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)] hover:bg-[var(--neon-green)]/30 shadow-[0_0_15px_rgba(0,255,102,0.25)]' 
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-white'
                }`}
                title={isSpeakerOn ? "Loudspeaker Active - Click for Earpiece / Headphone mode" : "Earpiece Mode - Click for Loudspeaker"}
              >
                <div className={`p-1.5 rounded-none ${isSpeakerOn ? 'bg-[var(--neon-green)]/30 text-[var(--neon-green)]' : 'bg-zinc-800 text-zinc-400'}`}>
                  {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </div>
                <div className="text-left font-mono">
                  <div className="text-[10px] font-black uppercase tracking-wider leading-none">
                    {isSpeakerOn ? 'SPEAKER ON' : 'EARPIECE'}
                  </div>
                  <div className={`text-[8px] font-bold tracking-widest mt-0.5 ${isSpeakerOn ? 'text-[var(--neon-green)]' : 'text-zinc-500'}`}>
                    {isSpeakerOn ? '● 100% BOOST' : '○ LOW AUDIO'}
                  </div>
                </div>
              </button>

              {/* Raise Hand Toggle for Group Calls */}
              {call.isGroup && (
                <button
                  onClick={() => {
                    playGlitchClickSound();
                    setIsHandRaised(!isHandRaised);
                  }}
                  className={`min-h-[52px] px-3.5 py-2.5 rounded-none flex items-center justify-center gap-2 transition-all border-2 cursor-pointer select-none ${
                    isHandRaised 
                      ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]' 
                      : 'bg-zinc-900 text-amber-400 border-amber-500/50 hover:bg-amber-950/30'
                  }`}
                  title={isHandRaised ? "Lower Hand" : "Raise Hand to Speak"}
                >
                  <Hand className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase hidden sm:inline">
                    {isHandRaised ? 'LOWER HAND' : 'RAISE HAND'}
                  </span>
                </button>
              )}

              {/* Video Camera Toggle */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setIsVideoOn(!isVideoOn);
                }}
                className={`min-h-[52px] px-3.5 py-2.5 rounded-none flex items-center justify-center gap-2 transition-all border-2 cursor-pointer select-none ${
                  !isVideoOn 
                    ? 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:bg-neutral-800' 
                    : 'bg-zinc-900 text-[var(--neon-green)] border-[var(--neon-green)]/60 hover:bg-[var(--neon-green)]/15'
                }`}
                title={isVideoOn ? "Disable Camera Feed" : "Enable Camera Feed"}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-zinc-500" />}
                <span className="text-[10px] font-black uppercase hidden sm:inline">
                  {isVideoOn ? 'CAM ON' : 'CAM OFF'}
                </span>
              </button>

              {/* Disconnect / End Call */}
              <button
                onClick={handleEndCall}
                className="min-h-[52px] px-5 bg-red-600 hover:bg-red-500 text-black border-2 border-black rounded-none flex items-center justify-center gap-2 transition cursor-pointer hover:scale-105 active:scale-95 shadow-[4px_4px_0_0_#991b1b]"
                title={call.isGroup ? "Leave Group Audio Channel" : "Disconnect Secured Communications Portal"}
              >
                <PhoneOff className="w-5 h-5 stroke-[3]" />
                <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">
                  END CALL
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
