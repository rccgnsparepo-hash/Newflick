/**
 * Universal Permission & Hardware Bridge Manager for Flick
 * Handles cross-platform permissions: Android APK (WebView/Capacitor/Cordova),
 * Electron Desktop, iOS Safari, and Browser Web standards.
 */

export interface PermissionStatusResult {
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'unavailable';
  stream?: MediaStream;
  error?: string;
}

/**
 * Checks platform environment
 */
export function getPlatformEnvironment() {
  if (typeof window === 'undefined') {
    return { isAndroid: false, isCapacitor: false, isCordova: false, isElectron: false, isWebView: false };
  }

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isElectron = /Electron/i.test(ua) || !!(window as any).electronAPI || !!(window as any).flickDesktop;
  const isCapacitor = !!(window as any).Capacitor;
  const isCordova = !!(window as any).cordova;
  const isWebView = isAndroid && (/wv/i.test(ua) || isCapacitor || isCordova || !!(window as any).Android || !!(window as any).AndroidInterface);

  return { isAndroid, isCapacitor, isCordova, isElectron, isWebView };
}

/**
 * Trigger Android Native Permission Bridges (if hosted inside Android APK or WebView)
 */
export async function triggerAndroidNativePermissions(permissionType: 'audio' | 'camera' | 'all' = 'all'): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const w = window as any;

  try {
    // 1. Android Native Javascript Interface
    if (w.AndroidInterface) {
      if (permissionType === 'audio' && typeof w.AndroidInterface.requestAudioPermission === 'function') {
        w.AndroidInterface.requestAudioPermission();
        return true;
      }
      if (permissionType === 'camera' && typeof w.AndroidInterface.requestCameraPermission === 'function') {
        w.AndroidInterface.requestCameraPermission();
        return true;
      }
      if (typeof w.AndroidInterface.requestAllPermissions === 'function') {
        w.AndroidInterface.requestAllPermissions();
        return true;
      }
    }

    // 2. Generic Android bridge
    if (w.Android) {
      if (typeof w.Android.requestMicrophonePermission === 'function') {
        w.Android.requestMicrophonePermission();
        return true;
      }
      if (typeof w.Android.requestPermissions === 'function') {
        w.Android.requestPermissions();
        return true;
      }
    }

    // 3. AndroidPush bridge
    if (w.AndroidPush && typeof w.AndroidPush.requestPermissions === 'function') {
      w.AndroidPush.requestPermissions();
      return true;
    }

    // 4. Capacitor native plugins
    if (w.Capacitor && w.Capacitor.Plugins) {
      const { Permissions, Camera } = w.Capacitor.Plugins;
      if (Permissions && typeof Permissions.request === 'function') {
        await Permissions.request({ name: permissionType === 'camera' ? 'camera' : 'microphone' });
        return true;
      }
    }

    // 5. iOS WebKit message handlers
    if (w.webkit?.messageHandlers?.permission?.postMessage) {
      w.webkit.messageHandlers.permission.postMessage({ type: permissionType });
      return true;
    }
  } catch (err) {
    console.warn('[Permissions] Native Android bridge trigger notice:', err);
  }

  return false;
}

/**
 * Universal Microphone Permission & Stream Acquisition
 * Implements multi-tier fallback for Android APKs, WebViews, and sandboxed iframes.
 */
export async function requestMicrophonePermission(): Promise<PermissionStatusResult> {
  if (typeof window === 'undefined') {
    return { granted: false, state: 'unavailable', error: 'Window context missing' };
  }

  // Trigger any active Android bridges first
  await triggerAndroidNativePermissions('audio');

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return {
      granted: false,
      state: 'unavailable',
      error: 'MediaDevices API not supported on this browser/platform'
    };
  }

  // Tier 1: Try with standard audio constraints
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      }
    });
    return { granted: true, state: 'granted', stream };
  } catch (tier1Err: any) {
    console.warn('[Permissions] Tier 1 Mic constraint request error:', tier1Err?.name, tier1Err?.message);

    // Tier 2: Try basic { audio: true } constraints
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { granted: true, state: 'granted', stream: fallbackStream };
    } catch (tier2Err: any) {
      console.warn('[Permissions] Tier 2 Basic Mic request error:', tier2Err?.name, tier2Err?.message);

      const errName = tier2Err?.name || '';
      let state: 'denied' | 'prompt' | 'unavailable' = 'denied';
      let errorMsg = 'Microphone access denied or blocked.';

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        state = 'denied';
        errorMsg = 'Microphone permission was denied by user or system policy.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        state = 'unavailable';
        errorMsg = 'No physical microphone hardware detected on this device.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        state = 'unavailable';
        errorMsg = 'Microphone is currently in use by another application or background process.';
      } else if (errName === 'SecurityError') {
        state = 'denied';
        errorMsg = 'Security restriction or iframe permission policy is blocking microphone access.';
      }

      return { granted: false, state, error: errorMsg };
    }
  }
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
