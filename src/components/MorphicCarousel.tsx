import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CarouselItem {
  name: string;
  role: string;
  img: string;
  color: string;
}

interface MorphicCarouselProps {
  items: CarouselItem[];
  onSelect?: (item: CarouselItem, index: number) => void;
}

export default function MorphicCarousel({ items, onSelect }: MorphicCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const dragOffset = useRef(0);
  const velocity = useRef(0);
  const lastTime = useRef(0);
  const lastX = useRef(0);
  const animationFrameId = useRef<number | null>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex]);

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  // Drag Handlers
  const handleStart = (clientX: number) => {
    isDragging.current = true;
    startX.current = clientX;
    dragOffset.current = 0;
    lastX.current = clientX;
    lastTime.current = performance.now();
    velocity.current = 0;

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current) return;
    const dx = clientX - startX.current;
    dragOffset.current = dx;

    // Track instant velocity for momentum physics
    const now = performance.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = (clientX - lastX.current) / dt;
    }
    lastX.current = clientX;
    lastTime.current = now;
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const threshold = 60; // drag pixels to change slide
    const finalVelocity = velocity.current;

    // Snapping logic with momentum physics support
    if (dragOffset.current < -threshold || finalVelocity < -0.3) {
      nextSlide();
    } else if (dragOffset.current > threshold || finalVelocity > 0.3) {
      prevSlide();
    }

    dragOffset.current = 0;
  };

  // Wheel scroll interaction with debouncing
  const scrollTimeout = useRef<number | null>(null);
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollTimeout.current) return;
    if (Math.abs(e.deltaX) > 10 || Math.abs(e.deltaY) > 10) {
      if (e.deltaX > 0 || e.deltaY > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
      scrollTimeout.current = window.setTimeout(() => {
        scrollTimeout.current = null;
      }, 350); // limit trigger rate
    }
  };

  return (
    <div 
      className="relative w-full overflow-hidden py-10 select-none flex flex-col items-center"
      onWheel={handleWheel}
    >
      {/* Visual background rings to highlight Coverflow depth */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-80 h-80 rounded-full border border-dashed border-red-500/40 animate-[spin_40s_linear_infinite]" />
        <div className="w-[420px] h-[420px] rounded-full border border-zinc-800 absolute" />
      </div>

      {/* Main 3D Track */}
      <div 
        ref={containerRef}
        className="w-full h-64 flex items-center justify-center relative cursor-grab active:cursor-grabbing max-w-lg touch-none"
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
      >
        {items.map((item, idx) => {
          // Circular index distance calculation
          let distance = idx - activeIndex;
          
          // Handle wrapping for infinite loop look
          const half = Math.floor(items.length / 2);
          if (distance > half) distance -= items.length;
          if (distance < -half) distance += items.length;

          const isActive = idx === activeIndex;
          const absDist = Math.abs(distance);

          // Render styles based on 3D Coverflow positioning
          const scale = isActive ? 1.05 : 0.85 - absDist * 0.08;
          const rotateY = distance * -32; // rotate side cards outwards
          const translateZ = isActive ? 50 : -100 - absDist * 30; // push background cards back
          const translateX = distance * 110; // offset cards horizontally
          const zIndex = 100 - absDist;
          const opacity = isActive ? 1 : Math.max(0.2, 0.7 - absDist * 0.2);

          const cardStyle: React.CSSProperties = {
            position: 'absolute',
            transform: `translateX(${translateX}px) translateZ(${translateZ}px) scale(${scale}) rotateY(${rotateY}deg)`,
            transition: isDragging.current ? 'transform 0.1s ease-out, opacity 0.1s ease-out' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
            zIndex,
            opacity,
            transformStyle: 'preserve-3d'
          };

          return (
            <div
              key={idx}
              style={cardStyle}
              onClick={() => {
                if (isActive) {
                  onSelect?.(item, idx);
                } else {
                  setActiveIndex(idx);
                }
              }}
              className={`w-44 h-56 bg-zinc-950 border ${isActive ? 'border-red-500/50 shadow-[0_0_24px_rgba(239,68,68,0.25)]' : 'border-zinc-850'} rounded-3xl p-3 flex flex-col justify-between overflow-hidden group`}
            >
              <div className="relative flex-1 overflow-hidden rounded-2xl border border-zinc-900 bg-black">
                <img 
                  src={item.img} 
                  alt={item.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                
                {isActive && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>

              <div className="mt-2.5 space-y-0.5">
                <h6 className={`text-[10px] font-mono font-black uppercase leading-none transition-colors ${isActive ? 'text-red-400' : 'text-zinc-300'}`}>
                  {item.name}
                </h6>
                <p className="text-[7px] font-mono text-zinc-500 uppercase tracking-wider leading-none">
                  {item.role}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination indicators and controls */}
      <div className="flex items-center gap-6 mt-4">
        <button
          onClick={prevSlide}
          className="p-2 border border-zinc-800 hover:border-red-500 hover:text-white rounded-xl text-zinc-500 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          {items.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${idx === activeIndex ? 'w-5 bg-red-500' : 'w-1.5 bg-zinc-800 hover:bg-zinc-700'}`}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          className="p-2 border border-zinc-800 hover:border-red-500 hover:text-white rounded-xl text-zinc-500 transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
