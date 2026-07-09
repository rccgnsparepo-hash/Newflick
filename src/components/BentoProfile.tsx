import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { 
  Check, 
  Trash2, 
  Heart, 
  MessageSquare, 
  Share2, 
  Sparkles, 
  Shield, 
  Database, 
  ChevronRight, 
  ImageIcon, 
  Clock, 
  Award,
  Bookmark,
  Sliders,
  Compass,
  CornerDownRight,
  TrendingUp,
  User,
  ExternalLink,
  Target,
  Zap,
  Flame,
  Activity,
  Maximize2,
  Copy,
  Terminal,
  Compass as NavigatorIcon
} from 'lucide-react';
import ThreeOniMask from './ThreeOniMask';
import LiquidMeshBackground from './LiquidMeshBackground';
import ThreeDCardTilt from './ThreeDCardTilt';
import LiquidMorphicButton from './LiquidMorphicButton';
import MorphicCarousel, { CarouselItem } from './MorphicCarousel';
import AchievementMorphicCard from './AchievementMorphicCard';

interface BentoProfileProps {
  profile: any;
  firebasePosts: any[];
  deletePost: (id: string, uid: string) => Promise<void>;
  currentCover: string;
  setCurrentCover: (url: string) => void;
  showCoverSelector: boolean;
  setShowCoverSelector: (show: boolean) => void;
  playGlitchClickSound: () => void;
  triggerVibration: (type: 'light' | 'medium' | 'heavy') => void;
  showBrutalistToast: (title: string, message: string, type?: any, icon?: string, id?: string) => void;
}

export default function BentoProfile({
  profile,
  firebasePosts,
  deletePost,
  currentCover,
  setCurrentCover,
  showCoverSelector,
  setShowCoverSelector,
  playGlitchClickSound,
  triggerVibration,
  showBrutalistToast
}: BentoProfileProps) {
  const [activeAvatarTab, setActiveAvatarTab] = useState<'oni' | 'cyber'>('oni');
  const [avatarScale, setAvatarScale] = useState(1);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cover image presets
  const coverPresets = [
    { name: 'Futuristic Lattice', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1200', color: 'border-rose-600' },
    { name: 'Crimson Abstract', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200', color: 'border-red-600' },
    { name: 'Cosmic Nebula', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1200', color: 'border-purple-600' },
    { name: 'Circuit Grid', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200', color: 'border-emerald-600' }
  ];

  // Coverflow carousel assets
  const galleryOniMasks: CarouselItem[] = [
    { name: 'Hannya Cyber', role: 'Active Mask', img: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=400', color: 'text-red-500' },
    { name: 'Red Oni Shogun', role: 'Rebel Guardian', img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400', color: 'text-rose-500' },
    { name: 'Neon Kitsune', role: 'Cryptic Intel', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400', color: 'text-cyan-400' },
    { name: 'Kabuki Glitch', role: 'Signal Jammer', img: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=400', color: 'text-purple-400' }
  ];

  const userContributions = firebasePosts.filter(p => p.authorId === profile?.uid);

  // GSAP Entry Timelines and magnetic animations
  useEffect(() => {
    // 1. Text split reveal for headings
    if (nameRef.current) {
      const text = nameRef.current.textContent || '';
      nameRef.current.innerHTML = text
        .split('')
        .map(char => `<span class="name-letter inline-block">${char === ' ' ? '&nbsp;' : char}</span>`)
        .join('');

      gsap.fromTo(
        '.name-letter',
        { y: 50, opacity: 0, rotateX: -90 },
        { 
          y: 0, 
          opacity: 1, 
          rotateX: 0, 
          stagger: 0.04, 
          duration: 0.8, 
          ease: 'back.out(1.7)' 
        }
      );
    }

    // 2. Bento cards smooth staggered slide up reveal
    gsap.fromTo(
      '.bento-card-stagger',
      { y: 40, opacity: 0 },
      { 
        y: 0, 
        opacity: 1, 
        stagger: 0.08, 
        duration: 0.8, 
        ease: 'power3.out' 
      }
    );
  }, [profile]);

  // Magnetic button calculations using GSAP
  const handleMagneticMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to(el, {
      x: x * 0.45,
      y: y * 0.45,
      scale: 1.05,
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)'
    });
  };

  return (
    <div 
      ref={containerRef}
      className="relative space-y-6 pb-20 select-none max-w-7xl mx-auto px-1 overflow-hidden"
    >
      {/* IMMERSIVE BACKGROUND (Animated Gradient Mesh + Interactive particles) */}
      <LiquidMeshBackground colorPreset="oni" />

      {/* SVG Liquid morph filters for avatars & indicators */}
      <svg className="absolute w-0 h-0" style={{ visibility: 'hidden', position: 'absolute' }}>
        <defs>
          <filter id="liquid-avatar">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" 
              result="goo" 
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* ==========================================
          1. TOP MINI NAV BAR & HEADER STATUS
          ========================================== */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between bg-[#111113]/80 backdrop-blur-md border border-zinc-900 p-3.5 rounded-3xl gap-4 font-mono text-[10px]">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_#ef4444]" />
          <span className="text-zinc-400 font-extrabold uppercase tracking-widest text-[8.5px]">
            NODE IDENTITY SYSTEM // OPERATOR CONCOURSE
          </span>
        </div>

        {/* Action icons row (Home, Bookmark, settings, profile plus) */}
        <div className="flex items-center gap-4 text-zinc-500">
          <button 
            onClick={() => { playGlitchClickSound(); triggerVibration('light'); }}
            className="hover:text-red-500 hover:scale-110 transition duration-150 cursor-pointer"
            title="Symmetric Layout"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button 
            onClick={() => { playGlitchClickSound(); triggerVibration('light'); }}
            className="hover:text-red-500 hover:scale-110 transition duration-150 cursor-pointer"
            title="Bookmarked Nodes"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button 
            onClick={() => { playGlitchClickSound(); triggerVibration('light'); }}
            className="hover:text-red-500 hover:scale-110 transition duration-150 cursor-pointer"
            title="Signal Modulation"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Miniature Avatar with Plus Icon */}
          <div className="relative pl-2 border-l border-zinc-800">
            <img 
              src={profile?.photoURL} 
              alt="" 
              className="w-6 h-6 rounded-full object-cover border border-zinc-750"
              referrerPolicy="no-referrer"
            />
            <span className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full w-3 h-3 flex items-center justify-center text-[7px] font-black border border-black animate-bounce">
              +
            </span>
          </div>
        </div>
      </div>

      {/* ==========================================
          2. COVER SELECTION CONTAINER
          ========================================== */}
      <div className="relative z-10 border border-zinc-900 bg-black overflow-hidden rounded-[32px] shadow-2xl">
        <div className="h-44 w-full relative group">
          <img 
            src={currentCover} 
            alt="Cover Banner" 
            className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          
          <button
            type="button"
            onClick={() => {
              playGlitchClickSound();
              triggerVibration('light');
              setShowCoverSelector(!showCoverSelector);
            }}
            className="absolute top-4 right-4 bg-black/85 hover:bg-red-600 text-white border border-zinc-850 px-3.5 py-2.5 rounded-2xl transition duration-300 flex items-center gap-1.5 text-[8.5px] font-mono uppercase tracking-widest font-black cursor-pointer shadow-lg hover:shadow-[0_0_12px_rgba(239,68,68,0.3)]"
          >
            <ImageIcon className="w-3.5 h-3.5 text-red-500" />
            <span>Select Banner</span>
          </button>
        </div>

        {/* Dropdown cover grid presets */}
        <AnimatePresence>
          {showCoverSelector && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3.5 bg-[#111113]/95 border-b border-zinc-900 grid grid-cols-2 sm:grid-cols-4 gap-2.5 overflow-hidden"
            >
              {coverPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    playGlitchClickSound();
                    triggerVibration('medium');
                    setCurrentCover(preset.url);
                    localStorage.setItem(`faraflick_profile_cover_${profile?.uid}`, preset.url);
                    setShowCoverSelector(false);
                    showBrutalistToast('COVER UPDATE', `Symmetric banner successfully updated.`, 'success');
                  }}
                  className={`group relative h-14 overflow-hidden rounded-xl border-2 ${currentCover === preset.url ? preset.color : 'border-zinc-900'} hover:scale-[1.02] transition`}
                >
                  <img src={preset.url} alt={preset.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition" />
                  <div className="absolute inset-0 bg-black/65 flex items-center justify-center p-1">
                    <span className="text-[7.5px] font-mono uppercase tracking-wider text-white text-center leading-none font-bold block">{preset.name}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ==========================================
          3. RESPONSIVE BENTO-GRID LAYOUT
          ========================================== */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 relative z-10">
        
        {/* ================= LEFT BENTO COLUMNS ================= */}
        <div className="md:col-span-3 space-y-5 flex flex-col">
          
          {/* Card B: STREAK CHALLENGE */}
          <div className="bento-card-stagger bg-[#161113]/85 backdrop-blur-lg border border-red-950 p-4.5 rounded-[32px] shadow-lg flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[7px] text-red-400 font-mono font-black uppercase tracking-widest block">
                  DAILY MODULATION
                </span>
                <h4 className="text-xs font-black text-white font-mono tracking-tight">
                  9 / 365 STREAK
                </h4>
              </div>
              <span className="px-2 py-0.5 text-[6.5px] bg-red-600/15 text-red-400 border border-red-500/20 font-bold uppercase rounded font-mono">
                CHALLENGE
              </span>
            </div>

            {/* Custom 3D-like vertical bars chart */}
            <div className="h-28 flex items-end justify-between px-1 pt-2 font-mono">
              {[
                { day: 'M', h: 'w-[12%] h-[65%] bg-zinc-800' },
                { day: 'T', h: 'w-[12%] h-[40%] bg-zinc-800' },
                { day: 'W', h: 'w-[12%] h-[80%] bg-zinc-800' },
                { day: 'T', h: 'w-[12%] h-[95%] bg-red-600 shadow-[0_0_10px_#ef4444]' },
                { day: 'F', h: 'w-[12%] h-[70%] bg-red-500' },
                { day: 'S', h: 'w-[12%] h-[50%] bg-zinc-800' },
                { day: 'S', h: 'w-[12%] h-[90%] bg-red-600 shadow-[0_0_10px_#ef4444]' }
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center flex-1 h-full justify-end space-y-2 group">
                  <div className={`rounded-full transition-all duration-300 cursor-help group-hover:scale-125 ${b.h}`} title={`Day ${i+1}`} />
                  <span className="text-[7px] text-zinc-500 font-black group-hover:text-red-400 transition-colors">{b.day}</span>
                </div>
              ))}
            </div>

            <div className="text-[9px] text-zinc-400 leading-relaxed font-sans pt-1">
              Currently maintaining high cryptographic relay contribution consistency across the campus network. Keep active!
            </div>
          </div>

          {/* Card C: Active Project Node wrapped in 3D tilt */}
          <div className="bento-card-stagger flex-1">
            <ThreeDCardTilt maxTilt={12} scale={1.03} className="h-full">
              <div className="bg-[#111113]/90 backdrop-blur-lg border border-zinc-900 p-4.5 rounded-[32px] shadow-lg space-y-4 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[7px] text-zinc-500 font-mono font-black uppercase tracking-widest">
                      ACTIVE PROJECTS
                    </span>
                    <Target className="w-3.5 h-3.5 text-zinc-500" />
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-red-950/40 border border-red-500/20 rounded-full flex items-center justify-center shadow-inner">
                        <Shield className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <h5 className="text-[9.5px] font-black text-white uppercase font-mono leading-none">ONIMUSHA WARRIORS</h5>
                        <span className="text-[6px] text-zinc-550 uppercase font-mono tracking-wider">E2EE Tunnel Subsystem</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-400 font-sans leading-relaxed">
                      Rebuilding high-speed localized decentralized signal routing matrix to withstand firewall disruptions.
                    </p>
                  </div>
                </div>

                {/* Engagement indicators */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-900 text-[8px] font-mono text-zinc-500">
                  <span className="flex items-center gap-1 hover:text-red-400 transition-colors cursor-pointer"><Heart className="w-2.5 h-2.5 text-red-500" /> 182 LIKES</span>
                  <span className="flex items-center gap-1 hover:text-cyan-400 transition-colors cursor-pointer"><MessageSquare className="w-2.5 h-2.5 text-cyan-400" /> 49 SHARES</span>
                </div>
              </div>
            </ThreeDCardTilt>
          </div>

        </div>

        {/* ================= MIDDLE SHOWCASE COLUMN ================= */}
        <div className="md:col-span-6 space-y-5">
          
          {/* Card A: MAIN SHOWCASE / DAREDEVIL SPECTRUM CARD */}
          <div className="bento-card-stagger bg-gradient-to-b from-[#180a0d]/90 to-[#101012]/90 backdrop-blur-xl border-2 border-red-950 rounded-[36px] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[490px]">
            
            {/* Red waves/mesh design styling accents */}
            <div className="absolute top-0 left-0 right-0 h-40 bg-radial-gradient from-red-600/10 to-transparent pointer-events-none" />

            {/* Header Identity Display */}
            <div className="p-6 relative z-10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-mono font-black text-red-400 uppercase tracking-widest block">
                  AUTHENTICATED NODE OVERVIEW
                </span>
                <span className="px-2.5 py-0.5 text-[7px] font-mono bg-red-600 text-white font-extrabold uppercase rounded-full shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                  ONLINE // PORT 3000
                </span>
              </div>

              <div className="space-y-1">
                {/* 3D typography name title with custom letters reveal */}
                <h2 
                  ref={nameRef}
                  className="text-3xl font-serif font-black tracking-tight text-white uppercase leading-none select-none"
                  style={{ textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                >
                  THE GREAT {profile?.displayName || 'OPERATOR'}
                </h2>
                
                <div className="flex items-center gap-2 font-mono text-[8.5px]">
                  <span className="text-zinc-500">TAG:</span>
                  <span className="text-red-400 uppercase font-bold tracking-wider animate-pulse">DAREDEVIL REBEL // KABUKI SPECTRUM</span>
                </div>
              </div>
            </div>

            {/* LIVE 3D THREE.JS CANVAS */}
            <div className="w-full h-64 relative flex items-center justify-center">
              <ThreeOniMask />
            </div>

            {/* Speech bubble details */}
            <div className="p-6 pt-0 relative z-10 flex flex-wrap justify-between items-end gap-4 border-t border-zinc-900/40">
              
              <div className="space-y-1">
                <div className="bg-[#1a0e10]/90 backdrop-blur-md border border-red-900/30 px-3 py-1.5 rounded-2xl max-w-[210px] shadow-lg">
                  <p className="text-[7.5px] font-mono text-red-400 uppercase font-black tracking-wide flex items-center gap-1">
                    <Terminal className="w-2.5 h-2.5" /> SPECTRUM TRANSMIT:
                  </p>
                  <p className="text-[9.5px] font-sans text-zinc-300 leading-tight">
                    "Do not compromise parameters. Keep encryption keys fully offline."
                  </p>
                </div>
              </div>

              <div className="flex flex-col text-right font-mono text-[7px] text-zinc-500 uppercase leading-normal">
                <span>MEMBERSHIP NO: #9901-CSC</span>
                <span>SECURE KEY: ECDH_SECP256K1</span>
                <span className="text-red-400 font-bold animate-pulse">KIMONO ONI ACTIVE</span>
              </div>

            </div>

          </div>

          {/* COVERFLOW CAROUSEL: SPECTRUM PERSONA ARCHIVES */}
          <div className="bento-card-stagger bg-[#111113]/85 backdrop-blur-lg border border-zinc-900 p-5 rounded-[36px] shadow-lg space-y-3">
            <div className="flex justify-between items-center px-2">
              <div className="space-y-0.5">
                <span className="text-[7.5px] text-zinc-500 font-mono font-black uppercase tracking-widest block">
                  SPECTRUM PERSONA ARCHIVES
                </span>
                <h4 className="text-[11px] font-black text-white uppercase font-mono tracking-tight">
                  Rotating Coverflow Deck
                </h4>
              </div>
              <Sparkles className="w-4 h-4 text-zinc-400" />
            </div>

            {/* Replacing flat list with fully responsive high-end Coverflow Carousel */}
            <MorphicCarousel 
              items={galleryOniMasks} 
              onSelect={(item) => {
                showBrutalistToast('PERSONA SYNC', `Synchronized with ${item.name} operational shield.`, 'success');
              }}
            />
          </div>

        </div>

        {/* ================= RIGHT BENTO COLUMNS ================= */}
        <div className="md:col-span-3 space-y-5 flex flex-col">
          
          {/* Card D: Scholastic Index */}
          <div className="bento-card-stagger bg-[#111113]/85 backdrop-blur-lg border border-zinc-900 p-4.5 rounded-[32px] shadow-lg flex flex-col justify-between h-44">
            <div className="flex justify-between items-center">
              <span className="text-[7.5px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
                SCHOLASTIC RECORD INDEX
              </span>
              <Award className="w-4 h-4 text-amber-500 shadow-sm" />
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-serif font-black text-white">4.88</span>
                <span className="text-[8.5px] text-zinc-500 font-mono font-bold">/ 5.0 CGPA</span>
              </div>
              <p className="text-[8.5px] text-zinc-400 font-mono">
                COMPUTER SCIENCES // LEVEL 300 DEAN LIST
              </p>
            </div>

            {/* Progress meters */}
            <div className="space-y-1.5 pt-1">
              <div className="space-y-0.5 text-[7px] font-mono flex justify-between text-zinc-500 font-bold">
                <span>ALGORITHMS PACKET</span>
                <span className="text-red-400 font-black">97% SECURED</span>
              </div>
              <div className="w-full bg-black h-1 rounded-full overflow-hidden border border-zinc-950">
                <div className="bg-gradient-to-r from-red-600 to-amber-500 h-full w-[97%]" />
              </div>
            </div>
          </div>

          {/* Card E: TRUST INDEX & REPUTATION METER */}
          <div className="bento-card-stagger flex-1">
            <ThreeDCardTilt maxTilt={10} scale={1.03} className="h-full">
              <div className="bg-[#131115]/85 backdrop-blur-lg border border-zinc-900 p-4.5 rounded-[32px] shadow-lg flex flex-col justify-between h-full space-y-4">
                <div className="space-y-4.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[7.5px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
                      TRUST REPUTATION RATIO
                    </span>
                    <Flame className="w-4 h-4 text-red-500" />
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-2xl font-serif font-black text-white leading-none">99.4%</h4>
                    <span className="text-[7px] text-zinc-500 font-mono uppercase tracking-wider block">INTEGRITY ALGORITHM MATRIX</span>
                  </div>

                  <p className="text-[9px] text-zinc-400 font-sans leading-relaxed">
                    Zero system faults recorded across remote cluster tunnels. Signal reputation parameters are optimal.
                  </p>
                </div>

                {/* Progress Circle Visual */}
                <div className="pt-2 flex items-center gap-3 border-t border-zinc-900">
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.03)" strokeWidth="3" fill="transparent" />
                      <circle cx="16" cy="16" r="13" stroke="#ef4444" strokeWidth="3" fill="transparent" 
                        strokeDasharray="81" strokeDashoffset="1" />
                    </svg>
                    <span className="absolute text-[6.5px] font-mono font-black text-white">99%</span>
                  </div>
                  <div className="font-mono text-[7px] text-zinc-500 leading-normal uppercase">
                    <span className="text-white font-black block">RELIABLE NODE</span>
                    <span>CSC-COGNIZANCE ENFORCED</span>
                  </div>
                </div>
              </div>
            </ThreeDCardTilt>
          </div>

        </div>

      </div>

      {/* ==========================================
          4. INTERACTIVE ACHIEVEMENTS GRID
          ========================================== */}
      <div className="relative z-10 space-y-3.5">
        <div className="flex items-center gap-2 px-1">
          <Award className="w-4.5 h-4.5 text-red-500 animate-pulse" />
          <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-400 font-black">
            OPERATIONAL MILESTONES & ACHIEVEMENTS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4.5">
          <AchievementMorphicCard
            title="Cryptic Sentinel"
            category="Security Block"
            description="Established 5+ local encrypted dialogue tunnels with peer nodes."
            level="Level IV"
            score={80}
            maxScore={100}
            unlocked={true}
            accentColor="#ef4444"
            icon="shield"
          />
          <AchievementMorphicCard
            title="Ember Initiator"
            category="Contributions"
            description="Logged continuous activity check-ins across the university campus."
            level="Level II"
            score={9}
            maxScore={15}
            unlocked={true}
            accentColor="#f59e0b"
            icon="flame"
          />
          <AchievementMorphicCard
            title="Signal Conduit"
            category="Bandwidth"
            description="Achieved high-speed peer file exchanges without node disruptions."
            level="Level I"
            score={30}
            maxScore={100}
            unlocked={false}
            accentColor="#06b6d4"
            icon="zap"
          />
        </div>
      </div>

      {/* ==========================================
          5. DIALOGUE TRANSMISSIONS LIST
          ========================================== */}
      <div className="relative z-10 bg-[#111113]/80 backdrop-blur-xl border border-zinc-900 p-6 rounded-[36px] shadow-xl space-y-5">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-4 gap-3">
          <div className="flex items-center gap-2">
            <CornerDownRight className="w-4 h-4 text-red-500" />
            <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-300 font-black">
              YOUR DIALOGUE TRANSMISSIONS ({userContributions.length})
            </span>
          </div>
          <span className="text-[8px] text-zinc-500 font-mono uppercase font-extrabold flex items-center gap-1.5 bg-black/40 border border-zinc-900 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Database Sync Active
          </span>
        </div>

        {userContributions.length === 0 ? (
          <div className="p-10 text-center bg-zinc-950/40 border-2 border-dashed border-zinc-900 rounded-3xl">
            <p className="text-[11px] font-serif italic text-zinc-500">You haven't transmitted any custom database packets yet. Post from the chronicles feed!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userContributions.map((post, pi) => (
              <div 
                key={pi} 
                className="p-4 bg-zinc-950/70 backdrop-blur-md border border-zinc-900/80 hover:border-red-500/20 hover:bg-black/60 rounded-2xl flex justify-between items-start gap-4 transition-all duration-300 group"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <p className="text-[11px] font-sans text-zinc-300 font-medium leading-relaxed break-words">{post.content}</p>
                  <span className="text-[7.5px] font-mono text-zinc-500 block uppercase tracking-wider">
                    Published: {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Disconnect/Delete this dialogue contribution?")) {
                      const toastId = 'delete-' + post.id;
                      try {
                        showBrutalistToast('DELETING...', 'Removing contribution packet from network spectrum...', 'loading', undefined, toastId);
                        await deletePost(post.id, profile!.uid);
                        showBrutalistToast('SUCCESS ✓', 'Contribution packet removed from network.', 'success', undefined, toastId);
                      } catch (err: any) {
                        showBrutalistToast('ERROR ×', 'Failed to remove packet: ' + err.message, 'error', undefined, toastId);
                      }
                    }
                  }}
                  className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer shrink-0 rounded-lg bg-zinc-900"
                  title="Remove Transmission"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==========================================
          6. SECURE CRITICAL DISK KEY FOOTER
          ========================================== */}
      <div className="relative z-10 bg-zinc-950/80 backdrop-blur-md p-4.5 border border-zinc-900 rounded-[28px] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[9px] text-zinc-400 shadow-lg">
        <div className="truncate max-w-full">
          <span className="text-zinc-550 block text-[7.5px] uppercase tracking-wider font-extrabold mb-1">LOCAL CRITICAL ECDH KEY REVOLUTION STATUS</span>
          <p className="truncate font-mono text-zinc-400 text-[8px] tracking-wide bg-black/60 p-2 border border-zinc-900 rounded-xl max-w-lg">
            {localStorage.getItem(`faraflick_profile_backup_${profile?.uid}`) || "SECURE_TUNNEL_ECDH_CURVE25519_ROTATED_ACTIVE"}
          </p>
        </div>

        {/* Magnetic Backup Button utilizing GSAP mouse magnetism */}
        <button
          type="button"
          onMouseMove={handleMagneticMove}
          onMouseLeave={handleMagneticLeave}
          onClick={() => {
            playGlitchClickSound();
            triggerVibration('heavy');
            navigator.clipboard.writeText(localStorage.getItem(`faraflick_profile_backup_${profile?.uid}`) || "SECURE_TUNNEL_ECDH_CURVE25519_ROTATED_ACTIVE");
            showBrutalistToast('COPIED', 'Backup signature copied to secure clip channel.', 'success');
          }}
          className="px-4 py-2.5 bg-black hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-300 hover:text-white uppercase font-mono font-black text-[8.5px] shrink-0 cursor-pointer rounded-xl transition duration-300 flex items-center gap-1.5 shadow-md"
        >
          <Copy className="w-3 h-3 text-red-500" />
          <span>Backup Encryption Key</span>
        </button>
      </div>

      {/* ==========================================
          7. PINTEREST & SIMALOON DESIGN CREDITS
          ========================================== */}
      <div className="relative z-10 flex flex-wrap items-center justify-between text-[7.5px] text-zinc-600 font-mono uppercase tracking-widest border-t border-zinc-900 pt-4.5 px-1 gap-2">
        <span>SCROLL FOR MORE SECURE PARAMETERS // v3.09 LIVE</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">INSPIRED BY <ExternalLink className="w-2.5 h-2.5" /> THREE.JS & PINTEREST</span>
          <span>ARCHIVED BY SIMALOON CREATIVE LABS</span>
        </div>
      </div>

    </div>
  );
}
