import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, Info, X, ShieldAlert, Check } from 'lucide-react';
import { playGlitchClickSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: 'trash' | 'alert' | 'info' | 'shield';
  badge?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    playGlitchClickSound();
    triggerVibration('medium');

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialogState(options);
    });
  }, []);

  const handleConfirm = () => {
    playGlitchClickSound();
    triggerVibration('medium');
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
    setDialogState(null);
  };

  const handleCancel = () => {
    playGlitchClickSound();
    triggerVibration('light');
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setDialogState(null);
  };

  // Keyboard accessibility
  useEffect(() => {
    if (!dialogState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  const variant = dialogState?.variant || 'danger';
  const iconType = dialogState?.icon || (variant === 'danger' ? 'trash' : 'alert');

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Global Brutalist Confirmation Modal */}
      <AnimatePresence>
        {dialogState && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-zinc-950 border-2 rounded-2xl p-6 shadow-2xl overflow-hidden select-none"
              style={{
                borderColor:
                  variant === 'danger'
                    ? 'rgba(239, 68, 68, 0.6)'
                    : variant === 'warning'
                    ? 'rgba(245, 158, 11, 0.6)'
                    : 'rgba(0, 255, 102, 0.5)',
                boxShadow:
                  variant === 'danger'
                    ? '0 0 30px rgba(239, 68, 68, 0.2)'
                    : variant === 'warning'
                    ? '0 0 30px rgba(245, 158, 11, 0.2)'
                    : '0 0 30px rgba(0, 255, 102, 0.15)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Corner accent tag */}
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-zinc-900 border border-zinc-800">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      variant === 'danger'
                        ? 'bg-rose-500 animate-pulse'
                        : variant === 'warning'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={
                      variant === 'danger'
                        ? 'text-rose-400'
                        : variant === 'warning'
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }
                  >
                    {dialogState.badge || (variant === 'danger' ? 'IRREVERSIBLE ACTION' : 'CONFIRMATION REQUIRED')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Icon & Title */}
              <div className="flex items-start gap-3.5 mb-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    variant === 'danger'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                      : variant === 'warning'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {iconType === 'trash' ? (
                    <Trash2 className="w-5 h-5" />
                  ) : iconType === 'alert' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : iconType === 'shield' ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-white uppercase tracking-wide font-mono">
                    {dialogState.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mt-1 font-sans">
                    {dialogState.message}
                  </p>
                </div>
              </div>

              {/* Re-ask Safety Warning Note */}
              <div className="my-4 p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
                <span className="text-amber-400 font-bold">Note:</span>
                <span>Flick verified this double-check to prevent accidental data loss.</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold uppercase transition border border-zinc-800 cursor-pointer"
                >
                  {dialogState.cancelText || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  autoFocus
                  className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-1.5 shadow-lg cursor-pointer ${
                    variant === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                      : variant === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/30'
                      : 'bg-[var(--neon-green)] hover:bg-[var(--neon-green)]/90 text-black'
                  }`}
                >
                  {variant === 'danger' ? (
                    <Trash2 className="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{dialogState.confirmText || 'Confirm Delete'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextType => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
