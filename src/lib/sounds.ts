// Self-contained sound synthesizer using the native Web Audio API
// No static media file dependency to avoid cross-origin, latency, or 404 hazards.

let audioCtx: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('flick_sound_enabled') !== 'false';
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

/**
 * Play a beautiful E2EE message sent chime
 */
export function playSendMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // High-frequency digital soft chime
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, now); // C5
  osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Play an E2EE message received double whistle
 */
export function playReceiveMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // First beep
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880.00, now); // A5
  osc1.frequency.exponentialRampToValueAtTime(1320.00, now + 0.08); // E6
  gain1.gain.setValueAtTime(0.07, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.12);

  // Second beep (staggered slightly)
  const delay = 0.12;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(987.77, now + delay); // B5
  osc2.frequency.exponentialRampToValueAtTime(1567.98, now + delay + 0.12); // G6
  gain2.gain.setValueAtTime(0.07, now + delay);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + delay);
  osc2.stop(now + delay + 0.18);
}

/**
 * Play a heart reaction/like sound sweep
 */
export function playLikeSound() {
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
  if (!isSoundEnabled()) return;

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
  if (!isSoundEnabled()) return;

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
