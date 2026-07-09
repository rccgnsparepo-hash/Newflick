import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface SlideItem {
  id: string;
  title: string;
  subtitle: string;
  color: string;
}

interface ThreeSlidesPhysicsProps {
  slides: SlideItem[];
}

export default function ThreeSlidesPhysics({ slides }: ThreeSlidesPhysicsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current || slides.length === 0) return;

    const width = containerRef.current.clientWidth || 400;
    const height = containerRef.current.clientHeight || 300;

    // Create scene, camera, renderer
    const scene = new THREE.Scene();
    scene.background = null; // transparent background

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 7;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xff3344, 2.5, 30);
    pointLight.position.set(2, 3, 4);
    scene.add(pointLight);

    const blueLight = new THREE.PointLight(0x0088ff, 2.0, 30);
    blueLight.position.set(-2, -3, 2);
    scene.add(blueLight);

    // Create textures for slides using canvas dynamically
    const slideMeshes: THREE.Mesh[] = [];
    const physicsData: {
      position: THREE.Vector3;
      targetPosition: THREE.Vector3;
      velocity: THREE.Vector3;
      rotationVelocity: THREE.Euler;
      originalY: number;
    }[] = [];

    slides.forEach((slide, index) => {
      // Create HTML5 Canvas to render elegant text texture
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 340;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Background card
        ctx.fillStyle = '#0d0d11';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Border
        ctx.lineWidth = 12;
        ctx.strokeStyle = slide.color || '#ff3344';
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

        // Subtitle block
        ctx.fillStyle = slide.color || '#ff3344';
        ctx.fillRect(30, 40, 160, 24);

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PEER ENVELOPE', 42, 56);

        // Title
        ctx.font = '900 24px monospace';
        ctx.fillStyle = '#ffffff';
        
        // Wrap title text safely
        const words = slide.title.split(' ');
        let line = '';
        let y = 110;
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          if (testLine.length > 25 && n > 0) {
            ctx.fillText(line, 30, y);
            line = words[n] + ' ';
            y += 35;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 30, y);

        // Subtitle desc
        ctx.font = 'italic 16px sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(slide.subtitle, 30, y + 45);

        // Quantum watermark
        ctx.font = '10px monospace';
        ctx.fillStyle = '#3f3f46';
        ctx.fillText(`KEY_ID: 0x${Math.abs(slide.id.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).slice(0, 8).toUpperCase()}`, 30, 300);
      }

      const texture = new THREE.CanvasTexture(canvas);
      
      // Rounded card look using BoxGeometry
      const geometry = new THREE.BoxGeometry(3.2, 2.1, 0.12);
      
      // Materials (front texture, other sides solid color)
      const borderMat = new THREE.MeshBasicMaterial({ color: 0x1b1b22 });
      const faceMat = new THREE.MeshBasicMaterial({ map: texture });
      const materials = [
        borderMat, // right
        borderMat, // left
        borderMat, // top
        borderMat, // bottom
        faceMat,   // front
        borderMat, // back
      ];

      const mesh = new THREE.Mesh(geometry, materials);
      
      // Position them in a sliding stack layout (X offset)
      const originalX = (index - activeIndex) * 3.8;
      mesh.position.set(originalX, 0, -Math.abs(index - activeIndex) * 1.5);
      mesh.rotation.y = (index - activeIndex) * -0.25;

      scene.add(mesh);
      slideMeshes.push(mesh);

      // Physics variables for interaction, damping, and inertia
      physicsData.push({
        position: mesh.position.clone(),
        targetPosition: mesh.position.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        rotationVelocity: new THREE.Euler(0, 0, 0),
        originalY: 0
      });
    });

    // Handle mouse/drag physics interactions
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;
    let dragVelocityX = 0;
    let dragVelocityY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        // Raycasting for hover details
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        const intersects = raycaster.intersectObjects(slideMeshes);
        
        if (intersects.length > 0) {
          const hoveredMesh = intersects[0].object as THREE.Mesh;
          const idx = slideMeshes.indexOf(hoveredMesh);
          if (idx !== -1) {
            setHoveredIndex(idx);
            // Apply hover hover physics lift
            physicsData[idx].velocity.y = 0.08;
          }
        } else {
          setHoveredIndex(null);
        }
        return;
      }

      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.clientY - previousMouseY;
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;

      dragVelocityX = deltaX * 0.012;
      dragVelocityY = deltaY * 0.012;

      // Apply drag direct physics offsets
      slideMeshes.forEach((mesh, index) => {
        mesh.position.x += dragVelocityX;
        mesh.position.y -= dragVelocityY;
        mesh.rotation.y += dragVelocityX * 0.3;
        mesh.rotation.x += dragVelocityY * 0.3;
      });
    };

    const onMouseUp = () => {
      isDragging = false;
      
      // Determine if a swipe happened and transition slides
      if (Math.abs(dragVelocityX) > 0.05) {
        if (dragVelocityX > 0 && activeIndex > 0) {
          setActiveIndex(prev => prev - 1);
        } else if (dragVelocityX < 0 && activeIndex < slides.length - 1) {
          setActiveIndex(prev => prev + 1);
        }
      }
    };

    // Touch support for mobile layouts
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isDragging = true;
        previousMouseX = e.touches[0].clientX;
        previousMouseY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const deltaX = e.touches[0].clientX - previousMouseX;
      const deltaY = e.touches[0].clientY - previousMouseY;
      previousMouseX = e.touches[0].clientX;
      previousMouseY = e.touches[0].clientY;

      dragVelocityX = deltaX * 0.012;
      dragVelocityY = deltaY * 0.012;

      slideMeshes.forEach((mesh) => {
        mesh.position.x += dragVelocityX;
        mesh.position.y -= dragVelocityY;
        mesh.rotation.y += dragVelocityX * 0.3;
      });
    };

    const onTouchEnd = () => {
      isDragging = false;
      if (Math.abs(dragVelocityX) > 0.05) {
        if (dragVelocityX > 0 && activeIndex > 0) {
          setActiveIndex(prev => prev - 1);
        } else if (dragVelocityX < 0 && activeIndex < slides.length - 1) {
          setActiveIndex(prev => prev + 1);
        }
      }
    };

    const el = renderer.domElement;
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    // Animation Render Loop with Deep Springs / Damping Physics simulation
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      slideMeshes.forEach((mesh, index) => {
        const data = physicsData[index];
        
        if (!isDragging) {
          // Spring back force to target slide stack position
          const targetX = (index - activeIndex) * 3.4;
          const targetZ = -Math.abs(index - activeIndex) * 1.2;
          const hoverLift = hoveredIndex === index ? 0.3 : 0;
          const floatOffset = Math.sin(elapsedTime * 2.5 + index) * 0.08;
          const targetY = data.originalY + hoverLift + floatOffset;

          // spring physics formulas
          const springK = 0.12; // stiffness
          const damping = 0.82;  // friction / damping

          // X force
          const forceX = (targetX - mesh.position.x) * springK;
          data.velocity.x = (data.velocity.x + forceX) * damping;
          mesh.position.x += data.velocity.x;

          // Y force
          const forceY = (targetY - mesh.position.y) * springK;
          data.velocity.y = (data.velocity.y + forceY) * damping;
          mesh.position.y += data.velocity.y;

          // Z force
          const forceZ = (targetZ - mesh.position.z) * springK;
          data.velocity.z = (data.velocity.z + forceZ) * damping;
          mesh.position.z += data.velocity.z;

          // Spring rotation back to normal target
          const targetRotY = (index - activeIndex) * -0.25;
          const targetRotX = 0;
          mesh.rotation.y += (targetRotY - mesh.rotation.y) * 0.15;
          mesh.rotation.x += (targetRotX - mesh.rotation.x) * 0.15;
          mesh.rotation.z += (0 - mesh.rotation.z) * 0.15;
        } else {
          // Slow down velocities if dragging
          dragVelocityX *= 0.9;
          dragVelocityY *= 0.9;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Responsive resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [slides, activeIndex, hoveredIndex]);

  return (
    <div className="relative w-full h-80 bg-zinc-950/40 rounded-2xl border border-zinc-850/50 overflow-hidden flex flex-col items-center justify-center">
      {/* 3D Canvas element parent */}
      <div ref={containerRef} className="w-full h-72 cursor-grab active:cursor-grabbing" id="three-physics-stage" />

      {/* Slide Index / Status indicator */}
      <div className="absolute bottom-4 flex items-center justify-between px-6 w-full select-none font-mono">
        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
          SYSTEM SLIDES [ {activeIndex + 1} / {slides.length} ]
        </span>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                playGlitchClickSound();
                setActiveIndex(i);
              }}
              className={`w-4 h-1.5 transition-all duration-300 rounded-full cursor-pointer ${
                activeIndex === i ? 'bg-red-500 w-6' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Simple sound trigger helper
function playGlitchClickSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.08);
    gain.gain.setValueAtTime(0.04, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.08);
  } catch (e) {}
}
