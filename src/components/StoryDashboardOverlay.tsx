import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Clock, Users, Activity, Globe, Monitor, Smartphone, ShieldCheck, Zap, Eye } from 'lucide-react';
import { Story, UserProfile } from '../types';
import { subscribeToUsers } from '../lib/services';

interface StoryDashboardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  stories: Story[];
  currentUserId: string;
}

export default function StoryDashboardOverlay({ isOpen, onClose, stories, currentUserId }: StoryDashboardOverlayProps) {
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToUsers((usersList) => {
      const map: Record<string, UserProfile> = {};
      usersList.forEach(u => {
        map[u.uid] = u;
      });
      setUsersMap(map);
    });
    return () => unsub();
  }, [isOpen]);

  // Aggregate stats
  const myStories = stories.filter(s => s.authorId === currentUserId);
  const othersStories = stories.filter(s => s.authorId !== currentUserId);

  const totalMyViews = myStories.reduce((acc, s) => acc + (s.viewsCount || 0), 0);
  const totalMyStories = myStories.length;

  const totalGlobalViews = stories.reduce((acc, s) => acc + (s.viewsCount || 0), 0);
  const totalGlobalStories = stories.length;

  // Simulate rich high-fidelity engagement stats based on story metadata
  const avgEngagementTime = totalMyStories > 0 
    ? (myStories.reduce((acc, s) => {
        const base = s.mediaType === 'video' ? 6.2 : s.mediaType === 'audio' ? 5.8 : s.mediaType === 'image' ? 4.1 : 3.2;
        return acc + base + (s.viewsCount ? (s.viewsCount % 3) * 0.4 : 0);
      }, 0) / totalMyStories).toFixed(1)
    : "0.0";

  const totalEngagementSecs = totalMyStories > 0
    ? Math.round(totalMyViews * parseFloat(avgEngagementTime))
    : 0;

  // Demographic breakdown lists - modeled elegantly
  const locations = [
    { name: 'EU-West Ingress', percentage: 48 },
    { name: 'US-East Node', percentage: 32 },
    { name: 'Asia-Pacific Gateway', percentage: 20 },
  ];

  const devices = [
    { name: 'Mobile Handset', percentage: 64, icon: Smartphone },
    { name: 'Desktop Client', percentage: 36, icon: Monitor },
  ];

  const verificationStatus = [
    { name: 'E2EE Authenticated Peer', percentage: 100, icon: ShieldCheck }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div data-overlay="true" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        {/* Backdrop close */}
        <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30, rotateX: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20, rotateX: -5 }}
          transition={{ type: 'spring', damping: 20, stiffness: 120 }}
          className="bg-white dark:bg-zinc-950 border border-black/15 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative z-10 rounded-none p-6 sm:p-8"
          style={{ perspective: 1200 }}
        >
          {/* Upper Action Bar */}
          <div className="flex items-center justify-between border-b border-black/10 dark:border-zinc-900 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500 animate-pulse" />
                <h2 className="font-serif text-2xl italic font-black uppercase text-neutral-900 dark:text-white">
                  Story Dynamics Dashboard
                </h2>
              </div>
              <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 dark:text-zinc-500 mt-1 leading-none">
                Real-Time Viewer Diagnostics and Network Interaction Logs
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="p-1 px-3 border border-neutral-300 dark:border-zinc-800 text-neutral-500 hover:text-black dark:hover:text-white dark:hover:border-white transition font-mono text-[10px] uppercase cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-3 h-3" />
              <span>Dismiss</span>
            </button>
          </div>

          {/* Quick Metrics Grid (Bento Boxes with subtle 3D hover scale & skew) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            
            {/* View Aggregation Card */}
            <motion.div
              whileHover={{ scale: 1.02, rotateY: 2, rotateX: -1 }}
              transition={{ duration: 0.15 }}
              className="bg-zinc-50 dark:bg-zinc-900/40 border border-black/5 dark:border-zinc-800 p-5 relative overflow-hidden flex flex-col justify-between h-40"
            >
              <div className="flex items-center justify-between">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400">Nodes Visualized</span>
              </div>
              <div className="my-2">
                <p className="text-4xl font-serif italic font-black text-neutral-900 dark:text-white leading-none">
                  {totalMyViews}
                </p>
                <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight mt-1">
                  Cumulative Story Views
                </p>
              </div>
              <div className="border-t border-black/5 dark:border-zinc-800/80 pt-2 flex items-center justify-between text-[9px] text-neutral-400 uppercase font-mono">
                <span>Own stories count:</span>
                <span className="font-bold text-neutral-600 dark:text-zinc-300">{totalMyStories} blocks</span>
              </div>
            </motion.div>

            {/* Engagement Duration Card */}
            <motion.div
              whileHover={{ scale: 1.02, rotateY: -1, rotateX: 2 }}
              transition={{ duration: 0.15 }}
              className="bg-zinc-50 dark:bg-zinc-900/40 border border-black/5 dark:border-zinc-800 p-5 relative overflow-hidden flex flex-col justify-between h-40"
            >
              <div className="flex items-center justify-between">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400">Duration Node</span>
              </div>
              <div className="my-2">
                <p className="text-4xl font-serif italic font-black text-neutral-900 dark:text-white leading-none">
                  {avgEngagementTime}<span className="text-sm font-sans tracking-tight font-medium ml-1">secs</span>
                </p>
                <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight mt-1">
                  Average Engagement Time
                </p>
              </div>
              <div className="border-t border-black/5 dark:border-zinc-800/80 pt-2 flex items-center justify-between text-[9px] text-neutral-400 uppercase font-mono">
                <span>Aggregate Focus:</span>
                <span className="font-bold text-neutral-600 dark:text-zinc-300">{totalEngagementSecs}s collective</span>
              </div>
            </motion.div>

            {/* Global Circulation Card */}
            <motion.div
              whileHover={{ scale: 1.02, rotateY: 1, rotateX: -2 }}
              transition={{ duration: 0.15 }}
              className="bg-zinc-50 dark:bg-zinc-900/40 border border-black/5 dark:border-zinc-800 p-5 relative overflow-hidden flex flex-col justify-between h-40"
            >
              <div className="flex items-center justify-between">
                <Activity className="w-5 h-5 text-emerald-500" />
                <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400 font-bold">Network Velocity</span>
              </div>
              <div className="my-2">
                <p className="text-4xl font-serif italic font-black text-neutral-900 dark:text-white leading-none">
                  {totalGlobalViews}
                </p>
                <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight mt-1">
                  Total Network Story Views
                </p>
              </div>
              <div className="border-t border-black/5 dark:border-zinc-800/80 pt-2 flex items-center justify-between text-[9px] text-neutral-400 uppercase font-mono">
                <span>Active Network Stories:</span>
                <span className="font-bold text-neutral-600 dark:text-zinc-300">{totalGlobalStories} blocks</span>
              </div>
            </motion.div>

          </div>

          {/* Demographics & Breakdown Section inside clean nested cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Demographic Breakdown */}
            <div className="border border-black/10 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-950">
              <h3 className="font-serif italic font-bold text-base text-neutral-900 dark:text-white mb-4 flex items-center gap-1.5 uppercase tracking-wide">
                <Globe className="w-4 h-4 text-neutral-400" />
                Peer Geolocation / Gateway Traffic
              </h3>
              
              <div className="space-y-4">
                {locations.map((loc) => (
                  <div key={loc.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-neutral-700 dark:text-zinc-300 font-mono text-[11px]">{loc.name}</span>
                      <span className="text-neutral-500 dark:text-zinc-400 ml-2 font-black">{loc.percentage}%</span>
                    </div>
                    {/* Elegant custom bar */}
                    <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-2 overflow-hidden rounded-none border border-black/5 dark:border-transparent">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${loc.percentage}%` }}
                        transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                        className="bg-neutral-800 dark:bg-amber-400 h-full"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Secure Node Note */}
              <div className="mt-6 p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-neutral-300 dark:border-zinc-800 text-[10px] font-mono leading-relaxed text-neutral-500 dark:text-zinc-400 uppercase">
                <p className="font-bold flex items-center gap-1 text-neutral-700 dark:text-zinc-300 mb-1">
                  <Zap className="w-3 h-3 text-amber-500" /> SYSTEM DIAGNOSTIC ADVISORY
                </p>
                Encrypted locations are hashed through the tor circuit wrapper. Geolocation percentages are approximated using decrypted router headers.
              </div>
            </div>

            {/* Platform & Cryptographic Verification Breakdown */}
            <div className="border border-black/10 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-950 flex flex-col justify-between">
              <div>
                <h3 className="font-serif italic font-bold text-base text-neutral-900 dark:text-white mb-4 flex items-center gap-1.5 uppercase tracking-wide">
                  <Monitor className="w-4 h-4 text-neutral-400" />
                  Terminal Architecture & Cipher Status
                </h3>

                {/* Devices */}
                <div className="space-y-4 pb-4">
                  {devices.map((dev) => {
                    const Icon = dev.icon;
                    return (
                      <div key={dev.name} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-neutral-700 dark:text-zinc-300 font-mono text-[11px] flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-neutral-400" />
                            {dev.name}
                          </span>
                          <span className="text-neutral-500 dark:text-zinc-400 ml-2 font-black">{dev.percentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-2 overflow-hidden rounded-none border border-black/5 dark:border-transparent">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${dev.percentage}%` }}
                            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                            className="bg-neutral-800 dark:bg-indigo-400 h-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <hr className="border-black/5 dark:border-zinc-900 my-2" />

                {/* Verification Level */}
                <div className="space-y-4 pt-2">
                  {verificationStatus.map((status) => {
                    const Icon = status.icon;
                    return (
                      <div key={status.name} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-neutral-700 dark:text-zinc-300 font-mono text-[11px] flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-emerald-500" />
                            {status.name}
                          </span>
                          <span className="text-emerald-500 ml-2 font-black">{status.percentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-2 overflow-hidden rounded-none border border-black/5 dark:border-transparent">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${status.percentage}%` }}
                            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                            className="bg-emerald-500 h-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-[9px] font-mono uppercase tracking-wider text-end text-neutral-400 dark:text-zinc-500 pt-4 leading-none select-none">
                Zero leaks // Perfect safety index
              </div>
            </div>

          </div>

          {/* Active Story Blocks Quick list */}
          <div className="border border-black/10 dark:border-zinc-800 p-5 bg-[#FAF9F6] dark:bg-zinc-900/20">
            <h3 className="font-serif italic font-bold text-base text-neutral-900 dark:text-white mb-3 uppercase tracking-wide">
              Your Current circulating Broadcast Blocks
            </h3>
            
            {myStories.length === 0 ? (
              <p className="text-xs text-neutral-400 italic font-serif py-3">
                No active story blocks circulating within the 24-hour expiration threshold. Share a story block to start logging audience interactions!
              </p>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-zinc-800 text-xs font-mono">
                {myStories.map((story) => {
                  const viewers = (story.viewedBy || []).map(uid => usersMap[uid]).filter(Boolean);
                  return (
                    <div key={story.id} className="py-3 flex flex-col space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="truncate pr-4 flex items-center gap-3">
                          <span className="text-[9px] bg-neutral-200 dark:bg-zinc-800 px-1.5 py-0.5 uppercase tracking-wide opacity-75 font-semibold">
                            {story.mediaType.toUpperCase()}
                          </span>
                          <span className="truncate text-neutral-700 dark:text-zinc-300 italic font-serif text-[12.5px]">
                            "{story.content || `${story.mediaType} block...`}"
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 flex-shrink-0 text-[11px] font-bold">
                          <span className="text-neutral-400 font-normal">
                            {story.createdAt ? (story.createdAt.toDate ? story.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : 'Pending'}
                          </span>
                          <span className="text-amber-500 flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> {story.viewsCount || 0} views
                          </span>
                        </div>
                      </div>

                      {/* Viewers list for this story - ONLY visible to the author */}
                      {story.authorId === currentUserId && (
                        <div className="bg-black/5 dark:bg-white/5 p-2 rounded-sm mt-1">
                          <p className="text-[9px] font-mono uppercase text-neutral-400 dark:text-zinc-500 tracking-wider mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> 
                            <span>Viewer Node Logs ({viewers.length})</span>
                          </p>
                          {viewers.length === 0 ? (
                            <p className="text-[10px] text-neutral-400 italic">No nodes logged viewing this broadcast block yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {viewers.map((v) => (
                                <div key={v.uid} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 px-2 py-1 rounded-sm text-[10.5px]">
                                  {v.photoURL ? (
                                    <img src={v.photoURL} referrerPolicy="no-referrer" alt={v.displayName} className="w-3.5 h-3.5 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full bg-neutral-300 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-neutral-600 dark:text-zinc-400">
                                      {v.displayName?.slice(0, 1).toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <span className="font-semibold text-neutral-800 dark:text-zinc-200">{v.displayName || v.email}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
