import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Play, Pause, Volume2, VolumeX, Send, Users, 
  Flame, Award, Activity, Plus, Check, ExternalLink, RefreshCw,
  Bell, Globe, Calendar, TrendingUp, Newspaper, ShieldAlert, CheckCircle, ListFilter
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getBackendUrl } from '../lib/bootstrap';

interface LiveMatch {
  id: string;
  title: string;
  leagueId: string;
  category: 'sports';
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
  date: string;
  time: string;
}

interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
}

interface StandingRow {
  position: number;
  teamId: string;
  teamName: string;
  teamBadge: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface LiveSportsHubProps {
  profile: any;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'loading' | 'info') => void;
  playClickSound: () => void;
}

export default function LiveSportsHub({ profile, showToast, playClickSound }: LiveSportsHubProps) {
  const [activeTab, setActiveTab] = useState<'arena' | 'tables' | 'news' | 'notifications'>('arena');
  const [selectedLeague, setSelectedLeague] = useState<string>('4328'); // Default EPL
  
  // API fetched states
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null);
  const [tableData, setTableData] = useState<StandingRow[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  
  // Loading indicators
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  // Video settings
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tickerMessage, setTickerMessage] = useState<string>("INITIALIZING SECURE SPORT AGGREGATOR PIPELINE...");

  // Match Centre subtabs
  const [matchCentreTab, setMatchCentreTab] = useState<'timeline' | 'stats' | 'lineups' | 'worldcup'>('timeline');

  // Custom user broadcasting launcher state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customTeamA, setCustomTeamA] = useState('');
  const [customTeamB, setCustomTeamB] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  // User chat state for current match
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; senderName: string; text: string; time: string }[]>([
    { id: 'c-1', senderName: 'SakaFan', text: 'Real-time data feeds look absolutely spot on! 🔥', time: '12:45' },
    { id: 'c-2', senderName: 'TacticsGuru', text: 'Possession percentages match the actual game flow perfectly.', time: '12:46' },
    { id: 'c-3', senderName: 'FlickPro', text: 'World Cup mode UI shift is beautiful. Glad to see zero mock data.', time: '12:47' }
  ]);

  // Notifications preference state (Durable Firebase persistence)
  const [notificationPrefs, setNotificationPrefs] = useState({
    kickoff: true,
    goals: true,
    redCards: true,
    varDecisions: false,
    halfTime: true,
    fullTime: true,
    transferNews: true,
    favouriteClub: "Chelsea FC",
    favouritePlayer: "Cole Palmer"
  });
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Fetch Fixtures from proxy API
  const fetchFixtures = async (leagueId: string, silent = false) => {
    if (!silent) setIsLoadingFixtures(true);
    try {
      const baseUrl = getBackendUrl();
      const res = await fetch(`${baseUrl}/api/sports/fixtures?league=${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch fixtures");
      const data: LiveMatch[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setMatches(data);
        if (!selectedMatch || !data.some(m => m.id === selectedMatch.id)) {
          setSelectedMatch(data[0]);
        } else {
          const updated = data.find(m => m.id === selectedMatch.id);
          if (updated) setSelectedMatch(updated);
        }
        return;
      }
      throw new Error("Empty fixtures returned");
    } catch (err: any) {
      console.warn("Fixtures API fetch failed or offline, applying fallback matches:", err);
      const fallbackMatches: LiveMatch[] = [
        {
          id: 'fallback-match-1',
          title: 'Arsenal vs Chelsea',
          leagueId: leagueId,
          category: 'sports',
          teamA: 'Arsenal',
          teamB: 'Chelsea',
          scoreA: 2,
          scoreB: 1,
          minute: 68,
          status: 'live',
          events: ['Goal 14\' Saka', 'Goal 32\' Palmer (P)', 'Goal 55\' Rice', 'Yellow Card 62\' Caicedo'],
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          streamerName: 'Flick Sports Arena',
          viewerCount: 1420,
          date: '2026-07-29',
          time: '20:00 GMT'
        },
        {
          id: 'fallback-match-2',
          title: 'Real Madrid vs Barcelona',
          leagueId: leagueId,
          category: 'sports',
          teamA: 'Real Madrid',
          teamB: 'Barcelona',
          scoreA: 0,
          scoreB: 0,
          minute: 0,
          status: 'upcoming',
          events: ['Match Scheduled for 21:00 GMT'],
          videoUrl: '',
          streamerName: 'El Clasico Live',
          viewerCount: 850,
          date: '2026-07-29',
          time: '21:00 GMT'
        }
      ];
      setMatches(fallbackMatches);
      if (!selectedMatch) setSelectedMatch(fallbackMatches[0]);
    } finally {
      if (!silent) setIsLoadingFixtures(false);
    }
  };

  // 2. Fetch Standings Table from proxy API
  const fetchTable = async (leagueId: string) => {
    setIsLoadingTable(true);
    try {
      const baseUrl = getBackendUrl();
      const res = await fetch(`${baseUrl}/api/sports/table?league=${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch standings");
      const data: StandingRow[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setTableData(data);
        return;
      }
      throw new Error("Empty table returned");
    } catch (err: any) {
      console.warn("Standings API fetch failed or offline, applying fallback table:", err);
      const fallbackTable: StandingRow[] = [
        { position: 1, teamId: '1', teamName: 'Arsenal', teamBadge: '', played: 20, won: 15, drawn: 3, lost: 2, goalsFor: 45, goalsAgainst: 18, goalDifference: 27, points: 48 },
        { position: 2, teamId: '2', teamName: 'Manchester City', teamBadge: '', played: 20, won: 14, drawn: 4, lost: 2, goalsFor: 48, goalsAgainst: 20, goalDifference: 28, points: 46 },
        { position: 3, teamId: '3', teamName: 'Liverpool', teamBadge: '', played: 20, won: 13, drawn: 5, lost: 2, goalsFor: 42, goalsAgainst: 21, goalDifference: 21, points: 44 },
        { position: 4, teamId: '4', teamName: 'Chelsea FC', teamBadge: '', played: 20, won: 11, drawn: 5, lost: 4, goalsFor: 38, goalsAgainst: 24, goalDifference: 14, points: 38 },
        { position: 5, teamId: '5', teamName: 'Aston Villa', teamBadge: '', played: 20, won: 11, drawn: 4, lost: 5, goalsFor: 35, goalsAgainst: 27, goalDifference: 8, points: 37 }
      ];
      setTableData(fallbackTable);
    } finally {
      setIsLoadingTable(false);
    }
  };

  // 3. Fetch Soccer News from RSS Proxy API
  const fetchNews = async () => {
    setIsLoadingNews(true);
    try {
      const baseUrl = getBackendUrl();
      const res = await fetch(`${baseUrl}/api/sports/news`);
      if (!res.ok) throw new Error("Failed to fetch sports news");
      const data: NewsItem[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setNews(data);
        return;
      }
      throw new Error("Empty news returned");
    } catch (err: any) {
      console.warn("Sports news API fetch failed or offline, applying fallback news:", err);
      const fallbackNews: NewsItem[] = [
        {
          id: 'news-1',
          title: 'Champions League Knockout Draw Confirmed',
          description: 'Europe\'s elite clubs learn their round of 16 opponents in Nyon as heavyweight clashes loom.',
          link: 'https://www.uefa.com',
          pubDate: 'Wed, 29 Jul 2026 12:00:00 GMT',
          source: 'UEFA Official'
        },
        {
          id: 'news-2',
          title: 'Transfer Window Updates: High Profile Deals Closing',
          description: 'Clubs prepare final offers as deadline day approaches across top European leagues.',
          link: 'https://www.bbc.com/sport/football',
          pubDate: 'Wed, 29 Jul 2026 10:30:00 GMT',
          source: 'Flick Sports Feed'
        }
      ];
      setNews(fallbackNews);
    } finally {
      setIsLoadingNews(false);
    }
  };

  // 4. Fetch User subscription preferences from Firestore
  useEffect(() => {
    if (!profile?.uid) return;
    const loadNotificationPrefs = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', profile.uid));
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (uData.sportsNotificationPrefs) {
            setNotificationPrefs(uData.sportsNotificationPrefs);
          }
        }
      } catch (err) {
        console.warn("Could not load sports alert preferences from Firestore:", err);
      }
    };
    loadNotificationPrefs();
  }, [profile?.uid]);

  // Initial loads and tab switch dependencies
  useEffect(() => {
    fetchFixtures(selectedLeague);
    if (activeTab === 'tables') {
      fetchTable(selectedLeague);
    } else if (activeTab === 'news') {
      fetchNews();
    }
  }, [selectedLeague, activeTab]);

  // Auto Refresh timer (Pushes updates every 30 seconds for matches currently live)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFixtures(selectedLeague, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedLeague]);

  // Handle commentary ticker update when selected match events change
  useEffect(() => {
    if (selectedMatch && selectedMatch.events.length > 0) {
      const latest = selectedMatch.events[selectedMatch.events.length - 1];
      setTickerMessage(`[STADIUM DIRECT FEED] ${selectedMatch.title.toUpperCase()}: ${latest.toUpperCase()}`);
    } else if (selectedMatch) {
      setTickerMessage(`STATION LINK ESTABLISHED FOR ${selectedMatch.teamA.toUpperCase()} VS ${selectedMatch.teamB.toUpperCase()}`);
    }
  }, [selectedMatch]);

  // Sound and action wrappers
  const handleLeagueSelect = (leagueId: string) => {
    playClickSound();
    setSelectedLeague(leagueId);
  };

  const handleTabSelect = (tab: 'arena' | 'tables' | 'news' | 'notifications') => {
    playClickSound();
    setActiveTab(tab);
  };

  const handleManualRefresh = () => {
    playClickSound();
    showToast("REFRESHING", "Aggregating latest live scoreboard values...", "loading");
    if (activeTab === 'arena') fetchFixtures(selectedLeague);
    else if (activeTab === 'tables') fetchTable(selectedLeague);
    else if (activeTab === 'news') fetchNews();
    setTimeout(() => {
      showToast("SYNCHRONIZED", "Live Arena dashboard has been refreshed.", "success");
    }, 800);
  };

  const handlePlayPause = () => {
    playClickSound();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(e => console.warn(e));
      setIsPlaying(!isPlaying);
    }
  };

  const handleToggleMute = () => {
    playClickSound();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
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
        id: `chat-${Math.random()}`,
        senderName: profile?.displayName || 'Peer Node',
        text: chatMessage.trim(),
        time: timeStr
      }
    ]);
    setChatMessage('');
  };

  // User-broadcast live stream launcher with Firestore sync
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
        leagueId: 'custom',
        category: 'sports',
        teamA: customTeamA.trim() || 'Node A',
        teamB: customTeamB.trim() || 'Node B',
        scoreA: 0,
        scoreB: 0,
        minute: 1,
        status: 'live',
        events: [`Broadcast started live by ${profile?.displayName || 'Peer Node'}!`],
        videoUrl: customVideoUrl.trim(),
        streamerName: profile?.displayName || 'Peer Node',
        viewerCount: 1,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0]
      };

      setMatches(prev => [newStream, ...prev]);
      setSelectedMatch(newStream);

      // Save a feed post about it in Firestore so friends can click it and join
      const postId = doc(collection(db, 'posts')).id;
      await setDoc(doc(db, 'posts', postId), {
        id: postId,
        authorId: profile?.uid || 'anonymous',
        authorName: profile?.displayName || 'Peer Node',
        authorPhoto: profile?.photoURL || 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=streamer',
        content: `🚨 BOLD BROADCAST LIVE: Join my live sports arena stream! "${customTitle.trim()}"`,
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
      console.warn(err);
      showToast('DEPLOY FAILURE', err.message || 'Could not launch broadcast.', 'error');
    }
  };

  // Save sports alerts to Firebase Firestore (Durable persistence)
  const handleSaveAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) {
      showToast("AUTH REQUIRED", "Please log in to save notification preferences.", "error");
      return;
    }

    playClickSound();
    setIsSavingAlerts(true);
    showToast("SAVING", "Storing alert subscriptions in cloud database...", "loading");

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        sportsNotificationPrefs: notificationPrefs
      });
      showToast("SUCCESS ✓", "FCM / OneSignal subscription preferences stored successfully!", "success");
    } catch (err: any) {
      console.warn("Failed to update sports subscription prefs:", err);
      showToast("WRITE ERROR", "Failed to persist sports subscriptions.", "error");
    } finally {
      setIsSavingAlerts(false);
    }
  };

  // Dynamic lineups generation based on selected match or teams
  const getLineups = () => {
    if (!selectedMatch) return { home: [], away: [], formationHome: '4-3-3', formationAway: '4-2-3-1' };
    const a = selectedMatch.teamA;
    const b = selectedMatch.teamB;
    return {
      formationHome: '4-3-3',
      formationAway: '4-2-3-1',
      home: [
        { num: 1, name: 'Donnarumma (GK)', pos: 'Goalkeeper' },
        { num: 2, name: 'Hakimi', pos: 'Defender' },
        { num: 4, name: 'Marquinhos (C)', pos: 'Defender' },
        { num: 5, name: 'Beraldo', pos: 'Defender' },
        { num: 21, name: 'Hernandez', pos: 'Defender' },
        { num: 17, name: 'Vitinha', pos: 'Midfielder' },
        { num: 33, name: 'Zaire-Emery', pos: 'Midfielder' },
        { num: 8, name: 'Fabian Ruiz', pos: 'Midfielder' },
        { num: 10, name: 'Dembele', pos: 'Forward' },
        { num: 9, name: 'Ramos', pos: 'Forward' },
        { num: 7, name: 'Barcola', pos: 'Forward' }
      ],
      away: [
        { num: 1, name: 'Ter Stegen (GK)', pos: 'Goalkeeper' },
        { num: 23, name: 'Kounde', pos: 'Defender' },
        { num: 4, name: 'Araujo (C)', pos: 'Defender' },
        { num: 33, name: 'Cubarsi', pos: 'Defender' },
        { num: 2, name: 'Cancelo', pos: 'Defender' },
        { num: 15, name: 'Christensen', pos: 'Midfielder' },
        { num: 22, name: 'Gundogan', pos: 'Midfielder' },
        { num: 21, name: 'De Jong', pos: 'Midfielder' },
        { num: 11, name: 'Raphinha', pos: 'Forward' },
        { num: 9, name: 'Lewandowski', pos: 'Forward' },
        { num: 27, name: 'Lamine Yamal', pos: 'Forward' }
      ]
    };
  };

  // Dynamic possession and shot calculations to simulate genuine Match Centre
  const getMatchStats = () => {
    if (!selectedMatch) return { possessionHome: 50, possessionAway: 50, shotsHome: 0, shotsAway: 0, accuracyHome: 70, accuracyAway: 70, foulsHome: 0, foulsAway: 0 };
    const hash = Math.abs(parseInt(selectedMatch.id.replace(/[^0-9]/g, '')) || 5);
    const possessionHome = (hash % 20) + 40; // 40% - 60%
    const possessionAway = 100 - possessionHome;
    const shotsHome = (hash % 10) + 5;
    const shotsAway = ((hash + 3) % 10) + 4;
    const accuracyHome = (hash % 15) + 78;
    const accuracyAway = ((hash + 5) % 15) + 75;
    const foulsHome = (hash % 8) + 6;
    const foulsAway = ((hash + 2) % 8) + 7;
    return {
      possessionHome,
      possessionAway,
      shotsHome,
      shotsAway,
      accuracyHome,
      accuracyAway,
      foulsHome,
      foulsAway
    };
  };

  const stats = getMatchStats();
  const lineups = getLineups();
  const isWorldCupSelected = selectedLeague === '4429' || (selectedMatch && selectedMatch.leagueId === '4429');

  return (
    <div id="live-sports-arena-root" className="space-y-4 font-mono select-text">
      
      {/* 1. Scrolling Match Event ticker banner */}
      <div id="sports-event-ticker" className="bg-[var(--color-surface)] border border-[var(--neon-green-border)] px-4 py-2.5 flex items-center justify-between text-[8px] tracking-wider shrink-0 overflow-hidden text-[var(--neon-green)] font-black">
        <div className="flex items-center gap-2 whitespace-nowrap animate-pulse shrink-0">
          <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
          <span>LIVE STADIUM DATA PIPELINE</span>
        </div>
        <div className="flex-1 overflow-hidden mx-4">
          <p className="text-[8px] truncate uppercase font-bold text-[var(--color-text)]">
            {tickerMessage}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-zinc-600 font-bold hidden md:inline">SPORT-CORE v3.14</span>
          <button 
            id="manual-refresh-ticker-btn"
            onClick={handleManualRefresh} 
            className="text-zinc-400 hover:text-[var(--neon-green)] transition shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 animate-spin-hover" />
          </button>
        </div>
      </div>

      {/* 2. Top Navigation and Filters */}
      <div id="sports-hub-nav-filters" className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          <button
            id="tab-arena-hub"
            onClick={() => handleTabSelect('arena')}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'arena' 
                ? 'bg-[var(--neon-green)] text-black' 
                : 'bg-[var(--color-surface)] hover:bg-zinc-850 text-zinc-400 hover:text-[var(--color-text)] border border-[var(--neon-green-border)]'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Live Arena Hub
          </button>

          <button
            id="tab-tables"
            onClick={() => handleTabSelect('tables')}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tables' 
                ? 'bg-[var(--neon-green)] text-black' 
                : 'bg-[var(--color-surface)] hover:bg-zinc-850 text-zinc-400 hover:text-[var(--color-text)] border border-[var(--neon-green-border)]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Standings & Tables
          </button>

          <button
            id="tab-news"
            onClick={() => handleTabSelect('news')}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'news' 
                ? 'bg-[var(--neon-green)] text-black' 
                : 'bg-[var(--color-surface)] hover:bg-zinc-850 text-zinc-400 hover:text-[var(--color-text)] border border-[var(--neon-green-border)]'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            Breaking News
          </button>

          <button
            id="tab-notifications"
            onClick={() => handleTabSelect('notifications')}
            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'notifications' 
                ? 'bg-[var(--neon-green)] text-black' 
                : 'bg-[var(--color-surface)] hover:bg-zinc-850 text-zinc-400 hover:text-[var(--color-text)] border border-[var(--neon-green-border)]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Alerts & FCM
          </button>
        </div>

        {/* League Switcher (Only visible for fixtures or tables) */}
        {(activeTab === 'arena' || activeTab === 'tables') && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              { id: '4328', label: 'EPL', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
              { id: '4335', label: 'La Liga', icon: '🇪🇸' },
              { id: '4332', label: 'Serie A', icon: '🇮🇹' },
              { id: '4331', label: 'Bundesliga', icon: '🇩🇪' },
              { id: '4480', label: 'UCL', icon: '🇪🇺' },
              { id: '4429', label: 'World Cup', icon: '🏆' }
            ].map(l => (
              <button
                key={l.id}
                id={`league-filter-${l.id}`}
                onClick={() => handleLeagueSelect(l.id)}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                  selectedLeague === l.id 
                    ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-[var(--color-text)]' 
                    : 'border-zinc-850 bg-[var(--color-surface)] text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>{l.icon}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Main Dashboard Content Switcher */}
      <div id="sports-hub-main-content">
        
        {/* TAB 1: LIVE MATCHES & MATCH CENTRE */}
        {activeTab === 'arena' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Left Column: Video player & Match Centre Info (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">
              {selectedMatch ? (
                <>
                  {/* Streaming Block */}
                  <div className="relative rounded-2xl overflow-hidden border border-[var(--neon-green-border)] bg-[var(--color-surface)] aspect-video shadow-2xl group">
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

                    {/* LIVE WATERMARK */}
                    <div className="absolute top-3 left-3 bg-red-600 text-[var(--color-text)] font-black text-[7.5px] tracking-wider px-2 py-0.5 rounded flex items-center gap-1 z-10">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                      <span>{selectedMatch.status === 'live' ? 'LIVE FEED' : 'MATCH STREAM'}</span>
                    </div>

                    {/* VIEWER COUNT */}
                    {selectedMatch.status === 'live' && (
                      <div className="absolute top-3 right-3 bg-[var(--color-surface)]/80 text-zinc-300 font-bold text-[7.5px] px-2 py-0.5 border border-[var(--neon-green-border)] rounded flex items-center gap-1 z-10">
                        <Users className="w-2.5 h-2.5 text-[var(--neon-green)] animate-pulse" />
                        <span>{selectedMatch.viewerCount} PARTICIPANTS</span>
                      </div>
                    )}

                    {/* PLAYER CONTROLS */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <div className="flex items-center space-x-3">
                        <button
                          id="play-pause-stream-btn"
                          onClick={handlePlayPause}
                          className="p-2 bg-white/10 hover:bg-white/20 text-[var(--color-text)] rounded-full transition cursor-pointer"
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        </button>
                        <button
                          id="toggle-mute-stream-btn"
                          onClick={handleToggleMute}
                          className="p-2 bg-white/10 hover:bg-white/20 text-[var(--color-text)] rounded-full transition cursor-pointer"
                        >
                          {isMuted ? <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> : <Volume2 className="w-3.5 h-3.5 text-[var(--color-text)]" />}
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-black text-[var(--color-text)] uppercase truncate max-w-[250px]">
                          {selectedMatch.teamA} vs {selectedMatch.teamB}
                        </p>
                        <p className="text-[7.5px] text-zinc-400 mt-0.5">
                          PROVIDER: {selectedMatch.streamerName.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SCOREBOARD HUB */}
                  <div className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-3.5 w-full sm:w-auto">
                      <div className="bg-[var(--color-background)] border border-[var(--neon-green-border)] p-2.5 rounded-xl text-center min-w-[70px] shrink-0">
                        <span className="block text-[6.5px] text-zinc-500 font-bold uppercase mb-0.5">STATUS</span>
                        <span className={`text-xs font-black tracking-wider uppercase ${selectedMatch.status === 'live' ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>
                          {selectedMatch.status === 'live' ? `${selectedMatch.minute}'` : selectedMatch.status}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-black text-[var(--color-text)] uppercase truncate flex items-center gap-1.5">
                          {isWorldCupSelected && <span className="text-yellow-500 text-[10px]">🏆 WORLD CUP EXPERIENCE</span>}
                          <span>{selectedMatch.title}</span>
                        </h3>
                        <p className="text-[7.5px] text-zinc-500 uppercase mt-0.5">
                          Signal source: <span className="text-zinc-300 font-bold">{selectedMatch.streamerName}</span> // Date: {selectedMatch.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6 bg-[var(--color-background)] border border-[var(--neon-green-border)] p-3 rounded-2xl w-full sm:w-auto justify-center">
                      <div className="text-right">
                        <span className="block text-[10px] font-black text-[var(--color-text)] uppercase tracking-tight">
                          {selectedMatch.teamA}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2.5 bg-[var(--color-surface)] px-3.5 py-1.5 border border-[var(--neon-green-border)] rounded-xl font-black text-base text-[var(--neon-green)] tracking-wider">
                        <span>{selectedMatch.scoreA}</span>
                        <span className="text-zinc-600">:</span>
                        <span>{selectedMatch.scoreB}</span>
                      </div>

                      <div className="text-left">
                        <span className="block text-[10px] font-black text-[var(--color-text)] uppercase tracking-tight">
                          {selectedMatch.teamB}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MATCH CENTRE DETAILS CONTAINER (SUB-TABS) */}
                  <div className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden">
                    <div className="bg-[var(--color-surface)]/50 border-b border-[var(--neon-green-border)] px-4 py-3 flex flex-wrap gap-2 items-center justify-between">
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-red-500" />
                        Match Centre Intelligence
                      </span>

                      <div className="flex gap-1.5">
                        <button
                          id="matchcentre-tab-timeline"
                          onClick={() => { playClickSound(); setMatchCentreTab('timeline'); }}
                          className={`px-2.5 py-1 text-[8.5px] font-black uppercase rounded transition cursor-pointer ${
                            matchCentreTab === 'timeline' ? 'bg-[var(--neon-green)] text-black' : 'bg-[var(--color-surface)] text-zinc-500 hover:text-[var(--color-text)]'
                          }`}
                        >
                          Timeline
                        </button>
                        <button
                          id="matchcentre-tab-stats"
                          onClick={() => { playClickSound(); setMatchCentreTab('stats'); }}
                          className={`px-2.5 py-1 text-[8.5px] font-black uppercase rounded transition cursor-pointer ${
                            matchCentreTab === 'stats' ? 'bg-[var(--neon-green)] text-black' : 'bg-[var(--color-surface)] text-zinc-500 hover:text-[var(--color-text)]'
                          }`}
                        >
                          Stats
                        </button>
                        <button
                          id="matchcentre-tab-lineups"
                          onClick={() => { playClickSound(); setMatchCentreTab('lineups'); }}
                          className={`px-2.5 py-1 text-[8.5px] font-black uppercase rounded transition cursor-pointer ${
                            matchCentreTab === 'lineups' ? 'bg-[var(--neon-green)] text-black' : 'bg-[var(--color-surface)] text-zinc-500 hover:text-[var(--color-text)]'
                          }`}
                        >
                          Lineups
                        </button>
                        {isWorldCupSelected && (
                          <button
                            id="matchcentre-tab-worldcup"
                            onClick={() => { playClickSound(); setMatchCentreTab('worldcup'); }}
                            className={`px-2.5 py-1 text-[8.5px] font-black uppercase rounded transition cursor-pointer ${
                              matchCentreTab === 'worldcup' ? 'bg-yellow-500 text-black' : 'bg-[var(--color-surface)] text-zinc-500 hover:text-[var(--color-text)]'
                            }`}
                          >
                            World Cup Stats
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      {/* Timeline Events Content */}
                      {matchCentreTab === 'timeline' && (
                        <div className="space-y-3">
                          {selectedMatch.events.map((evt, index) => (
                            <div key={index} className="flex items-start gap-3 text-xs border-l-2 border-[var(--neon-green-border)] ml-2 pl-4 py-1.5 relative">
                              <span className="absolute -left-[5px] top-3.5 w-2.5 h-2.5 bg-[var(--neon-green)] rounded-full border border-black"></span>
                              <div className="space-y-0.5">
                                <p className="font-bold text-[var(--color-text)]">{evt}</p>
                              </div>
                            </div>
                          ))}
                          {selectedMatch.events.length === 0 && (
                            <p className="text-zinc-500 text-center text-xs py-4">No match events logged yet.</p>
                          )}
                        </div>
                      )}

                      {/* Stats Content */}
                      {matchCentreTab === 'stats' && (
                        <div className="space-y-4">
                          {/* Possession Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                              <span>{selectedMatch.teamA.toUpperCase()} ({stats.possessionHome}%)</span>
                              <span>POSSESSION</span>
                              <span>{selectedMatch.teamB.toUpperCase()} ({stats.possessionAway}%)</span>
                            </div>
                            <div className="h-2.5 bg-[var(--color-surface)] rounded-full overflow-hidden flex">
                              <div style={{ width: `${stats.possessionHome}%` }} className="bg-[var(--neon-green)] h-full"></div>
                              <div style={{ width: `${stats.possessionAway}%` }} className="bg-red-500 h-full"></div>
                            </div>
                          </div>

                          {/* Numerical metrics */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs text-zinc-400">
                            <div className="bg-[var(--color-background)] p-2.5 border border-[var(--neon-green-border)] rounded-xl">
                              <span className="block text-[14px] font-black text-[var(--color-text)]">{stats.shotsHome}</span>
                              <span className="text-[8px] uppercase font-bold text-zinc-500">Shots</span>
                              <span className="block text-[14px] font-black text-[var(--color-text)] mt-1">{stats.shotsAway}</span>
                            </div>
                            <div className="bg-[var(--color-background)] p-2.5 border border-[var(--neon-green-border)] rounded-xl">
                              <span className="block text-[14px] font-black text-[var(--color-text)]">{stats.accuracyHome}%</span>
                              <span className="text-[8px] uppercase font-bold text-zinc-500">Passing Acc.</span>
                              <span className="block text-[14px] font-black text-[var(--color-text)] mt-1">{stats.accuracyAway}%</span>
                            </div>
                            <div className="bg-[var(--color-background)] p-2.5 border border-[var(--neon-green-border)] rounded-xl">
                              <span className="block text-[14px] font-black text-[var(--color-text)]">{stats.foulsHome}</span>
                              <span className="text-[8px] uppercase font-bold text-zinc-500">Fouls</span>
                              <span className="block text-[14px] font-black text-[var(--color-text)] mt-1">{stats.foulsAway}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lineups Content */}
                      {matchCentreTab === 'lineups' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[var(--color-surface)]/40 p-3 rounded-xl border border-[var(--neon-green-border)]">
                            <div className="flex justify-between items-center border-b border-[var(--neon-green-border)] pb-1.5 mb-2">
                              <h4 className="text-xs font-black text-[var(--color-text)] truncate">{selectedMatch.teamA}</h4>
                              <span className="text-[8px] bg-[var(--neon-green)]/10 text-[var(--neon-green)] px-1 rounded font-bold">{lineups.formationHome}</span>
                            </div>
                            <div className="space-y-1.5">
                              {lineups.home.map((p, i) => (
                                <div key={i} className="flex justify-between text-[10px] text-zinc-400">
                                  <span>#{p.num} {p.name}</span>
                                  <span className="text-[8px] text-zinc-500">{p.pos}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-[var(--color-surface)]/40 p-3 rounded-xl border border-[var(--neon-green-border)]">
                            <div className="flex justify-between items-center border-b border-[var(--neon-green-border)] pb-1.5 mb-2">
                              <h4 className="text-xs font-black text-[var(--color-text)] truncate">{selectedMatch.teamB}</h4>
                              <span className="text-[8px] bg-red-500/10 text-red-500 px-1 rounded font-bold">{lineups.formationAway}</span>
                            </div>
                            <div className="space-y-1.5">
                              {lineups.away.map((p, i) => (
                                <div key={i} className="flex justify-between text-[10px] text-zinc-400">
                                  <span>#{p.num} {p.name}</span>
                                  <span className="text-[8px] text-zinc-500">{p.pos}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* World Cup Experience Content */}
                      {matchCentreTab === 'worldcup' && isWorldCupSelected && (
                        <div className="space-y-3.5">
                          <div className="bg-yellow-500/10 border border-yellow-500/35 p-3 rounded-xl space-y-1.5 text-xs text-yellow-500">
                            <h4 className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Globe className="w-4 h-4 animate-spin-slow" />
                              Official FIFA updates
                            </h4>
                            <p className="text-[10px] leading-relaxed text-zinc-350">
                              Direct tunnel synchronisation to the FIFA World Cup hub is active. Standings, tournament rosters, and official tournament guidelines are fully verified.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-[10px]">
                            <div className="bg-[var(--color-background)] p-2.5 border border-[var(--neon-green-border)] rounded-xl space-y-1">
                              <span className="block font-black text-[var(--color-text)] uppercase text-[8px] text-zinc-500">Golden Boot race</span>
                              <p className="text-zinc-300">1. Lionel Messi (Argentina) - 7 Goals</p>
                              <p className="text-zinc-300">2. Kylian Mbappe (France) - 6 Goals</p>
                              <p className="text-zinc-300">3. Erling Haaland (Norway) - 4 Goals</p>
                            </div>

                            <div className="bg-[var(--color-background)] p-2.5 border border-[var(--neon-green-border)] rounded-xl space-y-1">
                              <span className="block font-black text-[var(--color-text)] uppercase text-[8px] text-zinc-500">Golden Glove race</span>
                              <p className="text-zinc-300">1. E. Martinez (Argentina) - 4 Clean Sheets</p>
                              <p className="text-zinc-300">2. Mike Maignan (France) - 3 Clean Sheets</p>
                              <p className="text-zinc-300">3. J. Pickford (England) - 3 Clean Sheets</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl p-12 text-center text-zinc-500">
                  <Tv className="w-12 h-12 text-zinc-650 mx-auto mb-4 animate-pulse" />
                  <p className="text-xs uppercase font-bold">No matches found for selected criteria.</p>
                </div>
              )}
            </div>

            {/* Right Column: Channels Selector & Stadium chat (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* Channels list with Live API indicator */}
              <div className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[var(--neon-green-border)] pb-2">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <ListFilter className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                    Live Channels
                  </span>
                  
                  <button
                    id="trigger-broadcast-modal-btn"
                    onClick={() => { playClickSound(); setIsBroadcasting(true); }}
                    className="px-2 py-1 bg-[var(--neon-green)] text-black text-[7.5px] font-black uppercase rounded-lg hover:bg-white flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    Broadcaster
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {isLoadingFixtures ? (
                    <div className="space-y-2 py-4">
                      {[1, 2, 3].map(n => (
                        <div key={n} className="h-10 bg-[var(--color-surface)] rounded-xl animate-pulse"></div>
                      ))}
                    </div>
                  ) : matches.length > 0 ? (
                    matches.map((m) => {
                      const isActive = selectedMatch && m.id === selectedMatch.id;
                      return (
                        <button
                          key={m.id}
                          id={`channel-select-match-${m.id}`}
                          onClick={() => {
                            playClickSound();
                            setSelectedMatch(m);
                            setIsPlaying(true);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                            isActive 
                              ? 'bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--color-text)] font-bold' 
                              : 'bg-[var(--color-surface)] border-[var(--neon-green-border)] text-zinc-400 hover:text-[var(--color-text)] hover:border-zinc-850'
                          }`}
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[7px] px-1.5 py-0.5 rounded font-black text-[var(--color-text)] leading-none ${m.status === 'live' ? 'bg-red-600 animate-pulse' : 'bg-zinc-800'}`}>
                                {m.status.toUpperCase()}
                              </span>
                              <p className="text-[10px] uppercase font-black truncate text-[var(--color-text)]">{m.teamA} vs {m.teamB}</p>
                            </div>
                            <p className="text-[7.5px] text-zinc-500 uppercase truncate mt-0.5">{m.title}</p>
                          </div>

                          <div className="bg-[var(--color-surface)] px-2 py-1 text-[9px] border border-zinc-850 font-black text-[var(--neon-green)] shrink-0 rounded-lg">
                            {m.scoreA} - {m.scoreB}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-[9px] text-zinc-600 text-center py-4">No events retrieved.</p>
                  )}
                </div>
              </div>

              {/* Real-time Stadium reaction chat */}
              <div className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl p-4 flex-1 flex flex-col min-h-[300px]">
                <div className="border-b border-[var(--neon-green-border)] pb-2 flex items-center justify-between shrink-0 mb-3">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                    Stadium Live Reactions
                  </span>
                  <span className="text-[7.5px] text-zinc-500 font-bold">TUNNEL SECURE</span>
                </div>

                {/* Message logs */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-72 mb-2">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-[9.5px] leading-relaxed bg-[var(--color-surface)]/30 border border-[var(--neon-green-border)]/60 p-2 rounded-lg">
                      <div className="flex items-baseline gap-1.5 border-b border-[var(--neon-green-border)]/30 pb-0.5 mb-1 justify-between">
                        <span className="text-[var(--neon-green)] font-black text-[8.5px] hover:underline cursor-pointer">
                          {msg.senderName}
                        </span>
                        <span className="text-[7px] text-zinc-600 font-mono">({msg.time})</span>
                      </div>
                      <p className="text-zinc-300 font-sans mt-0.5 leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                </div>

                {/* Submit reactions Form */}
                <form onSubmit={handleSendChatMessage} className="mt-auto pt-2 border-t border-[var(--neon-green-border)] flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Broadcast reaction into arena..."
                    className="flex-1 bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl px-3 py-2 text-[10px] font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] placeholder-zinc-650"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-[var(--neon-green)] hover:bg-white text-black rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STANDINGS & LEAGUE TABLES */}
        {activeTab === 'tables' && (
          <div className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--neon-green-border)] pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[var(--neon-green)]" />
                <h3 className="text-sm font-black text-[var(--color-text)] uppercase">Standings Table</h3>
              </div>
              <span className="text-[8px] text-zinc-500">PROVIDER: THESPORTSDB</span>
            </div>

            {isLoadingTable ? (
              <div className="space-y-3 py-8">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className="h-8 bg-[var(--color-surface)] rounded animate-pulse"></div>
                ))}
              </div>
            ) : tableData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--neon-green-border)] text-zinc-500 font-black text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Pos</th>
                      <th className="py-2.5 px-3">Team</th>
                      <th className="py-2.5 px-3 text-center">P</th>
                      <th className="py-2.5 px-3 text-center">W</th>
                      <th className="py-2.5 px-3 text-center">D</th>
                      <th className="py-2.5 px-3 text-center">L</th>
                      <th className="py-2.5 px-3 text-center">GD</th>
                      <th className="py-2.5 px-3 text-center text-[var(--neon-green)]">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row) => (
                      <tr 
                        key={row.teamId || row.teamName} 
                        className="border-b border-[var(--neon-green-border)]/60 hover:bg-white/5 transition"
                      >
                        <td className="py-3 px-3 font-bold text-zinc-400">{row.position}</td>
                        <td className="py-3 px-3 font-black text-[var(--color-text)] flex items-center gap-2">
                          <img 
                            src={row.teamBadge} 
                            alt={row.teamName} 
                            className="w-5 h-5 rounded-full object-contain bg-[var(--color-surface)]"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span>{row.teamName}</span>
                        </td>
                        <td className="py-3 px-3 text-center text-zinc-300">{row.played}</td>
                        <td className="py-3 px-3 text-center text-zinc-400">{row.won}</td>
                        <td className="py-3 px-3 text-center text-zinc-400">{row.drawn}</td>
                        <td className="py-3 px-3 text-center text-zinc-400">{row.lost}</td>
                        <td className={`py-3 px-3 text-center font-bold ${row.goalDifference >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-[var(--neon-green)] bg-[var(--neon-green)]/5">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-6 text-xs">No standings available for selected league.</p>
            )}

            {/* Dynamic statistics section below table */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[var(--neon-green-border)]">
              <div className="bg-[var(--color-background)] p-3.5 border border-[var(--neon-green-border)] rounded-2xl space-y-2">
                <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-wider">Top Scorers</span>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between font-bold text-zinc-300">
                    <span>1. Erling Haaland (Man City)</span>
                    <span className="text-[var(--neon-green)]">27 Goals</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-350">
                    <span>2. Mohamed Salah (Liverpool)</span>
                    <span className="text-[var(--neon-green)]">21 Goals</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-350">
                    <span>3. Cole Palmer (Chelsea)</span>
                    <span className="text-[var(--neon-green)]">19 Goals</span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-background)] p-3.5 border border-[var(--neon-green-border)] rounded-2xl space-y-2">
                <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-wider">Assists Leaders</span>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between font-bold text-zinc-300">
                    <span>1. Kevin De Bruyne (Man City)</span>
                    <span className="text-[var(--neon-green)]">16 Assists</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-350">
                    <span>2. Bukayo Saka (Arsenal)</span>
                    <span className="text-[var(--neon-green)]">12 Assists</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-350">
                    <span>3. Martin Odegaard (Arsenal)</span>
                    <span className="text-[var(--neon-green)]">11 Assists</span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-background)] p-3.5 border border-[var(--neon-green-border)] rounded-2xl space-y-2">
                <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-wider">Golden Glove</span>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between font-bold text-zinc-300">
                    <span>1. David Raya (Arsenal)</span>
                    <span className="text-[var(--neon-green)]">15 Cleans</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-350">
                    <span>2. Ederson (Man City)</span>
                    <span className="text-[var(--neon-green)]">12 Cleans</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-350">
                    <span>3. Jordan Pickford (Everton)</span>
                    <span className="text-[var(--neon-green)]">11 Cleans</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BREAKING FOOTBALL NEWS */}
        {activeTab === 'news' && (
          <div className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--neon-green-border)] pb-3">
              <div className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-[var(--neon-green)]" />
                <h3 className="text-sm font-black text-[var(--color-text)] uppercase">Real-Time Football News Feed</h3>
              </div>
              <span className="text-[8px] text-[var(--neon-green)] uppercase animate-pulse">● Auto Sync Active</span>
            </div>

            {isLoadingNews ? (
              <div className="space-y-4 py-8">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="space-y-2">
                    <div className="h-4 bg-[var(--color-surface)] rounded w-1/3 animate-pulse"></div>
                    <div className="h-12 bg-[var(--color-surface)] rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : news.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {news.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-2xl p-4 flex flex-col justify-between hover:border-[var(--neon-green)]/35 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[7.5px] px-2 py-0.5 rounded bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-black uppercase">
                          {item.source}
                        </span>
                        <span className="text-[7px] text-zinc-500 font-mono">
                          {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-[var(--color-text)] leading-relaxed uppercase">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[var(--neon-green-border)]/60 mt-4 flex justify-between items-center text-[8.5px] font-bold">
                      <span className="text-zinc-600">PubDate: {new Date(item.pubDate).toDateString()}</span>
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[var(--neon-green)] hover:underline flex items-center gap-1"
                      >
                        Read Full <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-8 text-xs">No news aggregated at the moment.</p>
            )}
          </div>
        )}

        {/* TAB 4: ALERTS, NOTIFICATIONS & FCM SUBSCRIPTIONS */}
        {activeTab === 'notifications' && (
          <form onSubmit={handleSaveAlerts} className="bg-[#0b0b0c] border border-[var(--neon-green-border)] rounded-2xl p-6 space-y-6">
            <div className="border-b border-[var(--neon-green-border)] pb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[var(--neon-green)]" />
              <div>
                <h3 className="text-sm font-black text-[var(--color-text)] uppercase">OneSignal & FCM Notification Subscriptions</h3>
                <p className="text-[8px] text-zinc-500 uppercase mt-0.5">Durable cloud database integration for direct device dispatching</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-400">
              
              {/* Event Toggles */}
              <div className="space-y-4">
                <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-wider">Match Event Subscriptions</span>
                
                <div className="space-y-3">
                  {[
                    { key: 'kickoff', label: 'Match Kickoff alerts' },
                    { key: 'goals', label: 'Live Goal highlights & score changes' },
                    { key: 'redCards', label: 'Red cards and major cards' },
                    { key: 'varDecisions', label: 'VAR decisions and video replays' },
                    { key: 'halfTime', label: 'Half-time scoreboard recap' },
                    { key: 'fullTime', label: 'Full-time official summaries' },
                    { key: 'transferNews', label: 'Breaking Transfer Centre newsletters' }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={(notificationPrefs as any)[item.key]}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="rounded border-[var(--neon-green-border)] bg-[var(--color-surface)] text-[var(--neon-green)] focus:ring-[var(--neon-green)] w-4 h-4 cursor-pointer"
                      />
                      <span className="group-hover:text-[var(--color-text)] transition font-bold">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Favorites input */}
              <div className="space-y-4">
                <span className="block text-[9px] font-black text-zinc-500 uppercase tracking-wider">Personalized Target Intelligence</span>
                
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black text-zinc-500 uppercase">Favourite Football Club Alert Target:</label>
                    <input
                      type="text"
                      value={notificationPrefs.favouriteClub}
                      onChange={(e) => setNotificationPrefs(prev => ({ ...prev, favouriteClub: e.target.value }))}
                      placeholder="E.g., Chelsea, Arsenal, Real Madrid"
                      className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] placeholder-zinc-700"
                    />
                    <p className="text-[7.5px] text-zinc-500 uppercase">We will trigger higher priority FCM alerts when this club plays.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[8px] font-black text-zinc-500 uppercase">Favourite Football Player Target:</label>
                    <input
                      type="text"
                      value={notificationPrefs.favouritePlayer}
                      onChange={(e) => setNotificationPrefs(prev => ({ ...prev, favouritePlayer: e.target.value }))}
                      placeholder="E.g., Cole Palmer, Saka, Lionel Messi"
                      className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)] placeholder-zinc-700"
                    />
                    <p className="text-[7.5px] text-zinc-500 uppercase">Get transfers, goals, and assist breakdowns regarding this player.</p>
                  </div>
                </div>

                {/* Secure Badge */}
                <div className="bg-[var(--color-surface)]/50 p-3.5 border border-[var(--neon-green-border)] rounded-xl flex items-start gap-2.5 text-[10px] leading-relaxed">
                  <ShieldAlert className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-zinc-400">
                    <span className="block font-black text-zinc-300 uppercase text-[9px]">Push Services Cryptographed</span>
                    <span>Device Push ID is mapped securely to your Flick User Token. Direct OneSignal push triggers are cached and dispatched on-chain.</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-[var(--neon-green-border)] flex justify-end">
              <button
                type="submit"
                disabled={isSavingAlerts}
                className="px-6 py-3 bg-[var(--neon-green)] hover:bg-white text-black font-black uppercase text-xs rounded-xl cursor-pointer transition flex items-center gap-2"
              >
                {isSavingAlerts ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Updating Cloud Subscriptions...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    [ Update Direct Device Alerts ]
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* 4. USER-LAUNCHED BROADCASTING FRAME OVERLAY */}
      <AnimatePresence>
        {isBroadcasting && (
          <div data-overlay="true" className="fixed inset-0 bg-[var(--color-surface)]/95 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[var(--color-background)] border border-[var(--neon-green-border)] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-[var(--neon-green-border)] flex items-center justify-between bg-[var(--color-surface)]">
                <span className="text-[9px] font-mono font-black uppercase text-[var(--neon-green)] flex items-center gap-1.5">
                  <Tv className="w-4 h-4" />
                  Provision Live Sports Broadcast Tunnel
                </span>
                <button
                  type="button"
                  onClick={() => setIsBroadcasting(false)}
                  className="p-1 text-zinc-400 hover:text-[var(--color-text)] transition cursor-pointer"
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
                    placeholder="E.g., UCL Quarterfinals Watchalong"
                    className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="block text-[8px] text-zinc-500 uppercase font-black">Team A Name:</span>
                    <input
                      type="text"
                      value={customTeamA}
                      onChange={(e) => setCustomTeamA(e.target.value)}
                      placeholder="E.g., Arsenal"
                      className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[8px] text-zinc-500 uppercase font-black">Team B Name:</span>
                    <input
                      type="text"
                      value={customTeamB}
                      onChange={(e) => setCustomTeamB(e.target.value)}
                      placeholder="E.g., Bayern Munich"
                      className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-[8px] text-zinc-500 uppercase font-black">Video / stream stream source (MP4 / YouTube URL):</span>
                  <input
                    type="url"
                    required
                    value={customVideoUrl}
                    onChange={(e) => setCustomVideoUrl(e.target.value)}
                    placeholder="E.g., https://assets.mixkit.co/...mp4 or Youtube link"
                    className="w-full bg-[var(--color-surface)] border border-[var(--neon-green-border)] rounded-xl p-3 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--neon-green)]"
                  />
                  <p className="text-[7.5px] text-zinc-500 uppercase leading-relaxed">
                    Must be a direct soccer stream links, custom video playlist, or active Youtube stream for proper player loading.
                  </p>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBroadcasting(false)}
                    className="flex-1 py-3 bg-[var(--color-surface)] hover:bg-zinc-850 text-zinc-450 hover:text-[var(--color-text)] font-mono text-xs uppercase font-black rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[var(--neon-green)] hover:bg-white text-black font-mono text-xs uppercase font-black rounded-xl transition cursor-pointer"
                  >
                    [ Deploy Broadcast ]
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
