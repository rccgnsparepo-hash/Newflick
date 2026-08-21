import { microphoneService, MicrophoneStatusInfo, MicrophonePermissionService, checkMicrophonePermission } from './microphoneService';

export { microphoneService, MicrophonePermissionService, checkMicrophonePermission };
export type { MicrophoneStatusInfo, MicrophoneState, RawAudioErrorInfo } from './microphoneService';

export interface PermissionStatusResult {
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'unavailable' | 'blocked' | 'error';
  stream?: MediaStream;
  error?: string;
}

/**
 * Checks platform environment
 */
export function getPlatformEnvironment() {
  const status = microphoneService.getStatus();
  return status.platform;
}

/**
 * Trigger Android Native Permission Bridges (if hosted inside Android APK or WebView)
 */
export async function triggerAndroidNativePermissions(permissionType: 'audio' | 'camera' | 'all' = 'all'): Promise<boolean> {
  if (permissionType === 'audio' || permissionType === 'all') {
    await microphoneService.triggerAndroidBridges();
  }

  if (typeof window === 'undefined') return false;
  const w = window as any;

  try {
    if (w.AndroidInterface?.requestCameraPermission && (permissionType === 'camera' || permissionType === 'all')) {
      w.AndroidInterface.requestCameraPermission();
      return true;
    }
    if (w.Capacitor?.Plugins?.Permissions?.request) {
      await w.Capacitor.Plugins.Permissions.request({ name: permissionType === 'camera' ? 'camera' : 'microphone' });
      return true;
    }
  } catch (err) {
    console.warn('[Permissions] Native bridge trigger notice:', err);
  }

  return false;
}

/**
 * Universal Microphone Permission & Stream Acquisition
 * Uses the central MicrophonePermissionService
 */
export async function requestMicrophonePermission(): Promise<PermissionStatusResult> {
  const res = await microphoneService.requestMicrophonePermission();
  return {
    granted: res.granted,
    state: res.status.state as any,
    stream: res.stream,
    error: res.error
  };
}

/**
 * Universal Camera Permission & Stream Acquisition
 */
export async function requestCameraPermission(): Promise<PermissionStatusResult> {
  if (typeof window === 'undefined') {
    return { granted: false, state: 'unavailable', error: 'Window context missing' };
  }

  await triggerAndroidNativePermissions('camera');

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { granted: false, state: 'unavailable', error: 'MediaDevices API not supported' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    return { granted: true, state: 'granted', stream };
  } catch (err: any) {
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      return { granted: true, state: 'granted', stream: fallbackStream };
    } catch (fallbackErr: any) {
      return {
        granted: false,
        state: 'denied',
        error: fallbackErr?.message || 'Camera permission denied or camera unavailable'
      };
    }
  }
}

/**
 * Returns the best supported MediaRecorder MIME type on current device
 */
export function getOptimalAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];

  for (const t of types) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }

  return 'audio/webm';
}

/**
 * Resilient Voice-to-Text Speech Recognition Initializer
 */
export function createSpeechRecognitionInstance(): {
  recognition: any | null;
  supported: boolean;
  error?: string;
} {
  if (typeof window === 'undefined') {
    return { recognition: null, supported: false, error: 'Window undefined' };
  }

  const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return {
      recognition: null,
      supported: false,
      error: 'Speech Recognition API not supported in this browser engine.'
    };
  }

  try {
    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    return { recognition: rec, supported: true };
  } catch (e: any) {
    return {
      recognition: null,
      supported: false,
      error: e?.message || 'Failed initializing Speech Recognition'
    };
  }
}
