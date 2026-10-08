/**
 * Centralized Authentication Diagnostics Engine
 * Tracks and logs authentication lifecycle events across Web and Desktop (Electron/EXE) platforms.
 * 
 * SECURITY NOTICE:
 * Never logs passwords, access tokens, refresh tokens, private keys, or sensitive credential values.
 */

export interface AuthDiagnosticEvent {
  timestamp: string;
  category: 'INIT' | 'LOGIN' | 'SIGNUP' | 'GOOGLE_OAUTH' | 'SESSION' | 'KEY_VERIFY' | 'ERROR';
  method: string;
  status: 'STARTED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'RECOVERED';
  projectId: string;
  platform: 'desktop-electron' | 'web-browser' | 'standalone-protocol';
  protocol: string;
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, any>;
}

class AuthDiagnosticsTracker {
  private events: AuthDiagnosticEvent[] = [];
  private maxEvents = 100;

  public getPlatform(): 'desktop-electron' | 'web-browser' | 'standalone-protocol' {
    if (typeof window === 'undefined') return 'web-browser';
    const isElectron = !!(window as any).process?.versions?.electron || 
                       !!(window as any).electronAPI || 
                       !!(window as any).require ||
                       navigator.userAgent.includes('Electron');
    if (isElectron) return 'desktop-electron';
    if (window.location.protocol === 'file:' || window.location.protocol === 'capacitor:' || window.location.protocol === 'app:') {
      return 'standalone-protocol';
    }
    return 'web-browser';
  }

  public logEvent(
    category: AuthDiagnosticEvent['category'],
    method: string,
    status: AuthDiagnosticEvent['status'],
    projectId: string,
    extra?: {
      errorCode?: string;
      errorMessage?: string;
      details?: Record<string, any>;
    }
  ): AuthDiagnosticEvent {
    const event: AuthDiagnosticEvent = {
      timestamp: new Date().toISOString(),
      category,
      method,
      status,
      projectId: projectId || 'unknown',
      platform: this.getPlatform(),
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
      errorCode: extra?.errorCode,
      errorMessage: extra?.errorMessage,
      details: extra?.details
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Color-coded console diagnostics
    const color = status === 'SUCCESS' ? '#00ff66' : status === 'FAILED' ? '#ff3366' : '#00ccff';
    const prefix = `[AuthDiagnostics] [${category}] [${status}]`;
    
    if (status === 'FAILED') {
      console.warn(
        `%c${prefix} ${method} (Project: ${event.projectId}, Platform: ${event.platform})`,
        `color: ${color}; font-weight: bold;`,
        {
          errorCode: extra?.errorCode,
          errorMessage: extra?.errorMessage,
          protocol: event.protocol,
          details: extra?.details
        }
      );
    } else {
      console.log(
        `%c${prefix} ${method} (Project: ${event.projectId}, Platform: ${event.platform})`,
        `color: ${color}; font-weight: bold;`,
        extra?.details || ''
      );
    }

    // Dispatch global event for in-UI diagnostic inspectors
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('faraflick-auth-diagnostic', { detail: event }));
    }

    return event;
  }

  public getHistory(): AuthDiagnosticEvent[] {
    return [...this.events];
  }

  public clearHistory(): void {
    this.events = [];
  }
}

export const authDiagnostics = new AuthDiagnosticsTracker();

if (typeof window !== 'undefined') {
  (window as any).__AUTH_DIAGNOSTICS__ = authDiagnostics;
}
