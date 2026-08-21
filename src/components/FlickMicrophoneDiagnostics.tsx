import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Mic,
  MicOff,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Terminal,
  Cpu,
  Globe,
  Radio,
  Lock,
  Layers,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp,
  Volume2
} from 'lucide-react';
import { microphoneService, MicrophoneStatusInfo } from '../lib/microphoneService';
import { showBrutalistToast } from '../lib/toast';
import { playGlitchClickSound } from '../lib/sounds';

export interface FlickMicrophoneDiagnosticsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestResultData {
  timestamp: string;
  status: 'idle' | 'testing' | 'success' | 'failed';
  category?: 'SUCCESS' | 'PERMISSION_DENIED' | 'NO_HARDWARE' | 'HARDWARE_BUSY' | 'CONSTRAINT_FAILURE' | 'INSECURE_CONTEXT' | 'TYPE_ERROR' | 'UNKNOWN';
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  trackInfo?: {
    id: string;
    label: string;
    kind: string;
    readyState: string;
    muted: boolean;
    enabled: boolean;
  };
  capabilities?: MediaTrackCapabilities | Record<string, any>;
  settings?: MediaTrackSettings | Record<string, any>;
  constraintsApplied?: any;
  isSynthetic?: boolean;
}

export const FlickMicrophoneDiagnostics: React.FC<FlickMicrophoneDiagnosticsProps> = ({
  isOpen,
  onClose
}) => {
  const [micStatus, setMicStatus] = useState<MicrophoneStatusInfo>(microphoneService.getStatus());
  const [selectedTier, setSelectedTier] = useState<'tier1' | 'tier2' | 'synthetic'>('tier1');
  const [isTesting, setIsTesting] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [testResult, setTestResult] = useState<TestResultData>({
    timestamp: new Date().toISOString(),
    status: 'idle'
  });
  const [showRawJson, setShowRawJson] = useState(false);
  const [deviceList, setDeviceList] = useState<MediaDeviceInfo[]>([]);

  const activeStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const synthNodesRef = useRef<{ osc?: OscillatorNode; lfo?: OscillatorNode } | null>(null);

  // Environmental probes
  const isSecureContextValue = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false;
  const protocolValue = typeof window !== 'undefined' ? window.location.protocol : 'unknown:';
  const hostnameValue = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const originValue = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const isIframe = typeof window !== 'undefined' ? window.self !== window.top : false;
  
  const hasNavigator = typeof navigator !== 'undefined';
  const hasMediaDevices = hasNavigator && !!navigator.mediaDevices;
  const hasGetUserMedia = hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
  const hasEnumerateDevices = hasMediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function';
  const hasPermissionsApi = hasNavigator && !!navigator.permissions && typeof navigator.permissions.query === 'function';

  useEffect(() => {
    const unsubscribe = microphoneService.subscribe((newStatus) => {
      setMicStatus(newStatus);
    });
    refreshDeviceList();
    return () => {
      unsubscribe();
      cleanupActiveStream();
    };
  }, []);

  const refreshDeviceList = async () => {
    if (hasEnumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setDeviceList(audioInputs);
      } catch (e) {
        console.warn('[FlickMicrophoneDiagnostics] Device enumeration failed:', e);
      }
    }
  };

  const cleanupActiveStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (synthNodesRef.current) {
      try {
        synthNodesRef.current.osc?.stop();
        synthNodesRef.current.lfo?.stop();
      } catch (e) {}
      synthNodesRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsTesting(false);
    setLiveVolume(0);
  };

  const runGetUserMediaTest = async () => {
    playGlitchClickSound();
    cleanupActiveStream();
    setIsTesting(true);

    const testTime = new Date().toISOString();

    if (selectedTier === 'synthetic') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) throw new Error('Web Audio API not supported');
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;

        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(220, ctx.currentTime);
        lfo.frequency.setValueAtTime(4, ctx.currentTime);
        lfoGain.gain.setValueAtTime(20, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.connect(gain);
        gain.connect(analyser);
        gain.connect(dest);
        osc.start();

        activeStreamRef.current = dest.stream;
        synthNodesRef.current = { osc, lfo };

        const track = dest.stream.getAudioTracks()[0];
        setTestResult({
          timestamp: testTime,
          status: 'success',
          category: 'SUCCESS',
          isSynthetic: true,
          trackInfo: track ? {
            id: track.id,
            label: 'Synthetic Web Audio Synthesizer Track',
            kind: track.kind,
            readyState: track.readyState,
            muted: track.muted,
            enabled: track.enabled
          } : undefined,
          constraintsApplied: { mode: 'synthetic-oscillator' }
        });

        startVolumeMeter(analyser);
        showBrutalistToast('SYNTHETIC PROBE ACTIVE', 'Virtual audio stream simulated successfully.', 'success');
      } catch (err: any) {
        setTestResult({
          timestamp: testTime,
          status: 'failed',
          category: 'UNKNOWN',
          errorName: err.name || 'SyntheticError',
          errorMessage: err.message || String(err),
          errorStack: err.stack
        });
        setIsTesting(false);
      }
      return;
    }

    if (!hasGetUserMedia) {
      setTestResult({
        timestamp: testTime,
        status: 'failed',
        category: 'INSECURE_CONTEXT',
        errorName: 'MediaDevicesUnavailable',
        errorMessage: 'navigator.mediaDevices.getUserMedia is undefined. (Requires HTTPS / Secure Context or supported browser).'
      });
      setIsTesting(false);
      return;
    }

    const constraints: MediaStreamConstraints = selectedTier === 'tier1' ? {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    } : {
      audio: true
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStreamRef.current = stream;
      const track = stream.getAudioTracks()[0];

      const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
      const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};

      setTestResult({
        timestamp: testTime,
        status: 'success',
        category: 'SUCCESS',
        isSynthetic: false,
        trackInfo: track ? {
          id: track.id,
          label: track.label || 'Default Audio Device',
          kind: track.kind,
          readyState: track.readyState,
          muted: track.muted,
          enabled: track.enabled
        } : undefined,
        capabilities,
        settings,
        constraintsApplied: constraints
      });

      // Hook up Web Audio VU analyser
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        startVolumeMeter(analyser);
      }

      await refreshDeviceList();
      await microphoneService.checkMicrophonePermission();
      showBrutalistToast('TEST GETUSERMEDIA SUCCESS', `Track active: ${track.label || 'Microphone'}`, 'success');
    } catch (err: any) {
      console.warn('[FlickMicrophoneDiagnostics] getUserMedia test failed:', err);

      let cat: TestResultData['category'] = 'UNKNOWN';
      const name = err.name || '';

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        cat = 'PERMISSION_DENIED';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        cat = 'NO_HARDWARE';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        cat = 'HARDWARE_BUSY';
      } else if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        cat = 'CONSTRAINT_FAILURE';
      } else if (name === 'SecurityError') {
        cat = 'INSECURE_CONTEXT';
      } else if (name === 'TypeError') {
        cat = 'TYPE_ERROR';
      }

      setTestResult({
        timestamp: testTime,
        status: 'failed',
        category: cat,
        errorName: err.name || 'UnknownError',
        errorMessage: err.message || String(err),
        errorStack: err.stack,
        constraintsApplied: constraints
      });
      setIsTesting(false);
      showBrutalistToast('GETUSERMEDIA TEST FAILED', `[${err.name}]: ${err.message}`, 'error');
    }
  };

  const startVolumeMeter = (analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      if (!activeStreamRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      setLiveVolume(Math.min(100, Math.round((avg / 128) * 100)));
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const generateDiagnosticReport = () => {
    return {
      appName: 'FLICK Ultra Modern E2EE WebApp',
      reportGeneratedAt: new Date().toISOString(),
      environment: {
        isSecureContext: isSecureContextValue,
        protocol: protocolValue,
        origin: originValue,
        hostname: hostnameValue,
        isIframe: isIframe,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        mediaDevicesAvailable: hasMediaDevices,
        getUserMediaAvailable: hasGetUserMedia,
        enumerateDevicesAvailable: hasEnumerateDevices,
        permissionsApiAvailable: hasPermissionsApi
      },
      microphoneServiceStatus: micStatus,
      detectedAudioInputs: deviceList.map(d => ({
        deviceId: d.deviceId ? `${d.deviceId.slice(0, 8)}...` : 'redacted',
        groupId: d.groupId ? `${d.groupId.slice(0, 8)}...` : 'redacted',
        label: d.label || '(Label hidden until permission granted)'
      })),
      lastTestResult: testResult
    };
  };

  const copyDiagnosticJson = () => {
    playGlitchClickSound();
    const report = generateDiagnosticReport();
    navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      .then(() => {
        showBrutalistToast('JSON COPIED', 'Full microphone diagnostic payload copied to clipboard.', 'success');
      })
      .catch(() => {
        showBrutalistToast('COPY FAILED', 'Could not access clipboard.', 'error');
      });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none font-mono">
        <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-2xl bg-[var(--color-surface)] border-2 border-[var(--neon-green)] shadow-[0_0_30px_rgba(0,255,102,0.25)] flex flex-col max-h-[90vh] overflow-hidden text-[var(--color-text)] z-10"
        >
          {/* Header Bar */}
          <div className="p-3.5 sm:p-4 bg-black/80 border-b border-[var(--neon-green)]/40 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded bg-[var(--neon-green)]/10 border border-[var(--neon-green)] flex items-center justify-center text-[var(--neon-green)] shrink-0">
                <Terminal className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                    FLICK MICROPHONE DIAGNOSTICS
                  </h2>
                  <span className="px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/40">
                    DEV MODE
                  </span>
                </div>
                <p className="text-[9px] text-zinc-400 truncate">
                  Hardware & WebRTC Media Layer Runtime Probes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={copyDiagnosticJson}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-[var(--neon-green)] border border-[var(--neon-green)]/40 text-[9px] font-black uppercase rounded transition flex items-center gap-1 cursor-pointer"
                title="Copy Full Diagnostic JSON"
              >
                <Copy className="w-3 h-3" />
                <span className="hidden sm:inline">COPY JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playGlitchClickSound();
                  onClose();
                }}
                className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-700 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Diagnostic Content */}
          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-[11px] leading-relaxed">
            
            {/* Category 1: Environment & Security Context */}
            <div className="bg-black/60 border border-zinc-800 p-3 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                  <span className="text-[10px] font-black uppercase text-white tracking-wider">
                    CATEGORY 1: ENVIRONMENT & SECURITY CONTEXT
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                  isSecureContextValue ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                }`}>
                  {isSecureContextValue ? 'SECURE CONTEXT OK' : 'INSECURE CONTEXT'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">window.isSecureContext:</span>
                  <span className={`font-black ${isSecureContextValue ? 'text-emerald-400' : 'text-red-400'}`}>
                    {String(isSecureContextValue)}
                  </span>
                </div>

                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">location.protocol:</span>
                  <span className="font-bold text-cyan-300">{protocolValue}</span>
                </div>

                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">location.hostname:</span>
                  <span className="font-bold text-zinc-200 truncate ml-2">{hostnameValue}</span>
                </div>

                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">Iframe Sandbox Status:</span>
                  <span className="font-bold text-amber-300">{isIframe ? 'Nested Iframe Container' : 'Top Window'}</span>
                </div>
              </div>
            </div>

            {/* Category 2: Navigator & MediaDevices APIs */}
            <div className="bg-black/60 border border-zinc-800 p-3 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                  <span className="text-[10px] font-black uppercase text-white tracking-wider">
                    CATEGORY 2: NAVIGATOR & MEDIADEVICES API
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                  hasGetUserMedia ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                }`}>
                  {hasGetUserMedia ? 'API AVAILABLE' : 'API MISSING'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">navigator.mediaDevices:</span>
                  <span className={`font-black ${hasMediaDevices ? 'text-emerald-400' : 'text-red-400'}`}>
                    {hasMediaDevices ? 'Available' : 'Undefined'}
                  </span>
                </div>

                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">getUserMedia Function:</span>
                  <span className={`font-black ${hasGetUserMedia ? 'text-emerald-400' : 'text-red-400'}`}>
                    {hasGetUserMedia ? 'typeof === function' : 'Unavailable'}
                  </span>
                </div>

                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">Audio Devices Detected:</span>
                  <span className="font-black text-[var(--neon-green)]">
                    {deviceList.length} Input Device(s)
                  </span>
                </div>

                <div className="p-2 bg-zinc-950/80 border border-zinc-850 rounded flex items-center justify-between">
                  <span className="text-zinc-400">Central Service State:</span>
                  <span className="font-black uppercase text-cyan-300">
                    {micStatus.state}
                  </span>
                </div>
              </div>

              {deviceList.length > 0 && (
                <div className="p-2 bg-zinc-950/90 border border-zinc-800 rounded space-y-1">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase">Detected Input Microphones:</span>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {deviceList.map((dev, idx) => (
                      <div key={dev.deviceId || idx} className="text-[9px] text-zinc-300 flex items-center justify-between">
                        <span className="truncate">• {dev.label || `Audio Input ${idx + 1} (Hardware ID detected)`}</span>
                        <span className="text-zinc-500 text-[8px] shrink-0 font-mono ml-2">
                          {dev.deviceId ? `${dev.deviceId.slice(0, 6)}...` : 'unidentified'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category 3: Test getUserMedia Call Execution */}
            <div className="bg-black/60 border border-zinc-800 p-3 rounded-lg space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                  <span className="text-[10px] font-black uppercase text-white tracking-wider">
                    CATEGORY 3: TEST GETUSERMEDIA PROBE
                  </span>
                </div>
                {isTesting && (
                  <span className="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-red-950 text-red-300 border border-red-800 animate-pulse">
                    ● ACTIVE STREAM
                  </span>
                )}
              </div>

              {/* Constraint Profile Selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9.5px] text-zinc-400 uppercase font-bold">Constraint Profile:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTier('tier1')}
                    className={`px-2 py-1 text-[9px] font-bold uppercase rounded border transition cursor-pointer ${
                      selectedTier === 'tier1'
                        ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    Tier 1 (Studio DSP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTier('tier2')}
                    className={`px-2 py-1 text-[9px] font-bold uppercase rounded border transition cursor-pointer ${
                      selectedTier === 'tier2'
                        ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    Tier 2 (audio: true)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTier('synthetic')}
                    className={`px-2 py-1 text-[9px] font-bold uppercase rounded border transition cursor-pointer ${
                      selectedTier === 'synthetic'
                        ? 'bg-amber-400 text-black border-amber-400 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    Synthetic Stream
                  </button>
                </div>
              </div>

              {/* Action Buttons & Level Meter */}
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] text-zinc-400 uppercase font-bold">LIVE VOLUME SPECTRUM:</span>
                  <span className="text-[9.5px] font-mono font-bold text-[var(--neon-green)]">{liveVolume}%</span>
                </div>

                <div className="w-full h-3 bg-zinc-900 rounded overflow-hidden p-0.5 border border-zinc-800">
                  <div
                    className={`h-full transition-all duration-75 ${
                      liveVolume > 70 ? 'bg-red-500' : liveVolume > 40 ? 'bg-yellow-400' : 'bg-[var(--neon-green)]'
                    }`}
                    style={{ width: `${liveVolume}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1 gap-2">
                  {!isTesting ? (
                    <button
                      type="button"
                      onClick={runGetUserMediaTest}
                      className="px-3.5 py-1.5 bg-[var(--neon-green)] text-black rounded font-black text-[10px] uppercase hover:bg-white transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      EXECUTE GETUSERMEDIA CALL
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={cleanupActiveStream}
                      className="px-3.5 py-1.5 bg-red-600 text-white rounded font-black text-[10px] uppercase hover:bg-red-500 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      TERMINATE TEST STREAM
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      playGlitchClickSound();
                      await microphoneService.checkMicrophonePermission();
                      await refreshDeviceList();
                      showBrutalistToast('PROBED', 'Hardware states re-evaluated.', 'info');
                    }}
                    className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded font-bold text-[9.5px] uppercase transition cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    RE-PROBE APIs
                  </button>
                </div>
              </div>

              {/* Categorized Test Outcome Display */}
              {testResult.status !== 'idle' && (
                <div className={`p-3 rounded-lg border text-[10px] space-y-2 ${
                  testResult.status === 'success'
                    ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
                    : 'bg-red-950/40 border-red-600/50 text-red-200'
                }`}>
                  <div className="flex items-center justify-between font-black uppercase">
                    <div className="flex items-center gap-1.5">
                      {testResult.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      )}
                      <span>OUTCOME CATEGORY: {testResult.category || testResult.status.toUpperCase()}</span>
                    </div>
                    <span className="text-[8.5px] text-zinc-400 font-normal">
                      {new Date(testResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {testResult.trackInfo && (
                    <div className="p-2 bg-black/50 border border-emerald-800/40 rounded space-y-1 font-mono text-[9px]">
                      <div><span className="text-zinc-400">Track Label:</span> <strong className="text-white">{testResult.trackInfo.label}</strong></div>
                      <div><span className="text-zinc-400">Track ID:</span> {testResult.trackInfo.id}</div>
                      <div><span className="text-zinc-400">Ready State:</span> <span className="text-emerald-400 font-bold uppercase">{testResult.trackInfo.readyState}</span></div>
                    </div>
                  )}

                  {testResult.settings && Object.keys(testResult.settings).length > 0 && (
                    <div className="p-2 bg-black/50 border border-emerald-800/40 rounded text-[9px] font-mono">
                      <span className="text-zinc-400 block mb-1 font-bold uppercase">Applied Settings:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-zinc-300">
                        {testResult.settings.sampleRate && <div>SR: {testResult.settings.sampleRate}Hz</div>}
                        {testResult.settings.channelCount && <div>Channels: {testResult.settings.channelCount}</div>}
                        {testResult.settings.echoCancellation !== undefined && <div>EC: {String(testResult.settings.echoCancellation)}</div>}
                        {testResult.settings.noiseSuppression !== undefined && <div>NS: {String(testResult.settings.noiseSuppression)}</div>}
                        {testResult.settings.autoGainControl !== undefined && <div>AGC: {String(testResult.settings.autoGainControl)}</div>}
                      </div>
                    </div>
                  )}

                  {testResult.errorMessage && (
                    <div className="p-2 bg-black/60 border border-red-800/50 rounded space-y-1 font-mono text-[9px] text-red-300">
                      <div><strong>Error Name:</strong> {testResult.errorName}</div>
                      <div><strong>Message:</strong> {testResult.errorMessage}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Collapsible Full JSON View */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRawJson(prev => !prev)}
                className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-900 text-left flex items-center justify-between text-[10px] font-black uppercase text-zinc-300 cursor-pointer"
              >
                <span>RAW SYSTEM DIAGNOSTIC PAYLOAD</span>
                {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showRawJson && (
                <div className="p-3 bg-black border-t border-zinc-800">
                  <pre className="text-[8.5px] text-emerald-400 overflow-x-auto max-h-48 p-2 bg-zinc-950 rounded border border-zinc-850 font-mono">
                    {JSON.stringify(generateDiagnosticReport(), null, 2)}
                  </pre>
                </div>
              )}
            </div>

          </div>

          {/* Footer Controls */}
          <div className="p-3 bg-black/90 border-t border-zinc-800 flex items-center justify-between text-[9px] text-zinc-400">
            <span className="hidden sm:inline">Hotkey: <kbd className="px-1 py-0.5 bg-zinc-800 text-[var(--neon-green)] rounded">Shift + M</kbd> or <kbd className="px-1 py-0.5 bg-zinc-800 text-[var(--neon-green)] rounded">Alt + M</kbd></span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-[9.5px] rounded transition cursor-pointer ml-auto"
            >
              CLOSE DIAGNOSTICS
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FlickMicrophoneDiagnostics;
