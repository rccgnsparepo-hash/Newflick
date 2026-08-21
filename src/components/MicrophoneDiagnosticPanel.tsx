import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Mic, 
  MicOff, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  HelpCircle, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Smartphone, 
  Monitor, 
  Volume2,
  Radio
} from 'lucide-react';
import { microphoneService, MicrophoneStatusInfo } from '../lib/microphoneService';
import { showBrutalistToast } from '../lib/toast';
import { playGlitchClickSound } from '../lib/sounds';

interface MicrophoneDiagnosticPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MicrophoneDiagnosticPanel({ isOpen, onClose }: MicrophoneDiagnosticPanelProps) {
  const [status, setStatus] = useState<MicrophoneStatusInfo>(microphoneService.getStatus());
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [liveVolume, setLiveVolume] = useState<number>(0);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [isSyntheticStream, setIsSyntheticStream] = useState<boolean>(false);
  const testStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const synthNodesRef = useRef<{ osc?: OscillatorNode; lfo?: OscillatorNode } | null>(null);

  useEffect(() => {
    const unsubscribe = microphoneService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => {
      unsubscribe();
      stopTest();
    };
  }, []);

  const runRecheck = async () => {
    playGlitchClickSound();
    await microphoneService.checkMicrophonePermission();
    showBrutalistToast('STATUS CHECKED', 'Microphone state refreshed from platform APIs.', 'info');
  };

  const startSyntheticTest = () => {
    stopTest();
    setIsTesting(true);
    setIsSyntheticStream(true);
    setTestSuccess(true);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        setTestSuccess(false);
        setIsTesting(false);
        showBrutalistToast('AUDIO ERROR', 'Web Audio API is not supported in this browser.', 'error');
        return;
      }

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);

      lfo.frequency.setValueAtTime(3.5, ctx.currentTime);
      lfoGain.gain.setValueAtTime(25, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(gain);
      gain.connect(analyser);
      gain.connect(dest);
      osc.start();

      testStreamRef.current = dest.stream;
      synthNodesRef.current = { osc, lfo };

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!testStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setLiveVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      showBrutalistToast('SYNTHETIC AUDIO ACTIVE', 'Simulated audio input active for meter & pipeline testing.', 'info');
    } catch (e: any) {
      console.warn('[MicrophoneDiagnosticPanel] Synthetic audio test warning:', e);
      setTestSuccess(false);
      setIsTesting(false);
    }
  };

  const startTest = async () => {
    playGlitchClickSound();
    stopTest();
    setIsTesting(true);
    setIsSyntheticStream(false);
    setTestSuccess(null);

    try {
      const stream = await microphoneService.createAudioStream({
        echoCancellation: true,
        noiseSuppression: true
      });
      testStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!testStreamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setLiveVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      }

      setTestSuccess(true);
      showBrutalistToast('MIC TEST SUCCESSFUL', 'Real audio hardware input detected and transmitting.', 'success');
    } catch (err: any) {
      console.warn('[MicrophoneDiagnosticPanel] Physical hardware test notice:', err?.message || err);
      // Automatically fallback to synthetic simulation mode when physical hardware is not detected or unavailable
      startSyntheticTest();
    }
  };

  const stopTest = () => {
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
    if (testStreamRef.current) {
      microphoneService.releaseAudioStream(testStreamRef.current);
      testStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsTesting(false);
    setIsSyntheticStream(false);
    setLiveVolume(0);
  };

  const resetState = () => {
    playGlitchClickSound();
    stopTest();
    microphoneService.resetPermissionState();
    showBrutalistToast('PERMISSIONS RESET', 'Permission state cleared. Ready to re-request.', 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 font-mono select-none animate-fadeIn">
      <div className="w-full max-w-2xl bg-zinc-950 border-2 border-zinc-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--neon-green)] animate-pulse" />
            <span className="text-xs sm:text-sm font-black tracking-wider text-white uppercase">
              HARDWARE & MIC DIAGNOSTIC SUITE
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopTest();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-zinc-300">
          
          {/* Status Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Status Card */}
            <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase">
                <span>MICROPHONE PERMISSION STATE</span>
                <span>STATE LOG</span>
              </div>
              <div className="flex items-center gap-2">
                {status.state === 'granted' ? (
                  <ShieldCheck className="w-5 h-5 text-[var(--neon-green)] shrink-0" />
                ) : status.state === 'blocked' || status.state === 'denied' ? (
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="font-black text-sm uppercase tracking-wide text-white">
                    {status.state}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {status.granted
                      ? 'Microphone stream access granted & active'
                      : status.isBlocked
                      ? 'Blocked by browser permissions policy or user settings'
                      : status.isUnavailable
                      ? 'No active input device hardware detected'
                      : 'Permission pending or awaiting user prompt'}
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Card */}
            <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase">
                <span>ENVIRONMENT & CONTEXT</span>
                <span>SECURITY</span>
              </div>
              <div className="flex items-center gap-2">
                {status.platform.isElectron ? (
                  <Monitor className="w-5 h-5 text-cyan-400 shrink-0" />
                ) : status.platform.isAndroid ? (
                  <Smartphone className="w-5 h-5 text-purple-400 shrink-0" />
                ) : (
                  <Cpu className="w-5 h-5 text-blue-400 shrink-0" />
                )}
                <div>
                  <div className="font-black text-sm uppercase tracking-wide text-white">
                    {status.platform.browserName}
                  </div>
                  <div className="text-[10px] flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      status.platform.isSecureContext ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                    }`}>
                      {status.platform.isSecureContext ? 'HTTPS / SECURE' : 'INSECURE HTTP'}
                    </span>
                    <span className="text-zinc-500">{status.platform.osName}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Raw Error Inspector (If any error occurred) */}
          {status.lastError && (
            <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/50 space-y-2">
              <div className="flex items-center gap-1.5 text-red-400 font-bold text-[10px] uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>RAW BROWSER ERROR TELEMETRY</span>
              </div>
              <div className="bg-black/90 p-2.5 rounded-lg border border-zinc-800 font-mono text-[10px] text-red-200 space-y-1 overflow-x-auto">
                <div><span className="text-zinc-500">Error Name:</span> <strong className="text-red-400">{status.lastError.name}</strong></div>
                <div><span className="text-zinc-500">Message:</span> {status.lastError.message}</div>
                {status.lastError.constraint && (
                  <div><span className="text-zinc-500">Constraint:</span> {status.lastError.constraint}</div>
                )}
                <div><span className="text-zinc-500">Origin / Host:</span> {status.lastError.origin || status.lastError.hostname}</div>
                <div><span className="text-zinc-500">Secure Context:</span> {status.lastError.secureContext ? 'true' : 'false'}</div>
              </div>
            </div>
          )}

          {/* Detected Audio Hardware Devices */}
          <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase">
              <span>DETECTED AUDIO INPUT DEVICES ({status.audioInputDevices.length})</span>
              <button
                type="button"
                onClick={runRecheck}
                className="text-[var(--neon-green)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                REFRESH
              </button>
            </div>
            {status.audioInputDevices.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {status.audioInputDevices.map((dev, idx) => (
                  <div key={dev.deviceId || idx} className="px-2.5 py-1.5 bg-black/80 rounded border border-zinc-800 flex items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-2 truncate">
                      <Mic className="w-3 h-3 text-[var(--neon-green)] shrink-0" />
                      <span className="text-white truncate">{dev.label || `Audio Device ${idx + 1}`}</span>
                    </div>
                    <span className="text-zinc-500 text-[8px] shrink-0 font-mono">
                      {dev.deviceId ? dev.deviceId.substring(0, 12) + '...' : 'DEFAULT'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-zinc-500 italic py-1">
                No explicit device labels returned (labels become visible after first permission approval).
              </div>
            )}
          </div>

          {/* Live Microphone Hardware Test & Volume Level Meter */}
          <div className="p-3 bg-black rounded-xl border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-300">
                <Volume2 className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                <span>LIVE HARDWARE INPUT METER</span>
              </div>
              {isTesting && (
                <span className={`text-[9px] font-black animate-pulse uppercase px-1.5 py-0.5 rounded ${
                  isSyntheticStream ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'text-red-400'
                }`}>
                  {isSyntheticStream ? '● SYNTHETIC AUDIO SIMULATION' : '● ACTIVE HARDWARE STREAM'}
                </span>
              )}
            </div>

            {/* Level Meter Bar */}
            <div className="h-4 bg-zinc-900 rounded-full border border-zinc-800 overflow-hidden p-0.5 relative">
              <div
                style={{ width: `${liveVolume}%` }}
                className={`h-full rounded-full transition-all duration-75 ${
                  liveVolume > 70
                    ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                    : liveVolume > 30
                    ? 'bg-[var(--neon-green)] shadow-[0_0_8px_#00ff66]'
                    : 'bg-emerald-600'
                }`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                {!isTesting ? (
                  <>
                    <button
                      type="button"
                      onClick={startTest}
                      className="px-3 py-1.5 bg-[var(--neon-green)] text-black rounded-lg font-black text-[10px] uppercase hover:bg-white transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                    >
                      <Mic className="w-3 h-3" />
                      TEST MICROPHONE STREAM
                    </button>
                    <button
                      type="button"
                      onClick={startSyntheticTest}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 rounded-lg font-bold text-[10px] uppercase transition cursor-pointer flex items-center gap-1"
                    >
                      <Radio className="w-3 h-3 text-amber-400" />
                      SYNTHETIC AUDIO TEST
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={stopTest}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-black text-[10px] uppercase hover:bg-red-500 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <MicOff className="w-3 h-3" />
                    STOP TEST
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetState}
                  className="px-2.5 py-1.5 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-lg text-[10px] uppercase font-bold transition cursor-pointer"
                >
                  RESET STATE
                </button>
              </div>

              {testSuccess === true && (
                <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSyntheticStream ? 'SYNTHETIC SIGNAL OK' : 'HARDWARE DETECTED'} ({liveVolume}%)
                </div>
              )}
            </div>
          </div>

          {/* Browser Recovery Instructions */}
          <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-1.5 text-[10px] text-zinc-400">
            <div className="flex items-center gap-1.5 text-zinc-300 font-bold uppercase">
              <HelpCircle className="w-3 h-3 text-[var(--neon-green)]" />
              <span>HOW TO UNBLOCK MICROPHONE PERMISSIONS</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[9.5px]">
              <li><strong>Chrome / Edge / Brave:</strong> Click the lock/settings icon next to the URL in the browser address bar &rarr; set <em>Microphone</em> to <strong>Allow</strong> &rarr; reload page.</li>
              <li><strong>Safari (macOS / iOS):</strong> Open Safari Settings &rarr; Websites &rarr; Microphone &rarr; set permission to <strong>Allow</strong>.</li>
              <li><strong>FLICK Electron Desktop:</strong> Ensure OS System Settings &rarr; Privacy & Security &rarr; Microphone has granted permission to FLICK.</li>
              <li><strong>Android APK:</strong> Long-press the FLICK app icon &rarr; App Info &rarr; Permissions &rarr; Microphone &rarr; select <strong>Allow only while using the app</strong>.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[9px] text-zinc-500">FLICK HARDWARE BRIDGE v2.4</span>
          <button
            type="button"
            onClick={() => {
              stopTest();
              onClose();
            }}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[10px] rounded-lg transition cursor-pointer"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
}
export default MicrophoneDiagnosticPanel;
