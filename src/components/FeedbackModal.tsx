import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createFeedback } from '../lib/services';
import { playLikeSound, playGlitchClickSound } from '../lib/sounds';
import { MessageSquare, X, Check, Star, ShieldCheck, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'bug' | 'feature' | 'general'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!content.trim()) {
      setError("Please outline your bug report or feedback message before sending.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const compiledContent = `[Category: ${category.toUpperCase()}] ${content.trim()}`;
      await createFeedback(profile.uid, profile.displayName, compiledContent);
      playLikeSound();
      setSuccess(true);
      setContent('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setError("Failed submitting feedback logs to cryptographic core.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-2xl z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative glass-panel border border-[var(--glass-border)] p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden z-10 text-[var(--color-text)]"
          >
            {/* Close */}
            <button
              onClick={() => {
                playGlitchClickSound();
                onClose();
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-black dark:hover:text-[var(--color-text)] transition cursor-pointer text-xs uppercase font-mono tracking-wider"
            >
              [Close]
            </button>

            {success ? (
              <div className="py-8 flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-500 text-xl animate-bounce">
                  ✓
                </div>
                <h3 className="font-serif italic text-xl font-bold">Transmission Captured</h3>
                <p className="text-xs text-neutral-500 dark:text-zinc-400 max-w-xs uppercase tracking-wider font-semibold font-mono leading-relaxed">
                  Your feedback payload has been written to the write-only vault logs block successfully of our secure server.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center space-x-2.5 mb-2">
                  <MessageSquare className="w-5 h-5 text-zinc-900 dark:text-[var(--color-text)]" />
                  <h3 className="font-serif italic text-xl font-semibold">Decentralized Feedback Portal</h3>
                </div>

                <p className="text-[10.5px] text-zinc-500 leading-relaxed uppercase tracking-wider font-bold">
                  Identify bugs, architectural feedback, or requested core updates directly with deep developer access.
                </p>

                {error && (
                  <div className="text-[10.5px] font-mono p-3 bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 uppercase tracking-widest leading-normal">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold opacity-60 mb-2">
                    Feedback Category Selector
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['general', 'bug', 'feature'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          playGlitchClickSound();
                          setCategory(cat);
                        }}
                        className={`text-[10px] uppercase tracking-widest font-black py-2.5 border text-center transition cursor-pointer rounded-none ${
                          category === cat
                            ? 'bg-[var(--color-surface)] text-[var(--color-text)] dark:bg-white dark:text-black border-black dark:border-white'
                            : 'bg-white dark:bg-[var(--color-surface)] border-black/10 dark:border-[var(--neon-green-border)] text-zinc-500 hover:text-black dark:hover:text-[var(--color-text)]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold opacity-60 mb-2">
                    Detailed Report Payload
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Provide details about mismatching layouts, error messages, or requested tools..."
                    className="w-full text-xs p-3 bg-white dark:bg-[var(--color-surface)] border border-black/15 dark:border-[var(--neon-green-border)] focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                  />
                  <div className="text-right text-[9px] font-mono text-neutral-400 mt-1 uppercase tracking-wider">
                    {content.length}/1000 MAX CHARS
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-[var(--neon-green-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      playGlitchClickSound();
                      onClose();
                    }}
                    className="border border-black/15 dark:border-[var(--neon-green-border)] px-4 py-2 hover:bg-[var(--color-surface)]/5 dark:hover:bg-[var(--color-surface)] text-xs transition uppercase font-bold tracking-wider rounded-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="border border-black dark:border-white bg-[var(--color-surface)] dark:bg-white text-[var(--color-text)] dark:text-black px-6 py-2 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 text-xs transition uppercase font-bold tracking-wider rounded-none cursor-pointer"
                  >
                    {isSubmitting ? 'Transmitting...' : 'Dispatch Logs'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
