import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { QrCode, Camera, Upload, Copy, Check, Download, ShieldCheck, UserPlus, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';
import { UserProfile } from '../types';

interface QrKeyExchangeProps {
  profile: UserProfile;
  onCloseModal?: () => void;
  onOpenChatWithPeer?: (peerId: string) => void;
}

export function SettingsQrKeyExchangeTab({ profile, onCloseModal, onOpenChatWithPeer }: QrKeyExchangeProps) {
  const [mode, setMode] = useState<'generate' | 'scan'>('generate');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Scanner States
  const [scanSource, setScanSource] = useState<'camera' | 'upload'>('upload');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedPeer, setScannedPeer] = useState<{
    uid: string;
    displayName: string;
    publicKey: string;
    email?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanAnimFrameRef = useRef<number | null>(null);

  // Payload for current user's key exchange
  const keyExchangePayload = JSON.stringify({
    type: 'flick_key_exchange',
    uid: profile.uid,
    displayName: profile.displayName || 'Anonymous',
    publicKey: profile.publicKey || '',
    email: profile.email || ''
  });

  // Generate QR Code on mount or profile update
  useEffect(() => {
    let isMounted = true;
    const generateQr = async () => {
      try {
        const url = await QRCode.toDataURL(keyExchangePayload, {
          width: 320,
          margin: 2,
          color: {
            dark: '#00ff66',
            light: '#0a0a0c'
          },
          errorCorrectionLevel: 'H'
        });
        if (isMounted) setQrDataUrl(url);
      } catch (err) {
        console.warn('QR Code generation failed:', err);
      }
    };
    generateQr();
    return () => { isMounted = false; };
  }, [keyExchangePayload]);

  // Clean up camera stream on unmount or tab switch
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (scanAnimFrameRef.current) {
      cancelAnimationFrame(scanAnimFrameRef.current);
      scanAnimFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCameraStream = async () => {
    playGlitchClickSound();
    setCameraError(null);
    setScannedPeer(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access API is not supported in this browser context.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        triggerVibration('medium');
        scanCameraLoop();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Unable to access camera. Please allow camera permissions or upload a QR image.');
      setCameraActive(false);
    }
  };

  const scanCameraLoop = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      scanAnimFrameRef.current = requestAnimationFrame(scanCameraLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        processScannedPayload(code.data);
        stopCameraStream();
        return;
      }
    }

    scanAnimFrameRef.current = requestAnimationFrame(scanCameraLoop);
  };

  const processScannedPayload = (rawData: string) => {
    try {
      let parsed: any = null;
      if (rawData.startsWith('{')) {
        parsed = JSON.parse(rawData);
      } else if (rawData.startsWith('flick:key:')) {
        const parts = rawData.split(':');
        parsed = {
          type: 'flick_key_exchange',
          uid: parts[2],
          displayName: parts[3] || 'Peer',
          publicKey: parts[4] || ''
        };
      }

      if (parsed && parsed.publicKey && (parsed.uid || parsed.type === 'flick_key_exchange')) {
        setScannedPeer({
          uid: parsed.uid || `peer_${Math.random().toString(36).substr(2, 6)}`,
          displayName: parsed.displayName || 'Cryptographic Peer',
          publicKey: parsed.publicKey,
          email: parsed.email
        });

        // Save imported key to localStorage cache for instant access
        try {
          localStorage.setItem(`flick_imported_key_${parsed.uid}`, parsed.publicKey);
        } catch {
          // ignore cache error
        }

        playLikeSound();
        triggerVibration('double');
        showBrutalistToast('KEY EXCHANGED ✓', `Cryptographic public key imported for @${parsed.displayName || 'Peer'}`, 'success');
      } else {
        showBrutalistToast('INVALID QR', 'Unrecognized Flick QR payload structure.', 'warning');
      }
    } catch (err) {
      console.warn('Failed parsing QR code payload:', err);
      showBrutalistToast('SCAN ERROR', 'Could not parse data from QR image.', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playGlitchClickSound();
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            processScannedPayload(code.data);
          } else {
            showBrutalistToast('NO QR FOUND', 'No readable QR code found in selected image.', 'warning');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPayload = () => {
    playGlitchClickSound();
    navigator.clipboard.writeText(keyExchangePayload);
    setCopiedPayload(true);
    showBrutalistToast('COPIED TO CLIPBOARD', 'Key Exchange Payload String copied.', 'success');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyPublicKey = () => {
    playGlitchClickSound();
    if (profile.publicKey) {
      navigator.clipboard.writeText(profile.publicKey);
      setCopiedKey(true);
      showBrutalistToast('COPIED PUBLIC KEY', 'Public key copied to clipboard.', 'success');
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    playGlitchClickSound();
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `flick-key-qr-${profile.displayName || 'user'}.png`;
    a.click();
    showBrutalistToast('DOWNLOAD STARTED', 'QR Code saved to downloads folder.', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-[var(--neon-green-border)] pb-3">
        <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
          <QrCode className="w-4 h-4 text-[var(--neon-green)]" />
          INSTANT QR KEY EXCHANGE PORTAL
        </h3>

        {/* Mode Switcher Buttons */}
        <div className="flex gap-1 bg-[var(--color-background)] p-1 border border-[var(--neon-green-border)] rounded-none">
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              stopCameraStream();
              setMode('generate');
            }}
            className={`px-3 py-1 text-[9px] font-mono uppercase tracking-wider transition cursor-pointer font-black ${
              mode === 'generate'
                ? 'bg-[var(--neon-green)] text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-[var(--color-text)]'
            }`}
          >
            My QR Code
          </button>
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              setMode('scan');
            }}
            className={`px-3 py-1 text-[9px] font-mono uppercase tracking-wider transition cursor-pointer font-black ${
              mode === 'scan'
                ? 'bg-[var(--neon-green)] text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-[var(--color-text)]'
            }`}
          >
            Scan Peer QR
          </button>
        </div>
      </div>

      {mode === 'generate' ? (
        <div className="space-y-4 animate-fade-in">
          <p className="text-[10px] text-zinc-400 font-sans leading-normal">
            Display this QR code to another Flick operator to let them scan your public key & initiate an instant end-to-end encrypted chat channel.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 bg-[var(--color-background)] border border-[var(--neon-green-border)] p-5">
            {/* QR Image Display */}
            <div className="relative group shrink-0">
              <div className="p-3 bg-black border-2 border-[var(--neon-green)] shadow-[4px_4px_0px_var(--neon-green)] flex items-center justify-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Flick Public Key QR Code" className="w-48 h-48 image-rendering-pixelated" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-zinc-500 font-mono text-xs">
                    Generating QR...
                  </div>
                )}
              </div>
              <div className="absolute top-2 right-2 bg-[var(--neon-green)] text-black text-[7px] font-mono font-black px-1.5 py-0.5 uppercase">
                E2EE KEY
              </div>
            </div>

            {/* Profile & Key Specs */}
            <div className="flex-1 space-y-3 w-full">
              <div>
                <span className="text-[8px] font-mono uppercase text-zinc-500 font-bold block">IDENTITY HANDLE</span>
                <span className="text-sm font-serif font-black text-[var(--color-text)] block">@{profile.displayName || 'Anonymous'}</span>
              </div>

              <div>
                <span className="text-[8px] font-mono uppercase text-zinc-500 font-bold block">PUBLIC KEY FINGERPRINT</span>
                <p className="text-[9px] font-mono text-[var(--neon-green)] bg-[var(--color-surface)] p-2 border border-[var(--neon-green-border)]/50 break-all select-all font-bold">
                  {profile.publicKey ? `${profile.publicKey.slice(0, 48)}...` : 'Generating Public Key...'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="px-3 py-1.5 bg-[var(--neon-green)] text-black hover:bg-white font-mono text-[9px] uppercase font-black transition cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_#000000]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save QR Image
                </button>

                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)] hover:border-[var(--neon-green)] text-zinc-300 hover:text-[var(--neon-green)] font-mono text-[9px] uppercase font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Key Payload
                </button>

                <button
                  type="button"
                  onClick={handleCopyPublicKey}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--neon-green-border)] hover:border-[var(--neon-green)] text-zinc-300 hover:text-[var(--neon-green)] font-mono text-[9px] uppercase font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-[var(--neon-green)]" /> : <ShieldCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" />}
                  Copy Raw Key
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <p className="text-[10px] text-zinc-400 font-sans leading-normal">
            Scan a peer's Flick QR code using your camera or upload a QR image file to instantly import their public encryption key and open a private chat.
          </p>

          {/* Scanner Option Switcher */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setScanSource('upload');
                stopCameraStream();
              }}
              className={`flex-1 py-2 text-[9.5px] font-mono uppercase font-black border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                scanSource === 'upload'
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)]'
                  : 'border-[var(--neon-green-border)] bg-[var(--color-surface)] text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload QR Image
            </button>

            <button
              type="button"
              onClick={() => {
                setScanSource('camera');
                startCameraStream();
              }}
              className={`flex-1 py-2 text-[9.5px] font-mono uppercase font-black border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                scanSource === 'camera'
                  ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-[var(--neon-green)]'
                  : 'border-[var(--neon-green-border)] bg-[var(--color-surface)] text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Live Camera Scan
            </button>
          </div>

          {/* Upload Scanner Box */}
          {scanSource === 'upload' && (
            <div className="border-2 border-dashed border-[var(--neon-green-border)] bg-[var(--color-background)] p-6 text-center space-y-3">
              <Upload className="w-8 h-8 text-[var(--neon-green)] mx-auto animate-bounce" />
              <div>
                <p className="text-xs font-mono uppercase font-bold text-[var(--color-text)]">Select or Drop QR Image File</p>
                <p className="text-[9px] text-zinc-500 font-sans mt-0.5">Supports PNG, JPEG, SVG, WebP with Flick QR payload</p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 bg-[var(--neon-green)] text-black hover:bg-white text-xs font-mono uppercase font-black cursor-pointer transition shadow-[3px_3px_0px_#000000]"
              >
                Browse Image File
              </button>
            </div>
          )}

          {/* Camera Viewport */}
          {scanSource === 'camera' && (
            <div className="space-y-3">
              <div className="relative bg-black border-2 border-[var(--neon-green)] overflow-hidden h-64 flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Animated Scanner Grid Crosshairs */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-44 h-44 border-2 border-[var(--neon-green)] relative animate-pulse">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[var(--neon-green)] -mt-1 -ml-1"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[var(--neon-green)] -mt-1 -mr-1"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[var(--neon-green)] -mb-1 -ml-1"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[var(--neon-green)] -mb-1 -mr-1"></div>
                      <div className="w-full h-0.5 bg-[var(--neon-green)]/80 absolute top-1/2 left-0 animate-ping"></div>
                    </div>
                  </div>
                )}

                {!cameraActive && !cameraError && (
                  <button
                    type="button"
                    onClick={startCameraStream}
                    className="px-4 py-2 bg-[var(--neon-green)] text-black font-mono text-xs font-black uppercase cursor-pointer"
                  >
                    Start Camera
                  </button>
                )}

                {cameraError && (
                  <div className="p-4 text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                    <p className="text-xs font-mono text-red-400 uppercase">{cameraError}</p>
                  </div>
                )}
              </div>

              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="w-full py-1.5 bg-[var(--color-surface)] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black font-mono text-[9px] uppercase font-bold cursor-pointer transition"
                >
                  Stop Camera Stream
                </button>
              )}
            </div>
          )}

          {/* Scanned Peer Card Confirmation */}
          {scannedPeer && (
            <div className="bg-[var(--color-surface)] border-2 border-[var(--neon-green)] p-4 space-y-3 animate-fade-in shadow-[4px_4px_0px_var(--neon-green)]">
              <div className="flex items-center justify-between border-b border-[var(--neon-green-border)] pb-2">
                <span className="text-[9px] font-mono font-black text-[var(--neon-green)] uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--neon-green)] animate-spin" />
                  IMPORTED PEER KEY DATA
                </span>
                <span className="text-[8px] bg-emerald-950 text-[var(--neon-green)] px-1.5 py-0.5 font-mono border border-[var(--neon-green)]/40 font-bold">
                  VALIDATED ✓
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] font-mono uppercase text-zinc-500">PEER ALIAS</span>
                <p className="text-sm font-serif font-black text-[var(--color-text)]">@{scannedPeer.displayName}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] font-mono uppercase text-zinc-500">PUBLIC ENCRYPTION KEY</span>
                <p className="text-[8.5px] font-mono text-[var(--neon-green)] bg-black p-2 border border-[var(--neon-green-border)] break-all select-all font-bold">
                  {scannedPeer.publicKey}
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    if (onCloseModal) onCloseModal();
                    if (onOpenChatWithPeer) {
                      onOpenChatWithPeer(scannedPeer.uid);
                    } else {
                      window.dispatchEvent(new CustomEvent('faraflick-open-chat', { detail: { peerId: scannedPeer.uid } }));
                    }
                  }}
                  className="flex-1 py-2 bg-[var(--neon-green)] text-black hover:bg-white font-mono text-xs font-black uppercase tracking-wider cursor-pointer transition flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000000]"
                >
                  <UserPlus className="w-4 h-4" />
                  Save Key & Start Encrypted Chat
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
