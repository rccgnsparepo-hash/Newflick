import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { showBrutalistToast } from '../lib/toast';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Shuffle, 
  Key, 
  CheckCircle2, 
  ChevronLeft,
  Loader2,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuthScreen() {
  const { loginWithGoogle, registerWithEmail, loginWithEmail, sendPasswordReset, loading: authContextLoading } = useAuth();
  const { isOnline } = useConnectivity();

  // Mode: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(() => Math.random().toString(36).substring(7));
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const shuffleAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const cleanFirebaseError = (msg: string) => {
    const lower = msg.toLowerCase();
    if (
      lower.includes('auth/invalid-credential') || 
      lower.includes('wrong-password') || 
      lower.includes('user-not-found') || 
      lower.includes('invalid_login_credentials')
    ) {
      return 'Incorrect email address or password. Please verify your credentials.';
    }
    if (lower.includes('auth/email-already-in-use') || lower.includes('email already in use')) {
      return 'An account with this email address already exists. Please sign in instead.';
    }
    if (lower.includes('auth/weak-password') || lower.includes('weak password')) {
      return 'Password must be at least 6 characters long.';
    }
    if (lower.includes('auth/invalid-email') || lower.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (lower.includes('popup-closed-by-user') || lower.includes('cancelled-by-user')) {
      return 'Google sign-in popup was closed before completion. Please try again.';
    }
    if (lower.includes('popup-blocked')) {
      return 'Google sign-in popup was blocked by your browser. Please allow popups or use email sign-in.';
    }
    if (lower.includes('operation-not-allowed') || lower.includes('operation not allowed')) {
      return 'Google sign-in is not activated in this project. Please sign in with email and password.';
    }
    if (lower.includes('unauthorized-domain') || lower.includes('unauthorized domain')) {
      return 'This origin is not authorized for Google OAuth. Please sign in with email and password.';
    }
    if (lower.includes('file://')) {
      return 'Google OAuth cannot run from a local file:// URL. Please sign in with email and password.';
    }
    if (lower.includes('network-request-failed') || lower.includes('network error')) {
      return 'Network connection failure. Please check your internet connection.';
    }
    return msg.replace('Firebase: ', '');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both your email address and password.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await loginWithEmail(email.trim(), password.trim());
      showBrutalistToast('AUTHENTICATED ✓', 'Welcome back to Flick!', 'success');
    } catch (err: any) {
      console.warn('[AuthScreen] Sign in error:', err);
      const cleanErr = cleanFirebaseError(err?.message || String(err));
      setError(cleanErr);
      showBrutalistToast('AUTH ERROR', cleanErr, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please provide a display name.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Please provide an email address and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await registerWithEmail(email.trim(), password.trim(), displayName.trim(), avatarSeed);
      showBrutalistToast('ACCOUNT CREATED ✓', 'Welcome to Flick! Session initialized.', 'success');
    } catch (err: any) {
      console.warn('[AuthScreen] Sign up error:', err);
      const cleanErr = cleanFirebaseError(err?.message || String(err));
      setError(cleanErr);
      showBrutalistToast('REGISTRATION ERROR', cleanErr, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address to receive a password reset link.');
      return;
    }

    setError(null);
    setResetSuccessMessage(null);
    setSubmitting(true);

    try {
      await sendPasswordReset(email.trim());
      const msg = `Password reset instructions have been dispatched to ${email.trim()}. Please check your inbox.`;
      setResetSuccessMessage(msg);
      showBrutalistToast('RESET EMAIL SENT', msg, 'success');
    } catch (err: any) {
      console.warn('[AuthScreen] Password reset error:', err);
      const cleanErr = cleanFirebaseError(err?.message || String(err));
      setError(cleanErr);
      showBrutalistToast('RESET ERROR', cleanErr, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await loginWithGoogle();
      showBrutalistToast('AUTHENTICATED ✓', 'Connected via Google identity.', 'success');
    } catch (err: any) {
      console.warn('[AuthScreen] Google auth error:', err);
      const cleanErr = cleanFirebaseError(err?.message || String(err));
      setError(cleanErr);
      showBrutalistToast('AUTH NOTICE', cleanErr, 'info');
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || authContextLoading;

  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-center items-center px-4 py-8 font-mono relative selection:bg-[var(--neon-green)] selection:text-black">
      {/* Subtle architectural grid pattern background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.04)_0%,transparent_75%)] pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: 'linear-gradient(var(--color-text) 1px, transparent 1px), linear-gradient(90deg, var(--color-text) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Main Auth Container Card */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-md bg-[var(--color-surface)] border-2 border-[var(--neon-green-border)] shadow-[6px_6px_0px_0px_var(--neon-green)] relative z-10 flex flex-col overflow-hidden"
      >
        {/* Card Header Bar */}
        <div className="p-6 pb-4 border-b border-[var(--neon-green-border)] bg-[var(--color-background)]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 border-2 border-[var(--neon-green)] flex items-center justify-center font-serif text-2xl font-black bg-[var(--color-surface)] text-[var(--neon-green)] shadow-[2px_2px_0px_var(--neon-green)]">
                F
              </div>
              <div>
                <h1 className="font-serif font-black text-xl text-[var(--color-text)] tracking-tight uppercase leading-none">
                  FLICK
                </h1>
                <p className="text-[9.5px] font-mono font-bold text-[var(--neon-green)] uppercase tracking-wider mt-1">
                  SECURE NET // AUTH GATEWAY
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[var(--color-surface)] border border-[var(--neon-green-border)] text-[9px] font-mono text-[var(--neon-green)] font-bold">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[var(--neon-green)] animate-pulse' : 'bg-amber-400'}`} />
              <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs (Sign In vs Create Account) */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 border-b border-[var(--neon-green-border)] bg-[var(--color-background)] text-xs font-mono font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`py-3 text-center uppercase tracking-wider transition-colors cursor-pointer border-r border-[var(--neon-green-border)] ${
                mode === 'signin'
                  ? 'bg-[var(--color-surface)] text-[var(--neon-green)] font-black border-b-2 border-b-[var(--neon-green)]'
                  : 'text-zinc-500 hover:text-[var(--color-text)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-3 text-center uppercase tracking-wider transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[var(--color-surface)] text-[var(--neon-green)] font-black border-b-2 border-b-[var(--neon-green)]'
                  : 'text-zinc-500 hover:text-[var(--color-text)]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 border-2 border-rose-500/80 bg-rose-500/10 text-rose-400 text-xs font-sans flex items-start justify-between gap-2.5 overflow-hidden"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-400 hover:text-white text-xs cursor-pointer px-1"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Banner (for password reset) */}
          <AnimatePresence>
            {resetSuccessMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 border-2 border-emerald-500/80 bg-emerald-500/10 text-emerald-400 text-xs font-sans flex items-start gap-2 overflow-hidden"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{resetSuccessMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MODE: SIGN IN */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Email Address</span>
                  <Mail className="w-3 h-3 text-zinc-500" />
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border-2 border-zinc-700/80 focus:border-[var(--neon-green)] text-[var(--color-text)] font-sans text-sm focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>Password</span>
                    <Lock className="w-3 h-3 text-zinc-500" />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-[10px] font-mono text-[var(--neon-green)] hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 pr-10 bg-[var(--color-background)] border-2 border-zinc-700/80 focus:border-[var(--neon-green)] text-[var(--color-text)] font-sans text-sm focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-[var(--neon-green)] hover:bg-emerald-400 text-black font-mono font-black text-xs uppercase tracking-widest transition-all duration-150 flex items-center justify-center space-x-2 shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE: CREATE ACCOUNT */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Avatar Selector */}
              <div className="flex items-center space-x-3 p-3 bg-[var(--color-background)] border border-[var(--neon-green-border)]">
                <img
                  src={`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed}`}
                  alt="Avatar Preview"
                  className="w-12 h-12 rounded-full border-2 border-[var(--neon-green)] bg-[var(--color-surface)] shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    Account Avatar
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate">
                    Seed: {avatarSeed}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={shuffleAvatar}
                  disabled={isLoading}
                  title="Generate new avatar"
                  className="p-2 border border-zinc-700 hover:border-[var(--neon-green)] text-[var(--color-text)] hover:text-[var(--neon-green)] transition cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Display Name</span>
                  <User className="w-3 h-3 text-zinc-500" />
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  required
                  autoFocus
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border-2 border-zinc-700/80 focus:border-[var(--neon-green)] text-[var(--color-text)] font-sans text-sm focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Email Address</span>
                  <Mail className="w-3 h-3 text-zinc-500" />
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border-2 border-zinc-700/80 focus:border-[var(--neon-green)] text-[var(--color-text)] font-sans text-sm focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Password (min. 6 characters)</span>
                  <Lock className="w-3 h-3 text-zinc-500" />
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 pr-10 bg-[var(--color-background)] border-2 border-zinc-700/80 focus:border-[var(--neon-green)] text-[var(--color-text)] font-sans text-sm focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-[var(--neon-green)] hover:bg-emerald-400 text-black font-mono font-black text-xs uppercase tracking-widest transition-all duration-150 flex items-center justify-center space-x-2 shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>CREATING ACCOUNT...</span>
                  </>
                ) : (
                  <>
                    <span>CREATE FREE ACCOUNT</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setResetSuccessMessage(null);
                }}
                className="inline-flex items-center text-xs font-mono text-[var(--neon-green)] hover:underline uppercase tracking-wider cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Back to Sign In</span>
              </button>

              <div className="space-y-1">
                <h3 className="font-serif font-black text-base text-[var(--color-text)] uppercase tracking-tight">
                  Reset Password
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-normal">
                  Enter your email address and we will dispatch a password reset link to your inbox.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Registered Email</span>
                  <Mail className="w-3 h-3 text-zinc-500" />
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoFocus
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border-2 border-zinc-700/80 focus:border-[var(--neon-green)] text-[var(--color-text)] font-sans text-sm focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[var(--neon-green)] hover:bg-emerald-400 text-black font-mono font-black text-xs uppercase tracking-widest transition-all duration-150 flex items-center justify-center space-x-2 shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>SENDING RESET LINK...</span>
                  </>
                ) : (
                  <>
                    <span>SEND RESET LINK</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Social Authentication Divider */}
          {mode !== 'forgot' && (
            <div className="pt-2 space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-700/60" />
                </div>
                <span className="relative px-3 bg-[var(--color-surface)] text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  or continue with
                </span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[var(--color-background)] hover:bg-zinc-800/80 border-2 border-zinc-700 hover:border-zinc-500 text-[var(--color-text)] text-xs font-mono font-bold tracking-wider uppercase transition flex items-center justify-center space-x-2.5 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info badge */}
        <div className="p-3.5 border-t border-[var(--neon-green-border)] bg-[var(--color-background)]/80 text-center">
          <p className="text-[10px] text-zinc-500 font-mono flex items-center justify-center space-x-1.5 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--neon-green)]" />
            <span>End-to-End Encrypted Sovereign Conduit</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
