import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Sparkles, Sliders, MessageSquare, ArrowRight, ArrowLeft, X, Check, HelpCircle } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';

interface AppTourProps {
  activeTab: 'feed' | 'chat';
  setActiveTab: (tab: 'feed' | 'chat') => void;
  setIsSettingsOpen: (open: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function AppTour({
  activeTab,
  setActiveTab,
  setIsSettingsOpen,
  isOpen,
  onClose
}: AppTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const steps = [
    {
      target: 'body',
      title: '🌌 SECURE TRANSMISSION BRIEFING',
      subtitle: 'Welcome to your sandbox terminal',
      description: 'You have entered Faratech Flick—a high-fidelity sovereign messaging cell. Let\'s run a 1-minute briefing to configure your node and guide you through posting, chats, and ephemeral loops.',
      placement: 'center',
      action: () => {
        setIsSettingsOpen(false);
      }
    },
    {
      target: '#tour-post-box',
      title: '✏️ CHRONICLE CREATOR',
      subtitle: 'Where to post updates',
      description: 'This is the Chronicle Post creator. Share a text log, attach external audio/video or secure image links to publish real-time journals. Your circle of peers will see them inside their customized feeds instantly.',
      placement: 'bottom',
      action: () => {
        setActiveTab('feed');
        setIsSettingsOpen(false);
      }
    },
    {
      target: '#tour-stories-bar',
      title: '⭕ EPHEMERAL CHRONICLES',
      subtitle: 'Disappearing 24h stories',
      description: 'Stories published here naturally decay and self-destruct after 24 hours. Tap on any peer\'s circular avatar to view their active telemetry clips, leave custom reactions, or explore viewer analytics.',
      placement: 'bottom',
      action: () => {
        setActiveTab('feed');
        setIsSettingsOpen(false);
      }
    },
    {
      target: '#tour-tab-chat',
      title: '🎛️ COMMUNICATION ENGINES',
      subtitle: 'Switching tabs',
      description: 'To look for peers, transmit messages, or inspect current encryption key streams, toggle over to the "Encryption Tunnels" panel.',
      placement: 'bottom',
      action: () => {
        setActiveTab('feed');
        setIsSettingsOpen(false);
      }
    },
    {
      target: '#tour-chat-list',
      title: '👥 ENCRYPTED DIRECT TUNNELS',
      subtitle: 'Chat who? Direct peers search',
      description: 'This directory catalogs active nodes on the network. Select any user from this list to instantiate a 2404-bit RSA private tunnel. You can type messages and track real-time "typing..." pulses seamlessly.',
      placement: 'bottom',
      action: () => {
        setActiveTab('chat');
        setIsSettingsOpen(false);
      }
    },
    {
      target: '#tour-profile-btn',
      title: '📐 CODES & TRANSCEIVERS CONFIG',
      subtitle: 'Configure your node settings',
      description: 'Tap on your Avatar or settings button to change active colors (purple, green, white), toggle the custom typing pulse modes (Stealth mode, Minimal mode, or Pulse mode), and secure expiring message TTL timers.',
      placement: 'bottom',
      action: () => {
        setActiveTab('chat');
        setIsSettingsOpen(false);
      }
    },
    {
      target: 'body',
      title: '🔥 HANDSHAKE COORDINATE READY',
      subtitle: 'All telemetry pipelines are green',
      description: 'Excellent work. Your terminal node is verified. Go ahead, post updates, open secured channels, and enjoy total private data sovereignty with Flick!',
      placement: 'center',
      action: () => {
        setIsSettingsOpen(false);
      }
    }
  ];

  useEffect(() => {
    if (!isOpen) return;

    const calcStepPos = () => {
      const step = steps[currentStepIndex];
      if (!step || step.target === 'body') {
        setCoords(null);
        return;
      }

      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        
        // Smooth scroll to highlight container
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setCoords(null);
      }
    };

    // Execute step setup action first
    const currentStep = steps[currentStepIndex];
    if (currentStep?.action) {
      currentStep.action();
    }

    // Set a slight timeout to let any tab rendering complete
    const timer = setTimeout(() => {
      calcStepPos();
    }, 280);

    window.addEventListener('resize', calcStepPos);
    window.addEventListener('scroll', calcStepPos);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calcStepPos);
      window.removeEventListener('scroll', calcStepPos);
    };
  }, [currentStepIndex, isOpen, activeTab]);

  if (!isOpen) return null;

  const handleNext = () => {
    playGlitchClickSound();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      playLikeSound();
      localStorage.setItem('flick_tour_completed', 'true');
      onClose();
    }
  };

  const handlePrev = () => {
    playGlitchClickSound();
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    playGlitchClickSound();
    localStorage.setItem('flick_tour_completed', 'true');
    onClose();
  };

  const step = steps[currentStepIndex];

  // Dynamically position tooltip near element or in viewport center
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 100,
  };

  if (coords) {
    let idealTop = coords.top + coords.height + 14;
    // Handle bottom of screen bounds: place above target if it doesn't fit below
    if (idealTop + 260 > window.innerHeight + window.scrollY) {
      idealTop = coords.top - 265;
      if (idealTop < window.scrollY) {
        idealTop = window.scrollY + (window.innerHeight - 240) / 2;
      }
    }

    const screenWidth = window.innerWidth;
    const tooltipWidth = Math.min(350, screenWidth - 32);
    let idealLeft = coords.left + (coords.width - tooltipWidth) / 2;
    
    // Contain left/right coordinates
    idealLeft = Math.max(16, Math.min(screenWidth - tooltipWidth - 16, idealLeft));

    tooltipStyle = {
      position: 'absolute',
      top: idealTop,
      left: idealLeft,
      width: `${tooltipWidth}px`,
      zIndex: 100,
    };
  }

  return (
    <div className="absolute inset-0 select-none">
      
      {/* 1. Backdrop dark mask using classical spotlight transparent box shadow trick */}
      {coords ? (
        <div
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            height: coords.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 90,
          }}
          className="rounded border border-[var(--neon-green)] animate-pulse pointer-events-none"
        />
      ) : (
        <div className="fixed inset-0 bg-[var(--color-surface)]/80 backdrop-blur-xs z-90 transition-all duration-300" />
      )}

      {/* 2. Interactive Floating Tooltip Box */}
      <div 
        style={tooltipStyle}
        className="transition-all duration-300"
      >
        <motion.div
          key={currentStepIndex}
          initial={{ scale: 0.95, opacity: 0, y: coords ? 5 : 0 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-[var(--color-background)] border-2 border-[var(--neon-green)] text-[var(--color-text)] shadow-[4px_4px_0px_#000000] p-4 font-mono text-left block"
        >
          {/* Header indicator */}
          <div className="flex items-center justify-between border-b border-[var(--neon-green)]/20 pb-2 mb-3">
            <div className="flex items-center space-x-1.5 text-[var(--neon-green)]">
              <Compass className="w-4 h-4 shrink-0 animate-spin-slow text-[var(--neon-green)]" />
              <span className="text-[9px] font-black tracking-widest uppercase">NODE GUIDE briefing</span>
            </div>
            <button
              onClick={handleSkip}
              className="text-zinc-500 hover:text-red-500 hover:rotate-90 transition duration-150 cursor-pointer p-0.5"
              title="Skip Briefing Tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step content */}
          <p className="text-[8px] tracking-widest font-black text-amber-500 uppercase">{step.subtitle}</p>
          <h4 className="text-sm font-black text-[var(--color-text)] mt-1 uppercase tracking-tight font-serif">
            {step.title}
          </h4>
          <p className="text-[11px] text-zinc-300 mt-2.5 leading-relaxed font-sans font-normal border-l-2 border-[var(--neon-green)]/35 pl-3">
            {step.description}
          </p>

          {/* Navigation and actions footer */}
          <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-[var(--neon-green)]/15">
            {/* Dots */}
            <div className="flex space-x-1 shrink-0">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 transition-all duration-200 ${
                    idx === currentStepIndex
                      ? 'bg-[var(--neon-green)] scale-110'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center space-x-2">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center space-x-1 border border-[var(--neon-green-border)] hover:border-zinc-500 px-2 py-1 text-[9px] font-black uppercase text-zinc-400 hover:text-[var(--color-text)] transition cursor-pointer font-mono"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-1.5 bg-[var(--neon-green)] hover:bg-[#00ffcc] hover:text-black border border-black font-black text-black px-3 py-1.5 text-[9.5px] font-mono tracking-widest uppercase transition transform active:scale-95 cursor-pointer"
              >
                {currentStepIndex === steps.length - 1 ? (
                  <>
                    <span>Decrypt</span>
                    <Check className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ArrowRight className="w-3 h-3 animate-pulse" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
