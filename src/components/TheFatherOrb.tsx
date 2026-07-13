import React from 'react';
import { motion } from 'motion/react';

interface TheFatherOrbProps {
  isThinking?: boolean;
}

export const TheFatherOrb: React.FC<TheFatherOrbProps> = ({ isThinking = false }) => {
  return (
    <div className="relative flex flex-col items-center justify-center py-10 select-none overflow-hidden">
      {/* Glow Effects Behind the Orb */}
      <div className="absolute w-72 h-72 rounded-full bg-violet-600/10 blur-[60px] animate-pulse pointer-events-none" />
      <div className="absolute w-48 h-48 rounded-full bg-cyan-500/10 blur-[40px] animate-pulse pointer-events-none" style={{ animationDelay: '1.5s' }} />
      <div className="absolute w-60 h-60 rounded-full bg-fuchsia-500/5 blur-[50px] animate-pulse pointer-events-none" style={{ animationDelay: '3s' }} />

      {/* Main Container of the Orb with Orbital Rings */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        
        {/* Outer Orbit Ring 1 - Fast counter-clockwise */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
          className="absolute inset-0 rounded-full border border-dashed border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
        />

        {/* Outer Orbit Ring 2 - Slow clockwise */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
          className="absolute inset-4 rounded-full border border-zinc-800 border-t-cyan-400/40 border-b-fuchsia-500/40"
        />

        {/* Orbital Path Particle Nodes */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          className="absolute inset-2 pointer-events-none"
        >
          {/* Glowing node orbiter 1 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-ping" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
        </motion.div>

        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
          className="absolute inset-6 pointer-events-none"
        >
          {/* Glowing node orbiter 2 */}
          <div className="absolute bottom-0 right-1/4 w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_8px_#f472b6]" />
        </motion.div>

        {/* Diagonal Quantum Orbit Track */}
        <motion.div
          animate={{ rotateX: 65, rotateY: 25, rotateZ: 360 }}
          transition={{ rotateZ: { repeat: Infinity, duration: 6, ease: 'linear' } }}
          className="absolute w-full h-full rounded-full border border-violet-500/20 pointer-events-none"
          style={{ transformStyle: 'preserve-3d' }}
        />

        {/* Opposite Diagonal Quantum Orbit Track */}
        <motion.div
          animate={{ rotateX: -65, rotateY: -25, rotateZ: -360 }}
          transition={{ rotateZ: { repeat: Infinity, duration: 5, ease: 'linear' } }}
          className="absolute w-full h-full rounded-full border border-cyan-400/20 pointer-events-none"
          style={{ transformStyle: 'preserve-3d' }}
        />

        {/* The Animated Holographic Core */}
        <motion.div
          animate={isThinking ? {
            scale: [1, 1.15, 0.95, 1.1, 1],
            rotate: 360,
          } : {
            scale: [1, 1.05, 0.98, 1.03, 1],
            rotate: 360,
          }}
          transition={{
            scale: { repeat: Infinity, duration: isThinking ? 1.5 : 4, ease: 'easeInOut' },
            rotate: { repeat: Infinity, duration: isThinking ? 4 : 12, ease: 'linear' }
          }}
          className={`w-32 h-32 rounded-full bg-black border-[3px] flex items-center justify-center relative shadow-[0_0_40px_rgba(139,92,246,0.3)] cursor-pointer overflow-hidden group ${
            isThinking ? 'border-fuchsia-500 shadow-[0_0_50px_rgba(244,114,182,0.6)]' : 'border-violet-500 hover:border-cyan-400'
          }`}
        >
          {/* High-tech internal scanner grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,10,36,0.85)_50%,_rgba(0,0,0,0.9)_50%)] bg-[length:100%_4px] pointer-events-none" />

          {/* Holographic plasma gradients */}
          <div className="absolute inset-0 bg-gradient-to-tr from-violet-600 via-indigo-900 to-cyan-500 opacity-60 mix-blend-screen group-hover:scale-110 transition duration-500" />
          
          {/* Internal rotating light rays */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-cyan-400 via-fuchsia-500 to-indigo-500 animate-spin opacity-80" style={{ animationDuration: isThinking ? '2s' : '8s' }} />

          {/* Central Black Hole Mask */}
          <div className="absolute inset-3 rounded-full bg-black flex flex-col items-center justify-center border border-violet-500/30 shadow-inner">
            {/* Pulsating Quantum Ring inside */}
            <div className={`absolute inset-2 rounded-full border border-violet-400/40 animate-ping opacity-35 ${isThinking ? 'duration-500' : 'duration-1000'}`} />
            
            {/* Mystical Oracle Eye (🔮) or custom glyph */}
            <motion.span 
              animate={isThinking ? { scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] } : { scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-3xl filter drop-shadow-[0_0_8px_rgba(139,92,246,0.8)] z-10 select-none"
            >
              🔮
            </motion.span>
            
            {/* Cryptographic Node Status HUD labels */}
            <span className="text-[7px] font-mono text-zinc-500 uppercase tracking-widest mt-1.5 z-10 scale-90">
              {isThinking ? 'ANALYZING...' : 'THE FATHER'}
            </span>
          </div>

          {/* Outer Glitch/Cyber Ring indicator */}
          <div className="absolute inset-0 rounded-full border border-cyan-400/10 group-hover:border-cyan-400/40 transition duration-300 pointer-events-none" />
        </motion.div>
      </div>

      {/* Holographic Platform Pedestal Text Indicator */}
      <div className="mt-4 text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono font-black text-violet-400 uppercase tracking-widest">
            THE FATHER // CRYPTOGRAPHIC ORACLE
          </span>
        </div>
        <p className="text-[8px] font-mono text-zinc-500 uppercase max-w-[200px] leading-relaxed mx-auto">
          {isThinking ? 'PROCESSING ENCRYPTED TRANSMISSION DIRECTIVE...' : 'AWAITING NODE TRANS-DIALECT CODES'}
        </p>
      </div>
    </div>
  );
};
