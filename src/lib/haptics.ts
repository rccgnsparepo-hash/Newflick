/**
 * Secure Tactile Haptics Manager 
 * Employs high-fidelity web custom vibration sequences with a check for local configurations
 */

export type VibrationIntensity = 'off' | 'light' | 'medium' | 'heavy' | 'double';
export type VibrationPattern = 'off' | 'subtle' | 'light' | 'medium' | 'heavy' | 'double' | 'triple' | 'pulse' | 'sos';
export type MessageType = 'direct' | 'group' | 'system';

export function isVibrationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('flick_vibration_enabled') !== 'false';
}

export function setVibrationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('flick_vibration_enabled', enabled ? 'true' : 'false');
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
        navigator.vibrate(10);
        break;
      case 'light':
        navigator.vibrate(20);
        break;
      case 'medium':
        navigator.vibrate(45);
        break;
      case 'heavy':
        navigator.vibrate(90);
        break;
      case 'double':
        navigator.vibrate([40, 60, 40]);
        break;
      case 'triple':
        navigator.vibrate([30, 40, 30, 40, 30]);
        break;
      case 'pulse':
        navigator.vibrate([80, 50, 20, 50, 80]);
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
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(40);
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
  const intensity = getVibrationIntensity(event);
  if (intensity === 'off') return;
  triggerVibration(intensity);
}

