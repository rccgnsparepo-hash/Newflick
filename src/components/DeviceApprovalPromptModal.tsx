import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Smartphone,
  Laptop,
  Globe,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Lock,
  ArrowRightLeft,
  Sparkles,
  Loader2
} from 'lucide-react';
import { DeviceAuthRequest, approveDeviceAuthRequest, rejectDeviceAuthRequest } from '../lib/deviceAuthSyncService';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';

interface DeviceApprovalPromptModalProps {
  request: DeviceAuthRequest | null;
  onClose: () => void;
  localPrivateKey: string | null;
  globalPassword?: string;
}

export function DeviceApprovalPromptModal({
  request,
  onClose,
  localPrivateKey,
  globalPassword
}: DeviceApprovalPromptModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!request) return null;

  const handleCopyCode = () => {
    playGlitchClickSound();
    navigator.clipboard.writeText(request.verificationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showBrutalistToast('CODE COPIED ✓', `Verification Code: ${request.verificationCode}`, 'info');
  };

  const handleApprove = async () => {
    setIsApproving(true);
    playGlitchClickSound();
    triggerVibration('medium');

    try {
      const res = await approveDeviceAuthRequest(request, localPrivateKey, globalPassword);
      if (res.success) {
        playLikeSound();
        showBrutalistToast('DEVICE AUTHORIZED ✓', `Vault and keys transferred to ${request.deviceName}.`, 'success');
        onClose();
      } else {
        showBrutalistToast('ERROR ×', res.error || 'Failed to authorize device.', 'error');
      }
    } catch (err: any) {
      showBrutalistToast('ERROR ×', err.message || 'Authorization failed.', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    playGlitchClickSound();
    triggerVibration('heavy');

    try {
      await rejectDeviceAuthRequest(request);
      showBrutalistToast('REQUEST REJECTED ×', 'The unauthorized device login attempt was declined.', 'warning');
      onClose();
    } catch (err: any) {
      showBrutalistToast('ERROR ×', err.message || 'Failed to reject request.', 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 8 }}
          className="bg-[#050806] border-2 border-[var(--neon-green)] p-6 max-w-md w-full shadow-[8px_8px_0px_0px_#00ff66] text-[var(--color-text)] space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--neon-green)]/30 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--neon-green)]/10 border border-[var(--neon-green)] flex items-center justify-center text-[var(--neon-green)]">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wider uppercase text-[var(--neon-green)]">
                  NEW DEVICE SIGN-IN ATTEMPT
                </h3>
                <p className="text-[10px] text-zinc-400 uppercase">Account Sync Lock Triggered</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-xs cursor-pointer p-1"
            >
              ✕
            </button>
          </div>

          {/* Device details card */}
          <div className="bg-black/60 border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-3">
              {request.deviceType === 'mobile' ? (
                <Smartphone className="w-8 h-8 text-[var(--neon-green)] shrink-0" />
              ) : request.deviceType === 'desktop' ? (
                <Laptop className="w-8 h-8 text-[var(--neon-green)] shrink-0" />
              ) : (
                <Globe className="w-8 h-8 text-[var(--neon-green)] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white uppercase truncate">{request.deviceName}</p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                  Type: {request.deviceType.toUpperCase()} • ID: {request.deviceId.slice(0, 10)}...
                </p>
              </div>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              A new device is trying to sign into your Flick account. To grant access and sync your local E2EE keys and chat history, verify the code below or tap Authorize.
            </p>
          </div>

          {/* 6-Digit Verification Code Block */}
          <div className="bg-black border border-[var(--neon-green)]/50 p-4 text-center space-y-2">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block font-bold">
              SECURITY VERIFICATION CODE
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-black tracking-[0.25em] text-[var(--neon-green)] font-mono selection:bg-[var(--neon-green)] selection:text-black">
                {request.verificationCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-1.5 border border-zinc-700 hover:border-[var(--neon-green)] text-zinc-300 hover:text-[var(--neon-green)] transition-colors cursor-pointer"
                title="Copy code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[var(--neon-green)]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
              Enter this code on your new device or tap the button below.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={isRejecting || isApproving}
              onClick={handleReject}
              className="py-3 px-4 bg-transparent border border-red-500/80 hover:bg-red-950/40 text-red-400 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isRejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>DECLINE</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isApproving || isRejecting}
              onClick={handleApprove}
              className="py-3 px-4 bg-[var(--neon-green)] hover:bg-[#00e65c] text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_#000000] disabled:opacity-50"
            >
              {isApproving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SYNCING VAULT...</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>AUTHORIZE & SYNC</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
