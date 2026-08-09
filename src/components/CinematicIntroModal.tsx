import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Download, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Lock, 
  Globe, 
  Terminal,
  Code2,
  CheckCircle2,
  Copy,
  Tv,
  MessageSquare,
  Radio,
  Layers,
  Smartphone,
  Cpu,
  Heart,
  Eye,
  Send,
  CheckCheck
} from 'lucide-react';
import { showBrutalistToast } from '../lib/toast';

interface CinematicIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoPlay?: boolean;
}

// 6 Master Scenes from the Official Hollywood Screenplay: "THE WORLD DESERVES BETTER"
const SCENES = [
  {
    id: 0,
    number: '01',
    title: 'THE SILENCE & THE ISOLATION',
    narration: 'They promised to connect the world...',
    subNarration: 'They built platforms. They forgot people.',
    duration: 25000, // 25 seconds
    sound: 'heartbeat' as const,
    visualNote: 'A young man sits alone in a cold dark room. Phone screen glows. No one replied. Endless scrolling, algorithms, toxic comments, privacy popups, data harvesting.',
    keywords: ['Endless Scroll', 'Toxic Algorithms', 'Data Selling', 'Isolated Souls'],
    bgTheme: 'from-[#030712] via-[#0b1329] to-[#020617]',
    accentColor: '#38bdf8'
  },
  {
    id: 1,
    number: '02',
    title: 'THE IGNITION & THE FORGE',
    narration: 'Imagine... A social platform... Built around people...',
    subNarration: 'Not algorithms.',
    duration: 25000, // 25 seconds
    sound: 'impact' as const,
    visualNote: 'The screen freezes. "ENOUGH." BOOM! An emerald green light ignites. The Flick logo is forged from hyper-dense light particles and volumetric beam flares.',
    keywords: ['Zero Surveillance', 'Emerald Light', 'Forged in Code', 'Absolute Sovereignty'],
    bgTheme: 'from-[#022c22] via-[#050508] to-[#064e3b]',
    accentColor: '#00ff66'
  },
  {
    id: 2,
    number: '03',
    title: 'THE FLICK MATRIX & UNIVERSAL CAPABILITIES',
    narration: 'Technology... Should never feel cold...',
    subNarration: 'It should bring us closer.',
    duration: 45000, // 45 seconds
    sound: 'melodic' as const,
    visualNote: 'Rapid montage: E2EE Messages, Ephemeral Loops, Video Calling, Community Hubs, Live Football Arena, Realtime News, Neumorphism, Claymorphism, Brutalism, Glassmorphism, Material.',
    keywords: ['2048-Bit RSA', 'Ephemeral Loops', 'Live Sports Arena', 'Multi-Theme Engine'],
    bgTheme: 'from-[#050508] via-[#1e1b4b] to-[#0f172a]',
    accentColor: '#818cf8'
  },
  {
    id: 3,
    number: '04',
    title: 'THE GLOBAL FREEDOM MESH',
    narration: 'This... is communication...',
    subNarration: 'Without compromise.',
    duration: 35000, // 35 seconds
    sound: 'soaring' as const,
    visualNote: 'Encrypted packets fly across continents. Satellites and fiber optics light up cities. Phones vibrate worldwide. Direct P2P tunnels connect people, not ad networks.',
    keywords: ['P2P Mesh Network', 'Sub-millisecond Latency', 'Global Node Sync', 'Untraceable Flow'],
    bgTheme: 'from-[#0284c7]/20 via-[#050508] to-[#0369a1]/30',
    accentColor: '#38bdf8'
  },
  {
    id: 4,
    number: '05',
    title: 'FLICK — "THE WORLD DESERVES BETTER."',
    narration: 'The next generation... isn\'t coming...',
    subNarration: 'It\'s already here.',
    duration: 30000, // 30 seconds
    sound: 'climax' as const,
    visualNote: 'PRIVACY • COMMUNITY • FREEDOM • CONNECTION. Massive orchestral rise. The Flick emblem pulses in pure emerald and liquid silver. Download Coming Soon.',
    keywords: ['Privacy', 'Community', 'Freedom', 'Connection'],
    bgTheme: 'from-[#050508] via-[#022c22] to-[#0f172a]',
    accentColor: '#00ff66'
  },
  {
    id: 5,
    number: '06',
    title: 'POST-CREDIT SCENE',
    narration: 'USER A: "Are you there?"',
    subNarration: 'Delivered • Seen • USER B: "Always."',
    duration: 15000, // 15 seconds
    sound: 'chime' as const,
    visualNote: 'Cold dark expanse. A single encrypted message arrives. Instant delivery indicator turns green. The human bond preserved in silence.',
    keywords: ['Zero Knowledge', 'Instant Handshake', 'Always Connected'],
    bgTheme: 'from-[#000000] via-[#050508] to-[#000000]',
    accentColor: '#00f0ff'
  }
];

export const CinematicIntroModal: React.FC<CinematicIntroModalProps> = ({
  isOpen,
  onClose,
  autoPlay = true
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<any>(null);

  // Audio Synth Engine - Orchestrating Piano, Heartbeat, Sub-Bass Drop, and String Chords
  const playAudioScoreForScene = (sceneType: string) => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (sceneType === 'heartbeat') {
        // Heartbeat thumps
        [0, 0.25, 1.2, 1.45].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(65, now + offset);
          osc.frequency.exponentialRampToValueAtTime(25, now + offset + 0.18);
          gain.gain.setValueAtTime(0.4, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.18);
        });
      } else if (sceneType === 'impact') {
        // Boom! Sub-bass impact + high synth surge
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 1.2);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.5);
      } else if (sceneType === 'melodic') {
        // Warm piano chord (C Major 9)
        const freqs = [261.63, 329.63, 392.00, 493.88, 587.33];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.08);
          gain.gain.setValueAtTime(0.12, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 2.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 2.5);
        });
      } else if (sceneType === 'soaring') {
        // Soaring ambient synth riser
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 3.0);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 3.2);
      } else if (sceneType === 'climax') {
        // Massive orchestral impact with choir frequency layer
        [130.81, 164.81, 196.00, 261.63, 392.00, 523.25].forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 3.5);
        });
      } else if (sceneType === 'chime') {
        // E2EE Message notification chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // Audio fallback
    }
  };

  // Matrix & Anamorphic Lens Canvas Simulation
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle field
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      char: string;
    }> = [];

    const charList = '01FLICK★E2EE⚡RSA2048SOVEREIGN';
    for (let i = 0; i < 110; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8,
        size: Math.random() * 12 + 8,
        color: i % 4 === 0 ? '#00FF66' : i % 5 === 0 ? '#38bdf8' : i % 6 === 0 ? '#818cf8' : '#ffffff',
        alpha: Math.random() * 0.6 + 0.2,
        char: charList[Math.floor(Math.random() * charList.length)]
      });
    }

    const render = () => {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // Anamorphic horizontal lens flare line
      const centerY = height / 2;
      const gradient = ctx.createLinearGradient(0, centerY, width, centerY);
      gradient.addColorStop(0, 'rgba(0,255,102,0)');
      gradient.addColorStop(0.5, currentSceneIdx === 1 ? 'rgba(0,255,102,0.35)' : 'rgba(56,189,248,0.25)');
      gradient.addColorStop(1, 'rgba(0,255,102,0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, centerY - 1.5, width, 3);

      // Render Particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.font = `${p.size}px monospace`;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillText(p.char, p.x, p.y);
      });
      ctx.globalAlpha = 1.0;

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, currentSceneIdx]);

  // Scene runner timer
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const currentScene = SCENES[currentSceneIdx];
    playAudioScoreForScene(currentScene.sound);

    const startTime = Date.now();
    const duration = currentScene.duration;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setSceneProgress(pct);

      if (pct >= 100) {
        clearInterval(timerRef.current);
        if (currentSceneIdx < SCENES.length - 1) {
          setCurrentSceneIdx((prev) => prev + 1);
          setSceneProgress(0);
        } else {
          setIsPlaying(false);
        }
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isPlaying, currentSceneIdx]);

  const handleReplay = () => {
    setCurrentSceneIdx(0);
    setSceneProgress(0);
    setIsPlaying(true);
  };

  const handleSelectScene = (idx: number) => {
    setCurrentSceneIdx(idx);
    setSceneProgress(0);
    setIsPlaying(true);
  };

  // Generate complete, self-contained HTML file for "FLICK — THE WORLD DESERVES BETTER"
  const generateFullHtmlTrailer = () => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLICK — "THE WORLD DESERVES BETTER." [OFFICIAL MASTER TRAILER]</title>
  <style>
    :root {
      --neon-green: #00ff66;
      --neon-cyan: #38bdf8;
      --neon-purple: #818cf8;
      --bg-dark: #030712;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: var(--bg-dark);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      height: 100vh;
      width: 100vw;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }
    .film-grain {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0);
      background-size: 4px 4px;
      opacity: 0.3;
    }
    .overlay {
      position: relative;
      z-index: 10;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2.5rem;
      background: radial-gradient(circle at center, rgba(3,7,18,0.2) 0%, rgba(3,7,18,0.92) 100%);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(0,255,102,0.2);
      padding-bottom: 1.2rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo-box {
      width: 44px;
      height: 44px;
      border: 2px solid var(--neon-green);
      background: rgba(0,255,102,0.1);
      color: var(--neon-green);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 1.6rem;
      box-shadow: 3px 3px 0px var(--neon-green);
    }
    .brand-title {
      font-size: 1.2rem;
      font-weight: 900;
      letter-spacing: 3px;
      color: #fff;
      font-family: monospace;
    }
    .badge {
      background: rgba(0,255,102,0.15);
      border: 1px solid var(--neon-green);
      color: var(--neon-green);
      padding: 6px 14px;
      font-size: 10px;
      letter-spacing: 2px;
      font-weight: bold;
      font-family: monospace;
      text-transform: uppercase;
    }
    .main-stage {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }
    .scene-tag {
      color: var(--neon-green);
      font-size: 0.85rem;
      letter-spacing: 4px;
      font-weight: bold;
      margin-bottom: 1.5rem;
      text-transform: uppercase;
      font-family: monospace;
    }
    .main-title {
      font-size: 3rem;
      font-weight: 900;
      letter-spacing: 4px;
      line-height: 1.15;
      margin-bottom: 1.5rem;
      text-transform: uppercase;
      text-shadow: 0 0 30px rgba(0,255,102,0.4);
      background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .main-subtitle {
      max-width: 750px;
      color: #94a3b8;
      font-size: 1.1rem;
      line-height: 1.7;
      letter-spacing: 1.5px;
      font-weight: 300;
    }
    .screenplay-note {
      margin-top: 2rem;
      padding: 1rem 1.5rem;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(15,23,42,0.6);
      font-size: 0.85rem;
      color: #cbd5e1;
      font-style: italic;
      line-height: 1.6;
      border-left: 3px solid var(--neon-green);
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      border-top: 1px solid rgba(0,255,102,0.2);
      padding-top: 1.2rem;
    }
    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--neon-green);
      width: 0%;
      transition: width 0.05s linear;
      box-shadow: 0 0 10px var(--neon-green);
    }
    .btn-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .btn {
      background: rgba(0,255,102,0.1);
      border: 1px solid var(--neon-green);
      color: var(--neon-green);
      padding: 12px 22px;
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: bold;
      letter-spacing: 2px;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.2s ease;
    }
    .btn:hover {
      background: var(--neon-green);
      color: #000;
      box-shadow: 0 0 20px rgba(0,255,102,0.6);
    }
    .scene-dots {
      display: flex;
      gap: 10px;
    }
    .dot {
      padding: 6px 12px;
      border: 1px solid rgba(255,255,255,0.2);
      color: #94a3b8;
      font-family: monospace;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .dot.active {
      background: var(--neon-green);
      color: #000;
      border-color: var(--neon-green);
      font-weight: bold;
    }
  </style>
</head>
<body>
  <canvas id="bgCanvas"></canvas>
  <div class="film-grain"></div>
  <div class="overlay">
    <div class="header">
      <div class="brand">
        <div class="logo-box">F</div>
        <div>
          <div class="brand-title">FLICK</div>
          <div style="font-size:9px; color:var(--neon-green); letter-spacing:2px; font-family:monospace;">THE WORLD DESERVES BETTER</div>
        </div>
      </div>
      <div class="badge">MASTER COMMERCIAL TRAILER</div>
    </div>

    <div class="main-stage">
      <div id="sceneTag" class="scene-tag">SCENE 01 // THE SILENCE & THE ISOLATION</div>
      <div id="mainTitle" class="main-title">THE ERA OF SURVEILLANCE IS OVER</div>
      <div id="mainSubtitle" class="main-subtitle">They promised to connect the world... They built platforms. They forgot people.</div>
      <div id="screenplayNote" class="screenplay-note">A young man sits alone in a cold dark room. Phone screen glows. No one replied. Endless scrolling, algorithms, toxic comments, privacy popups, data harvesting.</div>
    </div>

    <div class="controls">
      <div class="progress-bar-bg">
        <div id="progressBar" class="progress-bar-fill"></div>
      </div>
      <div class="btn-group">
        <button id="btnPlay" class="btn" onclick="togglePlay()">PAUSE</button>
        <div class="scene-dots">
          <div class="dot active" onclick="setScene(0)">01</div>
          <div class="dot" onclick="setScene(1)">02</div>
          <div class="dot" onclick="setScene(2)">03</div>
          <div class="dot" onclick="setScene(3)">04</div>
          <div class="dot" onclick="setScene(4)">05</div>
          <div class="dot" onclick="setScene(5)">06</div>
        </div>
        <button id="btnReplay" class="btn" onclick="replay()">REPLAY</button>
      </div>
    </div>
  </div>

  <script>
    // Canvas Animation
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = [];
    const charList = '01FLICK★E2EE⚡RSA2048SOVEREIGN';
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.6,
        vy: (Math.random() - 0.5) * 1.6,
        size: Math.random() * 12 + 8,
        color: i % 4 === 0 ? '#00FF66' : i % 5 === 0 ? '#38bdf8' : '#ffffff',
        alpha: Math.random() * 0.6 + 0.2,
        char: charList[Math.floor(Math.random() * charList.length)]
      });
    }

    function renderCanvas() {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.35)';
      ctx.fillRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.font = p.size + 'px monospace';
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillText(p.char, p.x, p.y);
      });
      ctx.globalAlpha = 1.0;
      requestAnimationFrame(renderCanvas);
    }
    renderCanvas();

    // Scene Engine
    const SCENES = [
      { tag: 'SCENE 01 // THE SILENCE & THE ISOLATION', title: 'THE ERA OF SURVEILLANCE IS OVER', subtitle: 'They promised to connect the world... They built platforms. They forgot people.', note: 'A young man sits alone in a cold dark room. Phone screen glows. No one replied. Endless scrolling, algorithms, toxic comments, privacy popups, data harvesting.', duration: 25000 },
      { tag: 'SCENE 02 // THE IGNITION & THE FORGE', title: 'UNTRACEABLE. UNSTOPPABLE.', subtitle: 'Imagine... A social platform... Built around people... Not algorithms.', note: 'The screen freezes. "ENOUGH." BOOM! An emerald green light ignites. The Flick logo is forged from hyper-dense light particles and volumetric beam flares.', duration: 25000 },
      { tag: 'SCENE 03 // THE FLICK MATRIX', title: 'TECHNOLOGY WITH HUMAN SOUL', subtitle: 'Technology... Should never feel cold... It should bring us closer.', note: 'Rapid montage: E2EE Messages, Ephemeral Loops, Video Calling, Community Hubs, Live Football Arena, Realtime News, Neumorphism, Claymorphism, Brutalism, Glassmorphism.', duration: 45000 },
      { tag: 'SCENE 04 // THE GLOBAL FREEDOM MESH', title: 'COMMUNICATION WITHOUT COMPROMISE', subtitle: 'This... is communication... Without compromise.', note: 'Encrypted packets fly across continents. Satellites and fiber optics light up cities. Phones vibrate worldwide. Direct P2P tunnels connect people, not ad networks.', duration: 35000 },
      { tag: 'SCENE 05 // THE CLIMAX', title: 'FLICK — "THE WORLD DESERVES BETTER."', subtitle: 'The next generation... isn\'t coming... It\'s already here.', note: 'PRIVACY • COMMUNITY • FREEDOM • CONNECTION. Massive orchestral rise. The Flick emblem pulses in pure emerald and liquid silver. Download Coming Soon.', duration: 30000 },
      { tag: 'SCENE 06 // POST-CREDIT HANDSHAKE', title: 'POST-CREDIT SCENE', subtitle: 'USER A: "Are you there?" [Delivered • Seen] USER B: "Always."', note: 'Cold dark expanse. A single encrypted message arrives. Instant delivery indicator turns green. The human bond preserved in silence.', duration: 15000 }
    ];

    let currentSceneIdx = 0;
    let isPlaying = true;
    let timer = null;

    function updateUI() {
      const s = SCENES[currentSceneIdx];
      document.getElementById('sceneTag').innerText = s.tag;
      document.getElementById('mainTitle').innerText = s.title;
      document.getElementById('mainSubtitle').innerText = s.subtitle;
      document.getElementById('screenplayNote').innerText = s.note;

      const dots = document.querySelectorAll('.dot');
      dots.forEach((d, idx) => {
        if (idx === currentSceneIdx) d.classList.add('active');
        else d.classList.remove('active');
      });
    }

    function runScene() {
      if (!isPlaying) return;
      updateUI();
      const s = SCENES[currentSceneIdx];
      const start = Date.now();

      timer = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, (elapsed / s.duration) * 100);
        document.getElementById('progressBar').style.width = pct + '%';

        if (pct >= 100) {
          clearInterval(timer);
          if (currentSceneIdx < SCENES.length - 1) {
            currentSceneIdx++;
            runScene();
          } else {
            isPlaying = false;
            document.getElementById('btnPlay').innerText = 'PLAY';
          }
        }
      }, 50);
    }

    function togglePlay() {
      isPlaying = !isPlaying;
      document.getElementById('btnPlay').innerText = isPlaying ? 'PAUSE' : 'PLAY';
      if (isPlaying) runScene();
      else clearInterval(timer);
    }

    function setScene(idx) {
      clearInterval(timer);
      currentSceneIdx = idx;
      isPlaying = true;
      document.getElementById('btnPlay').innerText = 'PAUSE';
      runScene();
    }

    function replay() {
      setScene(0);
    }

    runScene();
  </script>
</body>
</html>`;
  };

  const handleDownloadHtml = () => {
    try {
      const htmlContent = generateFullHtmlTrailer();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'flick-the-world-deserves-better-commercial.html');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showBrutalistToast('STANDALONE COMMERCIAL TRAILER DOWNLOADED', 'Saved flick-the-world-deserves-better-commercial.html!', 'success');
    } catch (err: any) {
      showBrutalistToast('DOWNLOAD ERROR', err?.message || 'Failed generating standalone HTML trailer.', 'error');
    }
  };

  const handleCopyCode = async () => {
    try {
      const htmlContent = generateFullHtmlTrailer();
      await navigator.clipboard.writeText(htmlContent);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      showBrutalistToast('HTML SOURCE COPIED', 'Full single-file HTML commercial copied to clipboard!', 'success');
    } catch {
      showBrutalistToast('COPY ERROR', 'Could not copy code to clipboard.', 'error');
    }
  };

  if (!isOpen) return null;

  const currentScene = SCENES[currentSceneIdx];

  return (
    <div className="fixed inset-0 z-[100] bg-[#030712] text-white flex flex-col justify-between font-sans select-none overflow-hidden animate-fade-in">
      {/* Background Matrix & Particle Canvas */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Film Grain Texture Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-30 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:4px_4px]" />

      {/* Cyber Grid & Radial Vignette */}
      <div className={`absolute inset-0 pointer-events-none z-0 bg-gradient-to-b ${currentScene.bgTheme} opacity-90 transition-colors duration-1000`} />

      {/* TOP HEADER */}
      <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between border-b border-white/10 bg-[#030712]/70 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 border-2 border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-[var(--neon-green)] flex items-center justify-center font-serif text-2xl font-black shadow-[3px_3px_0px_var(--neon-green)]">
            F
          </div>
          <div>
            <h2 className="font-extrabold text-sm sm:text-base tracking-widest uppercase text-white font-mono flex items-center gap-2">
              FLICK <span className="text-[10px] text-[var(--neon-green)] font-normal">["THE WORLD DESERVES BETTER"]</span>
            </h2>
            <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-mono">
              MASTER COMMERCIAL CINEMATIC ENTRANCE (2:45)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Audio Mute toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-[var(--neon-green)] transition cursor-pointer"
            title={isMuted ? 'Unmute Score Audio' : 'Mute Score Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[var(--neon-green)]" />}
          </button>

          {/* Download HTML File Button */}
          <button
            onClick={handleDownloadHtml}
            className="px-3.5 py-2 bg-[var(--neon-green)]/20 border border-[var(--neon-green)] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black font-extrabold text-[10px] font-mono uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_var(--neon-green)]"
            title="Download Standalone HTML Commercial File"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EXPORT HTML TRAILER FILE</span>
          </button>

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-2 border border-zinc-700 bg-zinc-900/80 hover:bg-red-500 hover:text-white transition cursor-pointer"
            title="Exit Commercial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN CINEMATIC DISPLAY STAGE */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-8 max-w-4xl mx-auto py-6">
        {/* Scene Indicator Badge */}
        <div className="flex items-center justify-center space-x-2 mb-4 font-mono">
          <span className="px-3 py-1 bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 text-[var(--neon-green)] text-[10px] font-extrabold tracking-widest uppercase">
            SCENE {currentScene.number} // {currentScene.title}
          </span>
          <span className="text-[10px] text-zinc-400 uppercase tracking-widest">
            {currentSceneIdx + 1} / {SCENES.length}
          </span>
        </div>

        {/* Dynamic Scene Headline */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-tight text-white mb-4 drop-shadow-[0_0_35px_rgba(0,255,102,0.3)] animate-pulse font-mono">
          {currentScene.narration}
        </h1>

        {/* Dynamic Scene Voiceover / Subtitle */}
        <p className="text-sm sm:text-lg text-zinc-300 max-w-2xl leading-relaxed tracking-wide mb-6 font-light italic">
          "{currentScene.subNarration}"
        </p>

        {/* Visual Directors Screenplay Note */}
        <div className="p-3 sm:p-4 border border-white/10 bg-slate-900/60 backdrop-blur-md rounded-lg max-w-2xl text-xs text-slate-300 text-left font-mono leading-relaxed border-l-4 border-l-[var(--neon-green)] mb-6">
          <div className="text-[9px] text-[var(--neon-green)] font-extrabold uppercase tracking-widest mb-1 flex items-center gap-1">
            <Tv className="w-3 h-3" /> DIRECTORS CINEMATIC VISUAL NOTE:
          </div>
          {currentScene.visualNote}
        </div>

        {/* Feature Tags Grid */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          {currentScene.keywords.map((kw, i) => (
            <span key={i} className="px-2.5 py-1 bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-mono uppercase tracking-wider">
              ⚡ {kw}
            </span>
          ))}
        </div>

        {/* Post Credit Scene Interactivity */}
        {currentSceneIdx === 5 && (
          <div className="mt-6 p-4 border border-cyan-500/40 bg-cyan-950/30 rounded-lg max-w-md w-full text-left font-mono">
            <div className="text-[10px] text-cyan-400 font-bold uppercase mb-2 flex items-center justify-between">
              <span>ENCRYPTED DIRECT PEER TUNNEL</span>
              <span className="flex items-center gap-1 text-[var(--neon-green)]"><CheckCheck className="w-3 h-3" /> E2EE VERIFIED</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-slate-900/80 border border-slate-700 text-slate-200 rounded">
                <span className="text-cyan-400 font-bold">USER A:</span> "Are you there?"
              </div>
              <div className="p-2 bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 text-[var(--neon-green)] rounded text-right font-bold">
                <span className="text-white">USER B:</span> "Always."
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONTROLS & SCENE TIMELINE BAR */}
      <div className="relative z-10 border-t border-white/10 bg-[#030712]/90 backdrop-blur-md p-4 sm:p-6 space-y-3 font-mono">
        {/* Progress Bar */}
        <div className="w-full bg-zinc-900 h-2 overflow-hidden border border-zinc-800 rounded-full">
          <div 
            className="bg-[var(--neon-green)] h-full transition-all duration-100 ease-linear shadow-[0_0_12px_var(--neon-green)]" 
            style={{ width: `${sceneProgress}%` }} 
          />
        </div>

        {/* Scene Navigation Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-[var(--neon-green)] text-zinc-200 hover:text-[var(--neon-green)] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" /> PAUSE
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[var(--neon-green)]" /> PLAY
                </>
              )}
            </button>

            <button
              onClick={handleReplay}
              className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-[var(--neon-green)] text-zinc-200 hover:text-[var(--neon-green)] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" /> REPLAY
            </button>
          </div>

          {/* Scene Selector Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full py-1">
            {SCENES.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => handleSelectScene(idx)}
                className={`px-2.5 py-1 text-[9px] font-extrabold uppercase border transition cursor-pointer whitespace-nowrap ${
                  currentSceneIdx === idx
                    ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] shadow-[0_0_10px_var(--neon-green)]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                {s.number}
              </button>
            ))}
          </div>

          {/* HTML Source Inspector & Exit */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCodeModal(!showCodeModal)}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-purple-400 text-zinc-300 hover:text-purple-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-purple-400" /> SOURCE HTML
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[var(--neon-green)] text-black font-extrabold text-[10px] uppercase tracking-wider hover:bg-white transition cursor-pointer shadow-[2px_2px_0px_#000]"
            >
              ENTER APP
            </button>
          </div>
        </div>
      </div>

      {/* STANDALONE HTML CODE INSPECTOR MODAL */}
      {showCodeModal && (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md p-4 sm:p-8 flex items-center justify-center">
          <div className="bg-slate-900 border-2 border-[var(--neon-green)] w-full max-w-4xl max-h-[85vh] flex flex-col p-4 font-mono">
            <div className="flex items-center justify-between border-b border-[var(--neon-green)]/30 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[var(--neon-green)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--neon-green)]">
                  flick-the-world-deserves-better-commercial.html (Full Standalone Code)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1 bg-[var(--neon-green)] text-black font-extrabold text-[10px] uppercase tracking-wider hover:bg-white transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'COPIED!' : 'COPY CODE'}
                </button>
                <button
                  onClick={() => setShowCodeModal(false)}
                  className="p-1 border border-zinc-700 bg-zinc-900 hover:bg-red-500 text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 mb-2">
              This standalone HTML file contains embedded CSS, Matrix particle animations, film grain effects, voiceover subtitles, and the scene controller. Run it directly in any browser!
            </p>

            <pre className="flex-1 bg-[#030712] border border-zinc-800 p-3 text-[9.5px] leading-relaxed text-emerald-400 overflow-auto select-all scrollbar-thin">
              {generateFullHtmlTrailer()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
