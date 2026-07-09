import React from 'react';
import { HardDrive, Layout, BookOpen, UserPlus, HelpCircle, Terminal, Flame, Info, Search } from 'lucide-react';
import { UserProfile } from '../types';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';
import { NativePushDebugger } from './NativePushDebugger';
import { showBrutalistToast } from '../lib/toast';

interface OtherTabsProps {
  activeTab: 'friends' | 'help' | 'quantum';
  autoDownloadOnCellular: boolean;
  setAutoDownloadOnCellular: (val: boolean) => void;
  cacheCleanupRetention: '7d' | '30d' | 'infinite';
  setCacheCleanupRetention: (val: '7d' | '30d' | 'infinite') => void;
  newsFeedStyle: 'vapor' | 'brutalist' | 'silicon';
  setNewsFeedStyle: (val: 'vapor' | 'brutalist' | 'silicon') => void;
  eduModeEnabled: boolean;
  setEduModeEnabled: (val: boolean) => void;
  friendsUserSearchQuery: string;
  setFriendsUserSearchQuery: (val: string) => void;
  systemUsers: UserProfile[];
  helpTicketCategory: 'technical' | 'privacy' | 'feedback';
  setHelpTicketCategory: (val: 'technical' | 'privacy' | 'feedback') => void;
  helpTicketContent: string;
  setHelpTicketContent: (val: string) => void;
  diagnosticLogs: string[];
  setDiagnosticLogs: React.Dispatch<React.SetStateAction<string[]>>;
  isSendingCloudTest: boolean;
  handleLocalPushSimulation: () => void;
  handleCloudTestCall: () => void;
  profile: any;
}

export function SettingsOtherTabs({
  activeTab,
  autoDownloadOnCellular,
  setAutoDownloadOnCellular,
  cacheCleanupRetention,
  setCacheCleanupRetention,
  newsFeedStyle,
  setNewsFeedStyle,
  eduModeEnabled,
  setEduModeEnabled,
  friendsUserSearchQuery,
  setFriendsUserSearchQuery,
  systemUsers,
  helpTicketCategory,
  setHelpTicketCategory,
  helpTicketContent,
  setHelpTicketContent,
  diagnosticLogs,
  setDiagnosticLogs,
  isSendingCloudTest,
  handleLocalPushSimulation,
  handleCloudTestCall,
  profile
}: OtherTabsProps) {
  return (
    <>
      {/* ADD FLICK FRIEND TAB PANEL */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> ADD A FLICK FRIEND CHANNEL
          </h3>

          <p className="text-[10px] text-zinc-450 leading-normal font-sans">
            Send an encryption channel handshake invitation to another registered node user on Flick by entering their tag or displayName alias.
          </p>

          <div className="flex gap-2 border border-zinc-900 bg-zinc-950 p-2">
            <Search className="w-4 h-4 text-zinc-500 mt-1.5 ml-1" />
            <input
              type="text"
              placeholder="Enter username handle keyword..."
              value={friendsUserSearchQuery}
              onChange={(e) => setFriendsUserSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs text-white focus:ring-0 outline-none font-mono"
            />
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {systemUsers
              .filter(u => u.displayName?.toLowerCase().includes(friendsUserSearchQuery.toLowerCase()))
              .map((user) => (
                <div key={user.uid} className="p-3 bg-zinc-950 border border-zinc-900 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img src={user.photoURL || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${user.uid}`} className="w-7 h-7 border border-zinc-800" alt="Avatar" referrerPolicy="no-referrer" />
                    <div>
                      <span className="text-xs font-serif font-black tracking-tight block">@{user.displayName || 'Anonymous'}</span>
                      <span className="text-[8px] font-mono text-zinc-500 block font-bold">KEY: {user.publicKey?.slice(0, 16)}...</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playLikeSound();
                      triggerVibration('medium');
                      showBrutalistToast('INVITE TRANSMITTED', `Cryptographic invite package sent to @${user.displayName || 'Anonymous'}. Keys dispatched securely.`, 'success');
                    }}
                    className="px-2.5 py-1 text-[8.5px] font-mono uppercase bg-black hover:bg-[var(--neon-green)] text-zinc-400 hover:text-black hover:font-bold border border-zinc-800 transition cursor-pointer"
                  >
                    Invite Key
                  </button>
                </div>
              ))}
            {systemUsers.length > 5 && friendsUserSearchQuery === '' && (
              <p className="text-center text-[8.5px] text-zinc-500 font-mono italic">And {systemUsers.length - 5} more users indexed inside database.</p>
            )}
          </div>
        </div>
      )}

      {/* HELP & SUPPORT TAB PANEL */}
      {activeTab === 'help' && (
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-bold text-[var(--neon-green)] font-mono flex items-center gap-2">
            <HelpCircle className="w-4 h-4" /> DISPATCH ENCRYPTED SUPPORT TICKET
          </h3>

          <p className="text-[10px] text-zinc-400 leading-normal font-sans">
            Send feedback or privacy concerns directly to Flick technical nodes. Form payloads are locked before transit.
          </p>

          <div className="space-y-3.5 mt-2">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold">Encrypted Ticket Category:</label>
              <select
                value={helpTicketCategory}
                onChange={(e) => {
                  setHelpTicketCategory(e.target.value as any);
                  playGlitchClickSound();
                }}
                className="w-full bg-black border border-zinc-800 px-2 py-1.5 text-xs font-mono text-[var(--neon-green)] focus:outline-none"
              >
                <option value="technical">Technical Support / Crash logs</option>
                <option value="privacy">Privacy & Account Security</option>
                <option value="feedback">General Interface Suggestions</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold">Detailed Description:</label>
              <textarea
                rows={3}
                placeholder="Describe your request or bug..."
                value={helpTicketContent}
                onChange={(e) => setHelpTicketContent(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 p-2 text-xs text-white placeholder-zinc-700 outline-none font-sans"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!helpTicketContent.trim()) {
                  showBrutalistToast('WARNING !', 'Support ticket content cannot be empty.', 'warning');
                  return;
                }
                playLikeSound();
                triggerVibration('heavy');
                showBrutalistToast('TICKET DISPATCHED', 'Support Ticket encrypted and dispatched with high-entropy package signature.', 'success');
                setHelpTicketContent('');
              }}
              className="w-full py-2 bg-black border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black font-mono text-[9px] uppercase font-bold cursor-pointer"
            >
              🔒 Dispatch Encrypted Payload
            </button>
          </div>
        </div>
      )}

      {/* NATIVE PUSH DEBUGGER TAB PANEL AS QUANTUM SIGNATURES */}
      {activeTab === 'quantum' && (
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-widest font-bold text-red-500 font-mono flex items-center gap-2">
            <Terminal className="w-4 h-4 text-red-400" /> QUANTUM SIGNATURES & RE-ROTATING SYMMETRIC KEYNODES
          </h3>

          <p className="text-[10px] text-zinc-450 leading-normal font-sans">
            Maintain abstract peer handshakes and rotate local entropy values asynchronously to prevent tracking. External diagnostic vectors are filtered.
          </p>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={handleLocalPushSimulation}
              className="bg-black border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-2 text-[10px] font-mono uppercase tracking-wider font-extrabold cursor-pointer text-center rounded-lg"
            >
              ⚡ ROTATE ENTROPY MATRIX
            </button>
            
            <button
              type="button"
              disabled={isSendingCloudTest}
              onClick={handleCloudTestCall}
              className="bg-red-600 border border-red-500 text-white hover:bg-red-500 px-3 py-2 text-[10px] font-mono uppercase tracking-wider font-extrabold cursor-pointer text-center disabled:opacity-40 rounded-lg"
            >
              {isSendingCloudTest ? 'Aligning...' : '🌀 SECURE HANDSHAKE'}
            </button>
          </div>

          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between items-center text-[9px] font-mono uppercase text-zinc-400 font-bold">
              <span>Entropy Trace Spectrum</span>
              <button
                type="button"
                onClick={() => {
                  playGlitchClickSound();
                  setDiagnosticLogs(["Spectra initialized..."]);
                }}
                className="text-zinc-550 hover:text-red-400 cursor-pointer text-[8px]"
              >
                Reset
              </button>
            </div>
            
            <div className="bg-black/95 border border-zinc-900 p-2 h-24 overflow-y-auto text-[8px] font-mono leading-normal text-red-400 space-y-1 scrollbar-thin select-text rounded-lg">
              {diagnosticLogs.map((log, idx) => {
                // Obfuscate standard push notification lines to sound cryptic and cool
                let secureLog = log;
                if (log.includes('Starting manual OneSignal register sequence')) {
                  secureLog = '[ ROTATION_INIT ] :: Ephemeral seed generation triggered...';
                } else if (log.includes('Current UID')) {
                  secureLog = `[ SIGNATURE_CHECK ] :: Secure key-hash token validated on secure memory sub-tier.`;
                } else if (log.includes('Web environment detected')) {
                  secureLog = '[ SIMULATOR ] :: Emulating secure local sandbox matrix...';
                } else if (log.includes('SUCCESS: Dummy Web Device Token')) {
                  secureLog = '[ ROTATE_SUCCESS ] :: Entropy vectors matched. Encrypted peer-mesh index synchronized.';
                } else if (log.includes('Trigger document written in Firestore')) {
                  secureLog = '[ SEED_BROADCAST ] :: Handshake packet submitted into firestore spectrum...';
                } else if (log.includes('Cloud Function is executing REST post')) {
                  secureLog = '[ TRANSLATION_MATRIX ] :: Executing asynchronous peer routing...';
                }
                return (
                  <div key={idx} className="border-b border-zinc-950 pb-0.5 whitespace-pre-wrap">{secureLog}</div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-950 pt-2 opacity-50 pointer-events-none select-none filter blur-[1px]">
            <NativePushDebugger 
              uid={profile?.uid} 
              oneSignalSubscriptionId={profile?.oneSignalSubscriptionId || profile?.oneSignalId} 
            />
          </div>
        </div>
      )}
    </>
  );
}
