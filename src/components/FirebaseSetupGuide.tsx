import React, { useState } from 'react';
import { ShieldAlert, Copy, Check, Terminal, ExternalLink, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface FirebaseSetupGuideProps {
  error: string | null;
}

export default function FirebaseSetupGuide({ error }: FirebaseSetupGuideProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const envVariables = [
    { name: 'FIREBASE_PROJECT_ID', desc: 'Your Firebase project ID' },
    { name: 'FIREBASE_API_KEY', desc: 'Your Firebase web API Key' },
    { name: 'FIREBASE_APP_ID', desc: 'Your Firebase Web App ID' },
    { name: 'FIREBASE_AUTH_DOMAIN', desc: 'Optional. defaults to {projectId}.firebaseapp.com' },
    { name: 'FIREBASE_FIRESTORE_DATABASE_ID', desc: 'Optional. Database ID if using a custom database' },
    { name: 'FIREBASE_STORAGE_BUCKET', desc: 'Optional. defaults to {projectId}.appspot.com' },
    { name: 'FIREBASE_MESSAGING_SENDER_ID', desc: 'Optional. Messaging sender ID' },
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAllEnvTemplate = () => {
    const template = envVariables.map(v => `${v.name}=YOUR_VALUE`).join('\n');
    handleCopy(template);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#f4f4f5] font-mono flex items-center justify-center p-4 selection:bg-[var(--neon-green)] selection:text-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.03)_0%,transparent_70%)] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl border-3 border-[#ff0055]/40 bg-[#0a0506]/95 p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(255,0,85,0.15)] relative overflow-hidden"
      >
        {/* Decorative corner borders */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-[#ff0055]" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-[#ff0055]" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-[#ff0055]" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-[#ff0055]" />

        {/* Header */}
        <div className="flex items-center space-x-4 pb-6 border-b-2 border-white/10 mb-6">
          <div className="w-12 h-12 border-2 border-[#ff0055] bg-black flex items-center justify-center text-[#ff0055] shadow-[3px_3px_0px_#ff0055]">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-widest text-[#ff0055] uppercase">
              Flick // Config Tunnel Offline
            </h1>
            <p className="text-[10px] text-zinc-400 font-sans uppercase font-bold tracking-wider">
              Firebase Configuration Required for E2EE Secure Direct Dialogues
            </p>
          </div>
        </div>

        {/* Error Details */}
        <div className="bg-black/80 border border-red-500/30 p-4 mb-6 rounded-none">
          <div className="flex items-center space-x-2 text-[#ff0055] text-xs font-bold uppercase mb-2">
            <Terminal className="w-4 h-4" />
            <span>Diagnostics Message</span>
          </div>
          <p className="text-[11px] text-zinc-300 font-mono break-all leading-relaxed">
            {error || "No 'apiKey' detected. The dynamic server config loader was unreachable and fallback credentials are unconfigured."}
          </p>
        </div>

        {/* Instructions */}
        <div className="space-y-4 mb-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-[var(--neon-green)]" />
            <span>How to configure on Vercel / Production:</span>
          </h2>
          
          <ol className="text-xs text-zinc-400 space-y-2.5 list-decimal pl-4 leading-relaxed font-sans font-semibold uppercase">
            <li>
              Go to your{' '}
              <a 
                href="https://vercel.com/dashboard" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[var(--neon-green)] hover:underline inline-flex items-center gap-0.5"
              >
                Vercel Dashboard <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and select this project.
            </li>
            <li>
              Navigate to <strong className="text-zinc-200">Settings &gt; Environment Variables</strong>.
            </li>
            <li>
              Add the following environment variables. The server will securely bootstrap the client without exposing credentials in the client build.
            </li>
          </ol>
        </div>

        {/* Variables Table */}
        <div className="border border-white/10 overflow-hidden mb-6">
          <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Required Environment Variables</span>
            <button
              onClick={copyAllEnvTemplate}
              className="text-[10px] text-[var(--neon-green)] hover:underline flex items-center gap-1 cursor-pointer font-bold uppercase"
            >
              {copied === 'template' ? (
                <>
                  <Check className="w-3 h-3" /> Copied Template
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy Env Template
                </>
              )}
            </button>
          </div>
          <div className="divide-y divide-white/5 bg-black/40">
            {envVariables.map((v) => (
              <div key={v.name} className="p-3.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-black text-zinc-100 font-mono block tracking-wide select-all">
                    {v.name}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-sans block mt-0.5 uppercase font-semibold">
                    {v.desc}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(v.name)}
                  className="self-start sm:self-center text-[10px] text-zinc-400 hover:text-white border border-white/10 hover:border-white/30 px-2 py-1 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied === v.name ? (
                    <>
                      <Check className="w-3 h-3 text-[#00ff66]" />
                      <span className="text-[#00ff66] font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Name</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/10 pt-6 gap-4">
          <p className="text-[9px] text-zinc-400 font-sans uppercase font-bold leading-normal">
            * Once added, trigger a new Vercel deployment to apply changes.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full sm:w-auto px-5 py-2.5 bg-black border-2 border-[var(--neon-green)] text-[var(--neon-green)] text-xs font-bold uppercase tracking-wider hover:bg-[var(--neon-green)] hover:text-black shadow-[4px_4px_0px_#00ff66] hover:shadow-none active:translate-x-1 active:translate-y-1 transition-all cursor-pointer text-center"
          >
            Retry Connection
          </button>
        </div>
      </motion.div>
    </div>
  );
}
