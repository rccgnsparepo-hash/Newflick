import React, { useEffect, useRef } from 'react';

interface LiquidMeshBackgroundProps {
  colorPreset?: 'oni' | 'neon' | 'cyber';
}

export default function LiquidMeshBackground({ colorPreset = 'oni' }: LiquidMeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.clientWidth);
    let height = (canvas.height = canvas.clientHeight);

    // Monitor resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.clientWidth;
      height = canvas.height = canvas.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Check system preferences for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Fluid colors based on preset
    let colors = ['rgba(239, 68, 68, 0.08)', 'rgba(219, 39, 119, 0.06)', 'rgba(15, 118, 110, 0.03)']; // default oni (reds + cyans)
    if (colorPreset === 'neon') {
      colors = ['rgba(0, 255, 102, 0.08)', 'rgba(6, 182, 212, 0.06)', 'rgba(5, 5, 5, 0)'];
    } else if (colorPreset === 'cyber') {
      colors = ['rgba(147, 51, 234, 0.08)', 'rgba(236, 72, 153, 0.06)', 'rgba(30, 58, 138, 0.04)'];
    }

    // Set particle density based on performance capability (desktop vs mobile)
    const isMobile = width < 768;
    const maxParticles = prefersReducedMotion ? 0 : isMobile ? 25 : 55;

    interface Node {
      x: number;
      y: number;
      targetX: number;
      targetY: number;
      baseX: number;
      baseY: number;
      radius: number;
      angle: number;
      speed: number;
      color: string;
      phase: number;
    }

    const nodes: Node[] = [];

    // Initialize fluid organic nodes
    for (let i = 0; i < maxParticles; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        targetX: x,
        targetY: y,
        radius: Math.random() * 80 + (isMobile ? 50 : 120),
        angle: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.35,
        color: colors[i % colors.length],
        phase: Math.random() * 100
      });
    }

    // Track mouse position
    const mouse = { x: -1000, y: -1000, radius: isMobile ? 120 : 250 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let time = 0;

    // Animation Loop
    const render = () => {
      time += 0.002;
      ctx.clearRect(0, 0, width, height);

      // Create rich fluid backdrop background color gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#0a0a0c');
      bgGradient.addColorStop(1, '#050506');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle brutalist background grids
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.007)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (prefersReducedMotion) {
        return; // Skip animation calculations
      }

      // Draw and animate liquid mesh nodes
      nodes.forEach((node) => {
        // Organic sinusoidal wandering
        node.phase += 0.002;
        const driftX = Math.sin(node.phase + node.angle) * 1.5;
        const driftY = Math.cos(node.phase * 0.8 + node.angle) * 1.5;
        node.baseX += driftX * node.speed;
        node.baseY += driftY * node.speed;

        // Wrap around margins
        if (node.baseX < -node.radius) node.baseX = width + node.radius;
        if (node.baseX > width + node.radius) node.baseX = -node.radius;
        if (node.baseY < -node.radius) node.baseY = height + node.radius;
        if (node.baseY > height + node.radius) node.baseY = -node.radius;

        // Mouse elastic repulsion fields
        let dx = mouse.x - node.baseX;
        let dy = mouse.y - node.baseY;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
          const force = (mouse.radius - distance) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          // Push away from mouse
          node.x = node.baseX - Math.cos(angle) * force * 50;
          node.y = node.baseY - Math.sin(angle) * force * 50;
        } else {
          // Smoothly snap back to original base
          node.x += (node.baseX - node.x) * 0.08;
          node.y += (node.baseY - node.y) * 0.08;
        }

        // Draw soft liquid glow gradients
        const radialGradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius
        );
        radialGradient.addColorStop(0, node.color);
        radialGradient.addColorStop(0.5, node.color.replace('0.08', '0.03').replace('0.06', '0.02'));
        radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radialGradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render connection lines between nodes for Liquidmorphism mesh effect
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 180) {
            const opacity = (180 - dist) / 180 * 0.04;
            ctx.strokeStyle = colorPreset === 'oni' 
              ? `rgba(239, 68, 68, ${opacity})` 
              : colorPreset === 'neon' 
              ? `rgba(0, 255, 102, ${opacity})`
              : `rgba(147, 51, 2 purple, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [colorPreset]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden rounded-[36px]"
    />
  );
}
