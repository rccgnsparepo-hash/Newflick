/**
 * Voice Capture Engine for Flick
 * Real-time amplitude metering, audio recording, hands-free locking,
 * live speech-to-text transcription, and audio processing.
 */

export type VoiceEffectPreset = 'natural' | 'studio' | 'crisp' | 'bass' | 'cyber';

export interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isLocked: boolean;
  durationSeconds: number;
  liveAmplitudes: number[]; // Rolling 30-amplitude array for real-time visualizer
  currentTranscript: string;
  interimTranscript: string;
  effect: VoiceEffectPreset;
}

export class FlickVoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
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
  private effect: VoiceEffectPreset = 'natural';
  private transcript: string = '';
  private interimTranscript: string = '';

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
      });
    }
  }

  public async startRecording(): Promise<void> {
    this.cleanup();
    this.audioChunks = [];
    this.capturedAmplitudes = [];
    this.durationSeconds = 0;
    this.transcript = '';
    this.interimTranscript = '';
    this.isRecording = true;
    this.isPaused = false;
    this.isLocked = false;

    try {
      // High fidelity audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        }
      });
      this.audioStream = stream;

      // Audio Context for live waveform amplitude analysis
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        this.audioCtx = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        this.analyser = analyser;

        this.startAmplitudeLoop();
      }

      // MediaRecorder with best supported mimeType
      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      recorder.start(100); // 100ms time slices

      // Live Speech-to-Text transcription (in-browser SpeechRecognition)
      this.startSpeechRecognition();

      // Duration counter
      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          this.durationSeconds += 1;
          this.emitState();
        }
      }, 1000);

      this.emitState();
    } catch (err) {
      this.cleanup();
      throw err;
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
        // Normalize between 0.1 and 1.0
        const norm = Math.max(0.1, Math.min(1.0, avg / 120));
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
        console.log('[SpeechRecognition] non-fatal notice:', e.error);
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
      if (!this.mediaRecorder) {
        return reject(new Error('No active recording'));
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mime });
          
          // Convert to Data URL
          const reader = new FileReader();
          reader.onload = async () => {
            const audioDataUrl = reader.result as string;
            
            // Build downsampled 40-point waveform
            let waveform: number[] = [];
            if (this.capturedAmplitudes.length >= 10) {
              const count = 40;
              const step = Math.max(1, Math.floor(this.capturedAmplitudes.length / count));
              for (let i = 0; i < count; i++) {
                const idx = Math.min(this.capturedAmplitudes.length - 1, i * step);
                waveform.push(this.capturedAmplitudes[idx] || 0.2);
              }
            } else {
              waveform = Array(40).fill(0.35);
            }

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
          reader.onerror = () => {
            this.cleanup();
            reject(new Error('Failed to read recorded audio'));
          };
          reader.readAsDataURL(blob);
        } catch (e) {
          this.cleanup();
          reject(e);
        }
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    });
  }

  public cancel() {
    this.cleanup();
  }

  private cleanup() {
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
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
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
