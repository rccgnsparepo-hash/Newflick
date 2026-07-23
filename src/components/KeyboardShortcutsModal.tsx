import React from 'react';
import { playGlitchClickSound } from '../lib/sounds';
import { Keyboard, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const shortcutsList = [
    {
      group: "Navigation & Tabs",
      items: [
        { keys: ["Shift + F", "Alt + F"], desc: "Switch to Social Feed Workspace" },
        { keys: ["Shift + C", "Alt + C"], desc: "Switch to Secure Chat handshakes" },
      ]
    },
    {
      group: "Interactive Portals",
      items: [
        { keys: ["Shift + S", "Alt + S"], desc: "Open Profile & Node Settings" },
        { keys: ["Shift + E", "Alt + E"], desc: "Open Decentralized Feedback Portal" },
        { keys: ["Shift + K", "Alt + K", "?"], desc: "Toggle Shortcuts Overlay (This menu)" },
      ]
    },
    {
      group: "Active Session Actions",
      items: [
        { keys: ["Escape"], desc: "Close any modal, drawer, or zoom view" },
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-[var(--color-surface)]/60 backdrop-blur-xs z-[180] flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={onClose} />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative bg-[#FAF9F6] dark:bg-[var(--color-background)] border-2 border-black dark:border-[var(--neon-green)] p-6 sm:p-8 rounded-none max-w-lg w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_var(--neon-green)] overflow-hidden z-10 font-mono text-zinc-900 dark:text-[var(--color-text)]"
          >
            {/* Corner Decorative Brutalist Tech details */}
            <div className="absolute top-2 left-2 text-[8px] opacity-25 uppercase tracking-widest pointer-events-none select-none">
              FARA_FLICK // SYSTEM_HOTKEYS_MAP
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                playGlitchClickSound();
                onClose();
              }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-black dark:hover:text-[var(--neon-green)] transition cursor-pointer text-xs uppercase tracking-wider font-black"
            >
              [Close]
            </button>

            <div className="flex items-center space-x-3 mb-6 border-b-2 border-black dark:border-[var(--neon-green)]/30 pb-4">
              <div className="p-1 bg-[var(--color-surface)] text-[var(--neon-green)] border border-[var(--neon-green)]/30">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider font-sans">
                  SYSTEM SHORTCUTS MAP
                </h3>
                <p className="text-[9px] uppercase tracking-widest text-[var(--neon-green)] font-mono font-black mt-0.5">
                  Node Quick Handshakes & Workspace Navigation
                </p>
              </div>
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {shortcutsList.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-2.5">
                  <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-400 border-l-2 border-[var(--neon-green)] pl-2">
                    {group.group}
                  </h4>
                  <div className="divide-y divide-black/10 dark:divide-[var(--neon-green)]/10 font-mono">
                    {group.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-300">
                          {item.desc}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.keys.map((k, keyIdx) => (
                            <React.Fragment key={keyIdx}>
                              {keyIdx > 0 && <span className="text-[9px] text-zinc-400">or</span>}
                              <kbd className="px-1.5 py-0.5 bg-[var(--color-surface)] text-[var(--neon-green)] text-[10px] font-black border border-[var(--neon-green)]/30 shadow-[1.5px_1.5px_0px_var(--neon-green)] uppercase tracking-tight">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-black/10 dark:border-[var(--neon-green)]/20 flex flex-col sm:flex-row items-center justify-between text-[9px] uppercase text-zinc-500 font-mono tracking-widest gap-2">
              <span>ACTIVE HANDSHAKE CAPABILITIES</span>
              <span className="text-[var(--neon-green)] font-black">
                [ FARA SECURE KERNEL ONLINE ]
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
