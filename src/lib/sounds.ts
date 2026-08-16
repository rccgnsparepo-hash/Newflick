// Self-contained sound synthesizer using the native Web Audio API
// No static media file dependency to avoid cross-origin, latency, or 404 hazards.

let audioCtx: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const legacy = localStorage.getItem('flick_sound_enabled');
  const interaction = localStorage.getItem('flick_interaction_sounds_enabled');
  if (interaction !== null) {
    return interaction !== 'false';
  }
  return legacy !== 'false';
}

export function isInteractionSoundsEnabled(): boolean {
  return isSoundEnabled();
}

export function setInteractionSoundsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('flick_sound_enabled', enabled ? 'true' : 'false');
  localStorage.setItem('flick_interaction_sounds_enabled', enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('flick_sounds_updated'));
}

export function isTypingSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  if (!isInteractionSoundsEnabled()) return false;
  return localStorage.getItem('flick_sound_typing_enabled') !== 'false';
}

export function isSendMessageSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  if (!isInteractionSoundsEnabled()) return false;
  return localStorage.getItem('flick_sound_send_enabled') !== 'false';
}

export function isReceiveMessageSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  if (!isInteractionSoundsEnabled()) return false;
  return localStorage.getItem('flick_sound_receive_enabled') !== 'false';
}

export function isReadMessageSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  if (!isInteractionSoundsEnabled()) return false;
  return localStorage.getItem('flick_sound_read_enabled') !== 'false';
}

export type TypingSoundStyle = 'modern' | 'thock' | 'bubble' | 'cyber' | 'clack';

export function getTypingSoundStyle(): TypingSoundStyle {
  if (typeof window === 'undefined') return 'modern';
  return (localStorage.getItem('flick_typing_sound_style') as TypingSoundStyle) || 'modern';
}

export function setTypingSoundStyle(style: TypingSoundStyle): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('flick_typing_sound_style', style);
  window.dispatchEvent(new Event('flick_sounds_updated'));
}

export function setSoundSetting(key: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('flick_sounds_updated'));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!isSoundEnabled()) return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  // Resume context if suspended (browser security blocks autoplay of sound without prior user interaction)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Low-overhead noise buffer cache for physical key switches
let keyNoiseBuffer: AudioBuffer | null = null;
function getKeyNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!keyNoiseBuffer || keyNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.05); // 50ms buffer
    keyNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = keyNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }
  return keyNoiseBuffer;
}

/**
 * Play a satisfying, realistic keyboard typing keystroke sound
 * with subtle natural pitch variation so rapid typing feels organic.
 */
let lastTypingSoundTime = 0;
export function playTypingSound(key?: string, customStyle?: TypingSoundStyle) {
  if (!isTypingSoundEnabled()) return;

  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  // Minimum 25ms threshold between typing sounds to prevent chaotic stacking while preserving high-speed typing feel
  if (nowMs - lastTypingSoundTime < 25) return;
  lastTypingSoundTime = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const style = customStyle || getTypingSoundStyle();

  // Deterministic or organic pitch jitter
  const pitchJitter = 0.92 + Math.random() * 0.16; // +/- 8%
  const isSpaceOrEnter = key === ' ' || key === 'Enter' || key === 'Space';
  const spaceMultiplier = isSpaceOrEnter ? 0.75 : 1.0;

  try {
    if (style === 'thock') {
      // 1. Mechanical "Thock" (Subtle low-end transient + tactile snap)
      const baseFreq = 460 * pitchJitter * spaceMultiplier;
      
      // Tone body
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.035);
      
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      // Transient snap
      const noise = ctx.createBufferSource();
      noise.buffer = getKeyNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 * pitchJitter, now);
      filter.Q.setValueAtTime(3.5, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.06, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
      noise.start(now);
      noise.stop(now + 0.025);

    } else if (style === 'bubble') {
      // 2. Bubble Pop (Soft tactile liquid droplet)
      const baseFreq = 750 * pitchJitter * spaceMultiplier;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.85, now + 0.028);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);

    } else if (style === 'cyber') {
      // 3. Cyber Zap / Tech Tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800 * pitchJitter * spaceMultiplier, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.02);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.022);

    } else if (style === 'clack') {
      // 4. Classic Typewriter / Mechanical Clack
      const baseFreq = 1200 * pitchJitter * spaceMultiplier;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.setValueAtTime(baseFreq * 0.5, now + 0.01);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.025);

    } else {
      // Default: Modern Tactile Click (crisp, pleasant, non-intrusive)
      const baseFreq = 950 * pitchJitter * spaceMultiplier;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 1.5, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.025);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      // Micro top click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(2200 * pitchJitter, now);
      clickGain.gain.setValueAtTime(0.05, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    }
  } catch (e) {
    // Graceful fallback if audio is temporarily interrupted
  }
}

/**
 * Play a beautiful E2EE message sent chime (whoosh + bright pop)
 */
export function playSendMessageSound() {
  if (!isInteractionSoundsEnabled() || !isSendMessageSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // High-frequency digital soft chime
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, now); // C5
  osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.12); // C6
  osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.18); // E6

  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.26);
}

// Named registry alias for Message Sent status transition
export const playMessageSentSound = playSendMessageSound;

/**
 * Play an E2EE message received double whistle / alert chime
 */
export function playReceiveMessageSound() {
  if (!isInteractionSoundsEnabled() || !isReceiveMessageSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // First beep
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880.00, now); // A5
  osc1.frequency.exponentialRampToValueAtTime(1320.00, now + 0.08); // E6
  gain1.gain.setValueAtTime(0.08, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.12);

  // Second beep (staggered slightly)
  const delay = 0.11;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1046.50, now + delay); // C6
  osc2.frequency.exponentialRampToValueAtTime(1567.98, now + delay + 0.12); // G6
  gain2.gain.setValueAtTime(0.08, now + delay);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + delay);
  osc2.stop(now + delay + 0.18);
}

// Named registry alias for Message Received status transition
export const playMessageReceivedSound = playReceiveMessageSound;

/**
 * Play message read / seen receipt sound (crisp double tick chime)
 */
export function playMessageReadSound() {
  if (!isInteractionSoundsEnabled() || !isReadMessageSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // First tick
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1760.00, now); // A6
  osc1.frequency.exponentialRampToValueAtTime(2637.02, now + 0.03); // E7
  gain1.gain.setValueAtTime(0.07, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.045);

  // Second micro tick for that signature double-check feedback
  const delay = 0.045;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2093.00, now + delay); // C7
  osc2.frequency.exponentialRampToValueAtTime(3135.96, now + delay + 0.04); // G7
  gain2.gain.setValueAtTime(0.07, now + delay);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + delay);
  osc2.stop(now + delay + 0.06);
}

/**
 * Play message delivered receipt sound (single high tick)
 */
export function playMessageDeliveredSound() {
  if (!isInteractionSoundsEnabled() || !isReadMessageSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1567.98, now); // G6
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.035);
}

/**
 * Play a heart reaction/like sound sweep
 */
export function playLikeSound() {
  if (!isInteractionSoundsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(349.23, now); // F4
  osc.frequency.exponentialRampToValueAtTime(698.46, now + 0.2); // F5

  gain.gain.setValueAtTime(0.0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Play a glitch tech feedback noise
 */
export function playGlitchClickSound() {
  if (!isInteractionSoundsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.setValueAtTime(40, now + 0.04);

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

/**
 * Play custom sound for a specific contact group
 */
export function playGroupNotificationSound(groupKey: 'vip' | 'direct' | 'group' | 'other') {
  if (!isSoundEnabled() || !isReceiveMessageSoundEnabled()) return;

  const soundType = localStorage.getItem(`flick_sound_type_${groupKey}`) || 'default';
  
  if (soundType === 'custom') {
    const customData = localStorage.getItem(`flick_sound_data_${groupKey}`);
    if (customData) {
      try {
        const audio = new Audio(customData);
        audio.volume = 0.5;
        audio.play().catch(() => {
          playSynthesizedLibrarySound('default', groupKey);
        });
        return;
      } catch (e) {
        console.warn("Custom sound playing failed, falling back:", e);
      }
    }
  }

  // Play synthesized library sound
  playSynthesizedLibrarySound(soundType, groupKey);
}

function playSynthesizedLibrarySound(soundType: string, groupKey: string) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (soundType === 'cosmic') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (soundType === 'glitch') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(80, now + 0.05);
    osc.frequency.setValueAtTime(220, now + 0.1);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (soundType === 'ring') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } else {
    // Default fallback (double whistle)
    playReceiveMessageSound();
  }
}

/**
 * Play the correct incoming message sound based on context
 */
export function playIncomingMessageSound(senderId?: string, isGroup?: boolean) {
  if (!isSoundEnabled() || !isReceiveMessageSoundEnabled()) return;

  try {
    const cachedProfileStr = localStorage.getItem('flick_cached_profile');
    if (cachedProfileStr) {
      const cachedProfile = JSON.parse(cachedProfileStr);
      // Silent Mode check
      if (cachedProfile.notifSilentMode === true) return;
      
      // VIP Sender check
      if (senderId && cachedProfile.notifMessagesFrom?.includes(senderId)) {
        playGroupNotificationSound('vip');
        return;
      }
    }
  } catch (e) {
    console.warn("Error parsing cached profile for incoming sound routing:", e);
  }

  if (isGroup) {
    playGroupNotificationSound('group');
  } else {
    playGroupNotificationSound('direct');
  }
}

let ringtoneInterval: any = null;

export function startRingtoneSound() {
  if (!isSoundEnabled()) return;
  stopRingtoneSound();

  const playPulse = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc2.frequency.setValueAtTime(480, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.2);
    osc2.stop(now + 1.2);
  };

  playPulse();
  ringtoneInterval = setInterval(playPulse, 2200);
}

export function stopRingtoneSound() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

export function playCallConnectedSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  [523.25, 659.25, 783.99].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.1);
    gain.gain.setValueAtTime(0.08, now + idx * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.1);
    osc.stop(now + idx * 0.1 + 0.15);
  });
}

export function playCallEndSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  [440, 349.23, 261.63].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + idx * 0.12);
    gain.gain.setValueAtTime(0.07, now + idx * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.12);
    osc.stop(now + idx * 0.12 + 0.18);
  });
}

