/**
 * Secure Tactile Haptics Manager 
 * Employs high-fidelity web custom vibration sequences with a check for local configurations
 */

export type VibrationIntensity = 'off' | 'light' | 'medium' | 'heavy' | 'double';

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
