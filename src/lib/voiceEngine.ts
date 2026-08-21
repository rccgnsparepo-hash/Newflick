/**
 * Voice Capture Engine for Flick
 * Real-time amplitude metering, high-fidelity audio recording, hands-free locking,
 * live speech-to-text transcription, and studio audio effects processing.
 */

import { microphoneService, RawAudioErrorInfo } from './microphoneService';
import { getOptimalAudioMimeType } from './permissions';

export type VoiceEffectPreset = 'natural' | 'studio' | 'crisp' | 'bass' | 'cyber';

export interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isLocked: boolean;
  durationSeconds: number;
  liveAmplitudes: number[]; // Rolling 36-amplitude array for real-time visualizer
  currentTranscript: string;
  interimTranscript: string;
  effect: VoiceEffectPreset;
  isSynthetic?: boolean;
  rawError?: RawAudioErrorInfo | null;
}

export class FlickVoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private processedStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private timerInterval: any = null;
  private recognition: any = null;
  
  private audioChunks: Blob[] = [];
  private capturedAmplitudes: number[] = [];
  private durationSeconds: number = 0;
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private isLocked: boolean = false;
  private isSynthetic: boolean = false;
  private effect: VoiceEffectPreset = 'natural';
  private transcript: string = '';
  private interimTranscript: string = '';
  private rawError: RawAudioErrorInfo | null = null;

  private onStateChange: ((state: VoiceRecordingState) => void) | null = null;

  constructor(onStateChange?: (state: VoiceRecordingState) => void) {
    if (onStateChange) this.onStateChange = onStateChange;
  }

  public setEffect(fx: VoiceEffectPreset) {
    this.effect = fx;
    this.emitState();
  }

  public setLocked(locked: boolean) {
    this.isLocked = locked;
    this.emitState();
  }

  private emitState() {
    if (this.onStateChange) {
      this.onStateChange({
        isRecording: this.isRecording,
        isPaused: this.isPaused,
        isLocked: this.isLocked,
        durationSeconds: this.durationSeconds,
        liveAmplitudes: [...this.capturedAmplitudes.slice(-36)],
        currentTranscript: this.transcript,
        interimTranscript: this.interimTranscript,
        effect: this.effect,
        isSynthetic: this.isSynthetic,
        rawError: this.rawError
      });
    }
  }

  /**
   * Starts recording from the physical microphone.
   * If physical mic is restricted by the browser/iframe, seamlessly falls back
   * to a rich Web Audio synthesizer so audio recording never crashes.
   */
  public async startRecording(): Promise<void> {
    this.cleanup();
    this.audioChunks = [];
    this.capturedAmplitudes = [];
    this.durationSeconds = 0;
    this.transcript = '';
    this.interimTranscript = '';
    this.isPaused = false;
    this.isLocked = false;
    this.isSynthetic = false;
    this.rawError = null;

    let stream: MediaStream | null = null;

    // 1. Attempt to acquire physical microphone stream
    try {
      stream = await microphoneService.createAudioStream({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });
      this.isSynthetic = false;
    } catch (micErr: any) {
      console.warn('[FlickVoiceRecorder] Physical mic unavailable, switching to synthetic voice engine fallback:', micErr?.message || micErr);
      this.isSynthetic = true;
      this.rawError = microphoneService.getStatus().lastError;
      
      // Build robust synthetic audio stream with Web Audio API
      const syntheticGraph = this.createSyntheticAudioStream();
      if (syntheticGraph) {
        stream = syntheticGraph.stream;
        this.audioCtx = syntheticGraph.audioCtx;
        this.analyser = syntheticGraph.analyser;
      }
    }

    if (!stream) {
      throw new Error('Unable to initialize audio capture engine.');
    }

    this.audioStream = stream;
    this.isRecording = true;

    try {
      // 2. Set up Web Audio processing graph for physical mic (if not synthetic)
      if (!this.isSynthetic) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const ctx = new AudioCtxClass();
          this.audioCtx = ctx;

          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }

          const source = ctx.createMediaStreamSource(stream);
          const destination = ctx.createMediaStreamDestination();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.5;

          // Build Audio Effect Chain based on preset
          let lastNode: AudioNode = source;

          if (this.effect === 'studio') {
            const lowCut = ctx.createBiquadFilter();
            lowCut.type = 'highpass';
            lowCut.frequency.value = 80;

            const presence = ctx.createBiquadFilter();
            presence.type = 'peaking';
            presence.frequency.value = 3500;
            presence.gain.value = 3.5;

            lastNode.connect(lowCut);
            lowCut.connect(presence);
            lastNode = presence;
          } else if (this.effect === 'crisp') {
            const highShelf = ctx.createBiquadFilter();
            highShelf.type = 'highshelf';
            highShelf.frequency.value = 4000;
            highShelf.gain.value = 5.0;

            lastNode.connect(highShelf);
            lastNode = highShelf;
          } else if (this.effect === 'bass') {
            const bassBoost = ctx.createBiquadFilter();
            bassBoost.type = 'lowshelf';
            bassBoost.frequency.value = 250;
            bassBoost.gain.value = 6.0;

            lastNode.connect(bassBoost);
            lastNode = bassBoost;
          } else if (this.effect === 'cyber') {
            const bandpass = ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.value = 1400;
            bandpass.Q.value = 2.5;

            lastNode.connect(bandpass);
            lastNode = bandpass;
          }

          lastNode.connect(analyser);
          this.analyser = analyser;

          lastNode.connect(destination);
          this.processedStream = destination.stream;
        }
      }

      this.startAmplitudeLoop();

      // 3. Initialize MediaRecorder with the best supported audio mimeType
      const streamToRecord = this.processedStream || stream;
      const mimeType = getOptimalAudioMimeType();
      
      const recorder = new MediaRecorder(streamToRecord, { mimeType });
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      recorder.start(100); // 100ms time slice chunks

      // 4. Start live speech recognition if physical mic is active
      if (!this.isSynthetic) {
        this.startSpeechRecognition();
      }

      // 5. Active Duration Timer
      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          this.durationSeconds += 1;
          this.emitState();
        }
      }, 1000);

      this.emitState();
    } catch (setupErr) {
      console.error('[FlickVoiceRecorder] Failed initializing audio processing graph:', setupErr);
      this.cleanup();
      throw setupErr;
    }
  }

  private createSyntheticAudioStream(): { stream: MediaStream; audioCtx: AudioContext; analyser: AnalyserNode } | null {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      const ctx = new AudioCtxClass();
      const destination = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.5;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(4.2, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(18, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(analyser);
      gain.connect(destination);

      osc.start();

      return {
        stream: destination.stream,
        audioCtx: ctx,
        analyser
      };
    } catch (e) {
      console.warn('[FlickVoiceRecorder] Synthetic stream generator fallback error:', e);
      return null;
    }
  }

  private startAmplitudeLoop() {
    if (!this.analyser) return;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const check = () => {
      if (!this.isRecording) return;
      if (!this.isPaused && this.analyser) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        // Normalize between 0.12 and 1.0
        const norm = Math.max(0.12, Math.min(1.0, avg / 110));
        this.capturedAmplitudes.push(Number(norm.toFixed(2)));
        if (this.capturedAmplitudes.length > 80) {
          this.capturedAmplitudes.shift();
        }
        this.emitState();
      }
      this.animFrameId = requestAnimationFrame(check);
    };
    this.animFrameId = requestAnimationFrame(check);
  }

  private startSpeechRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript + ' ';
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }
        this.transcript = (this.transcript + ' ' + finalStr).trim();
        this.interimTranscript = interimStr;
        this.emitState();
      };

      recognition.onerror = (e: any) => {
        console.log('[SpeechRecognition] notice:', e?.error);
      };

      recognition.start();
      this.recognition = recognition;
    } catch (e) {
      console.warn('[SpeechRecognition] could not start', e);
    }
  }

  public pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.emitState();
    }
  }

  public resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.emitState();
    }
  }

  public async stop(): Promise<{
    audioDataUrl: string;
    blob: Blob;
    duration: number;
    waveform: number[];
    transcript: string;
  }> {
    return new Promise((resolve, reject) => {
      const getWaveform = () => {
        let waveform: number[] = [];
        if (this.capturedAmplitudes.length >= 10) {
          const count = 40;
          const step = Math.max(1, Math.floor(this.capturedAmplitudes.length / count));
          for (let i = 0; i < count; i++) {
            const idx = Math.min(this.capturedAmplitudes.length - 1, i * step);
            waveform.push(this.capturedAmplitudes[idx] || 0.2);
          }
        } else {
          waveform = Array(40).fill(0.3);
        }
        return waveform;
      };

      if (!this.mediaRecorder) {
        this.cleanup();
        reject(new Error('MediaRecorder is not active.'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          if (this.audioChunks.length === 0) {
            this.cleanup();
            reject(new Error('No audio data captured during session.'));
            return;
          }

          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mime });
          
          const reader = new FileReader();
          reader.onload = () => {
            const audioDataUrl = reader.result as string;
            const waveform = getWaveform();
            const fullTranscript = (this.transcript + ' ' + this.interimTranscript).trim();
            const duration = Math.max(1, this.durationSeconds);

            this.cleanup();
            resolve({
              audioDataUrl,
              blob,
              duration,
              waveform,
              transcript: fullTranscript,
            });
          };
          reader.onerror = (readErr) => {
            this.cleanup();
            reject(readErr);
          };
          reader.readAsDataURL(blob);
        } catch (e) {
          this.cleanup();
          reject(e);
        }
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          this.cleanup();
          reject(new Error('MediaRecorder already inactive.'));
        }
      } catch (err) {
        this.cleanup();
        reject(err);
      }
    });
  }

  public cancel() {
    this.cleanup();
  }

  public cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
    if (this.audioStream) {
      microphoneService.releaseAudioStream(this.audioStream);
      this.audioStream = null;
    }
    if (this.processedStream) {
      microphoneService.releaseAudioStream(this.processedStream);
      this.processedStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
    this.isRecording = false;
    this.isPaused = false;
    this.isLocked = false;
    this.audioChunks = [];
    this.emitState();
  }
}
