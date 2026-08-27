import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smartphone,
  Laptop,
  ArrowRightLeft,
  Download,
  Upload,
  Key,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  HardDrive,
  QrCode,
  RefreshCw,
  Copy,
  Check,
  Radio,
  FileCheck,
  Share2,
  Camera,
  FileJson,
  Eye,
  Lock,
  Sparkles,
  Zap
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  getDeviceStorageStats,
  DeviceStorageStats,
  getDevicePlatform,
  getOrCreateDeviceId,
  getDeviceName,
  wipeAllLocalDeviceData,
} from '../lib/deviceStorageEngine';
import {
  exportEncryptedVault,
  downloadVaultFile,
  restoreEncryptedVault,
  startDeviceTransferSender,
  startDeviceTransferReceiver,
  generateSyncPin,
  DeviceSyncSession,
} from '../lib/vaultTransferEngine';
import {
  downloadEncryptedChatLogsJson,
  importEncryptedChatLogsJson
} from '../lib/chatExportUtility';
import { useAuth } from '../contexts/AuthContext';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';

interface DeviceVaultTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
  defaultTab?: 'qr_sync' | 'transfer' | 'backup' | 'restore' | 'stats' | 'p2p';
}

export function DeviceVaultTransferModal({
  isOpen,
  onClose,
  onDataRestored,
  defaultTab = 'qr_sync',
}: DeviceVaultTransferModalProps) {
  const { profile, reloadProfile } = useAuth();
  const initialTab = defaultTab === 'p2p' ? 'transfer' : defaultTab;
  const [activeTab, setActiveTab] = useState<'qr_sync' | 'transfer' | 'backup' | 'restore' | 'stats'>(initialTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab === 'p2p' ? 'transfer' : (defaultTab as any));
    }
  }, [defaultTab]);

  // Storage Stats state
  const [stats, setStats] = useState<DeviceStorageStats | null>(null);

  // QR Session Key Sync State
  const [qrMode, setQrMode] = useState<'generate' | 'scan'>('generate');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrRawPayload, setQrRawPayload] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [qrCopied, setQrCopied] = useState<boolean>(false);
  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [isImportingQr, setIsImportingQr] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Export / Backup state
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [confirmExportPassphrase, setConfirmExportPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  // Restore state
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStrategy, setRestoreStrategy] = useState<'merge' | 'replace'>('merge');

  // Device-to-Device Transfer state
  const [transferMode, setTransferMode] = useState<'send' | 'receive'>('send');
  const [syncPin, setSyncPin] = useState(generateSyncPin());
  const [transferPassphrase, setTransferPassphrase] = useState('flick-sync-pass');
  const [syncSession, setSyncSession] = useState<DeviceSyncSession | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Load storage stats
  const refreshStats = async () => {
    try {
      const s = await getDeviceStorageStats();
      setStats(s);
    } catch (e) {
      console.warn('Error loading stats', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
      setSyncPin(generateSyncPin());
      if (activeTab === 'qr_sync') {
        generateQrSessionPayload();
      }
    }
  }, [isOpen, activeTab]);

  // Clean up WebRTC session & camera stream when modal closes
  useEffect(() => {
    return () => {
      if (syncSession) {
        syncSession.close();
      }
      stopCameraScanner();
    };
  }, [syncSession]);

  // Stop camera helper
  const stopCameraScanner = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsScanningLive(false);
  };

  // Generate QR code for E2EE session keys & sync
  const generateQrSessionPayload = async () => {
    if (!profile?.uid) return;
    setIsGeneratingQr(true);
    try {
      const privKey = localStorage.getItem(`e2ee_private_${profile.uid}`) || '';
      const pubKey = localStorage.getItem(`e2ee_public_${profile.uid}`) || profile.publicKey || '';

      const sessionSyncObject = {
        type: 'flick_e2ee_session_sync',
        version: '1.0',
        uid: profile.uid,
        displayName: profile.displayName,
        email: profile.email,
        publicKey: pubKey,
        privateKey: privKey,
        deviceId: getOrCreateDeviceId(),
        timestamp: Date.now()
      };

      const jsonStr = JSON.stringify(sessionSyncObject);
      setQrRawPayload(jsonStr);

      const url = await QRCode.toDataURL(jsonStr, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 380,
        color: {
          dark: '#00ff66',
          light: '#0a0a0a'
        }
      });
      setQrDataUrl(url);
    } catch (err: any) {
      console.warn('QR Generation error:', err);
      showBrutalistToast('QR ERROR', 'Could not generate session sync QR code.', 'error');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Start live camera QR scanner
  const startCameraScanner = async () => {
    playGlitchClickSound();
    triggerVibration('medium');
    setIsScanningLive(true);
    setScanStatus('INITIALIZING OPTICAL SENSOR...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
      setScanStatus('ALIGN QR CODE WITHIN SENSOR TARGET');
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setIsScanningLive(false);
      setScanStatus('');
      showBrutalistToast('CAMERA PERMISSION', 'Camera access denied or unsupported on this device.', 'error');
    }
  };

  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.height = videoRef.current.videoHeight;
          canvas.width = videoRef.current.videoWidth;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            stopCameraScanner();
            handleProcessScannedQrPayload(code.data);
            return;
          }
        }
      }
    }
    scanLoopRef.current = requestAnimationFrame(tickScan);
  };

  // Image file QR scanner
  const handleImageFileScan = async (file: File) => {
    playGlitchClickSound();
    triggerVibration('medium');
    setIsImportingQr(true);

    try {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              handleProcessScannedQrPayload(code.data);
            } else {
              showBrutalistToast('SCAN FAILED', 'No valid Flick QR code found in uploaded image.', 'error');
              setIsImportingQr(false);
            }
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showBrutalistToast('IMAGE ERROR', err.message || 'Failed to read image file', 'error');
      setIsImportingQr(false);
    }
  };

  // Process decoded QR payload
  const handleProcessScannedQrPayload = async (rawPayload: string) => {
    setIsImportingQr(true);
    try {
      let data: any = null;
      try {
        data = JSON.parse(rawPayload);
      } catch {
        throw new Error('QR payload is not a valid JSON structure.');
      }

      if (data.type === 'flick_e2ee_session_sync' || data.privateKey || data.publicKey) {
        const targetUid = profile?.uid || data.uid;
        if (!targetUid) throw new Error('Missing target user identity.');

        if (data.privateKey) {
          localStorage.setItem(`e2ee_private_${targetUid}`, typeof data.privateKey === 'string' ? data.privateKey : JSON.stringify(data.privateKey));
        }
        if (data.publicKey) {
          localStorage.setItem(`e2ee_public_${targetUid}`, typeof data.publicKey === 'string' ? data.publicKey : JSON.stringify(data.publicKey));
        }

        playLikeSound();
        triggerVibration('heavy');
        showBrutalistToast('E2EE SESSION SYNCED', `Keys & session credentials verified for @${data.displayName || 'Operator'}!`, 'success');

        if (reloadProfile) await reloadProfile();
        if (onDataRestored) onDataRestored();
        refreshStats();
      } else {
        throw new Error('Unrecognized Flick QR payload structure.');
      }
    } catch (err: any) {
      console.warn('QR Ingestion error:', err);
      showBrutalistToast('SYNC FAILED', err.message || 'Invalid QR payload format.', 'error');
    } finally {
      setIsImportingQr(false);
    }
  };

  // Handle Export Backup (.flick)
  const handleExportBackup = async () => {
    if (!exportPassphrase || exportPassphrase.length < 4) {
      showBrutalistToast('INVALID PASSPHRASE', 'Passphrase must be at least 4 characters.', 'error');
      return;
    }
    if (exportPassphrase !== confirmExportPassphrase) {
      showBrutalistToast('PASSPHRASE MISMATCH', 'Passphrases do not match.', 'error');
      return;
    }

    playGlitchClickSound();
    triggerVibration('medium');
    setIsExporting(true);

    try {
      const blob = await exportEncryptedVault(exportPassphrase);
      const res = await downloadVaultFile(blob);
      showBrutalistToast('VAULT EXPORTED', res.method === 'share' ? '.flick storage file shared/saved.' : 'Encrypted .flick backup saved to your device.', 'success');
      playLikeSound();
      setExportPassphrase('');
      setConfirmExportPassphrase('');
      refreshStats();
    } catch (err: any) {
      console.warn('Export error:', err);
      showBrutalistToast('EXPORT FAILED', err.message || 'Could not export vault', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Export JSON with RSA Keypair
  const handleExportJsonVault = async () => {
    if (!profile?.uid) return;
    setIsExportingJson(true);
    try {
      await downloadEncryptedChatLogsJson({
        uid: profile.uid,
        displayName: profile.displayName,
        email: profile.email
      }, true);
      refreshStats();
    } catch (err: any) {
      showBrutalistToast('JSON EXPORT ERROR', err.message || 'Failed to export JSON chat vault.', 'error');
    } finally {
      setIsExportingJson(false);
    }
  };

  // Handle Restore Backup File (.flick or .json)
  const handleRestoreFile = async () => {
    if (!restoreFile) {
      showBrutalistToast('NO FILE SELECTED', 'Please select a .flick, .flickvault, or .json backup file.', 'error');
      return;
    }

    playGlitchClickSound();
    triggerVibration('heavy');
    setIsRestoring(true);

    try {
      const isJson = restoreFile.name.endsWith('.json') || restoreFile.type === 'application/json';

      if (isJson) {
        const text = await restoreFile.text();
        const res = await importEncryptedChatLogsJson(text, profile?.uid || 'anonymous');
        if (res.success) {
          if (reloadProfile) await reloadProfile();
          if (onDataRestored) onDataRestored();
          refreshStats();
        }
      } else {
        if (!restorePassphrase) {
          showBrutalistToast('PASSPHRASE REQUIRED', 'Enter the passphrase used to encrypt the .flick binary backup.', 'error');
          setIsRestoring(false);
          return;
        }
        const buffer = await restoreFile.arrayBuffer();
        const result = await restoreEncryptedVault(buffer, restorePassphrase, restoreStrategy);
        playLikeSound();
        showBrutalistToast(
          'VAULT RESTORED',
          `Restored ${result.restoredConversations} conversations and ${result.restoredBlobs} media items!`,
          'success'
        );
        setRestoreFile(null);
        setRestorePassphrase('');
        refreshStats();
        if (onDataRestored) onDataRestored();
      }
    } catch (err: any) {
      console.warn('Restore error:', err);
      showBrutalistToast('RESTORE FAILED', err.message || 'Incorrect passphrase or corrupted file.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Start P2P Transfer
  const handleStartP2PTransfer = async () => {
    if (transferMode === 'receive' && (!syncPin || syncPin.trim().length < 4)) {
      showBrutalistToast('SYNC CODE REQUIRED', 'Please enter the 6-character code from your other device.', 'error');
      return;
    }

    playGlitchClickSound();
    triggerVibration('medium');

    if (transferMode === 'send') {
      const sess = await startDeviceTransferSender(syncPin, transferPassphrase, (updated) => {
        setSyncSession({ ...updated });
        if (updated.status === 'completed') {
          showBrutalistToast('TRANSFER COMPLETE', 'Vault sent successfully to peer device!', 'success');
          playLikeSound();
        } else if (updated.status === 'failed') {
          showBrutalistToast('TRANSFER FAILED', updated.errorMessage || 'Failed to dispatch vault', 'error');
        }
      });
      setSyncSession(sess);
      showBrutalistToast('VAULT DISPATCHED', `Pairing code ${syncPin.toUpperCase()} is active on the secure bridge.`, 'info');
    } else {
      const sess = await startDeviceTransferReceiver(syncPin, transferPassphrase, (updated) => {
        setSyncSession({ ...updated });
        if (updated.status === 'completed') {
          showBrutalistToast('VAULT INGESTED', 'All conversations, keys, and voice notes synced locally!', 'success');
          playLikeSound();
          refreshStats();
          if (onDataRestored) onDataRestored();
        } else if (updated.status === 'failed') {
          showBrutalistToast('SYNC ERROR', updated.errorMessage || 'Could not find or decrypt vault with that code', 'error');
        }
      });
      setSyncSession(sess);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-zinc-950 border border-[var(--neon-green-border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--neon-green)]/10 border border-[var(--neon-green)] flex items-center justify-center text-[var(--neon-green)]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                Flick Vault & Key Sync
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30">
                  Zero-Cloud E2EE
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                Decentralized Local Storage & RSA Cryptographic Handshake
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playGlitchClickSound();
              stopCameraScanner();
              onClose();
            }}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800/80 bg-black/40 px-6 pt-2 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => { playGlitchClickSound(); stopCameraScanner(); setActiveTab('qr_sync'); }}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'qr_sync'
                ? 'border-[var(--neon-green)] text-[var(--neon-green)]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            QR Key Sync
          </button>

          <button
            onClick={() => { playGlitchClickSound(); stopCameraScanner(); setActiveTab('transfer'); }}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'transfer'
                ? 'border-[var(--neon-green)] text-[var(--neon-green)]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            P2P Transfer
          </button>

          <button
            onClick={() => { playGlitchClickSound(); stopCameraScanner(); setActiveTab('backup'); }}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-[var(--neon-green)] text-[var(--neon-green)]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Encrypted Export
          </button>

          <button
            onClick={() => { playGlitchClickSound(); stopCameraScanner(); setActiveTab('restore'); }}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'restore'
                ? 'border-[var(--neon-green)] text-[var(--neon-green)]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Restore Backup
          </button>

          <button
            onClick={() => { playGlitchClickSound(); stopCameraScanner(); setActiveTab('stats'); }}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-[var(--neon-green)] text-[var(--neon-green)]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Storage Diagnostics
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* ========================================================= */}
          {/* TAB 0: QR CODE E2EE SESSION KEY SYNC                      */}
          {/* ========================================================= */}
          {activeTab === 'qr_sync' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-zinc-200 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[var(--neon-green)]" />
                    QR E2EE Session Key Exchange
                  </span>
                  <span className="text-[10px] font-mono text-[var(--neon-green)] bg-[var(--neon-green)]/10 px-2 py-0.5 rounded border border-[var(--neon-green)]/30">
                    AIR-GAPPED SYNC
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Scan a QR code from an existing device to securely sync your end-to-end encrypted session keys and cryptographic identity to a new browser instance without cloud leakage.
                </p>
              </div>

              {/* Sub Mode Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    playGlitchClickSound();
                    stopCameraScanner();
                    setQrMode('generate');
                    generateQrSessionPayload();
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center space-y-1.5 transition ${
                    qrMode === 'generate'
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-zinc-100'
                      : 'border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Laptop className="w-5 h-5 text-[var(--neon-green)]" />
                  <span className="text-xs font-black uppercase">Share Key via QR</span>
                  <span className="text-[10px] text-zinc-500 text-center">Display QR on this existing device</span>
                </button>

                <button
                  onClick={() => {
                    playGlitchClickSound();
                    setQrMode('scan');
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center space-y-1.5 transition ${
                    qrMode === 'scan'
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-zinc-100'
                      : 'border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Camera className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-black uppercase">Scan Session QR</span>
                  <span className="text-[10px] text-zinc-500 text-center">Scan from phone or new browser</span>
                </button>
              </div>

              {/* MODE 1: GENERATE / SHOW QR */}
              {qrMode === 'generate' && (
                <div className="flex flex-col items-center justify-center p-6 bg-black border border-zinc-800 rounded-3xl space-y-4">
                  <div className="relative p-3 bg-zinc-950 border-2 border-[var(--neon-green)] rounded-2xl shadow-[0_0_30px_rgba(0,255,102,0.15)] flex items-center justify-center">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="E2EE Session Sync QR" className="w-64 h-64 rounded-lg object-contain" />
                    ) : (
                      <div className="w-64 h-64 flex items-center justify-center text-xs font-mono text-zinc-500">
                        Generating High-Density QR Matrix...
                      </div>
                    )}
                  </div>

                  <div className="text-center space-y-1 max-w-sm">
                    <span className="text-xs font-black uppercase text-zinc-200">
                      Syncing Cryptographic Identity
                    </span>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      Operator: <span className="text-[var(--neon-green)] font-bold">@{profile?.displayName || 'Operator'}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full max-w-md">
                    <button
                      onClick={() => {
                        if (qrRawPayload) {
                          navigator.clipboard.writeText(qrRawPayload);
                          setQrCopied(true);
                          playLikeSound();
                          setTimeout(() => setQrCopied(false), 2000);
                          showBrutalistToast('COPIED', 'Cryptographic session payload copied to clipboard.', 'info');
                        }
                      }}
                      className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-2"
                    >
                      {qrCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                      {qrCopied ? 'Payload Copied' : 'Copy Payload String'}
                    </button>

                    <button
                      onClick={generateQrSessionPayload}
                      disabled={isGeneratingQr}
                      className="py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGeneratingQr ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: SCAN SESSION QR */}
              {qrMode === 'scan' && (
                <div className="p-6 bg-black border border-zinc-800 rounded-3xl space-y-4">
                  {!isScanningLive ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                      <div className="w-16 h-16 rounded-3xl bg-[var(--neon-green)]/10 border border-[var(--neon-green)] flex items-center justify-center text-[var(--neon-green)] shadow-[0_0_20px_rgba(0,255,102,0.2)]">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase text-zinc-100">Sensor Ready</h4>
                        <p className="text-xs text-zinc-400 max-w-sm">
                          Use live camera feed or upload a screenshot to instantly restore E2EE keys and chat history.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-2">
                        <button
                          onClick={startCameraScanner}
                          className="flex-1 py-3.5 rounded-2xl bg-[var(--neon-green)] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          Launch Live Camera Scanner
                        </button>

                        <label className="flex-1 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-bold text-xs uppercase hover:bg-zinc-800 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer">
                          <Upload className="w-4 h-4 text-amber-400" />
                          Upload QR Image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleImageFileScan(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-video border border-[var(--neon-green)] flex items-center justify-center">
                        <video ref={videoRef} className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanner reticle overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-48 h-48 border-2 border-[var(--neon-green)] rounded-2xl relative animate-pulse shadow-[0_0_25px_rgba(0,255,102,0.4)]">
                            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white" />
                            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white" />
                            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white" />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white" />
                          </div>
                        </div>

                        <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-center">
                          <span className="text-[10px] font-mono text-[var(--neon-green)] uppercase font-bold">
                            {scanStatus || 'SCANNING FOR FLICK E2EE MATRIX...'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={stopCameraScanner}
                        className="w-full py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        Cancel Camera Scanner
                      </button>
                    </div>
                  )}

                  {/* Manual Raw Payload Paste Fallback */}
                  <div className="pt-2 border-t border-zinc-900">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5">
                      Or Paste Encrypted Payload JSON:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder='{"type":"flick_e2ee_session_sync", ...}'
                        className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-[var(--neon-green)]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            handleProcessScannedQrPayload(e.currentTarget.value.trim());
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = (e.currentTarget.previousSibling as HTMLInputElement)?.value;
                          if (input?.trim()) {
                            handleProcessScannedQrPayload(input.trim());
                          }
                        }}
                        disabled={isImportingQr}
                        className="px-4 py-2.5 rounded-xl bg-[var(--neon-green)] text-black font-black text-xs uppercase"
                      >
                        {isImportingQr ? 'Syncing...' : 'Import'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: DEVICE-TO-DEVICE DIRECT P2P TRANSFER               */}
          {/* ========================================================= */}
          {activeTab === 'transfer' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-zinc-200 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-[var(--neon-green)] animate-pulse" />
                    Direct Device-to-Device Sync
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">P2P WebRTC DataChannel</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Transfer all your conversations, voice notes, photos, and settings directly from one device to another without ever routing through an external cloud server.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    playGlitchClickSound();
                    setTransferMode('send');
                    setSyncSession(null);
                  }}
                  className={`p-4 rounded-2xl border flex flex-col items-center space-y-2 transition ${
                    transferMode === 'send'
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-zinc-100'
                      : 'border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Laptop className="w-6 h-6 text-[var(--neon-green)]" />
                  <span className="text-xs font-black uppercase">Send From This Device</span>
                  <span className="text-[10px] text-zinc-500 text-center">Share vault with a phone or laptop</span>
                </button>

                <button
                  onClick={() => {
                    playGlitchClickSound();
                    setTransferMode('receive');
                    setSyncSession(null);
                  }}
                  className={`p-4 rounded-2xl border flex flex-col items-center space-y-2 transition ${
                    transferMode === 'receive'
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-zinc-100'
                      : 'border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Smartphone className="w-6 h-6 text-amber-400" />
                  <span className="text-xs font-black uppercase">Receive On This Device</span>
                  <span className="text-[10px] text-zinc-500 text-center">Enter PIN to pull from your other device</span>
                </button>
              </div>

              {/* Transfer Code / PIN Section */}
              <div className="p-5 rounded-2xl bg-black border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase">
                    {transferMode === 'send' ? 'Your Sync PIN' : 'Enter Peer Sync PIN'}
                  </span>
                  {transferMode === 'send' && (
                    <button
                      onClick={() => {
                        playGlitchClickSound();
                        setSyncPin(generateSyncPin());
                      }}
                      className="text-[10px] font-mono text-[var(--neon-green)] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  )}
                </div>

                {transferMode === 'send' ? (
                  <div className="flex items-center justify-center space-x-3 py-3 bg-zinc-900/80 rounded-2xl border border-zinc-800">
                    <span className="text-3xl font-mono font-black tracking-widest text-[var(--neon-green)]">
                      {syncPin}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(syncPin);
                        setCopiedPin(true);
                        setTimeout(() => setCopiedPin(false), 2000);
                        playLikeSound();
                      }}
                      className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition"
                    >
                      {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={syncPin}
                    onChange={(e) => setSyncPin(e.target.value.toUpperCase())}
                    placeholder="ENTER 6-DIGIT CODE"
                    maxLength={8}
                    className="w-full text-center py-3 bg-zinc-900 border border-zinc-700 rounded-2xl text-2xl font-mono font-black text-amber-400 tracking-widest uppercase focus:outline-none focus:border-amber-400"
                  />
                )}

                {/* Progress bar if active */}
                {syncSession && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-400 uppercase">Status: {syncSession.status}</span>
                      <span className="text-[var(--neon-green)] font-bold">{syncSession.progressPercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-[var(--neon-green)] transition-all duration-300"
                        style={{ width: `${syncSession.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStartP2PTransfer}
                  disabled={syncSession?.status === 'transferring'}
                  className="w-full py-4 rounded-2xl bg-[var(--neon-green)] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,102,0.2)]"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {transferMode === 'send' ? 'Initiate P2P Vault Dispatch' : 'Connect & Ingest Peer Vault'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: ENCRYPTED BACKUP EXPORT                            */}
          {/* ========================================================= */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <span className="text-xs font-black uppercase text-zinc-200 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-[var(--neon-green)]" />
                  Encrypted Offline Vaults (.flick & .json)
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Export an encrypted snapshot of all your local messages, audio recordings, memories, and photos, or export a comprehensive JSON archive containing your RSA keypair pairing info.
                </p>
                <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800 text-[10px] text-zinc-300">
                  <strong className="text-[var(--neon-green)]">100% Local Storage:</strong> FLICK does not store your conversation database on Firebase cloud servers.
                </div>
              </div>

              {/* JSON Vault Export Box */}
              <div className="p-5 rounded-2xl bg-black border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileJson className="w-5 h-5 text-[var(--neon-green)]" />
                    <div>
                      <h4 className="text-xs font-black uppercase text-zinc-100">Encrypted Chat Logs JSON</h4>
                      <p className="text-[10px] font-mono text-zinc-500">Includes RSA Keypair info & message ciphertexts</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                    SHA-256 Verified
                  </span>
                </div>

                <button
                  onClick={handleExportJsonVault}
                  disabled={isExportingJson}
                  className="w-full py-3.5 rounded-2xl bg-zinc-900 border border-[var(--neon-green-border)] text-[var(--neon-green)] font-black text-xs uppercase tracking-wider hover:bg-[var(--neon-green)]/10 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FileJson className="w-4 h-4" />
                  {isExportingJson ? 'Generating Encrypted JSON...' : 'Export Encrypted JSON Logs + Keypair Info'}
                </button>
              </div>

              {/* .flick Binary Archive Box */}
              <div className="p-5 rounded-2xl bg-black border border-zinc-800 space-y-4">
                <h4 className="text-xs font-black uppercase text-zinc-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Full Binary Archive (.flick)
                </h4>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                    Encryption Passphrase
                  </label>
                  <input
                    type="password"
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    placeholder="Enter strong passphrase..."
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-100 focus:outline-none focus:border-[var(--neon-green)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                    Confirm Passphrase
                  </label>
                  <input
                    type="password"
                    value={confirmExportPassphrase}
                    onChange={(e) => setConfirmExportPassphrase(e.target.value)}
                    placeholder="Re-enter passphrase..."
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-100 focus:outline-none focus:border-[var(--neon-green)]"
                  />
                </div>

                <button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="w-full py-4 rounded-2xl bg-[var(--neon-green)] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Encrypting & Packaging...' : 'Download / Share Encrypted .flick Archive'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: RESTORE BACKUP ARCHIVE                             */}
          {/* ========================================================= */}
          {activeTab === 'restore' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <span className="text-xs font-black uppercase text-zinc-200 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-amber-400" />
                  Restore Local Vault (.flick / .json)
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Import a previously exported <code className="text-amber-400 font-bold">.flick</code> storage extension file or <code className="text-[var(--neon-green)] font-bold">.json</code> encrypted chat logs vault to sync past conversations and restore RSA keypairs onto this system.
                </p>
              </div>

              <div className="space-y-4">
                {/* File picker */}
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                    Select .flick, .flickvault, or .json File
                  </label>
                  <input
                    type="file"
                    accept=".flick,.flickvault,.bin,.json,application/json,application/octet-stream"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setRestoreFile(e.target.files[0]);
                      }
                    }}
                    className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl text-xs text-zinc-300 file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                </div>

                {restoreFile && !restoreFile.name.endsWith('.json') && (
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                      Decryption Passphrase (for .flick binary archives)
                    </label>
                    <input
                      type="password"
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      placeholder="Enter backup passphrase..."
                      className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                {/* Strategy selector */}
                <div className="flex items-center space-x-4 pt-1">
                  <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      checked={restoreStrategy === 'merge'}
                      onChange={() => setRestoreStrategy('merge')}
                      className="accent-[var(--neon-green)]"
                    />
                    <span>Merge with existing device data</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      checked={restoreStrategy === 'replace'}
                      onChange={() => setRestoreStrategy('replace')}
                      className="accent-amber-400"
                    />
                    <span>Replace all device data</span>
                  </label>
                </div>

                <button
                  onClick={handleRestoreFile}
                  disabled={isRestoring || !restoreFile}
                  className="w-full py-4 rounded-2xl bg-amber-400 text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  {isRestoring ? 'Decrypting & Ingesting Vault...' : 'Restore Vault to this Device'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: DEVICE STORAGE DIAGNOSTICS                         */}
          {/* ========================================================= */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Conversations</span>
                  <span className="text-xl font-mono font-black text-zinc-100 block">
                    {stats?.totalConversations || 0}
                  </span>
                </div>

                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Messages</span>
                  <span className="text-xl font-mono font-black text-zinc-100 block">
                    {stats?.totalMessages || 0}
                  </span>
                </div>

                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Media Items</span>
                  <span className="text-xl font-mono font-black text-[var(--neon-green)] block">
                    {stats?.totalMediaBlobs || 0}
                  </span>
                </div>

                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Voice Memories</span>
                  <span className="text-xl font-mono font-black text-amber-400 block">
                    {stats?.totalVoiceMemories || 0}
                  </span>
                </div>
              </div>

              {/* Platform and Device ID */}
              <div className="p-4 rounded-2xl bg-black border border-zinc-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Platform:</span>
                  <span className="text-zinc-200 uppercase font-bold">{getDevicePlatform()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Device Name:</span>
                  <span className="text-zinc-200">{getDeviceName()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Device ID:</span>
                  <span className="text-[var(--neon-green)] text-[10px] truncate max-w-[200px]">
                    {getOrCreateDeviceId()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Local Space Used:</span>
                  <span className="text-zinc-200 font-bold">
                    {((stats?.estimatedSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              </div>

              {/* Wipe Local Storage */}
              <div className="pt-2">
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to completely erase all local Flick data on this device?')) {
                      await wipeAllLocalDeviceData();
                      showBrutalistToast('VAULT WIPED', 'All local data on this device has been cleared.', 'info');
                      refreshStats();
                      if (onDataRestored) onDataRestored();
                    }
                  }}
                  className="w-full py-3 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-400 font-bold text-xs uppercase hover:bg-red-900/40 transition"
                >
                  Wipe Local Data on This Device Only
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
