/**
 * Secure Tactile Haptics Manager 
 * Employs high-fidelity web custom vibration sequences with granular per-event trigger controls
 * and configurable vibration intensity for messages, incoming calls, button clicks, and reactions.
 */

export type VibrationIntensity = 'off' | 'subtle' | 'light' | 'medium' | 'heavy' | 'double';
export type VibrationPattern = 'off' | 'subtle' | 'light' | 'medium' | 'heavy' | 'double' | 'triple' | 'pulse' | 'sos';
export type MessageType = 'direct' | 'group' | 'system';

export type HapticAction = 'message' | 'call_incoming' | 'button_click' | 'like' | 'global';

export type HapticTriggerEvent =
  | 'message_received'
  | 'message_sent'
  | 'call_incoming'
  | 'button_click'
  | 'like'
  | 'reaction'
  | 'long_press';

export interface HapticTriggerMetadata {
  id: HapticTriggerEvent;
  label: string;
  category: 'messages' | 'calls' | 'interactions';
  description: string;
  defaultEnabled: boolean;
  defaultPattern: VibrationPattern;
}

export const HAPTIC_TRIGGER_DEFINITIONS: HapticTriggerMetadata[] = [
  {
    id: 'message_received',
    label: 'Inbound Message Arrival',
    category: 'messages',
    description: 'Distinctive tactile pulse when an inbound encrypted transmission arrives in chat.',
    defaultEnabled: true,
    defaultPattern: 'double'
  },
  {
    id: 'message_sent',
    label: 'Message Dispatched',
    category: 'messages',
    description: 'Subtle tactile confirmation when a message is successfully encrypted & sent.',
    defaultEnabled: true,
    defaultPattern: 'subtle'
  },
  {
    id: 'call_incoming',
    label: 'Incoming Call Cadence',
    category: 'calls',
    description: 'Rhythmic pulsing pattern during incoming peer-to-peer WebRTC calls.',
    defaultEnabled: true,
    defaultPattern: 'pulse'
  },
  {
    id: 'button_click',
    label: 'Button & Keypress Clicks',
    category: 'interactions',
    description: 'Micro-haptic click when tapping brutalist switches, icons, or navigation buttons.',
    defaultEnabled: true,
    defaultPattern: 'subtle'
  },
  {
    id: 'like',
    label: 'Likes & Favorites',
    category: 'interactions',
    description: 'Crisp tactile snap when liking social dispatches, stories, or profiles.',
    defaultEnabled: true,
    defaultPattern: 'light'
  },
  {
    id: 'reaction',
    label: 'Message Reaction (Emoji)',
    category: 'interactions',
    description: 'Tactile pop upon applying or toggling an emoji reaction to a chat bubble.',
    defaultEnabled: true,
    defaultPattern: 'medium'
  },
  {
    id: 'long_press',
    label: 'Bubble Long-Press Trigger',
    category: 'interactions',
    description: 'Immediate tactile kick when holding a message bubble to open the reaction dock.',
    defaultEnabled: true,
    defaultPattern: 'medium'
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

/**
 * Gets configured intensity for a specific action or global fallback.
 */
export function getVibrationIntensity(action: HapticAction | string): VibrationIntensity {
  if (typeof window === 'undefined') return 'off';
  const val = localStorage.getItem(`flick_vibration_intensity_${action}`);
  if (val) return val as VibrationIntensity;
  
  // Default values per action
  switch (action) {
    case 'call_incoming':
      return 'heavy';
    case 'message':
    case 'message_received':
      return 'medium';
    case 'button_click':
      return 'subtle';
    case 'like':
    case 'reaction':
      return 'light';
    case 'global':
    default:
      return 'medium';
  }
}

/**
 * Sets configured intensity for a specific action.
 */
export function setVibrationIntensity(action: HapticAction | string, intensity: VibrationIntensity): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`flick_vibration_intensity_${action}`, intensity);
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

export function triggerMessageTypeVibration(type: MessageType): void {
  if (!isHapticTriggerEnabled('message_received')) return;
  const pattern = getHapticPatternForMessageType(type);
  if (pattern === 'off') return;
  triggerPatternVibration(pattern);
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

export function triggerVibration(type: VibrationIntensity | 'light' | 'medium' | 'heavy' | 'double'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!navigator.vibrate) return;
  if (!isVibrationEnabled()) return;

  try {
    switch (type) {
      case 'off':
        break;
      case 'subtle':
        navigator.vibrate(12);
        break;
      case 'light':
        navigator.vibrate(20);
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
 * High-level trigger function that strictly honors individual haptic trigger toggles and intensity
 */
export function triggerEventHaptic(
  event: HapticTriggerEvent,
  customPatternOrIntensity?: VibrationPattern | VibrationIntensity
): void {
  if (!isVibrationEnabled()) return;
  if (!isHapticTriggerEnabled(event)) return;

  // Determine action intensity mapping
  let actionKey: HapticAction = 'global';
  if (event === 'message_received' || event === 'message_sent') {
    actionKey = 'message';
  } else if (event === 'call_incoming') {
    actionKey = 'call_incoming';
  } else if (event === 'button_click') {
    actionKey = 'button_click';
  } else if (event === 'like' || event === 'reaction') {
    actionKey = 'like';
  }

  const configuredIntensity = getVibrationIntensity(actionKey);
  if (configuredIntensity === 'off') return;

  if (customPatternOrIntensity) {
    if (customPatternOrIntensity === 'off') return;
    if (['subtle', 'light', 'medium', 'heavy', 'double'].includes(customPatternOrIntensity)) {
      triggerVibration(customPatternOrIntensity as VibrationIntensity);
    } else {
      triggerPatternVibration(customPatternOrIntensity as VibrationPattern);
    }
    return;
  }

  // Trigger based on configured action intensity
  if (actionKey === 'call_incoming') {
    if (configuredIntensity === 'double') {
      triggerPatternVibration('double');
    } else if (configuredIntensity === 'heavy') {
      triggerPatternVibration('pulse');
    } else {
      triggerVibration(configuredIntensity);
    }
  } else {
    triggerVibration(configuredIntensity);
  }
}
