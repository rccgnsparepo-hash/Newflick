import { BackendAdapter } from './types';
import { networkModeManager } from './NetworkModeManager';

export function getActiveBackend(): BackendAdapter {
  return networkModeManager.getActiveAdapter();
}
