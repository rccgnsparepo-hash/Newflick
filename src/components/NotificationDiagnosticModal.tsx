import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  RefreshCw, 
  Wrench, 
  X, 
  ShieldCheck, 
  Smartphone, 
  Database, 
  Lock, 
  Radio
} from 'lucide-react';
import { 
  notificationDiagnosticService, 
  PushDiagnosticReport, 
  DiagnosticItem 
} from '../lib/NotificationDiagnosticService';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { showBrutalistToast } from '../lib/toast';

interface NotificationDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid?: string;
}

export const NotificationDiagnosticModal: React.FC<NotificationDiagnosticModalProps> = ({
  isOpen,
  onClose,
  uid
}) => {
  const [report, setReport] = useState<PushDiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  const runDiagnostic = async () => {
    setIsRunning(true);
    try {
      const res = await notificationDiagnosticService.runFullDiagnostics(uid);
      setReport(res);
      triggerVibration('light');
    } catch (err: any) {
      console.warn('[DiagnosticModal] Error running diagnostics:', err);
      showBrutalistToast('DIAGNOSTIC ERROR', err?.message || 'Failed to complete push diagnostic scan.', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRepair = async () => {
    if (!uid) {
      showBrutalistToast('AUTH REQUIRED', 'Please sign in to repair push registration.', 'warning');
      return;
    }
    playGlitchClickSound();
    setIsRepairing(true);
    try {
      const result = await notificationDiagnosticService.repairPushRegistration(uid);
      if (result.success) {
        playLikeSound();
        triggerVibration('medium');
        showBrutalistToast('REPAIR COMPLETED', result.message, 'success');
      } else {
        showBrutalistToast('REPAIR NOTICE', result.message, 'warning');
      }
      await runDiagnostic();
    } catch (err: any) {
      showBrutalistToast('REPAIR FAILED', err?.message || 'Error occurred during push repair.', 'error');
    } finally {
      setIsRepairing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostic();
    }
  }, [isOpen, uid]);

  if (!isOpen) return null;

  const renderStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md font-mono select-text">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl max-h-[90vh] bg-neutral-950 border-2 border-[var(--neon-green)] shadow-[0_0_30px_rgba(0,255,102,0.2)] flex flex-col overflow-hidden"
        >
          {/* Top Modal Header */}
          <div className="p-3.5 sm:p-4 bg-black border-b border-[var(--neon-green)]/30 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-3 h-3 bg-[var(--neon-green)] rounded-full animate-ping shrink-0" />
              <div>
                <h2 className="text-xs sm:text-sm font-black tracking-widest text-[var(--neon-green)] uppercase flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> FLICK PUSH DIAGNOSTIC VERIFIER
                </h2>
                <p className="text-[8px] text-zinc-400 uppercase tracking-widest mt-0.5">
                  Native Android 13+ APK & Web Push Architecture Audit
                </p>
              </div>
            </div>

            <button
              onClick={() => { playGlitchClickSound(); onClose(); }}
              className="p-1 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 transition"
              title="Close Diagnostic Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 scrollbar-thin">
            {/* Overall Verdict Banner */}
            {report && (
              <div className={`p-4 border ${
                report.overallStatus === 'PASS'
                  ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                  : report.overallStatus === 'WARN'
                  ? 'border-amber-500/50 bg-amber-950/20 text-amber-300'
                  : 'border-rose-500/50 bg-rose-950/20 text-rose-300'
              } flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${
                      report.overallStatus === 'PASS'
                        ? 'bg-emerald-500 text-black'
                        : report.overallStatus === 'WARN'
                        ? 'bg-amber-500 text-black'
                        : 'bg-rose-600 text-white'
                    }`}>
                      STATUS: {report.overallStatus}
                    </span>
                    <span className="text-xs font-bold">
                      Health Score: {report.score}%
                    </span>
                  </div>
                  <p className="text-[9.5px] text-zinc-300">
                    {report.overallStatus === 'PASS'
                      ? 'All push services, permissions, and backend database token mappings are active.'
                      : report.overallStatus === 'WARN'
                      ? 'Push notifications are operational, but some components require synchronization.'
                      : 'Critical push components are disconnected or denied. Background alerts will not arrive.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={runDiagnostic}
                    disabled={isRunning}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-[9px] font-bold uppercase transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
                    Rescan
                  </button>

                  <button
                    onClick={handleRepair}
                    disabled={isRepairing}
                    className="px-3 py-1.5 bg-[var(--neon-green)] text-black hover:bg-emerald-400 text-[9px] font-black uppercase transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                  >
                    <Wrench className={`w-3 h-3 ${isRepairing ? 'animate-spin' : ''}`} />
                    {isRepairing ? 'Repairing...' : 'Auto-Repair'}
                  </button>
                </div>
              </div>
            )}

            {/* Diagnostic Item Checklist */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--neon-green)] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" /> Component Architecture Status ({report?.items.length || 0} checks)
              </span>

              <div className="space-y-2">
                {report?.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-neutral-900/60 border border-zinc-800 hover:border-zinc-700 transition flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start space-x-2.5 min-w-0">
                      {renderStatusIcon(item.status)}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-[10px] font-bold text-zinc-200 uppercase">
                            {item.name}
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.2 border uppercase ${
                            item.status === 'pass'
                              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30'
                              : item.status === 'warn'
                              ? 'border-amber-500/40 text-amber-400 bg-amber-950/30'
                              : item.status === 'fail'
                              ? 'border-rose-500/40 text-rose-400 bg-rose-950/30'
                              : 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30'
                          }`}>
                            {item.summary}
                          </span>
                        </div>
                        <p className="text-[8.5px] text-zinc-400 leading-normal">
                          {item.detail}
                        </p>
                        {item.actionHint && (
                          <p className="text-[8px] text-amber-400 font-sans italic mt-0.5">
                            💡 Recommendation: {item.actionHint}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Token & Device Snapshot */}
            {report && (
              <div className="p-3.5 bg-black border border-zinc-800 space-y-2.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-[var(--neon-green)]" /> Device Identity & Token Registry
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[8.5px]">
                  <div className="p-2 bg-neutral-900 border border-zinc-800 space-y-0.5">
                    <span className="text-zinc-500 uppercase block">Local OneSignal Subscription ID:</span>
                    <span className="text-[var(--neon-green)] font-mono truncate block">
                      {report.localDeviceTokens.oneSignalSubscriptionId || 'NONE / NOT_OBTAINED'}
                    </span>
                  </div>

                  <div className="p-2 bg-neutral-900 border border-zinc-800 space-y-0.5">
                    <span className="text-zinc-500 uppercase block">Linked External UID:</span>
                    <span className="text-zinc-300 font-mono truncate block">
                      {report.localDeviceTokens.oneSignalExternalId || report.backendRecord.uid || 'ANONYMOUS'}
                    </span>
                  </div>

                  <div className="p-2 bg-neutral-900 border border-zinc-800 space-y-0.5 sm:col-span-2">
                    <span className="text-zinc-500 uppercase block">Backend Registered Device Tokens in Firestore:</span>
                    <span className="text-zinc-300 font-mono break-all block">
                      {report.backendRecord.registeredTokens.length > 0
                        ? report.backendRecord.registeredTokens.join(', ')
                        : 'No tokens stored in user document.'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="p-3 sm:p-4 bg-black border-t border-[var(--neon-green)]/30 flex items-center justify-between">
            <span className="text-[8px] text-zinc-500 uppercase">
              Last Check: {report ? new Date(report.timestamp).toLocaleTimeString() : 'Pending'}
            </span>

            <button
              onClick={() => { playGlitchClickSound(); onClose(); }}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[9px] font-bold uppercase transition"
            >
              Done / Dismiss
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
