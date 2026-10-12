import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Key, Eye, CheckCircle2, ArrowRight, Radio, Sparkles, Lock, MessageSquare, RefreshCw } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';

interface OnboardingIntroProps {
  onComplete: () => void;
}

export default function OnboardingIntro({ onComplete }: OnboardingIntroProps) {
  const [screenState, setScreenState] = useState<'splash' | 'welcome' | 'slides'>('splash');
  const [slideIndex, setSlideIndex] = useState(0);

  // Splash Screen automatic duration transition (similar to Meta's startup delay)
  useEffect(() => {
    if (screenState === 'splash') {
      const timer = setTimeout(() => {
        setScreenState('welcome');
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [screenState]);

  const featureSlides = [
    {
      title: "End-to-End Encrypted",
      subtitle: "Privacy First Security",
      description: "All communications are locked peer-to-peer. Your private cryptographic keys stay exclusively on this device. No servers can intercept or read your encrypted conversations.",
      icon: Lock,
      color: "text-[var(--neon-green)] border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5"
    },
    {
      title: "Disappearing Stories",
      subtitle: "Ephemeral Chronicles",
      description: "Circulating stories naturally expire and dissolve after 24 hours. Express yourself in your peer circles with text logs, media feeds, and custom reaction tickers.",
      icon: Eye,
      color: "text-emerald-400 border-emerald-400/35 bg-emerald-500/5",
    },
    {
      title: "Live Action Channels",
      subtitle: "Real-Time Telemetry",
      description: "Connect instantly with encrypted direct tunnels, visual interaction triggers, custom profile stamps, and secure key exchanges optimized for mobile portability.",
      icon: Radio,
      color: "text-teal-400 border-teal-400/30 bg-teal-500/5",
    }
  ];

  const handleNextSlide = () => {
    playGlitchClickSound();
    if (slideIndex < featureSlides.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      playLikeSound();
      onComplete();
    }
  };

  const currentSlide = featureSlides[slideIndex];
  const SlideIcon = currentSlide.icon;

  return (
    <div className="fixed inset-0 z-[100] bg-[#070c0e] text-[var(--color-text)] flex flex-col items-center justify-between p-6 select-none overflow-hidden font-sans">
      
      {/* Background elegant lighting spot & connection grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0b1517_1px,transparent_1px),linear-gradient(to_bottom,#0b1517_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-60 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[radial-gradient(circle_at_center,#122a2b_0%,transparent_70%)] opacity-50 blur-3xl pointer-events-none" />

      {/* Top Margin Header */}
      <div className="z-10 w-full flex items-center justify-between opacity-80 pt-2">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 border border-[var(--neon-green)]/40 flex items-center justify-center font-serif text-xs font-black bg-[var(--color-surface)] text-[var(--neon-green)]">
            F
          </div>
          <span className="text-[8.5px] font-mono tracking-[0.2em] font-extrabold uppercase text-emerald-500">SECURE SHELL GATE</span>
        </div>
        <div className="text-[8.5px] font-mono tracking-wider text-zinc-500 uppercase">
          NODE: COM.FARATECH.FLICK
        </div>
      </div>

      {/* Main Responsive Onboarding Frame Container */}
      <div className="z-10 flex-1 flex flex-col items-center justify-center max-w-md w-full relative">
        <AnimatePresence mode="wait">
          
          {/* STAGE 1: Splash/Loading View */}
          {screenState === 'splash' && (
            <motion.div
              key="splash"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="flex flex-col items-center space-y-7 text-center"
            >
              {/* Pulsing Concentric Circular Branding */}
              <div className="relative flex items-center justify-center">
                <div className="absolute w-32 h-32 rounded-full border border-emerald-500/20 animate-ping duration-1000" />
                <div className="absolute w-24 h-24 rounded-full border border-[var(--neon-green)]/30 animate-pulse duration-700" />
                <div className="w-18 h-18 bg-[var(--color-surface)] border-2 border-[var(--neon-green)] rounded-3xl flex items-center justify-center font-serif text-4xl italic font-black text-[var(--neon-green)] shadow-[0px_0px_20px_rgba(0,255,102,0.15)]">
                  F
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-serif font-black tracking-widest text-[var(--color-text)] uppercase italic">
                  FLICK
                </h1>
                <p className="text-[10px] uppercase font-mono tracking-[0.3em] text-[var(--neon-green)] mt-2 font-bold animate-pulse">
                  Initializing local secure tunnels...
                </p>
              </div>

              {/* Progress Dot Track */}
              <div className="flex items-center space-x-2.5 pt-2">
                <div className="w-2 h-2 rounded-full bg-[var(--neon-green)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}

          {/* STAGE 2: Welcome / Legal Policy view (reserves exact Meta vibe) */}
          {screenState === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center text-center space-y-8"
            >
              {/* Abstract connected world vector illustration */}
              <div className="relative w-56 h-56 flex items-center justify-center mt-2">
                <div className="absolute inset-0 rounded-full border border-emerald-500/10 animate-spin-slow duration-[30000ms]" />
                <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20 border-dashed animate-spin-slow duration-[15000ms]" />
                <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-emerald-900/15 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
                  <MessageSquare className="w-14 h-14 text-[var(--neon-green)] opacity-85" />
                </div>
                {/* Connected nodes */}
                <span className="absolute top-4 left-6 w-3 h-3 bg-teal-400 rounded-full animate-ping" />
                <span className="absolute bottom-6 right-10 w-2 h-2 bg-[var(--neon-green)] rounded-full animate-pulse" />
                <span className="absolute top-1/2 right-4 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
              </div>

              <div className="space-y-3.5">
                <h1 className="text-3xl font-sans font-extrabold tracking-tight text-[var(--color-text)]">
                  Welcome to Flick
                </h1>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto px-1 font-mono uppercase tracking-tight">
                  A high-fidelity telemetry messaging network. Designed with absolute data sovereignty.
                </p>
              </div>

              {/* Meta Terms Accordance styling */}
              <div className="bg-[#091113] border border-emerald-950/40 p-4 max-w-sm rounded-2xl">
                <p className="text-zinc-350 text-[11px] leading-relaxed font-sans font-medium">
                  Read our <span className="text-[var(--neon-green)] underline cursor-pointer hover:opacity-85">Privacy Policy</span>. Tap <span className="font-extrabold text-[var(--color-text)]">"Agree and Continue"</span> to establish local handshake structures and accept our terms.
                </p>
              </div>

              {/* Elegant rounded emerald button matching Meta's layout */}
              <button
                onClick={() => {
                  playGlitchClickSound();
                  setScreenState('slides');
                }}
                className="w-full sm:w-80 bg-[var(--neon-green)] text-black hover:bg-emerald-400 text-xs font-mono font-black uppercase tracking-widest py-3.5 px-6 rounded-full transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-[0px_4px_16px_rgba(0,255,102,0.15)] flex items-center justify-center space-x-2 cursor-pointer mt-2"
              >
                <span>Agree and Continue</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </motion.div>
          )}

          {/* STAGE 3: Features Micro-Slideshow */}
          {screenState === 'slides' && (
            <motion.div
              key="slides"
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full flex flex-col justify-between"
            >
              <div className="bg-[#091113]/90 border border-emerald-950/45 p-6 sm:p-8 rounded-3xl relative shadow-2xl min-h-[350px] flex flex-col justify-between mt-2">
                
                {/* Progress bar pagination track */}
                <div className="flex gap-2.5 mb-6">
                  {featureSlides.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        idx === slideIndex 
                          ? 'bg-[var(--neon-green)]' 
                          : idx < slideIndex 
                            ? 'bg-emerald-900/60' 
                            : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>

                {/* Animated feature details */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slideIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col justify-center py-2"
                  >
                    <div className="flex items-center space-x-3.5 mb-5">
                      <div className={`p-3 rounded-2xl border ${currentSlide.color} flex items-center justify-center shrink-0`}>
                        <SlideIcon className="w-5.5 h-5.5" />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-[var(--neon-green)] font-bold">
                          Flick Feature {slideIndex + 1} of {featureSlides.length}
                        </span>
                        <h3 className="text-[10px] tracking-wider text-zinc-400 font-mono uppercase font-black">
                          {currentSlide.subtitle}
                        </h3>
                      </div>
                    </div>

                    <h2 className="text-2xl font-sans font-black text-[var(--color-text)] tracking-tight leading-tight mb-4 uppercase">
                      {currentSlide.title}
                    </h2>

                    <p className="text-zinc-300 text-xs sm:text-[13px] leading-relaxed font-sans font-normal border-l-2 border-[var(--neon-green)]/40 pl-4 py-0.5">
                      {currentSlide.description}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Micro Actions */}
                <div className="mt-8 pt-5 border-t border-emerald-950/20 flex items-center justify-between">
                  <button
                    onClick={() => {
                      playGlitchClickSound();
                      onComplete();
                    }}
                    className="text-zinc-400 hover:text-[var(--color-text)] text-[10px] font-mono tracking-widest uppercase cursor-pointer transition-colors"
                  >
                    Skip
                  </button>

                  <button
                    onClick={handleNextSlide}
                    className="bg-white text-black hover:bg-[var(--neon-green)] py-2.5 px-5 rounded-full text-[10.5px] font-mono uppercase tracking-widest font-black flex items-center space-x-1.5 cursor-pointer shadow-lg transition-colors duration-200"
                  >
                    {slideIndex === featureSlides.length - 1 ? (
                      <>
                        <span>Finish</span>
                        <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />
                      </>
                    ) : (
                      <>
                        <span>Next</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Signature Footer: Branded precisely like the Meta standard "from Meta" logo */}
      <div className="z-10 w-full flex flex-col items-center space-y-1 py-4 select-none pointer-events-none mt-4 shrink-0 transition-opacity duration-300">
        <span className="text-[8px] font-sans font-bold uppercase tracking-[0.3em] text-zinc-400">
          by
        </span>
        <span className="text-[11px] font-sans font-extrabold text-[var(--color-text)] tracking-[0.4em] mr-[-0.4em] uppercase">
          Faratech
        </span>
      </div>

    </div>
  );
}
