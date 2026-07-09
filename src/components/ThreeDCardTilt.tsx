import React, { useState, useRef, useEffect } from 'react';

interface ThreeDCardTiltProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // Max tilt degree
  perspective?: number; // Perspective value in px
  scale?: number; // Zoom on hover
}

export default function ThreeDCardTilt({
  children,
  className = '',
  maxTilt = 10,
  perspective = 1000,
  scale = 1.02
}: ThreeDCardTiltProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({
    opacity: 0,
    transform: 'translate(-50%, -50%)'
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const el = cardRef.current;
    const rect = el.getBoundingClientRect();

    // Mouse coordinates relative to card
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Normalised position from -0.5 to 0.5
    const normX = x / rect.width - 0.5;
    const normY = y / rect.height - 0.5;

    // Calculate rotation angles
    const tiltX = -normY * maxTilt; // Rotate around X axis based on Y movement
    const tiltY = normX * maxTilt;  // Rotate around Y axis based on X movement

    setCoords({ x: tiltY, y: tiltX });

    // Glare position
    setGlareStyle({
      opacity: 0.4,
      left: `${x}px`,
      top: `${y}px`,
      background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)',
      transform: 'translate(-50%, -50%)'
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0 });
    setGlareStyle({
      opacity: 0,
      transform: 'translate(-50%, -50%)',
      transition: 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
    });
  };

  // Safe tilt check on mobile (disable heavy tilt, support simple touch response)
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const style: React.CSSProperties = {
    transform: isHovered && !isTouchDevice
      ? `perspective(${perspective}px) rotateX(${coords.y}deg) rotateY(${coords.x}deg) scale3d(${scale}, ${scale}, ${scale})`
      : `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
    transition: isHovered ? 'none' : 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
    transformStyle: 'preserve-3d',
    position: 'relative' as const
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={`relative overflow-hidden ${className}`}
    >
      {/* 3D Content wrapper to allow children to use translateZ */}
      <div style={{ transform: 'translateZ(10px)', transformStyle: 'preserve-3d', height: '100%', width: '100%' }}>
        {children}
      </div>

      {/* Dynamic reflective reflection glare overlay */}
      {!isTouchDevice && (
        <div
          className="absolute pointer-events-none transition-opacity duration-300 w-96 h-96 rounded-full"
          style={glareStyle}
        />
      )}
    </div>
  );
}
