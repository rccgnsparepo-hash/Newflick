import React, { useState, useEffect } from 'react';
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
  Share2
} from 'lucide-react';
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
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';

interface DeviceVaultTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

export function DeviceVaultTransferModal({
  isOpen,
  onClose,
  onDataRestored,
}: DeviceVaultTransferModalProps) {
  const [activeTab, setActiveTab] = useState<'transfer' | 'backup' | 'restore' | 'stats'>('transfer');

  // Stats state
  const [stats, setStats] = useState<DeviceStorageStats | null>(null);

  // Export / Backup state
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [confirmExportPassphrase, setConfirmExportPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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
    }
  }, [isOpen]);

  // Clean up session when modal closes
  useEffect(() => {
    return () => {
      if (syncSession) {
        syncSession.close();
      }
    };
  }, [syncSession]);

  // Handle Export Backup
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
      downloadVaultFile(blob);
      showBrutalistToast('VAULT EXPORTED', 'Encrypted .flickvault backup downloaded to your device.', 'success');
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

  // Handle Restore Backup File
  const handleRestoreFile = async () => {
    if (!restoreFile) {
      showBrutalistToast('NO FILE SELECTED', 'Please select a .flickvault backup file.', 'error');
      return;
    }
    if (!restorePassphrase) {
      showBrutalistToast('PASSPHRASE REQUIRED', 'Enter the passphrase used to encrypt the backup.', 'error');
      return;
    }

    playGlitchClickSound();
    triggerVibration('heavy');
    setIsRestoring(true);

    try {
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
    } catch (err: any) {
      console.warn('Restore error:', err);
      showBrutalistToast('RESTORE FAILED', err.message || 'Incorrect passphrase or corrupted file.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Start P2P Transfer
  const handleStartP2PTransfer = async () => {
    playGlitchClickSound();
    triggerVibration('medium');

    if (transferMode === 'send') {
      const sess = await startDeviceTransferSender(syncPin, transferPassphrase, (updated) => {
        setSyncSession({ ...updated });
        if (updated.status === 'completed') {
          showBrutalistToast('TRANSFER COMPLETE', 'Vault sent successfully to peer device!', 'success');
          playLikeSound();
        }
      });
      setSyncSession(sess);
    } else {
      const sess = await startDeviceTransferReceiver(syncPin, transferPassphrase, (updated) => {
        setSyncSession({ ...updated });
        if (updated.status === 'completed') {
          showBrutalistToast('VAULT INGESTED', 'All conversations and voice notes synced locally!', 'success');
          playLikeSound();
          refreshStats();
          if (onDataRestored) onDataRestored();
        }
      });
      setSyncSession(sess);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
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
                Flick Vault Manager
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30">
                  Local-First
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                Your Data. Your Devices. Our Bridge.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playGlitchClickSound();
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
            onClick={() => { playGlitchClickSound(); setActiveTab('transfer'); }}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'transfer'
                ? 'border-[var(--neon-green)] text-[var(--neon-green)]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Device Transfer
          </button>

          <button
            onClick={() => { playGlitchClickSound(); setActiveTab('backup'); }}
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
            onClick={() => { playGlitchClickSound(); setActiveTab('restore'); }}
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
            onClick={() => { playGlitchClickSound(); setActiveTab('stats'); }}
            className={`pb-3 px-3 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-[var(--neon-green)] text-[var(--neon-green)]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Device Storage
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
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
                  AES-256 Encrypted Offline Vault
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Export an encrypted snapshot of all your local messages, audio recordings, memories, and photos to a single <code className="text-[var(--neon-green)]">.flickvault</code> file.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                    Encryption Passphrase
                  </label>
                  <input
                    type="password"
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    placeholder="Enter strong passphrase..."
                    className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl text-xs text-zinc-100 focus:outline-none focus:border-[var(--neon-green)]"
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
                    className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl text-xs text-zinc-100 focus:outline-none focus:border-[var(--neon-green)]"
                  />
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Flick does not store your passphrase. If you forget this passphrase, your encrypted backup cannot be decrypted.
                  </span>
                </div>

                <button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="w-full py-4 rounded-2xl bg-[var(--neon-green)] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Encrypting & Packaging...' : 'Download Encrypted .flickvault Archive'}
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
                  Restore Local Flick Vault
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Import a previously exported <code className="text-amber-400">.flickvault</code> file onto this device.
                </p>
              </div>

              <div className="space-y-4">
                {/* File picker */}
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                    Select .flickvault File
                  </label>
                  <input
                    type="file"
                    accept=".flickvault,application/octet-stream"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setRestoreFile(e.target.files[0]);
                      }
                    }}
                    className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl text-xs text-zinc-300 file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1.5">
                    Decryption Passphrase
                  </label>
                  <input
                    type="password"
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="Enter backup passphrase..."
                    className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

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
                  {isRestoring ? 'Decrypting & Ingesting...' : 'Restore Vault to this Device'}
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
