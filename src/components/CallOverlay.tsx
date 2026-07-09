import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, ShieldCheck, Radio, Sparkles, AlertTriangle } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';

export interface CallState {
  type: 'voice' | 'video';
  status: 'dialing' | 'ringing' | 'active' | 'ended';
  peerId: string;
  peerName: string;
  peerPhoto: string;
  isIncoming?: boolean;
}

interface CallOverlayProps {
  call: any;
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Status transitions simulation
  useEffect(() => {
    if (call.isIncoming) {
      setStatus(call.status as any);
      return;
    }

    let t1: any;
    let t2: any;

    if (call.status === 'dialing') {
      t1 = setTimeout(() => {
        setStatus('ringing');
        triggerVibration('medium');
      }, 2000);

      t2 = setTimeout(() => {
        setStatus('active');
        triggerVibration('medium');
        playLikeSound();
      }, 5000);
    } else {
      setStatus(call.status as any);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [call.status, call.isIncoming]);

  // Stopwatch duration tracker
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Request actual camera stream for video calls
  useEffect(() => {
    const hasMediaDevices = typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (isVideoOn && status === 'active') {
      if (hasMediaDevices) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then((stream) => {
            setLocalStream(stream);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            }
          })
          .catch((err) => {
            console.warn("Camera media stream permission rejected or unavailable:", err);
          });
      } else {
        console.warn("navigator.mediaDevices or getUserMedia is not supported in this nested or secure iframe sandbox.");
      }
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isVideoOn, status]);

  // Cyber canvas visualizer generator (Remote peer digital pulse)
  useEffect(() => {
    if (status !== 'active') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let time = 0;

    const render = () => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Neon-green cybersecurity frequency waves
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 1) {
        const amplitude = 30 + Math.sin(time / 5) * 15;
        const frequency = 0.02 + Math.cos(time / 15) * 0.01;
        const y = canvas.height / 2 + Math.sin(x * frequency + time / 10) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Secondary cyber pulse wave
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)';
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 2) {
        const y = canvas.height / 2 + Math.cos(x * 0.012 + time / 18) * 45;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // ASCII metrics logs decoration
      ctx.fillStyle = '#00ff66';
      ctx.shadowColor = 'transparent';
      ctx.font = '8px monospace';
      ctx.fillText(`ENTROPY: ${(0.825 + Math.sin(time/20) * 0.05).toFixed(4)}`, 15, canvas.height - 30);
      ctx.fillText(`SECURE COORDINATES: TLS_AES_256_GCM_SHA384`, 15, canvas.height - 15);
      ctx.fillText(`STREAM FREQUENCY: 60Hz // LOW LATENCY`, canvas.width - 200, canvas.height - 15);

      time += 1;
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [status]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleEndCall = () => {
    playGlitchClickSound();
    triggerVibration('double');
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    onEndCall();
  };

  return (
    <div className="fixed inset-0 bg-[#060606] z-[99999] flex flex-col items-center justify-between p-6 sm:p-12 font-mono text-[var(--neon-green)] selection:bg-[var(--neon-green)] selection:text-black">
      
      {/* Encryption Banner Header */}
      <div className="w-full max-w-4xl flex items-center justify-between border-2 border-[var(--neon-green)] bg-black px-4 py-3 shadow-[4px_4px_0_0_#000000] shrink-0">
        <span className="flex items-center gap-2 text-xs font-black tracking-widest text-[var(--neon-green)]">
          <ShieldCheck className="w-4 h-4 text-[var(--neon-green)] animate-pulse shrink-0" />
          CRYPTOGRAPHIC TUNNEL SECURED_
        </span>
        <span className="bg-[var(--neon-green)] text-black font-extrabold text-[8px] tracking-widest px-2 py-0.5 uppercase">
          E2EE ACTIVE
        </span>
      </div>

      {/* Main Calling Stage */}
      <div className="w-full max-w-4xl flex-1 my-6 flex flex-col lg:flex-row items-center gap-6 justify-center min-h-0">
        
        {/* Remote Peer Stage */}
        <div className="flex-1 w-full h-full min-h-[300px] border-4 border-black dark:border-zinc-800 bg-[#0d0d0d] shadow-[8px_8px_0_0_#000000] flex flex-col relative items-center justify-center overflow-hidden">
          
          {/* Animated Matrix Background */}
          {status === 'active' && call.type === 'video' ? (
            <canvas ref={canvasRef} width={640} height={400} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950 to-black select-none pointer-events-none opacity-40">
              <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,255,102,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
          )}

          {/* Caller Profile Avatar Ring */}
          {(status !== 'active' || call.type === 'voice') && (
            <div className="relative flex flex-col items-center z-10 space-y-6">
              <div className="relative">
                {/* Dialing Pulse Circles */}
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
                <h2 className="font-serif text-2xl font-bold italic text-white uppercase tracking-tight">
                  {call.peerName}
                </h2>
                <p className="text-[10px] text-[var(--neon-green)] tracking-widest uppercase animate-pulse">
                  {status === 'dialing' && '⚡ ESTABLISHING SECURE PORTAL CHANNEL...'}
                  {status === 'ringing' && '📞 HANDSHAKE PING SENT // RINGING...'}
                  {status === 'active' && '● TUNNEL OPENED'}
                </p>
              </div>
            </div>
          )}

          {/* Real-time active status banner info */}
          {status === 'active' && (
            <div className="absolute top-4 left-4 z-10 bg-black/85 border border-[var(--neon-green)]/40 p-2.5 text-[9px] font-mono flex flex-col space-y-0.5">
              <div className="flex items-center gap-1.5 text-[var(--neon-green)] font-extrabold">
                <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
                <span>FREQUENCY LINK CONVERTED</span>
              </div>
              <span className="text-zinc-400">FPS: 60 / CODEC: OPUS_WEBRTC</span>
              <span className="text-zinc-400">REDUNDANCY RATIO: 0.00% LOSS</span>
            </div>
          )}

          {/* Picture-in-Picture Local video stream loopback */}
          {status === 'active' && call.type === 'video' && isVideoOn && (
            <div className="absolute bottom-4 right-4 z-20 w-36 h-48 border-2 border-[var(--neon-green)] bg-black shadow-lg flex flex-col font-mono text-[8px] overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute bottom-1 left-1.5 bg-black/75 p-1 border border-[var(--neon-green)]/20 text-[var(--neon-green)] uppercase font-bold tracking-wider">
                NODE_A (YOU)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECURE CALLING TIME STOPWATCH */}
      {status === 'active' && (
        <div className="text-center my-4 shrink-0 font-mono">
          <div className="text-3xl font-black text-white px-6 py-2 border-2 border-[var(--neon-green)] bg-black inline-block shadow-[3px_3px_0_0_#000000] tracking-widest">
            {formatTime(seconds)}
          </div>
          <div className="text-[9px] uppercase tracking-widest mt-2 text-zinc-400">
            SECURE LINK CONNECTION DURATION
          </div>
        </div>
      )}

      {/* Sound Waves Spectrum Representation */}
      {status === 'active' && !isMuted && (
        <div className="flex items-center justify-center gap-1 my-4 h-12 w-full shrink-0">
          {[...Array(24)].map((_, i) => {
            const h = 10 + Math.random() * 32;
            return (
              <div
                key={i}
                className="w-1 bg-[var(--neon-green)] opacity-80"
                style={{
                  height: `${h}px`,
                  transition: 'height 0.1s ease',
                  animation: `bounceWave ${0.5 + Math.random() * 0.5}s infinite alternate`
                }}
              />
            );
          })}
        </div>
      )}

      {/* Styled Call Control Rail Operations */}
      <div className="w-full max-w-xl bg-black border-2 border-[var(--neon-green)] p-5 flex items-center justify-around shadow-[4px_4px_0_0_#000000] shrink-0">
        {call.isIncoming && (status === 'dialing' || status === 'ringing') ? (
          <div className="flex gap-4 w-full">
            <button
              onClick={() => {
                playGlitchClickSound();
                triggerVibration('double');
                onEndCall();
              }}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#991b1b]"
            >
              <PhoneOff className="w-4 h-4" />
              <span>DECLINE HANDSHAKE</span>
            </button>
            <button
              onClick={() => {
                playLikeSound();
                triggerVibration('medium');
                if (onAcceptCall) onAcceptCall();
              }}
              className="flex-1 py-3 bg-[var(--neon-green)] hover:bg-white font-extrabold text-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition border border-black shadow-[4px_4px_0_0_#15803d] animate-pulse"
            >
              <Phone className="w-4 h-4" />
              <span>ACCEPT CHANNEL</span>
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
              className={`w-14 h-14 rounded-none flex items-center justify-center transition border cursor-pointer ${
                isMuted 
                  ? 'bg-rose-950/40 text-rose-500 border-rose-500 hover:bg-rose-900/60' 
                  : 'bg-black text-[var(--neon-green)] border-[var(--neon-green)]/55 hover:bg-[var(--neon-green)]/15'
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Big End Call trigger */}
            <button
              onClick={handleEndCall}
              className="w-16 h-16 bg-red-600 hover:bg-red-500 text-black border-2 border-black rounded-none flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95 shadow-[4px_4px_0_0_#991b1b]"
              title="Disconnect Secured Communications Portal"
            >
              <PhoneOff className="w-6 h-6 stroke-[3]" />
            </button>

            {/* Video Mode Enable/Disable */}
            <button
              onClick={() => {
                playGlitchClickSound();
                setIsVideoOn(!isVideoOn);
              }}
              className={`w-14 h-14 rounded-none flex items-center justify-center transition border cursor-pointer ${
                !isVideoOn 
                  ? 'bg-[#1a1a1a] text-zinc-500 border-zinc-700 hover:bg-neutral-800' 
                  : 'bg-black text-[var(--neon-green)] border-[var(--neon-green)]/55 hover:bg-[var(--neon-green)]/15'
              }`}
              title={isVideoOn ? "Turn off video camera feedback" : "Activate video channel feedback"}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>

      {/* Styled animation styles */}
      <style>{`
        @keyframes bounceWave {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1.3); }
        }
      `}</style>
    </div>
  );
}
