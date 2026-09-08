/**
 * Secure Tactile Haptics Manager 
 * Employs high-fidelity web custom vibration sequences with granular per-event trigger controls
 */

export type VibrationIntensity = 'off' | 'light' | 'medium' | 'heavy' | 'double';
export type VibrationPattern = 'off' | 'subtle' | 'light' | 'medium' | 'heavy' | 'double' | 'triple' | 'pulse' | 'sos';
export type MessageType = 'direct' | 'group' | 'system';

export type HapticTriggerEvent =
  | 'message_received'
  | 'message_sent'
  | 'like'
  | 'reaction'
  | 'long_press'
  | 'button_click'
  | 'call_incoming';

export interface HapticTriggerMetadata {
  id: HapticTriggerEvent;
  label: string;
  description: string;
  defaultEnabled: boolean;
  defaultPattern: VibrationPattern;
}

export const HAPTIC_TRIGGER_DEFINITIONS: HapticTriggerMetadata[] = [
  {
    id: 'message_received',
    label: 'Message Received',
    description: 'Distinctive tactile pulse when an inbound encrypted transmission arrives in chat.',
    defaultEnabled: true,
    defaultPattern: 'double'
  },
  {
    id: 'message_sent',
    label: 'Message Dispatched',
    description: 'Subtle tactile confirmation when a message is successfully encrypted & sent.',
    defaultEnabled: true,
    defaultPattern: 'subtle'
  },
  {
    id: 'like',
    label: 'Like & Favorite Action',
    description: 'Crisp tactile snap when liking social dispatches, stories, or profiles.',
    defaultEnabled: true,
    defaultPattern: 'light'
  },
  {
    id: 'reaction',
    label: 'Message Reaction (Emoji)',
    description: 'Tactile pop upon applying or toggling an emoji reaction to a chat bubble.',
    defaultEnabled: true,
    defaultPattern: 'medium'
  },
  {
    id: 'long_press',
    label: 'Bubble Long-Press Trigger',
    description: 'Immediate tactile kick when holding a message bubble to open the reaction dock.',
    defaultEnabled: true,
    defaultPattern: 'medium'
  },
  {
    id: 'button_click',
    label: 'Cyber Button & Keypress',
    description: 'Micro-haptic click when tapping brutalist switches, icons, or navigation buttons.',
    defaultEnabled: true,
    defaultPattern: 'subtle'
  },
  {
    id: 'call_incoming',
    label: 'Incoming Call Cadence',
    description: 'Rhythmic pulsing pattern during incoming peer-to-peer WebRTC calls.',
    defaultEnabled: true,
    defaultPattern: 'pulse'
  }
];

export function isVibrationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('flick_vibration_enabled') !== 'false';
}

export function setVibrationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('flick_vibration_enabled', enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('flick_haptics_updated'));
}

export function isHapticTriggerEnabled(event: HapticTriggerEvent): boolean {
  if (typeof window === 'undefined') return false;
  if (!isVibrationEnabled()) return false;
  const stored = localStorage.getItem(`flick_haptic_trigger_${event}`);
  if (stored !== null) {
    return stored === 'true';
  }
  const def = HAPTIC_TRIGGER_DEFINITIONS.find(t => t.id === event);
  return def ? def.defaultEnabled : true;
}

export function setHapticTriggerEnabled(event: HapticTriggerEvent, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`flick_haptic_trigger_${event}`, enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('flick_haptics_updated'));
}

export function getHapticTriggersConfig(): Record<HapticTriggerEvent, boolean> {
  const config = {} as Record<HapticTriggerEvent, boolean>;
  HAPTIC_TRIGGER_DEFINITIONS.forEach(t => {
    config[t.id] = isHapticTriggerEnabled(t.id);
  });
  return config;
}

export function getVibrationIntensity(event: 'message' | 'like'): VibrationIntensity {
  if (typeof window === 'undefined') return 'off';
  const val = localStorage.getItem(`flick_vibration_intensity_${event}`);
  if (val) return val as VibrationIntensity;
  // Defaults: medium for message, light for like
  return event === 'message' ? 'medium' : 'light';
}

export function setVibrationIntensity(event: 'message' | 'like', intensity: VibrationIntensity): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`flick_vibration_intensity_${event}`, intensity);
  window.dispatchEvent(new Event('flick_haptics_updated'));
}

// Granular haptic pattern per message type (Direct, Group, System)
export function getHapticPatternForMessageType(type: MessageType): VibrationPattern {
  if (typeof window === 'undefined') return 'medium';
  const val = localStorage.getItem(`flick_haptic_pattern_${type}`);
  if (val) return val as VibrationPattern;
  switch (type) {
    case 'direct': return 'double';
    case 'group': return 'pulse';
    case 'system': return 'heavy';
    default: return 'medium';
  }
}

export function setHapticPatternForMessageType(type: MessageType, pattern: VibrationPattern): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`flick_haptic_pattern_${type}`, pattern);
  window.dispatchEvent(new Event('flick_haptics_updated'));
}

export function triggerPatternVibration(pattern: VibrationPattern): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!navigator.vibrate) return;
  if (!isVibrationEnabled()) return;

  try {
    switch (pattern) {
      case 'off':
        break;
      case 'subtle':
        navigator.vibrate(12);
        break;
      case 'light':
        navigator.vibrate(22);
        break;
      case 'medium':
        navigator.vibrate(48);
        break;
      case 'heavy':
        navigator.vibrate(95);
        break;
      case 'double':
        navigator.vibrate([40, 50, 40]);
        break;
      case 'triple':
        navigator.vibrate([30, 40, 30, 40, 30]);
        break;
      case 'pulse':
        navigator.vibrate([80, 50, 25, 50, 80]);
        break;
      case 'sos':
        navigator.vibrate([30, 30, 30, 30, 30, 80, 80, 80, 30, 30, 30]);
        break;
    }
  } catch (err) {
    console.debug('[Haptics API] Device vibration blocked or unsupported:', err);
  }
}

export function triggerMessageTypeVibration(type: MessageType): void {
  if (!isHapticTriggerEnabled('message_received')) return;
  const pattern = getHapticPatternForMessageType(type);
  if (pattern === 'off') return;
  triggerPatternVibration(pattern);
}

export function triggerVibration(type: 'light' | 'medium' | 'heavy' | 'double'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!navigator.vibrate) return;
  if (!isVibrationEnabled()) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(18);
        break;
      case 'medium':
        navigator.vibrate(45);
        break;
      case 'heavy':
        navigator.vibrate(85);
        break;
      case 'double':
        navigator.vibrate([40, 50, 40]);
        break;
    }
  } catch (err) {
    console.debug('[Haptics API] Device vibration blocked or unsupported:', err);
  }
}

export function triggerEventVibration(event: 'message' | 'like'): void {
  const triggerKey: HapticTriggerEvent = event === 'message' ? 'message_received' : 'like';
  if (!isHapticTriggerEnabled(triggerKey)) return;
  const intensity = getVibrationIntensity(event);
  if (intensity === 'off') return;
  triggerVibration(intensity);
}

/**
 * High-level trigger function that strictly honors individual haptic trigger toggles
 */
export function triggerEventHaptic(
  event: HapticTriggerEvent,
  customPattern?: VibrationPattern | VibrationIntensity
): void {
  if (!isHapticTriggerEnabled(event)) return;

  const def = HAPTIC_TRIGGER_DEFINITIONS.find(t => t.id === event);
  const pattern = customPattern || (def ? def.defaultPattern : 'light');

  if (pattern === 'light' || pattern === 'medium' || pattern === 'heavy' || pattern === 'double') {
    triggerVibration(pattern);
  } else {
    triggerPatternVibration(pattern as VibrationPattern);
  }
}


