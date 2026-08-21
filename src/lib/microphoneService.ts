/**
 * FLICK Unified Microphone & Media Permission Service
 * Single source of truth for microphone permissions, stream acquisition,
 * device enumeration, and hardware diagnostic tracking across Web, Electron, and Android.
 */

export type MicrophoneState =
  | 'unknown'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'error';

export interface RawAudioErrorInfo {
  name: string;
  message: string;
  constraint?: string;
  secureContext: boolean;
  mediaDevicesExists: boolean;
  protocol: string;
  hostname: string;
  origin: string;
  timestamp: number;
}

export interface PlatformDetails {
  isAndroid: boolean;
  isCapacitor: boolean;
  isCordova: boolean;
  isElectron: boolean;
  isWebView: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isChromeOrEdge: boolean;
  isSecureContext: boolean;
  browserName: string;
  osName: string;
}

export interface MicrophoneStatusInfo {
  state: MicrophoneState;
  granted: boolean;
  canPrompt: boolean;
  isBlocked: boolean;
  isUnavailable: boolean;
  audioInputDevices: MediaDeviceInfo[];
  activeDeviceLabel?: string;
  lastError: RawAudioErrorInfo | null;
  platform: PlatformDetails;
  testedAt?: number;
}

export type MicrophoneStatusListener = (status: MicrophoneStatusInfo) => void;

export class MicrophonePermissionService {
  private static instance: MicrophonePermissionService | null = null;
  private currentStatus: MicrophoneStatusInfo;
  private listeners: Set<MicrophoneStatusListener> = new Set();
  private activeStreams: Set<MediaStream> = new Set();
  private isChecking: boolean = false;

  private constructor() {
    this.currentStatus = this.getInitialStatus();
    if (typeof window !== 'undefined') {
      this.attachSystemListeners();
    }
  }

  public static getInstance(): MicrophonePermissionService {
    if (!MicrophonePermissionService.instance) {
      MicrophonePermissionService.instance = new MicrophonePermissionService();
    }
    return MicrophonePermissionService.instance;
  }

  private detectPlatform(): PlatformDetails {
    if (typeof window === 'undefined') {
      return {
        isAndroid: false,
        isCapacitor: false,
        isCordova: false,
        isElectron: false,
        isWebView: false,
        isSafari: false,
        isFirefox: false,
        isChromeOrEdge: false,
        isSecureContext: false,
        browserName: 'Server',
        osName: 'Unknown'
      };
    }

    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isCapacitor = !!(window as any).Capacitor;
    const isCordova = !!(window as any).cordova;
    const isElectron = /Electron/i.test(ua) || !!(window as any).electronAPI || !!(window as any).flickDesktop || !!(window as any).process?.versions?.electron;
    const isWebView = isAndroid && (/wv/i.test(ua) || isCapacitor || isCordova || !!(window as any).Android || !!(window as any).AndroidInterface);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isFirefox = /firefox|fxios/i.test(ua);
    const isChromeOrEdge = /chrome|chromium|edg/i.test(ua);
    const isSecureContext = !!window.isSecureContext;

    let osName = 'Unknown OS';
    if (/Windows/i.test(ua)) osName = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) osName = 'macOS';
    else if (/Linux/i.test(ua)) osName = 'Linux';
    else if (/Android/i.test(ua)) osName = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) osName = 'iOS';

    let browserName = 'Browser';
    if (isElectron) browserName = 'Electron Desktop';
    else if (isCapacitor) browserName = 'Capacitor Android/iOS App';
    else if (/Edg/i.test(ua)) browserName = 'Microsoft Edge';
    else if (/Chrome/i.test(ua)) browserName = 'Google Chrome';
    else if (/Firefox/i.test(ua)) browserName = 'Mozilla Firefox';
    else if (isSafari) browserName = 'Apple Safari';

    return {
      isAndroid,
      isCapacitor,
      isCordova,
      isElectron,
      isWebView,
      isSafari,
      isFirefox,
      isChromeOrEdge,
      isSecureContext,
      browserName,
      osName
    };
  }

  private getInitialStatus(): MicrophoneStatusInfo {
    const platform = this.detectPlatform();
    return {
      state: 'unknown',
      granted: false,
      canPrompt: true,
      isBlocked: false,
      isUnavailable: false,
      audioInputDevices: [],
      lastError: null,
      platform
    };
  }

  private attachSystemListeners() {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        this.checkMicrophonePermission().catch(() => {});
      });
    }

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        navigator.permissions.query({ name: 'microphone' as any }).then((permStatus) => {
          permStatus.onchange = () => {
            this.handlePermissionsApiChange(permStatus.state);
          };
        }).catch(() => {
          // Permissions.query({ name: 'microphone' }) is not supported in all browsers (e.g. Firefox)
        });
      } catch (e) {
        // Ignore query error
      }
    }
  }

  private handlePermissionsApiChange(state: PermissionState) {
    if (state === 'granted') {
      this.updateStatus({
        state: 'granted',
        granted: true,
        isBlocked: false,
        canPrompt: false
      });
    } else if (state === 'denied') {
      this.updateStatus({
        state: 'blocked',
        granted: false,
        isBlocked: true,
        canPrompt: false
      });
    } else {
      this.updateStatus({
        state: 'unknown',
        granted: false,
        isBlocked: false,
        canPrompt: true
      });
    }
  }

  private updateStatus(partial: Partial<MicrophoneStatusInfo>) {
    this.currentStatus = {
      ...this.currentStatus,
      ...partial,
      platform: this.detectPlatform(),
      testedAt: Date.now()
    };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentStatus);
      } catch (err) {
        console.error('[MicrophonePermissionService] Listener error:', err);
      }
    });
  }

  public subscribe(listener: MicrophoneStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.currentStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): MicrophoneStatusInfo {
    return { ...this.currentStatus };
  }

  /**
   * Triggers native Android/Capacitor bridge hooks if available
   */
  public async triggerAndroidBridges(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const w = window as any;

    try {
      if (w.AndroidInterface?.requestAudioPermission) {
        w.AndroidInterface.requestAudioPermission();
        return true;
      }
      if (w.Android?.requestMicrophonePermission) {
        w.Android.requestMicrophonePermission();
        return true;
      }
      if (w.AndroidPush?.requestPermissions) {
        w.AndroidPush.requestPermissions();
        return true;
      }
      if (w.Capacitor?.Plugins?.Permissions?.request) {
        await w.Capacitor.Plugins.Permissions.request({ name: 'microphone' });
        return true;
      }
    } catch (err) {
      console.warn('[MicrophonePermissionService] Native Android bridge trigger notice:', err);
    }
    return false;
  }

  /**
   * Triggers Electron IPC handlers if available
   */
  public async triggerElectronPermissionRequest(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const w = window as any;

    try {
      if (w.electronAPI?.requestMicrophonePermission) {
        const res = await w.electronAPI.requestMicrophonePermission();
        return !!res?.granted;
      }
      if (w.ipcRenderer?.invoke) {
        const res = await w.ipcRenderer.invoke('request-microphone-permission');
        return !!res?.granted;
      }
    } catch (err) {
      console.warn('[MicrophonePermissionService] Electron IPC request notice:', err);
    }
    return true; // Fallback to standard web getUserMedia
  }

  /**
   * Checks current microphone permission and hardware device availability without prompting
   */
  public async checkMicrophonePermission(): Promise<MicrophoneStatusInfo> {
    if (this.isChecking) return this.currentStatus;
    this.isChecking = true;

    try {
      const platform = this.detectPlatform();

      // Check Secure Context
      if (!platform.isSecureContext && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const errorInfo: RawAudioErrorInfo = {
          name: 'SecurityError',
          message: 'Microphone access is strictly restricted to Secure Contexts (HTTPS or localhost).',
          secureContext: false,
          mediaDevicesExists: !!navigator.mediaDevices,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          origin: window.location.origin,
          timestamp: Date.now()
        };
        this.updateStatus({
          state: 'error',
          granted: false,
          isBlocked: true,
          canPrompt: false,
          lastError: errorInfo
        });
        return this.currentStatus;
      }

      // Check MediaDevices support
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        const errorInfo: RawAudioErrorInfo = {
          name: 'NotSupportedError',
          message: 'navigator.mediaDevices.getUserMedia is not supported by this browser engine.',
          secureContext: platform.isSecureContext,
          mediaDevicesExists: !!navigator.mediaDevices,
          protocol: typeof window !== 'undefined' ? window.location.protocol : '',
          hostname: typeof window !== 'undefined' ? window.location.hostname : '',
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          timestamp: Date.now()
        };
        this.updateStatus({
          state: 'unavailable',
          granted: false,
          isUnavailable: true,
          canPrompt: false,
          lastError: errorInfo
        });
        return this.currentStatus;
      }

      // Enumerate audio input devices
      let audioInputs: MediaDeviceInfo[] = [];
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        audioInputs = devices.filter((d) => d.kind === 'audioinput');
      } catch (enumErr) {
        console.warn('[MicrophonePermissionService] Device enumeration notice:', enumErr);
      }

      // Check Permissions API if available
      let permState: PermissionState | null = null;
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          const p = await navigator.permissions.query({ name: 'microphone' as any });
          permState = p.state;
        } catch (e) {
          // Permissions API microphone query not implemented on this browser
        }
      }

      let state: MicrophoneState = this.currentStatus.state;
      let isBlocked = false;
      let isGranted = false;
      let canPrompt = true;

      if (permState === 'granted') {
        state = 'granted';
        isGranted = true;
        canPrompt = false;
      } else if (permState === 'denied') {
        state = 'blocked';
        isBlocked = true;
        canPrompt = false;
      } else if (permState === 'prompt') {
        state = 'unknown';
        canPrompt = true;
      } else if (audioInputs.some((d) => d.label.length > 0)) {
        // If device labels are visible, permission has already been granted in this session
        state = 'granted';
        isGranted = true;
        canPrompt = false;
      }

      this.updateStatus({
        state,
        granted: isGranted,
        canPrompt,
        isBlocked,
        isUnavailable: audioInputs.length === 0 && (state === 'granted' || permState === 'granted'),
        audioInputDevices: audioInputs
      });

      return this.currentStatus;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Explicitly requests microphone access in response to a direct user gesture.
   * Tests high-fidelity audio constraints, then falls back to baseline audio.
   */
  public async requestMicrophonePermission(customConstraints?: MediaStreamConstraints): Promise<{
    granted: boolean;
    stream?: MediaStream;
    status: MicrophoneStatusInfo;
    error?: string;
  }> {
    this.updateStatus({ state: 'requesting', canPrompt: false });

    // Step 1: Trigger native bridges on Android or Electron
    await this.triggerAndroidBridges();
    await this.triggerElectronPermissionRequest();

    const platform = this.detectPlatform();
    const loc = typeof window !== 'undefined' ? window.location : { protocol: '', hostname: '', origin: '' };

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      const errInfo: RawAudioErrorInfo = {
        name: 'NotSupportedError',
        message: 'MediaDevices getUserMedia API is unavailable in this environment.',
        secureContext: platform.isSecureContext,
        mediaDevicesExists: !!navigator.mediaDevices,
        protocol: loc.protocol,
        hostname: loc.hostname,
        origin: loc.origin,
        timestamp: Date.now()
      };
      this.updateStatus({
        state: 'unavailable',
        granted: false,
        isUnavailable: true,
        lastError: errInfo
      });
      return { granted: false, status: this.currentStatus, error: errInfo.message };
    }

    // Step 2: Try Tier 1 with studio-grade noise suppression and echo cancellation
    const tier1Constraints: MediaStreamConstraints = customConstraints || {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    };

    let acquiredStream: MediaStream | null = null;
    let rawError: any = null;

    try {
      acquiredStream = await navigator.mediaDevices.getUserMedia(tier1Constraints);
    } catch (t1Err: any) {
      console.warn('[MicrophonePermissionService] Tier 1 constraint error:', t1Err?.name, t1Err?.message);
      rawError = t1Err;

      // Step 3: Try Tier 2 baseline constraints ({ audio: true })
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        rawError = null; // Baseline succeeded
      } catch (t2Err: any) {
        console.warn('[MicrophonePermissionService] Tier 2 baseline error:', t2Err?.name, t2Err?.message);
        rawError = t2Err;
      }
    }

    // If stream was successfully acquired:
    if (acquiredStream) {
      this.activeStreams.add(acquiredStream);
      
      // Enumerate devices now that permission is granted to capture device labels
      let audioInputs: MediaDeviceInfo[] = [];
      let activeLabel = '';
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        audioInputs = devices.filter((d) => d.kind === 'audioinput');
        const activeTrack = acquiredStream.getAudioTracks()[0];
        if (activeTrack) {
          activeLabel = activeTrack.label || audioInputs[0]?.label || 'Default Microphone';
        }
      } catch (e) {
        // Ignore enumeration errors
      }

      this.updateStatus({
        state: 'granted',
        granted: true,
        canPrompt: false,
        isBlocked: false,
        isUnavailable: false,
        audioInputDevices: audioInputs,
        activeDeviceLabel: activeLabel,
        lastError: null
      });

      return {
        granted: true,
        stream: acquiredStream,
        status: this.currentStatus
      };
    }

    // Process and categorize raw error
    const errName = rawError?.name || 'UnknownError';
    const errMessage = rawError?.message || 'Failed to acquire microphone stream.';
    const errConstraint = rawError?.constraint;

    const errorDetails: RawAudioErrorInfo = {
      name: errName,
      message: errMessage,
      constraint: errConstraint,
      secureContext: platform.isSecureContext,
      mediaDevicesExists: !!navigator.mediaDevices,
      protocol: loc.protocol,
      hostname: loc.hostname,
      origin: loc.origin,
      timestamp: Date.now()
    };

    let newState: MicrophoneState = 'error';
    let isBlocked = false;
    let isUnavailable = false;
    let friendlyMessage = errMessage;

    switch (errName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        // If the browser rejected without a prompt or user denied, mark blocked
        newState = 'blocked';
        isBlocked = true;
        friendlyMessage = 'Microphone access was blocked or denied by browser permission settings.';
        break;

      case 'NotFoundError':
      case 'DevicesNotFoundError':
        newState = 'unavailable';
        isUnavailable = true;
        friendlyMessage = 'No active microphone hardware was detected on this device.';
        break;

      case 'NotReadableError':
      case 'TrackStartError':
        newState = 'unavailable';
        isUnavailable = true;
        friendlyMessage = 'The microphone is already in use by another program, tab, or operating system process.';
        break;

      case 'OverconstrainedError':
        newState = 'error';
        friendlyMessage = `Audio hardware does not support requested constraint: ${errConstraint || 'unknown'}.`;
        break;

      case 'SecurityError':
        newState = 'blocked';
        isBlocked = true;
        friendlyMessage = 'Microphone is blocked by document Permissions-Policy or non-secure HTTP context.';
        break;

      case 'TypeError':
        newState = 'error';
        friendlyMessage = 'Invalid audio constraints passed to getUserMedia.';
        break;

      default:
        newState = 'denied';
        friendlyMessage = `Microphone access error (${errName}): ${errMessage}`;
        break;
    }

    this.updateStatus({
      state: newState,
      granted: false,
      canPrompt: newState === 'denied',
      isBlocked,
      isUnavailable,
      lastError: errorDetails
    });

    return {
      granted: false,
      status: this.currentStatus,
      error: friendlyMessage
    };
  }

  /**
   * Creates an active audio MediaStream for recording or WebRTC calling.
   * Throws a descriptive error if microphone access is not granted.
   */
  public async createAudioStream(options?: {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    deviceId?: string;
  }): Promise<MediaStream> {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: options?.echoCancellation !== false,
      noiseSuppression: options?.noiseSuppression !== false,
      autoGainControl: options?.autoGainControl !== false,
      channelCount: 1
    };

    if (options?.deviceId) {
      audioConstraints.deviceId = { exact: options.deviceId };
    }

    const result = await this.requestMicrophonePermission({ audio: audioConstraints });

    if (!result.granted || !result.stream) {
      const err = new Error(result.error || 'Failed to acquire microphone audio stream');
      err.name = result.status.lastError?.name || 'MicrophoneAccessError';
      throw err;
    }

    return result.stream;
  }

  /**
   * Releases and stops all tracks on a MediaStream to immediately deactivate
   * the operating system's microphone indicator.
   */
  public releaseAudioStream(stream?: MediaStream | null): void {
    if (!stream) return;
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // Track already stopped
        }
      });
      this.activeStreams.delete(stream);
    } catch (e) {
      console.warn('[MicrophonePermissionService] Release stream notice:', e);
    }
  }

  /**
   * Releases all tracked active streams across the entire application.
   */
  public releaseAllStreams(): void {
    this.activeStreams.forEach((s) => this.releaseAudioStream(s));
    this.activeStreams.clear();
  }

  /**
   * Resets local cached permission error state to allow clean retry
   */
  public resetPermissionState(): void {
    this.updateStatus({
      state: 'unknown',
      granted: false,
      canPrompt: true,
      isBlocked: false,
      isUnavailable: false,
      lastError: null
    });
    this.checkMicrophonePermission().catch(() => {});
  }
}

export const microphoneService = MicrophonePermissionService.getInstance();
export const checkMicrophonePermission = () => microphoneService.checkMicrophonePermission();
export const requestMicrophonePermission = (customConstraints?: MediaStreamConstraints) => microphoneService.requestMicrophonePermission(customConstraints);
export const createAudioStream = (options?: {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  deviceId?: string;
}) => microphoneService.createAudioStream(options);
export const releaseAudioStream = (stream?: MediaStream | null) => microphoneService.releaseAudioStream(stream);
export const releaseAllStreams = () => microphoneService.releaseAllStreams();

export default microphoneService;
