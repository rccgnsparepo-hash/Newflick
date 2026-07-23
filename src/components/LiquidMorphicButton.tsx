import React, { useState } from 'react';

interface LiquidMorphicButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  glowColor?: string;
}

export default function LiquidMorphicButton({
  children,
  onClick,
  className = '',
  glowColor = 'rgba(239, 68, 68, 0.4)'
}: LiquidMorphicButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      {/* Liquid Goo SVG Filter - Injected once dynamically */}
      <svg className="hidden-svg-filter absolute" width="0" height="0" style={{ position: 'absolute', visibility: 'hidden' }}>
        <defs>
          <filter id="liquid-goo-button">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" 
              result="goo" 
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative overflow-hidden px-5 py-2.5 rounded-full font-mono text-[9px] uppercase tracking-wider font-extrabold transition-all duration-300 border border-[var(--neon-green-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:text-[var(--color-text)] hover:border-red-500/50 cursor-pointer ${className}`}
        style={{
          boxShadow: isHovered ? `0 0 15px ${glowColor}` : 'none'
        }}
      >
        {/* Floating background liquid blobs */}
        <div 
          className="absolute inset-0 overflow-hidden pointer-events-none rounded-full"
          style={{ filter: 'url(#liquid-goo-button)' }}
        >
          <div 
            className={`absolute rounded-full bg-red-600 transition-all duration-700 ease-out`}
            style={{
              width: isHovered ? '90px' : '40px',
              height: isHovered ? '90px' : '40px',
              left: isHovered ? '10%' : '-10%',
              top: isHovered ? '-20%' : '-50%',
              opacity: isHovered ? 0.85 : 0,
              transform: 'translate(-50%, -50%)'
            }}
          />
          <div 
            className={`absolute rounded-full bg-amber-500 transition-all duration-700 ease-out`}
            style={{
              width: isHovered ? '80px' : '30px',
              height: isHovered ? '80px' : '30px',
              right: isHovered ? '5%' : '-20%',
              bottom: isHovered ? '-20%' : '-50%',
              opacity: isHovered ? 0.75 : 0,
              transform: 'translate(50%, 50%)'
            }}
          />
        </div>

        {/* Dynamic button contents with elevated z-index */}
        <span className="relative z-10 flex items-center gap-1.5 font-bold">
          {children}
        </span>
      </button>
    </>
  );
}
