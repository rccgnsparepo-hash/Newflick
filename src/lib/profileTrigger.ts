/**
 * Global Profile Deep Linking Trigger
 */
import { triggerVibration } from './haptics';

export function triggerViewProfile(uid: string) {
  if (typeof window === 'undefined') return;
  triggerVibration('light');
  const event = new CustomEvent('faraflick-view-profile', { detail: { uid } });
  window.dispatchEvent(event);
}
