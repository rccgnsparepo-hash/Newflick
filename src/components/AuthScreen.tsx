import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { showBrutalistToast } from '../lib/toast';
import { 
  Key, Shuffle, AlertCircle, LogIn, UserPlus, Shield, 
  Terminal, WifiOff, Lock, Globe, MapPin, User, Sparkles, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthScreenProps {
  simulatedName?: string;
  onSimulatedSelect?: (uid: string, name: string, email: string, seed: string) => void;
}

export default function AuthScreen({ simulatedName, onSimulatedSelect }: AuthScreenProps) {
  const { loginWithGoogle, registerWithEmail, loginWithEmail, sendPasswordReset, loading } = useAuth();
  const { isOnline, connectionType } = useConnectivity();

  // Detect if running inside an iframe (such as AI Studio preview frames)
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Authentication mode and form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(() => Math.random().toString(36).substring(7));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Background particles and Interactive physics canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Progressive loading connection log steps (from the architecture)
  const [currentStep, setCurrentStep] = useState(0);
  const loadingSteps = [
    { title: "PREPARING SECURE PORTAL", detail: "Calibrating safe local sandbox parameters" },
    { title: "ESTABLISHING CLOUD SYNC", detail: "Connecting to direct database sync pipelines" },
    { title: "OPTIMIZING TELEMETRY LINK", detail: "Initializing high-fidelity campus feeds and active nodes" },
    { title: "SYNCHRONIZING CHRONICLES", detail: "Caching dynamic community updates securely" }
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % loadingSteps.length);
      }, 1600);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Shuffle Dicebear avatar seed
  const shuffleAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const cleanFirebaseError = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes('auth/invalid-credential') || lower.includes('wrong-password') || lower.includes('user-not-found')) {
      return 'Incorrect email address or password. Please verify your credentials.';
    }
    if (lower.includes('auth/email-already-in-use') || lower.includes('email already in use')) {
      return 'An account with this email address is already registered on this node.';
    }
    if (lower.includes('auth/weak-password') || lower.includes('weak password')) {
      return 'Portal entry password must be at least 6 characters long.';
    }
    if (lower.includes('auth/invalid-email') || lower.includes('invalid email')) {
      return 'Please supply a valid email syntax address.';
    }
    if (lower.includes('popup-closed-by-user') || lower.includes('cancelled-by-user')) {
      return 'Google sign-in popup was interrupted. Please try again or use direct Email Sign-In.';
    }
    if (lower.includes('popup-blocked')) {
      return 'Google sign-in popup was blocked. Please permit popups or use direct Email Sign-In.';
    }
    return msg.replace('Firebase: ', '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password parameters.');
      return;
    }
    if (isSignUp && !displayName.trim()) {
      setError('Please provide a display or pen name.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (isSignUp) {
        await registerWithEmail(email.trim(), password.trim(), displayName.trim(), avatarSeed);
        showBrutalistToast('SUCCESS ✓', 'Account created! Welcome to Flick.', 'success');
      } else {
        await loginWithEmail(email.trim(), password.trim());
        showBrutalistToast('SUCCESS ✓', 'Authenticated successfully! Linking node...', 'success');
      }
    } catch (err: any) {
      console.warn(err);
      const cleanErr = cleanFirebaseError(err?.message || String(err));
      setError(cleanErr);
      showBrutalistToast('ERROR ×', cleanErr, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please input your email node route first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResetSuccess(null);
    try {
      await sendPasswordReset(email.trim());
      const successMsg = "A password reset email has been successfully broadcast to your node route. Check your inbox!";
      setResetSuccess(successMsg);
      showBrutalistToast('SUCCESS ✓', successMsg, 'success');
    } catch (err: any) {
      console.warn(err);
      const cleanErr = err?.message || "Failed broadcasting reset packet.";
      setError(cleanErr);
      showBrutalistToast('ERROR ×', cleanErr, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      showBrutalistToast('SUCCESS ✓', 'Authenticated with Google! Syncing core node...', 'success');
    } catch (err: any) {
      console.warn(err);
      const cleanErr = cleanFirebaseError(err?.message || String(err));
      setError(cleanErr);
      showBrutalistToast('ERROR ×', cleanErr, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Setup High-Fidelity Physics and Morphing Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = canvas.parentElement?.clientWidth || 480;
    let height = canvas.height = canvas.parentElement?.clientHeight || 480;

    // Handle canvas resize
    const resizeObserver = new ResizeObserver(() => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // 3D Particle definition for sphere projection
    interface Point3D {
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      vx: number;
      vy: number;
      vz: number;
      color: string;
      size: number;
      label?: string;
      glowRadius?: number;
    }

    const points: Point3D[] = [];
    const numPoints = 120;
    const sphereRadius = Math.min(width, height) * 0.32 || 120;

    // Golden spiral algorithm to distribute points evenly across a 3D sphere
    for (let i = 0; i < numPoints; i++) {
      const theta = Math.acos(1 - 2 * (i + 0.5) / numPoints);
      const phi = Math.PI * (1 + Math.sqrt(5)) * i;

      const x = sphereRadius * Math.sin(theta) * Math.cos(phi);
      const y = sphereRadius * Math.sin(theta) * Math.sin(phi);
      const z = sphereRadius * Math.cos(theta);

      // Label some special high-fidelity nodes
      let label: string | undefined = undefined;
      if (i === 12) label = "🌐 Kyoto Campus Central";
      if (i === 34) label = "📚 CS Group Study";
      if (i === 78) label = "💬 Confessions Portal";

      points.push({
        x, y, z,
        baseX: x, baseY: y, baseZ: z,
        vx: 0, vy: 0, vz: 0,
        color: label ? '#00ff66' : '#d4d4d8',
        size: label ? 5.5 : 2.5,
        label,
        glowRadius: label ? 10 : 0
      });
    }

    // Physics parameters for rotation and dragging
    let rotX = 0;
    let rotY = 0;
    let velX = 0.003; // Base constant rotation speed
    let velY = 0.002;
    const friction = 0.95; // Spin deceleration
    const restoreForce = 0.08; // Morph elastic snap back

    // Mouse state
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let hoverActive = false;

    // Track dragging velocities
    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      const rect = canvas.getBoundingClientRect();
      lastMouseX = e.clientX - rect.left;
      lastMouseY = e.clientY - rect.top;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      currentMouseX = e.clientX - rect.left;
      currentMouseY = e.clientY - rect.top;
      hoverActive = true;

      if (!isMouseDown) return;

      const deltaX = currentMouseX - lastMouseX;
      const deltaY = currentMouseY - lastMouseY;

      // Map dragging to rotational physics
      velX = deltaY * 0.004;
      velY = deltaX * 0.004;

      lastMouseX = currentMouseX;
      lastMouseY = currentMouseY;
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleMouseLeave = () => {
      isMouseDown = false;
      hoverActive = false;
    };

    // Attach listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Render loop with physics integration
    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      // Decay rotation velocities unless dragging is active
      if (!isMouseDown) {
        velX *= friction;
        velY *= friction;
        // Keep a very tiny minimal drift so the sphere never fully stalls
        if (Math.abs(velX) < 0.0005) velX = 0.0003;
        if (Math.abs(velY) < 0.0005) velY = 0.0002;
      }

      // Update rotation angles
      rotY += velY;
      rotX += velX;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Render futuristic orbit lines behind the sphere
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, sphereRadius * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      // Project points in 3D, calculate physics-based morphing distortion
      const projected = points.map(p => {
        // 1. Rotate in 3D around Y axis
        let x1 = p.baseX * cosY - p.baseZ * sinY;
        let z1 = p.baseX * sinY + p.baseZ * cosY;

        // 2. Rotate around X axis
        let y2 = p.baseY * cosX - z1 * sinX;
        let z2 = p.baseY * sinX + z1 * cosX;

        // Perfect spherical targets
        const targetRotX = x1;
        const targetRotY = y2;
        const targetRotZ = z2;

        // Apply interactive soft-body fluid push (Morphing Physics)
        const screenX = targetRotX + width / 2;
        const screenY = targetRotY + height / 2;

        if (hoverActive) {
          const dx = currentMouseX - screenX;
          const dy = currentMouseY - screenY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Force repulsion distance threshold
          const threshold = 75;
          if (distance < threshold && distance > 0) {
            const force = (threshold - distance) / threshold * 38; // Repelling force magnitude
            const angle = Math.atan2(dy, dx);

            // Integrate instant velocity offsets (pushing particles away in 3D direction)
            p.vx -= Math.cos(angle) * force * 0.08;
            p.vy -= Math.sin(angle) * force * 0.08;
          }
        }

        // Apply restoring spring physics back to correct sphere surface location
        p.vx += (0 - p.x) * restoreForce;
        p.vy += (0 - p.y) * restoreForce;
        p.vz += (0 - p.z) * restoreForce;

        // Add minor friction damping to particles
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.vz *= 0.82;

        // Update positions with interactive displacements
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Combine base rotation position with internal offset physics
        const finalX = targetRotX + p.x * 0.15;
        const finalY = targetRotY + p.y * 0.15;
        const finalZ = targetRotZ + p.z * 0.15;

        // Simple perspective projection factor
        const scale = (finalZ + sphereRadius * 1.5) / (sphereRadius * 2);

        return {
          px: finalX * scale + width / 2,
          py: finalY * scale + height / 2,
          pz: finalZ,
          scale,
          origPoint: p
        };
      });

      // Sort points by depth (back-to-front rendering) for accurate projection overlay
      projected.sort((a, b) => a.pz - b.pz);

      // Draw connection lines to close neighbors to create mesh network
      ctx.lineWidth = 0.55;
      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        if (p1.pz < -20) continue; // Skip deep back lines for visual clarity

        let connectionsCount = 0;
        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];
          if (connectionsCount > 3) break; // Limit lines per particle for performance

          const dx = p1.px - p2.px;
          const dy = p1.py - p2.py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 48) {
            const alpha = (1 - dist / 48) * 0.22 * p1.scale;
            ctx.strokeStyle = `rgba(161, 161, 170, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.stroke();
            connectionsCount++;
          }
        }
      }

      // Render points and labels
      projected.forEach(proj => {
        const p = proj.origPoint;
        const size = p.size * proj.scale;
        const alpha = Math.max(0.12, (proj.pz + sphereRadius) / (sphereRadius * 2));

        // Draw node aura/glow if it is a major campus conduit
        if (p.label) {
          ctx.beginPath();
          ctx.arc(proj.px, proj.py, size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 255, 102, ${0.12 * proj.scale})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(proj.px, proj.py, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 255, 102, ${alpha})`;
          ctx.fill();

          // Highlight label if mouse is somewhat close to the node
          const dx = currentMouseX - proj.px;
          const dy = currentMouseY - proj.py;
          const mouseDist = Math.sqrt(dx * dx + dy * dy);

          if (mouseDist < 55) {
            ctx.fillStyle = '#00ff66';
            ctx.font = 'bold 9.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
            ctx.shadowColor = 'rgba(0, 255, 102, 0.4)';
            ctx.shadowBlur = 4;
            ctx.fillText(p.label, proj.px + 10, proj.py + 3);
            ctx.shadowBlur = 0; // Reset shadow

            // Small connecting line to label
            ctx.strokeStyle = 'rgba(0, 255, 102, 0.45)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(proj.px, proj.py);
            ctx.lineTo(proj.px + 7, proj.py);
            ctx.stroke();
          }
        } else {
          // Regular mesh particle
          ctx.beginPath();
          ctx.arc(proj.px, proj.py, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212, 212, 216, ${alpha * 0.7})`;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Dicebear avatar preview URL
  const avatarUrl = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed}`;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-12 lg:p-16 relative overflow-hidden bg-[#050505] text-[#f4f4f5] font-sans">
      
      {/* 1. Immersive Atmospheric Cyber-Traditional Courtyard Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        {/* Scenic image silhouette overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-lighten filter grayscale contrast-125 scale-105"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1400')` }}
        />
        
        {/* Absolute ambient dark glass vignetting */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/85 to-black/90" />
        
        {/* Soft glowing architectural light nodes */}
        <div className="absolute top-[20%] left-[30%] w-96 h-96 rounded-full bg-emerald-900/10 blur-[130px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[20%] w-[450px] h-[450px] rounded-full bg-zinc-900/40 blur-[160px]" />
      </div>

      {/* 2. Main Portal Floating Hub (Responsive Desktop Frame) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl h-auto md:h-[80vh] min-h-[580px] max-h-[820px] bg-white rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border border-zinc-900/10 overflow-hidden flex flex-col md:flex-row relative z-10"
      >
        
        {/* LEFT COLUMN: Modern, pristine off-white interactive login form */}
        <div className="flex-1 bg-[#fafafa] text-zinc-900 px-6 py-8 sm:px-10 sm:py-10 flex flex-col justify-between overflow-y-auto min-h-[460px] md:min-h-0 relative">
          
          {/* Top layout: Brand logo */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 border-2 border-black flex items-center justify-center font-serif text-lg italic font-black bg-black text-[#00ff66] shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,0.15)]">
                F
              </div>
              <span className="font-serif font-black text-sm tracking-widest text-black">
                FLICK
              </span>
            </div>
            
            {/* Live Network State Badge inside off-white panel */}
            <div className="flex items-center space-x-1.5 bg-zinc-150/85 px-2.5 py-1 rounded-full text-[8.5px] font-mono font-bold uppercase text-zinc-600 border border-zinc-200">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span>{isOnline ? `SECURE NODE (${connectionType.toUpperCase()})` : 'NODE OFFLINE'}</span>
            </div>
          </div>

          {/* Form container with AnimatePresence transitions */}
          <div className="my-auto max-w-sm w-full mx-auto space-y-5">
            <AnimatePresence mode="wait">
              {loading || submitting ? (
                <motion.div 
                  key="form-loading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-12 text-center flex flex-col items-center justify-center space-y-5"
                >
                  <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                    <span className="absolute inset-0 rounded-full border-4 border-zinc-100" />
                    <span className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin" />
                    <Lock className="w-5 h-5 text-emerald-600 animate-pulse" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-mono font-black text-zinc-400 uppercase tracking-widest">
                      GATEWAY STEP 0{currentStep + 1}
                    </h3>
                    <h2 className="text-sm font-serif font-black italic text-zinc-900 tracking-wide uppercase">
                      {loadingSteps[currentStep].title}
                    </h2>
                    <p className="text-xs text-zinc-500 font-sans leading-normal max-w-[240px] mx-auto">
                      {loadingSteps[currentStep].detail}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={isResettingPassword ? "form-reset" : isSignUp ? "form-register" : "form-login"}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                  className="space-y-5"
                >
                  {/* Titles */}
                  <div className="space-y-1.5">
                    <h2 className="text-3xl font-serif font-black italic tracking-tight text-zinc-900 leading-none">
                      {isResettingPassword 
                        ? "Reset Route" 
                        : isSignUp 
                          ? "Join the Portal" 
                          : "Welcome back!"}
                    </h2>
                    <p className="text-zinc-500 text-xs leading-relaxed max-w-xs font-sans">
                      {isResettingPassword 
                        ? "Supply your email to receive standard node reset parameters."
                        : isSignUp 
                          ? "Secure an account with Flick to experience real-time peer networks."
                          : "Simplify your campus feed and access active community discussions."}
                    </p>
                  </div>

                  {/* Errors display */}
                  {error && (
                    <div className="flex items-start bg-red-50 border border-red-200 p-3 rounded-2xl text-red-800 text-[11px] font-sans leading-relaxed">
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5 text-red-500" />
                      <div>
                        <span className="font-bold uppercase tracking-wider block mb-0.5 text-red-600 text-[9.5px] font-mono">Handshake Interrupted</span>
                        {error}
                      </div>
                    </div>
                  )}

                  {/* Success display */}
                  {resetSuccess && (
                    <div className="flex items-start bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-emerald-800 text-[11px] font-sans leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 mr-2 shrink-0 mt-0.5 text-emerald-500" />
                      <div>
                        <span className="font-bold uppercase tracking-wider block mb-0.5 text-emerald-600 text-[9.5px] font-mono">Broadcast Synced</span>
                        {resetSuccess}
                      </div>
                    </div>
                  )}

                  {isResettingPassword ? (
                    <form onSubmit={handleResetPassword} className="space-y-3.5">
                      <div className="space-y-1">
                        <input
                          type="email"
                          required
                          placeholder="Email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200/50 focus:bg-white text-zinc-900 font-sans rounded-full border-none outline-none ring-2 ring-transparent focus:ring-emerald-500/80 transition text-sm placeholder-zinc-400"
                        />
                      </div>

                      <button
                        type="submit"
                        className="flex items-center justify-center w-full px-5 py-3.5 bg-black hover:bg-zinc-800 text-white transition rounded-full font-sans text-xs tracking-wider font-extrabold cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 mr-2 text-[#00ff66]" />
                        Reset Password
                      </button>

                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsResettingPassword(false);
                            setError(null);
                            setResetSuccess(null);
                          }}
                          className="text-xs text-zinc-400 hover:text-zinc-900 transition underline cursor-pointer"
                        >
                          Back to Sign In
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                      {isSignUp && (
                        <div className="space-y-3 animate-fadeIn">
                          <input
                            type="text"
                            required
                            placeholder="Display / Pen Name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200/50 focus:bg-white text-zinc-900 font-sans rounded-full border-none outline-none ring-2 ring-transparent focus:ring-emerald-500/80 transition text-sm placeholder-zinc-400"
                          />

                          {/* Dicebear Avatar Generator within off-white portal form */}
                          <div className="p-3 bg-zinc-100 rounded-2xl flex items-center justify-between border border-zinc-200/60">
                            <div className="flex items-center space-x-3.5">
                              <img
                                src={avatarUrl}
                                alt="Avatar Preview"
                                className="w-11 h-11 bg-white border border-zinc-200 rounded-full object-cover shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0">
                                <div className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                                  Avatar Seed
                                </div>
                                <div className="text-[10.5px] text-zinc-800 font-mono font-medium truncate max-w-[120px]">
                                  {avatarSeed}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={shuffleAvatar}
                              className="flex items-center justify-center p-2.5 bg-white hover:bg-zinc-200 border border-zinc-200 rounded-full text-zinc-700 transition cursor-pointer"
                              title="Shuffle Seed"
                            >
                              <Shuffle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      <input
                        type="email"
                        required
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200/50 focus:bg-white text-zinc-900 font-sans rounded-full border-none outline-none ring-2 ring-transparent focus:ring-emerald-500/80 transition text-sm placeholder-zinc-400"
                      />

                      <div className="relative">
                        <input
                          type="password"
                          required
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200/50 focus:bg-white text-zinc-900 font-sans rounded-full border-none outline-none ring-2 ring-transparent focus:ring-emerald-500/80 transition text-sm placeholder-zinc-400"
                        />
                        {!isSignUp && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsResettingPassword(true);
                              setError(null);
                              setResetSuccess(null);
                            }}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-zinc-400 hover:text-zinc-900 cursor-pointer"
                          >
                            Forgot?
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="flex items-center justify-center w-full px-5 py-3.5 bg-black hover:bg-zinc-800 text-white transition rounded-full font-sans text-xs tracking-wider font-extrabold cursor-pointer mt-1"
                      >
                        {isSignUp ? (
                          <>
                            <UserPlus className="w-3.5 h-3.5 mr-2 text-[#00ff66]" />
                            Create Free Account
                          </>
                        ) : (
                          <>
                            <LogIn className="w-3.5 h-3.5 mr-2 text-[#00ff66]" />
                            Log In
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Mode switcher toggle */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null);
                      }}
                      className="text-xs text-zinc-500 hover:text-black hover:underline transition cursor-pointer font-medium"
                    >
                      {isSignUp
                        ? "Already a member? Sign In"
                        : "Not a member? Register now"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Google Authentication Section */}
            {!loading && !submitting && (
              <div className="space-y-4 pt-1">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200/60" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-mono">
                    <span className="px-3 bg-[#fafafa] text-zinc-400 uppercase tracking-widest">
                      or continue with
                    </span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    id="google-login-btn"
                    onClick={handleGoogleSubmit}
                    type="button"
                    className="flex items-center justify-center w-12 h-12 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 rounded-full transition cursor-pointer"
                    title="Google Identity Portal"
                  >
                    <img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google"
                      className="w-5 h-5"
                    />
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* Footer terms */}
          <div className="mt-6 text-center text-[10px] text-zinc-400 font-sans font-medium">
            Protected by standard client-side secure sandbox protocols.
          </div>
        </div>

        {/* RIGHT COLUMN: Cinematic "Flick Sphere" Canvas & Physics Sandbox (Desktop only) */}
        <div className="hidden md:flex md:w-1/2 bg-[#0c0c0c] border-l border-zinc-900/60 relative flex-col justify-between p-8 overflow-hidden">
          
          {/* Top navigation header matching the basketball aesthetic */}
          <div className="flex items-center justify-between z-10 font-mono">
            <div className="flex items-center space-x-2 bg-zinc-900/65 px-4 py-1.5 rounded-full border border-zinc-800/80">
              <span className="text-[10px] font-black text-white tracking-widest uppercase">
                COVENANT HUB
              </span>
            </div>
            
            {/* Nav Pill bar representation from reference video */}
            <div className="flex items-center space-x-1 bg-zinc-900/40 p-1 rounded-full border border-zinc-800/40">
              <div className="px-3 py-1 bg-zinc-800 text-[9px] text-[#00ff66] font-bold rounded-full flex items-center space-x-1 select-none">
                <Globe className="w-3 h-3" />
                <span>Home</span>
              </div>
              <div className="px-3 py-1 text-[9px] text-zinc-400 font-medium rounded-full flex items-center space-x-1 opacity-60 select-none">
                <MapPin className="w-3 h-3" />
                <span>Map</span>
              </div>
              <div className="px-3 py-1 text-[9px] text-zinc-400 font-medium rounded-full flex items-center space-x-1 opacity-60 select-none">
                <User className="w-3 h-3" />
                <span>My Profile</span>
              </div>
            </div>
          </div>

          {/* Interactive Physics Canvas playground */}
          <div className="flex-1 flex flex-col justify-center items-center relative select-none">
            
            {/* Absolute instructional subtitle */}
            <div className="absolute top-4 text-center z-10 pointer-events-none">
              <span className="text-[9px] font-mono font-black text-zinc-500 uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full">
                Drag to Spin // Hover to Morph Nodes
              </span>
            </div>

            {/* Canvas Core Element */}
            <div className="w-full h-64 md:h-72 flex items-center justify-center relative">
              <canvas 
                ref={canvasRef} 
                className="w-full h-full cursor-grab active:cursor-grabbing relative z-10" 
              />
            </div>
          </div>

          {/* Bottom styled details from reference basketball poster */}
          <div className="border-t border-zinc-900 pt-5 z-10 flex items-end justify-between font-mono">
            <div className="space-y-1 text-left">
              <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                CAMPUS MATCHES
              </div>
              <h1 className="text-xl font-serif font-black italic text-white leading-tight uppercase tracking-tight">
                FIND YOUR<br />CAMPUS PEERS
              </h1>
            </div>
            
            <div className="text-right space-y-0.5">
              <div className="text-[12px] font-black text-white tracking-widest font-mono">
                FLICK // COVENANT
              </div>
              <div className="text-[8px] text-zinc-500 tracking-wider">
                ACTIVE CHANNELS INERTIA ENGINE // v1.2
              </div>
            </div>
          </div>
        </div>

      </motion.div>

      {/* Main outer copyright / secure sandbox credentials info */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-zinc-500 text-[10px] font-mono z-10 pointer-events-none select-none">
        <p className="flex items-center justify-center text-[var(--neon-green)]/60 font-black uppercase tracking-widest">
          <Shield className="w-3.5 h-3.5 mr-1 text-[#00ff66]/70" /> SECURE SANDBOX ENCRYPTED
        </p>
      </div>
    </div>
  );
}
