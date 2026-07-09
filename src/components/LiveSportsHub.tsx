import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Play, Pause, Volume2, VolumeX, Send, Users, 
  Flame, Award, Activity, Plus, Check, ExternalLink, RefreshCw 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, limit, doc, setDoc } from 'firebase/firestore';

interface LiveMatch {
  id: string;
  title: string;
  category: 'sports' | 'gaming' | 'news' | 'entertainment';
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  minute: number;
  status: 'live' | 'upcoming' | 'ended';
  events: string[];
  videoUrl: string;
  streamerName: string;
  viewerCount: number;
}

interface LiveSportsHubProps {
  profile: any;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'loading' | 'info') => void;
  playClickSound: () => void;
}

// Pre-seeded high fidelity mock live streams (simulating a real-time live matches video API feed)
const INITIAL_MATCHES: LiveMatch[] = [
  {
    id: 'ucl-final',
    title: 'UEFA Champions League // Quarter-Finals',
    category: 'sports',
    teamA: 'Chelsea FC',
    teamB: 'Real Madrid',
    scoreA: 2,
    scoreB: 1,
    minute: 74,
    status: 'live',
    events: [
      "Kickoff at Stamford Bridge!",
      "14' Goal Chelsea! Cole Palmer finishes a beautiful counter-attack.",
      "32' Goal Real Madrid! Bellingham scores a clinical header.",
      "58' Yellow Card: Enzo Fernandez (Chelsea)",
      "67' Penalty Chelsea! Cole Palmer scores his second of the night."
    ],
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-playing-soccer-in-the-rain-41804-large.mp4',
    streamerName: 'Flick Sports Net',
    viewerCount: 245
  },
  {
    id: 'nba-match',
    title: 'NBA Finals // Game 3',
    category: 'sports',
    teamA: 'Boston Celtics',
    teamB: 'LA Lakers',
    scoreA: 98,
    scoreB: 95,
    minute: 11, // Q4
    status: 'live',
    events: [
      "Q1: Lakers start strong with AD dominating the paint.",
      "Q2: Tatum responds with three consecutive triples.",
      "Q3: Defensive masterclass from both squads.",
      "Q4 4' Remaining: Jaylen Brown converts an and-one!"
    ],
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-basketball-player-scoring-a-basket-39906-large.mp4',
    streamerName: 'Flick Sports Net',
    viewerCount: 184
  },
  {
    id: 'esports-gaming',
    title: 'Valorant Campus Tournament // Final Match',
    category: 'gaming',
    teamA: 'Flick Hunters',
    teamB: 'Cyber Phoenix',
    scoreA: 11,
    scoreB: 12,
    minute: 23,
    status: 'live',
    events: [
      "Map 3: Split. Cyber Phoenix leads slightly.",
      "Round 15: Clutch 1v3 play by 'XenNode' keeps Hunters alive.",
      "Round 20: Flawless spike defusal by Phoenix.",
      "Round 22: Hunters tie the round score at 11-11!"
    ],
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-keyboard-and-mouse-with-neon-lights-43234-large.mp4',
    streamerName: 'Lagos Arena Live',
    viewerCount: 512
  }
];

export default function LiveSportsHub({ profile, showToast, playClickSound }: LiveSportsHubProps) {
  const [matches, setMatches] = useState<LiveMatch[]>(INITIAL_MATCHES);
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch>(INITIAL_MATCHES[0]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tickerMessage, setTickerMessage] = useState<string>("INITIALIZING PIPELINE CONNECTION TO LIVE MATCHES...");
  
  // Custom streamer state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customTeamA, setCustomTeamA] = useState('');
  const [customTeamB, setCustomTeamB] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [customCategory, setCustomCategory] = useState<'sports' | 'gaming' | 'news' | 'entertainment'>('sports');

  // Stream chat system
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; senderName: string; text: string; time: string }[]>([
    { id: '1', senderName: 'XenNode', text: 'LETS GO CHELSEA! Cole Palmer is absolute class!', time: '12:04' },
    { id: '2', senderName: 'MatrixNode', text: 'Real Madrid will bounce back in the second leg', time: '12:05' },
    { id: '3', senderName: 'AeroFlick', text: 'This streaming lag is literally 0.01ms. Incredible setup!', time: '12:05' },
    { id: '4', senderName: 'CryptoLover', text: 'Valo matches are getting insane', time: '12:06' }
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Live Match Clock and Event Ticker Simulation (Simulating real-time WebSocket API score sync)
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches(prevMatches => {
        const updated = prevMatches.map(match => {
          if (match.status !== 'live') return match;

          // Increment minutes
          let newMin = match.minute;
          let newScoreA = match.scoreA;
          let newScoreB = match.scoreB;
          const newEvents = [...match.events];

          if (match.category === 'sports') {
            newMin += 1;
            if (newMin > 90) {
              newMin = 1;
              newScoreA = 0;
              newScoreB = 0;
              newEvents.push(`[SYSTEM] Match restarted for mock simulation loop.`);
            }

            // Small chance of score update
            if (Math.random() < 0.12) {
              const scorer = Math.random() > 0.5 ? 'teamA' : 'teamB';
              if (scorer === 'teamA') {
                newScoreA += 1;
                newEvents.push(`${newMin}' GOAL for ${match.teamA}! Direct strike!`);
                if (match.id === selectedMatch.id) {
                  showToast('GOAL !!!', `${match.teamA} just scored!`, 'info');
                }
              } else {
                newScoreB += 1;
                newEvents.push(`${newMin}' GOAL for ${match.teamB}! Set piece convert!`);
                if (match.id === selectedMatch.id) {
                  showToast('GOAL !!!', `${match.teamB} just scored!`, 'info');
                }
              }
            } else if (Math.random() < 0.15) {
              // Add a non-score commentary event
              const commentaries = [
                "Near miss! Shot goes barely over the crossbar.",
                "Foul committed in the midfield area.",
                "Tactical substitution being prepared.",
                "Outstanding save by the goalkeeper!",
                "Incredible dribble sequence past two defenders."
              ];
              const randomComment = commentaries[Math.floor(Math.random() * commentaries.length)];
              newEvents.push(`${newMin}' ${randomComment}`);
            }
          } else if (match.category === 'gaming') {
            // Gaming round updates
            if (Math.random() < 0.2) {
              const scorer = Math.random() > 0.45 ? 'teamA' : 'teamB';
              if (scorer === 'teamA') {
                newScoreA += 1;
                newEvents.push(`Round ${newScoreA + newScoreB}: ${match.teamA} secures the round!`);
              } else {
                newScoreB += 1;
                newEvents.push(`Round ${newScoreA + newScoreB}: ${match.teamB} secures the round!`);
              }

              if (newScoreA >= 13 || newScoreB >= 13) {
                newEvents.push(`[MATCH OVER] Final Score: ${newScoreA} - ${newScoreB}`);
                newScoreA = 0;
                newScoreB = 0;
              }
            }
          }

          // Limit events to last 15
          if (newEvents.length > 15) {
            newEvents.shift();
          }

          const updatedMatch = {
            ...match,
            minute: newMin,
            scoreA: newScoreA,
            scoreB: newScoreB,
            events: newEvents,
            viewerCount: Math.max(10, match.viewerCount + Math.floor(Math.random() * 5) - 2)
          };

          // Sync current selected match state
          if (match.id === selectedMatch.id) {
            setSelectedMatch(updatedMatch);
          }

          return updatedMatch;
        });

        // Set the ticker message to latest event of the selected match
        const activeEvents = updated.find(m => m.id === selectedMatch.id)?.events || [];
        if (activeEvents.length > 0) {
          setTickerMessage(`[SYNC OK] LATEST COMMENTARY: ${activeEvents[activeEvents.length - 1].toUpperCase()}`);
        }

        return updated;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [selectedMatch.id]);

  // 2. Automated comment generation to make the stream feel active and realistic
  useEffect(() => {
    const commentsList = [
      "OMG what a play!!!",
      "Are you seeing this guys??",
      "Is that Cole Palmer on fire?",
      "Phenomenal streaming quality, zero buffer",
      "Hunters are definitely winning the tournament.",
      "Ref is literally blind, that was a clear penalty!",
      "Lakers defensive rotations are slow tonight",
      "Insane lagless decentralized connection",
      "Stream is absolute fire 🔥🔥🔥",
      "Wait, who is streaming this? This is awesome",
      "Goal of the season right there!"
    ];

    const namesList = ["NodeAlpha", "ShadowHex", "GridSentinel", "BinaryBoss", "HyperCore", "VibeNode", "CipherPunk"];

    const interval = setInterval(() => {
      const randomComment = commentsList[Math.floor(Math.random() * commentsList.length)];
      const randomName = namesList[Math.floor(Math.random() * namesList.length)];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setChatMessages(prev => [
        ...prev,
        { id: Math.random().toString(), senderName: randomName, text: randomComment, time: timeStr }
      ].slice(-25)); // Keep last 25 comments
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Sync mute state on video tag
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handlePlayPause = () => {
    playClickSound();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => console.warn(err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleToggleMute = () => {
    playClickSound();
    setIsMuted(!isMuted);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    playClickSound();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        senderName: profile?.displayName || 'Peer Node',
        text: chatMessage.trim(),
        time: timeStr
      }
    ]);

    setChatMessage('');
  };

  // User-broadcast live stream launcher
  const handleDeployBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !customVideoUrl.trim()) {
      showToast('VALIDATION ERROR', 'Please complete title and streaming URL.', 'error');
      return;
    }

    playClickSound();
    showToast('INITIALIZING...', 'Provisioning broadcast tunnel keys...', 'loading');

    try {
      const newMatchId = 'custom-' + Date.now();
      const newStream: LiveMatch = {
        id: newMatchId,
        title: customTitle.trim(),
        category: customCategory,
        teamA: customTeamA.trim() || 'Node A',
        teamB: customTeamB.trim() || 'Node B',
        scoreA: 0,
        scoreB: 0,
        minute: 1,
        status: 'live',
        events: [`Broadcast started live by ${profile?.displayName || 'Peer Node'}!`],
        videoUrl: customVideoUrl.trim(),
        streamerName: profile?.displayName || 'Peer Node',
        viewerCount: 1
      };

      // Add to local matches list
      setMatches(prev => [newStream, ...prev]);
      setSelectedMatch(newStream);

      // Save a feed post about it in Firestore so friends can click it and join!
      const postId = doc(collection(db, 'posts')).id;
      await setDoc(doc(db, 'posts', postId), {
        id: postId,
        authorId: profile?.uid || 'anonymous',
        authorName: profile?.displayName || 'Peer Node',
        authorPhoto: profile?.photoURL || 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=streamer',
        content: `🚨 BOLD BROADCAST LIVE: Join my live stream arena! Category: ${customCategory.toUpperCase()}. "${customTitle.trim()}"`,
        videoUrl: customVideoUrl.trim(),
        mediaType: 'video',
        likesCount: 0,
        isLiveStream: true,
        liveMatchId: newMatchId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      showToast('BROADCAST ONLINE ✓', 'Stream is successfully deployed and visible on global feeds!', 'success');
      setIsBroadcasting(false);
      setCustomTitle('');
      setCustomTeamA('');
      setCustomTeamB('');
      setCustomVideoUrl('');
    } catch (err: any) {
      console.error(err);
      showToast('DEPLOY FAILURE', err.message || 'Could not launch broadcast.', 'error');
    }
  };

  return (
    <div className="space-y-4 font-mono">
      {/* 1. Scrolling Match Event ticker banner */}
      <div className="bg-black/80 border border-zinc-900 px-4 py-2 flex items-center justify-between text-[8px] tracking-wider select-none shrink-0 overflow-hidden text-[var(--neon-green)] font-black">
        <div className="flex items-center gap-1.5 whitespace-nowrap animate-pulse shrink-0">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
          <span>LIVE STADIUM TUNNEL SYNCHRONIZED</span>
        </div>
        <div className="flex-1 overflow-hidden mx-4">
          <p className="text-[7.5px] truncate uppercase animate-pulse">
            {tickerMessage}
          </p>
        </div>
        <span className="text-zinc-600 font-bold shrink-0">API VERSION 1.25 // SECURE</span>
      </div>

      {/* 2. Main Arena split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Side: Video streaming block (7 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Embedded Streaming Player Container */}
          <div className="relative rounded-2xl overflow-hidden border border-zinc-900 bg-black aspect-video shadow-2xl group">
            
            {/* The Live Video frame */}
            {selectedMatch.videoUrl.includes('youtube.com') || selectedMatch.videoUrl.includes('youtu.be') ? (
              <iframe
                src={`https://www.youtube.com/embed/${
                  selectedMatch.videoUrl.includes('youtu.be/') 
                    ? selectedMatch.videoUrl.split('youtu.be/')[1]?.split('?')[0] 
                    : selectedMatch.videoUrl.split('v=')[1]?.split('&')[0]
                }?autoplay=1&mute=${isMuted ? '1' : '0'}&controls=0`}
                className="w-full h-full pointer-events-none"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Live Stream Frame"
              />
            ) : (
              <video
                ref={videoRef}
                src={selectedMatch.videoUrl}
                autoPlay={isPlaying}
                loop
                muted={isMuted}
                playsInline
                className="w-full h-full object-cover"
              />
            )}

            {/* LIVE PULSING WATERMARK OVERLAY */}
            <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-[7.5px] tracking-wider px-2 py-0.5 rounded-none flex items-center gap-1.5 select-none shadow-md z-10">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
              <span>LIVE BROADCAST</span>
            </div>

            {/* VIEWER COUNT */}
            <div className="absolute top-3 right-3 bg-black/75 text-zinc-300 font-bold text-[7.5px] px-2 py-0.5 rounded-none flex items-center gap-1 select-none border border-zinc-850 z-10">
              <Users className="w-2.5 h-2.5 text-[var(--neon-green)]" />
              <span>{selectedMatch.viewerCount} NODE PARTICIPANTS</span>
            </div>

            {/* PLAYER CONTROL HUB OVERLAY */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handlePlayPause}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                </button>
                <button
                  onClick={handleToggleMute}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>

              <div className="text-right">
                <p className="text-[9px] font-black text-white uppercase truncate max-w-[200px]">
                  {selectedMatch.title}
                </p>
                <p className="text-[7.5px] text-zinc-400 mt-0.5">
                  BROADCAST SIGNAL: {selectedMatch.streamerName.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* ACTIVE MATCH SCOREBOARD DETAILS CONTAINER */}
          <div className="bg-[#0b0b0c] border border-zinc-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Live Ticker display */}
            <div className="flex items-center space-x-3.5 w-full sm:w-auto">
              <div className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl text-center min-w-[70px] shrink-0">
                <span className="block text-[6.5px] text-zinc-500 font-bold uppercase mb-0.5">MINUTE</span>
                <span className="text-xs font-black text-[var(--neon-green)] tracking-wider">
                  {selectedMatch.category === 'gaming' ? 'ROUND' : `${selectedMatch.minute}'`}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-black text-white uppercase truncate">
                  {selectedMatch.title}
                </h3>
                <p className="text-[7.5px] text-zinc-500 uppercase mt-0.5">
                  Broadcaster: <span className="text-zinc-300 font-bold">{selectedMatch.streamerName}</span>
                </p>
              </div>
            </div>

            {/* Scoreboard display */}
            <div className="flex items-center space-x-6 bg-zinc-950 border border-zinc-900 p-3 rounded-2xl w-full sm:w-auto justify-center select-none">
              
              {/* Team A */}
              <div className="text-right">
                <span className="block text-[9.5px] font-black text-white uppercase tracking-tight">
                  {selectedMatch.teamA}
                </span>
              </div>

              {/* Numerical Tally */}
              <div className="flex items-center space-x-2.5 bg-black px-3.5 py-1.5 border border-zinc-900 rounded-xl font-black text-base text-[var(--neon-green)] tracking-wider shadow-inner">
                <span>{selectedMatch.scoreA}</span>
                <span className="text-zinc-600 animate-pulse">:</span>
                <span>{selectedMatch.scoreB}</span>
              </div>

              {/* Team B */}
              <div className="text-left">
                <span className="block text-[9.5px] font-black text-white uppercase tracking-tight">
                  {selectedMatch.teamB}
                </span>
              </div>
            </div>
          </div>

          {/* SIMULATED TIMELINE EVENTS TICKER */}
          <div className="bg-[#090909] border border-zinc-900 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-[8.5px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-red-500" />
                Live Commentary & Event Ticker
              </span>
              <span className="text-[7px] text-[var(--neon-green)] uppercase animate-pulse">
                ● Live updates active
              </span>
            </div>
            
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {selectedMatch.events.map((evt, idx) => (
                <div key={idx} className="text-[9.5px] text-zinc-350 leading-relaxed font-mono flex items-start gap-1.5 py-0.5 border-b border-zinc-900/40 last:border-0">
                  <span className="text-[var(--neon-green)] font-black text-[8px] shrink-0">▶</span>
                  <span className="normal-case">{evt}</span>
                </div>
              ))}
              {selectedMatch.events.length === 0 && (
                <p className="text-[9px] text-zinc-600 text-center py-4">No events logged yet for this feed.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Chat & Channels (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Active Live Broadcast Selector */}
          <div className="bg-[#0b0b0c] border border-zinc-900 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[8.5px] font-black text-zinc-400 uppercase tracking-wider">
                Active Channels
              </span>
              <button
                onClick={() => { playClickSound(); setIsBroadcasting(true); }}
                className="px-2 py-1 bg-[var(--neon-green)] text-black text-[7.5px] font-black uppercase rounded-none hover:bg-white flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-2.5 h-2.5" />
                Broadcast Live
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {matches.map((m) => {
                const isActive = m.id === selectedMatch.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      playClickSound();
                      setSelectedMatch(m);
                      setIsPlaying(true);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                      isActive 
                        ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-white font-bold' 
                        : 'bg-black border-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] px-1 py-0.5 bg-red-600 text-white font-black leading-none">LIVE</span>
                        <p className="text-[9.5px] uppercase font-black truncate text-white">{m.teamA} VS {m.teamB}</p>
                      </div>
                      <p className="text-[7.5px] text-zinc-500 uppercase truncate mt-0.5">{m.title}</p>
                    </div>

                    <div className="bg-[#121214] px-2 py-1 text-[8.5px] border border-zinc-850 font-black text-[var(--neon-green)] shrink-0">
                      {m.scoreA} - {m.scoreB}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Arena stream chat */}
          <div className="bg-[#0b0b0c] border border-zinc-900 rounded-2xl p-4 flex-1 flex flex-col min-h-[300px]">
            <div className="border-b border-zinc-900 pb-2 flex items-center justify-between shrink-0">
              <span className="text-[8.5px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-[var(--neon-green)]" />
                Live Stadium Chat
              </span>
              <span className="text-[7.5px] text-zinc-500 font-bold">TUNNEL SYNC: ACTIVE</span>
            </div>

            {/* Message streams */}
            <div className="flex-1 overflow-y-auto py-3.5 space-y-3 pr-1 max-h-72">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-[9.5px] leading-relaxed">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[var(--neon-green)] font-black text-[8px] hover:underline cursor-pointer">
                      {msg.senderName}
                    </span>
                    <span className="text-[7px] text-zinc-600 font-mono">({msg.time})</span>
                  </div>
                  <p className="text-zinc-350 font-sans mt-0.5 leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSendChatMessage} className="mt-auto pt-2 border-t border-zinc-900 flex gap-2 shrink-0">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Broadcast reaction into stadium..."
                className="flex-1 bg-black border border-zinc-900 rounded-xl px-3 py-2 text-[9.5px] font-mono text-white focus:outline-none focus:border-[var(--neon-green)] placeholder-zinc-600"
              />
              <button
                type="submit"
                className="p-2 bg-[var(--neon-green)] hover:bg-white text-black rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 3. BROADCAST DIALOG OVERLAY */}
      <AnimatePresence>
        {isBroadcasting && (
          <div data-overlay="true" className="fixed inset-0 bg-black/95 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-black">
                <span className="text-[9px] font-mono font-black uppercase text-[var(--neon-green)]">
                  ⚡ PROVISION NEW BROADCAST SIGNAL
                </span>
                <button
                  type="button"
                  onClick={() => setIsBroadcasting(false)}
                  className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleDeployBroadcast} className="p-5 overflow-y-auto space-y-4">
                
                <div className="space-y-1">
                  <span className="block text-[8px] text-zinc-500 uppercase font-black">Broadcast Title / Event Context:</span>
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="E.g., Chess Club Campus Semi-Finals Live"
                    className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[var(--neon-green)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="block text-[8px] text-zinc-500 uppercase font-black">Team A / Node A Name:</span>
                    <input
                      type="text"
                      value={customTeamA}
                      onChange={(e) => setCustomTeamA(e.target.value)}
                      placeholder="E.g., Host Player"
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[var(--neon-green)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[8px] text-zinc-500 uppercase font-black">Team B / Node B Name:</span>
                    <input
                      type="text"
                      value={customTeamB}
                      onChange={(e) => setCustomTeamB(e.target.value)}
                      placeholder="E.g., Guest Player"
                      className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[var(--neon-green)]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-[8px] text-zinc-500 uppercase font-black">Signal Stream Category:</span>
                  <select
                    value={customCategory}
                    onChange={(e: any) => setCustomCategory(e.target.value)}
                    className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[var(--neon-green)] uppercase"
                  >
                    <option value="sports">⚽ Live Sports Match</option>
                    <option value="gaming">🎮 Live Gaming Stream</option>
                    <option value="news">📰 Live Campus News</option>
                    <option value="entertainment">🎬 Live Entertainment / Chill</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="block text-[8px] text-zinc-500 uppercase font-black">Video / Stream Link (MP4/Youtube/Twitch):</span>
                  <input
                    type="url"
                    required
                    value={customVideoUrl}
                    onChange={(e) => setCustomVideoUrl(e.target.value)}
                    placeholder="E.g., https://assets.mixkit.co/... .mp4 or Youtube link"
                    className="w-full bg-black border border-zinc-900 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-[var(--neon-green)]"
                  />
                  <p className="text-[7.5px] text-zinc-500 uppercase">
                    Make sure the direct URL is an MP4/WebM file, or standard YouTube link for proper frame embedding.
                  </p>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBroadcasting(false)}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-mono text-xs uppercase font-black rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[var(--neon-green)] hover:bg-white text-black font-mono text-xs uppercase font-black rounded-xl transition cursor-pointer"
                  >
                    [ DEPLOY BROADCAST ]
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
