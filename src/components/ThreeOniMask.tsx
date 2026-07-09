import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeOniMask() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 300;
    const height = containerRef.current.clientHeight || 300;

    // Create scene
    const scene = new THREE.Scene();

    // Create camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 6;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const redLight = new THREE.DirectionalLight(0xef4444, 4.0);
    redLight.position.set(3, 3, 5);
    scene.add(redLight);

    const amberLight = new THREE.PointLight(0xf59e0b, 3.0, 15);
    amberLight.position.set(-3, -3, 3);
    scene.add(amberLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 2.5, 10);
    cyanLight.position.set(0, 0, 2);
    scene.add(cyanLight);

    // Build standard 3D "Oni Cyber-Mask" using primitives
    const oniGroup = new THREE.Group();

    // 1. Face Shield Base (Main Angular Plate)
    const faceGeo = new THREE.ConeGeometry(1.2, 2.0, 4); // 4-sided pyramid
    const faceMat = new THREE.MeshPhongMaterial({
      color: 0x111113,
      emissive: 0x1a0505,
      shininess: 90,
      flatShading: true,
      side: THREE.DoubleSide
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.rotation.x = Math.PI; // point down
    faceMesh.position.y = -0.2;
    oniGroup.add(faceMesh);

    // 2. Forehead Plate
    const foreheadGeo = new THREE.BoxGeometry(1.5, 0.5, 0.4);
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.1,
      metalness: 0.8,
      flatShading: true
    });
    const forehead = new THREE.Mesh(foreheadGeo, darkMetalMat);
    forehead.position.set(0, 0.6, 0.4);
    oniGroup.add(forehead);

    // 3. Symmetric Oni Horns (Left and Right)
    const hornMaterial = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.9,
      flatShading: true
    });

    // Left Horn
    const hornLeftGroup = new THREE.Group();
    const hornL1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.0, 5), hornMaterial);
    hornL1.rotation.z = -Math.PI / 6;
    hornL1.position.set(-0.6, 1.1, 0.2);
    hornLeftGroup.add(hornL1);

    const hornL2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.12, 0.6, 5), hornMaterial);
    hornL2.rotation.z = -Math.PI / 3;
    hornL2.position.set(-1.0, 1.45, 0.2);
    hornLeftGroup.add(hornL2);
    oniGroup.add(hornLeftGroup);

    // Right Horn
    const hornRightGroup = new THREE.Group();
    const hornR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.0, 5), hornMaterial);
    hornR1.rotation.z = Math.PI / 6;
    hornR1.position.set(0.6, 1.1, 0.2);
    hornRightGroup.add(hornR1);

    const hornR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.12, 0.6, 5), hornMaterial);
    hornR2.rotation.z = Math.PI / 3;
    hornR2.position.set(1.0, 1.45, 0.2);
    hornRightGroup.add(hornR2);
    oniGroup.add(hornRightGroup);

    // 4. Glowing Cyber Eyes (Left and Right)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const eyeGeo = new THREE.SphereGeometry(0.14, 8, 8);
    
    const eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
    eyeLeft.position.set(-0.35, 0.15, 0.65);
    oniGroup.add(eyeLeft);

    const eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
    eyeRight.position.set(0.35, 0.15, 0.65);
    oniGroup.add(eyeRight);

    // 5. Angular Nose bridge
    const noseGeo = new THREE.BoxGeometry(0.15, 0.8, 0.3);
    const nose = new THREE.Mesh(noseGeo, darkMetalMat);
    nose.rotation.x = Math.PI / 8;
    nose.position.set(0, -0.15, 0.8);
    oniGroup.add(nose);

    // 6. Cybernetic Fangs (Mouth elements)
    const fangGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
    const fangMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 });
    
    const fangLeft = new THREE.Mesh(fangGeo, fangMat);
    fangLeft.rotation.x = Math.PI;
    fangLeft.position.set(-0.32, -0.6, 0.7);
    oniGroup.add(fangLeft);

    const fangRight = new THREE.Mesh(fangGeo, fangMat);
    fangRight.rotation.x = Math.PI;
    fangRight.position.set(0.32, -0.6, 0.7);
    oniGroup.add(fangRight);

    scene.add(oniGroup);

    // 7. Fire Ember Floating Particles (Matching Japan/Oni theme)
    const particleCount = 75;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4.5; // X
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4.5; // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3; // Z
      speeds[i] = 0.01 + Math.random() * 0.02;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Create glowing particle material using canvas texture for soft circle
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const gradient = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      pCtx.fillStyle = gradient;
      pCtx.fillRect(0, 0, 16, 16);
    }
    const particleTexture = new THREE.CanvasTexture(pCanvas);

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.18,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const embers = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(embers);

    // Drag-to-rotate interaction variables
    let isDragging = false;
    let previousMouseX = 0;
    let targetRotationY = 0;
    let targetRotationX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      previousMouseX = e.clientX;

      targetRotationY += deltaX * 0.012;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Touch support for mobile layouts
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isDragging = true;
        previousMouseX = e.touches[0].clientX;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const deltaX = e.touches[0].clientX - previousMouseX;
      previousMouseX = e.touches[0].clientX;

      targetRotationY += deltaX * 0.012;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    const el = renderer.domElement;
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Slow idle rotation + hover/drag spring rotation
      oniGroup.rotation.y += (targetRotationY - oniGroup.rotation.y) * 0.1;
      // Soft floating bounce
      oniGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.12;

      // Pulse the eyes & lighting slightly for a heartbeat effect
      const pulse = 1.0 + Math.sin(elapsedTime * 4.0) * 0.15;
      eyeLeft.scale.set(pulse, pulse, pulse);
      eyeRight.scale.set(pulse, pulse, pulse);
      redLight.intensity = 4.0 + Math.sin(elapsedTime * 2.0) * 1.5;

      // Animate floating ember particles upward
      const positionAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      const array = positionAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        array[i * 3 + 1] += speeds[i]; // Move up Y
        array[i * 3] += Math.sin(elapsedTime + i) * 0.002; // soft X drift
        
        // Recycle particles when they float too high
        if (array[i * 3 + 1] > 2.5) {
          array[i * 3 + 1] = -2.5;
          array[i * 3] = (Math.random() - 0.5) * 4.5;
        }
      }
      positionAttr.needsUpdate = true;

      // Idle auto rotation if not dragging
      if (!isDragging) {
        targetRotationY += 0.005;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
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
  }, []);

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {/* 3D label badge */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur border border-red-500/35 px-2 py-0.5 rounded-full text-[7px] text-red-400 font-mono tracking-widest uppercase select-none pointer-events-none">
        THREE.JS 3D MASK // DRAG ROTATE
      </div>
    </div>
  );
}
