import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Shield, ArrowRight, RefreshCw, Radio, Tag, Clock, Globe, Filter, ExternalLink, Columns, BookOpen, AlertTriangle, Send, ShieldCheck } from 'lucide-react';
import { playGlitchClickSound, playLikeSound } from '../lib/sounds';
import { showPushNotification } from '../lib/pushNotifications';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

export interface NewsItem {
  id: string;
  category: 'CYBERSECURITY' | 'CRYPTOGRAPHY' | 'NETWORK' | 'AI SYSTEMS';
  source: string;
  timeSlot: string;
  title: string;
  summary: string;
  body: string;
  impactLevel: 'CRITICAL' | 'MEDIUM' | 'SECURE';
  url: string;
}

// Fallback high-entropy baseline chronicles
const BASELINE_CHRONICLES: NewsItem[] = [
  {
    id: "fara-001",
    category: "CRYPTOGRAPHY",
    source: "Decentralized Key Node",
    timeSlot: "3 mins ago",
    title: "Post-Quantum Cryptography (PQC) standards finalized by NIST experts",
    summary: "NIST has released the first set of finalized standards for quantum-resistant ciphers. System operators are advised to migrate RSA-2048 layers.",
    body: "The National Institute of Standards and Technology (NIST) has published its finalized specifications for three post-quantum cryptographic algorithms. This marks a historic transition in international security. Fara Flick's client-side RSA key generation leverages high-entropy cryptographic seeds which can adapt.",
    impactLevel: "CRITICAL",
    url: "https://www.nist.gov/news-events/news/2024/08/nist-releases-first-three-finalized-post-quantum-cryptography-standards"
  },
  {
    id: "fara-002",
    category: "CYBERSECURITY",
    source: "Threat Intelligence Stream",
    timeSlot: "14 mins ago",
    title: "Zero-Click browser vulnerabilities bypassed using canvas memory siphons",
    summary: "A fresh zero-day exploit targeting Chromium-based render engines has been isolated. Users are urged to force high sandboxing levels.",
    body: "Researchers have identified a sophisticated hardware-accelerated rendering bug that leaks browser cache blocks. Fara Flick remains unaffected due to absolute zero-knowledge transient local structures.",
    impactLevel: "CRITICAL",
    url: "https://www.cisa.gov/resources-tools/programs/known-exploited-vulnerabilities-catalog"
  }
];

export default function SecureNewsFlow() {
  const [items, setItems] = useState<NewsItem[]>(BASELINE_CHRONICLES);
  const [activeDossier, setActiveDossier] = useState<NewsItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [tickerOffset, setTickerOffset] = useState(0);
  const [readerMode, setReaderMode] = useState<'normal' | 'plaintext'>('plaintext');

  // Custom News Broadcaster composer states
  const [showPublisher, setShowPublisher] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsCategory, setNewsCategory] = useState<'CYBERSECURITY' | 'CRYPTOGRAPHY' | 'NETWORK' | 'AI SYSTEMS'>('CYBERSECURITY');
  const [newsImpact, setNewsImpact] = useState<'CRITICAL' | 'MEDIUM' | 'SECURE'>('CRITICAL');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsBody.trim()) return;
    setIsPublishing(true);
    playGlitchClickSound();

    try {
      await addDoc(collection(db, 'news'), {
        title: newsTitle,
        category: newsCategory,
        impactLevel: newsImpact,
        summary: newsSummary || newsBody.substring(0, 150) + '...',
        body: newsBody,
        source: 'Global Wire Node',
        url: '',
        createdAt: serverTimestamp()
      });

      // Clear fields
      setNewsTitle('');
      setNewsSummary('');
      setNewsBody('');
      setShowPublisher(false);
      playLikeSound();
    } catch (err) {
      console.error('Failed to publish custom news bullet:', err);
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Reference for already notified IDs to prevent repetitive popups
  const seenNewsIdsRef = useRef<Set<string>>(new Set(["fara-001", "fara-002"]));
  const isFirstLoadRef = useRef(true);

  // Dynamic live Hacker News API parser
  const fetchLiveNews = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch top tech/cyber security stories
      const listRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const ids: number[] = await listRes.json();
      
      // Take first 15 stories to keep loading speed blazing fast
      const subsetIds = ids.slice(0, 15);
      
      const parsedStories: NewsItem[] = [];
      
      // 2. Fetch details for each item asynchronously in parallel
      await Promise.all(
        subsetIds.map(async (storyId) => {
          try {
            const detailRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
            const story = await detailRes.json();
            
            if (!story || !story.title) return;
            
            // Map title properties to categories
            const titleLower = story.title.toLowerCase();
            let category: 'CYBERSECURITY' | 'CRYPTOGRAPHY' | 'NETWORK' | 'AI SYSTEMS' = 'AI SYSTEMS';
            let impactLevel: 'CRITICAL' | 'MEDIUM' | 'SECURE' = 'SECURE';
            
            if (titleLower.includes('hack') || titleLower.includes('vuln') || titleLower.includes('exploit') || titleLower.includes('security') || titleLower.includes('cve') || titleLower.includes('attack') || titleLower.includes('leak') || titleLower.includes('bypass')) {
              category = 'CYBERSECURITY';
              impactLevel = 'CRITICAL';
            } else if (titleLower.includes('crypto') || titleLower.includes('encrypt') || titleLower.includes('key') || titleLower.includes('hash') || titleLower.includes('cipher') || titleLower.includes('signature') || titleLower.includes('rsa') || titleLower.includes('quantum')) {
              category = 'CRYPTOGRAPHY';
              impactLevel = 'CRITICAL';
            } else if (titleLower.includes('network') || titleLower.includes('dns') || titleLower.includes('bgp') || titleLower.includes('route') || titleLower.includes('packet') || titleLower.includes('port') || titleLower.includes('proxy') || titleLower.includes('load') || titleLower.includes('tcp') || titleLower.includes('http')) {
              category = 'NETWORK';
              impactLevel = 'MEDIUM';
            }

            const storyUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
            const parsedTime = story.time ? `${Math.max(1, Math.floor((Date.now() / 1000 - story.time) / 60))}m ago` : "Live Now";
            
            const storySummary = `${story.title}. [Live signal captured from nodes of ${story.by || 'anonymous'}]`;

            const item: NewsItem = {
              id: story.id.toString(),
              category,
              source: story.by ? `HN / @${story.by}` : "Encrypted Gateway",
              timeSlot: parsedTime,
              title: story.title,
              summary: storySummary,
              body: story.text ? story.text.replace(/<[^>]*>/g, '') : "This intelligence bulletin was routed live to Fara Flick's network coordinates. Press the 'Secure In-App Browser' trigger below to inspect the target payload frame synchronously in the liquid glass reader mode overlay without leaving the terminal.",
              impactLevel,
              url: storyUrl
            };
            
            parsedStories.push(item);
          } catch (e) {
            console.warn("Story fetching thread warning:", e);
          }
        })
      );
      
      if (parsedStories.length > 0) {
        // Sort parsed stories so critical impact levels show first
        parsedStories.sort((a, b) => {
          const weights = { "CRITICAL": 3, "MEDIUM": 2, "SECURE": 1 };
          return weights[b.impactLevel] - weights[a.impactLevel];
        });

        setItems(parsedStories);

        // Check for new stories to issue Native Push Notifications!
        parsedStories.forEach((story) => {
          if (!seenNewsIdsRef.current.has(story.id)) {
            seenNewsIdsRef.current.add(story.id);
            
            // Only trigger push if it's NOT the very first mount fetch (to prevent baseline startup spam)
            if (!isFirstLoadRef.current) {
              showPushNotification(
                `⚡ FARA FLICK BREAKING: ${story.category}`, 
                story.title
              );
            }
          }
        });
        
        isFirstLoadRef.current = false;
      }
    } catch (err) {
      console.warn("Offline fallback activation: Live signals are secure inside baseline chronicles mode.", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Mount effect to fetch live stories initially and trigger auto-sync every 3 minutes
  useEffect(() => {
    fetchLiveNews();
    
    const interval = setInterval(() => {
      fetchLiveNews();
    }, 180000);
    
    return () => clearInterval(interval);
  }, []);

  // Synchronize custom broadcast news from Firestore and hook real-time notifications
  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customNews: NewsItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        customNews.push({
          id: doc.id,
          category: data.category || 'CYBERSECURITY',
          source: data.source || 'Admin Signal',
          timeSlot: data.createdAt ? `${Math.max(1, Math.floor((Date.now() - data.createdAt.toDate().getTime()) / 60000))}m ago` : 'Just Now',
          title: data.title || 'Broadcast Alert',
          summary: data.summary || data.body || '',
          body: data.body || '',
          impactLevel: data.impactLevel || 'CRITICAL',
          url: data.url || ''
        });
      });

      if (customNews.length > 0) {
        setItems(prev => {
          const merged = [...customNews, ...prev];
          const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
          return unique;
        });

        customNews.forEach((news) => {
          if (!seenNewsIdsRef.current.has(news.id)) {
            seenNewsIdsRef.current.add(news.id);
            if (!isFirstLoadRef.current) {
              const customEvent = new CustomEvent('faraflick-foreground-push', {
                detail: {
                  id: news.id,
                  title: `⚡ BROADCAST ALERT: ${news.category}`,
                  body: news.title,
                  data: {
                    type: 'news',
                    id: news.id,
                    newsId: news.id,
                    title: news.title,
                    body: news.summary,
                    priority: news.impactLevel === 'CRITICAL' ? 'high' : 'normal',
                    showPopup: true,
                    popupDuration: 3000
                  }
                }
              });
              window.dispatchEvent(customEvent);
            }
          }
        });
      }
    }, (err) => {
      console.warn("SecureNewsFlow: broadcast news collection stream warning:", err);
    });

    return () => unsubscribe();
  }, []);

  // Ticker text rotation animations
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setInterval(() => {
      setTickerOffset(prev => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  const triggerRefreshFeeds = () => {
    playGlitchClickSound();
    fetchLiveNews().then(() => {
      playLikeSound();
    });
  };

  const getImpactColor = (lvl: string) => {
    if (lvl === 'CRITICAL') return 'text-red-500 border-red-500/30 bg-red-500/10 font-black';
    if (lvl === 'MEDIUM') return 'text-amber-400 border-amber-400/30 bg-amber-400/10 font-bold';
    return 'text-[var(--neon-green)] border-[var(--neon-green)]/30 bg-[var(--neon-green)]/10';
  };

  // Filter elements
  const categories = ['ALL', 'CYBERSECURITY', 'CRYPTOGRAPHY', 'NETWORK', 'AI SYSTEMS'];
  const filteredItems = selectedCategory === 'ALL' 
    ? items 
    : items.filter(news => news.category === selectedCategory);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 font-mono pb-12">
      
      {/* Massive Neo-Brutalist Masthead */}
      <div className="border-4 border-[var(--neon-green)] bg-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000000] flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b-2 border-[var(--neon-green)]/30 pb-4">
          <div className="flex items-center space-x-3">
            <Radio className="w-8 h-8 text-[var(--neon-green)] animate-pulse shrink-0" />
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
                FARA FLICK NEWS WIRE
              </h2>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-mono font-bold text-[var(--neon-green)] mt-1">
                ✦ LIVE SIGNAL INTELLIGENCE BROADCASTS // COHERENT TUNNEL GATEWAY
              </p>
            </div>
          </div>
          
          {/* Dynamic Sync Trigger */}
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button
              onClick={() => {
                playGlitchClickSound();
                setShowPublisher(!showPublisher);
              }}
              className="px-4 py-2 border-2 border-red-500 bg-[#050505] text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer flex items-center gap-2 text-xs uppercase font-extrabold shadow-[4px_4px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
              <Send className="w-3.5 h-3.5" />
              {showPublisher ? 'CLOSE WRITER' : 'BROADCAST BULLET'}
            </button>

            <button
              onClick={triggerRefreshFeeds}
              className="px-4 py-2 border-2 border-[var(--neon-green)] bg-[#050505] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition-all cursor-pointer flex items-center gap-2 text-xs uppercase font-extrabold shadow-[4px_4px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              title="Scan remote feeds"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'SCANNING NODE APIS...' : 'SCAN FEEDS'}
            </button>
          </div>
        </div>

        {/* Info ribbon with technical details */}
        <div className="flex flex-wrap items-center justify-between text-[9px] text-zinc-500 font-bold uppercase gap-2">
          <span>PORTAL_NODE_A // SECURED</span>
          <span>FEED RATE: 45 SEC SCAN FREQUENCY</span>
          <span>SIGNALS DETECTED: {items.length} PACKETS ACTIVE</span>
        </div>
      </div>

      {/* Brutalist News Composer Panel */}
      <AnimatePresence>
        {showPublisher && (
          <motion.form
            onSubmit={handlePublishNews}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-4 border-red-500 bg-black p-5 shadow-[6px_6px_0px_0px_#000000] space-y-4 overflow-hidden"
          >
            <div className="flex items-center space-x-2 text-red-500 font-extrabold text-xs uppercase border-b-2 border-red-500/20 pb-2">
              <Radio className="w-4 h-4 animate-pulse" />
              <span>EMIT LIVE BROADCAST INTEL WIRE SIGNAL</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold uppercase">Signal Heading / Title</label>
                <input
                  type="text"
                  required
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  placeholder="e.g. System Breach detected on main campus subgrid..."
                  className="w-full bg-[#070707] border-2 border-zinc-800 text-white p-2.5 text-xs focus:border-red-500 focus:outline-none focus:ring-0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase">Category Coordinates</label>
                  <select
                    value={newsCategory}
                    onChange={(e) => setNewsCategory(e.target.value as any)}
                    className="w-full bg-[#070707] border-2 border-zinc-800 text-white p-2.5 text-xs focus:border-red-500 focus:outline-none"
                  >
                    <option value="CYBERSECURITY">CYBERSECURITY</option>
                    <option value="CRYPTOGRAPHY">CRYPTOGRAPHY</option>
                    <option value="NETWORK">NETWORK</option>
                    <option value="AI SYSTEMS">AI SYSTEMS</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase">Threat/Impact Rating</label>
                  <select
                    value={newsImpact}
                    onChange={(e) => setNewsImpact(e.target.value as any)}
                    className="w-full bg-[#070707] border-2 border-zinc-800 text-white p-2.5 text-xs focus:border-red-500 focus:outline-none"
                  >
                    <option value="CRITICAL">⚡ CRITICAL</option>
                    <option value="MEDIUM">⚡ MEDIUM</option>
                    <option value="SECURE">⚡ SECURE</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-bold uppercase">Brief Summary (Optional)</label>
              <input
                type="text"
                value={newsSummary}
                onChange={(e) => setNewsSummary(e.target.value)}
                placeholder="Brief high-level summary of the threat..."
                className="w-full bg-[#070707] border-2 border-zinc-800 text-white p-2.5 text-xs focus:border-red-500 focus:outline-none focus:ring-0"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-bold uppercase">Full Signal Decryption / Body Text</label>
              <textarea
                required
                rows={4}
                value={newsBody}
                onChange={(e) => setNewsBody(e.target.value)}
                placeholder="Full content payload details..."
                className="w-full bg-[#070707] border-2 border-zinc-800 text-white p-2.5 text-xs focus:border-red-500 focus:outline-none focus:ring-0 resize-none font-sans font-bold"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPublishing}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase flex items-center gap-2 border-2 border-black shadow-[4px_4px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer"
              >
                {isPublishing ? 'PUBLISHING BROADCAST...' : 'TRANSMIT SIGNAL WIRE'}
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Brutalist Category Filter */}
      <div className="border-2 border-zinc-800 bg-[#0c0c0c] p-4 shadow-[4px_4px_0px_0px_#000000]">
        <div className="flex items-center gap-1.5 mb-3 text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold">
          <Filter className="w-4 h-4 text-[var(--neon-green)]" />
          <span>Coordinates Selector (Filter Live Categories)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                playGlitchClickSound();
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider border-2 transition-all cursor-pointer font-black ${
                selectedCategory === cat
                  ? 'bg-[var(--neon-green)] text-black border-black shadow-[3px_3px_0px_0px_#000000]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-[var(--neon-green)]/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Live Signal Ticker Ribbon */}
      {(() => {
        const currentItem = items[tickerOffset] || items[0];
        if (!currentItem) return null;
        return (
          <div className="bg-[#050505] border-2 border-red-500/30 p-3 text-xs flex items-center justify-between overflow-hidden shadow-[4px_4px_0px_0px_rgba(239,68,68,0.1)]">
            <div className="flex items-center space-x-3.5 truncate">
              <span className="bg-red-600 text-white font-black px-2 py-0.5 text-[9px] uppercase tracking-wider animate-pulse border border-black">
                BREAKING INTEL
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={tickerOffset}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="truncate text-red-400 italic font-bold cursor-pointer hover:underline uppercase"
                  onClick={() => {
                    playGlitchClickSound();
                    setActiveDossier(currentItem);
                  }}
                >
                  [{currentItem.category}] {currentItem.title}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        );
      })()}

      {/* Downward Flowing Stories Lists */}
      <div className="space-y-8">
        {filteredItems.length === 0 ? (
          <div className="p-16 text-center border-4 border-dashed border-[var(--neon-green)]/15 text-zinc-650 italic text-sm uppercase animate-pulse bg-[#070707]">
            No live signal packets buffered for category {selectedCategory}.
          </div>
        ) : (
          <>
            {/* PINNED CHRONICLES SECTION (Always pinned if active first-class signals are CRITICAL) */}
            {selectedCategory === 'ALL' && filteredItems.some(i => i.impactLevel === 'CRITICAL') && (
              <div className="border-4 border-red-500 bg-red-950/10 p-6 relative shadow-[8px_8px_0px_0px_#ef4444] animate-pulse">
                <div className="absolute top-[-14px] left-4 bg-red-600 text-white font-black px-3 py-1 text-[10px] uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_#000000]">
                  PINNED CRITICAL INTEL
                </div>
                {filteredItems.filter(i => i.impactLevel === 'CRITICAL').slice(0, 1).map(news => (
                  <div 
                    key={`pinned-${news.id}`}
                    onClick={() => {
                      playGlitchClickSound();
                      setActiveDossier(news);
                    }}
                    className="cursor-pointer group space-y-4"
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono font-black text-red-400">
                      <span>[ HIGH ENTROPY ENVELOPE SECURED ]</span>
                      <span>{news.timeSlot}</span>
                    </div>
                    <h3 className="font-serif text-lg sm:text-xl font-black text-white hover:text-red-400 uppercase tracking-tight leading-tight transition duration-150">
                      ⚡ {news.title}
                    </h3>
                    <p className="text-xs sm:text-sm font-sans text-zinc-300 leading-relaxed font-bold">
                      {news.summary}
                    </p>
                    <div className="flex items-center justify-between border-t-2 border-red-500/20 pt-3.5 text-[9px] uppercase font-black text-red-400 mt-4">
                      <span>ORIGIN NODE: {news.source}</span>
                      <span className="flex items-center gap-1 hover:underline">
                        DECRYPT SOURCE OUTLET PAYLOAD →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MAIN PREMIUM CARDS LIST - 3 COLUMN BENTO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((news, index) => {
                const isCritical = news.impactLevel === 'CRITICAL';
                return (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.4) }}
                    whileHover={{ scale: 1.01, x: 2 }}
                    onClick={() => {
                      playGlitchClickSound();
                      setActiveDossier(news);
                    }}
                    className={`p-5 bg-[#0e0e0e] hover:bg-[#141414] border transition-all cursor-pointer flex flex-col justify-between ${
                      isCritical 
                        ? 'border-red-500/40 hover:border-red-500 shadow-[3px_3px_0px_rgba(239,68,68,0.15)]' 
                        : 'border-[var(--neon-green)]/20 hover:border-[var(--neon-green)] shadow-[3px_3px_0px_rgba(0,0,0,0.6)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[8.5px] mb-2 font-mono">
                        <span className="text-zinc-500 flex items-center gap-1.5 font-bold">
                          <Clock className="w-3 h-3 text-[var(--neon-green)]" />
                          {news.timeSlot}
                        </span>
                        <span className={`px-2 py-0.5 border text-[8.5px] uppercase font-black ${getImpactColor(news.impactLevel)}`}>
                          {news.impactLevel}
                        </span>
                      </div>

                      <h4 className="font-serif text-sm font-extrabold text-white group-hover:text-[var(--neon-green)] leading-snug tracking-tight uppercase">
                        {news.title}
                      </h4>

                      <p className="text-[11px] text-zinc-400 mt-3.5 leading-relaxed font-sans line-clamp-3">
                        {news.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--neon-green)]/15 mt-5 pt-3 text-[8.5px] text-zinc-500 font-mono font-bold uppercase">
                      <span className="flex items-center gap-1 text-[var(--neon-green)]/70">
                        <Tag className="w-3 h-3 text-[var(--neon-green)]" />
                        {news.category}
                      </span>
                      <span className="flex items-center gap-1 hover:text-[var(--neon-green)] text-zinc-300 transition-all">
                        EXPAND REPORT <ArrowRight className="w-3 h-3 ml-0.5 text-[var(--neon-green)]" />
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Expanded News Dossier lightbox modal with In-App Browser Reader Frame */}
      <AnimatePresence>
        {activeDossier && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[90] flex items-center justify-center p-2 sm:p-4 pointer-events-auto">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setActiveDossier(null)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[#0b0b0b] border-2 border-[var(--neon-green)] p-4 sm:p-6 w-full max-w-4xl relative z-10 shadow-[8px_8px_0px_0px_#000000] rounded-none flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-[var(--neon-green)]/30 pb-3 mb-4 shrink-0">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-[var(--neon-green)]" />
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                    SECURE IN-APP INTELLIGENCE VIEWPORT
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDossier(null)}
                  className="px-2.5 py-1 border border-[var(--neon-green)]/50 hover:bg-[var(--neon-green)] hover:text-black text-[9px] uppercase hover:font-bold transition cursor-pointer"
                >
                  [ CLOSE VIEWPORT ]
                </button>
              </div>

              {/* Grid content split - Details Left, Browser View Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-y-auto lg:overflow-hidden min-h-0">
                
                {/* Story metadata container */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4 overflow-y-auto pr-1">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] uppercase font-black bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 px-2 py-0.5 leading-none text-[var(--neon-green)]">
                        {activeDossier.category}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-bold">
                        ORIGIN: {activeDossier.source}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-[var(--neon-green)] text-md sm:text-lg leading-tight uppercase">
                      {activeDossier.title}
                    </h3>

                    <div className="text-[11px] leading-relaxed text-zinc-300 bg-[#050505]/80 p-3 border-l-2 border-[var(--neon-green)] italic font-sans">
                      "{activeDossier.summary}"
                    </div>

                    <div className="text-[11.5px] leading-relaxed text-zinc-400 font-sans space-y-2">
                      <p>{activeDossier.body}</p>
                    </div>
                  </div>

                  <div className="border-t border-[var(--neon-green)]/10 pt-4 space-y-3">
                    <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase">
                      <span>Security Threat Level</span>
                      <span className={`px-2 py-0.5 border ${getImpactColor(activeDossier.impactLevel)}`}>
                        {activeDossier.impactLevel}
                      </span>
                    </div>
                    
                    {/* External source anchor URL display */}
                    <a
                      href={activeDossier.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[var(--neon-green)]/30 text-zinc-500 hover:text-[var(--neon-green)] hover:border-[var(--neon-green)] transition-all text-[9.5px] uppercase"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>DIRECT PAYLOAD OUTLET LINK</span>
                    </a>
                  </div>
                </div>

                {/* Embedded Frame Panel (ALL external links read INSIDE) */}
                <div className="lg:col-span-7 border border-[var(--neon-green)]/20 bg-[#020202] flex flex-col h-[320px] lg:h-full min-h-0 relative">
                  <div className="bg-[#070707] border-b border-[var(--neon-green)]/20 p-2 flex items-center justify-between shrink-0 font-mono text-[9px] text-zinc-400">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Globe className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                      <span className="truncate max-w-[200px] font-bold text-zinc-200">
                        {activeDossier.url}
                      </span>
                    </div>
                    
                    {/* Reader Style toggling (Normal iframe vs Bypassed txtify reader) */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          playGlitchClickSound();
                          setReaderMode('plaintext');
                        }}
                        className={`px-2 py-0.5 border transition cursor-pointer flex items-center gap-1 ${
                          readerMode === 'plaintext' 
                            ? 'bg-[var(--neon-green)] text-black border-black font-extrabold' 
                            : 'bg-black text-zinc-500 border-zinc-800 hover:text-white'
                        }`}
                        title="Bypass iframe restrictions and load a clean readable document format"
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        <span>READER</span>
                      </button>
                      <button
                        onClick={() => {
                          playGlitchClickSound();
                          setReaderMode('normal');
                        }}
                        className={`px-2 py-0.5 border transition cursor-pointer flex items-center gap-1 ${
                          readerMode === 'normal' 
                            ? 'bg-[var(--neon-green)] text-black border-black font-extrabold' 
                            : 'bg-black text-zinc-500 border-zinc-800 hover:text-white'
                        }`}
                        title="Load directly (Note: some websites block native iframe display)"
                      >
                        <Columns className="w-2.5 h-2.5" />
                        <span>LIVE WEB</span>
                      </button>
                    </div>
                  </div>

                  {/* Frame Body wrapper */}
                  <div className="flex-1 bg-white relative">
                    {/* Prompt info block if site might fail */}
                    <iframe
                      sandbox="allow-scripts allow-same-origin allow-popups"
                      referrerPolicy="no-referrer"
                      title="Integrated Iframe Web Reader"
                      src={
                        readerMode === 'plaintext'
                          ? `https://txtify.it/${activeDossier.url.replace(/^https?:\/\//, '')}`
                          : activeDossier.url
                      }
                      className="w-full h-full border-none"
                    />
                    
                    {/* Liquid Glass floating corner overlay to label sandboxed frame */}
                    <div className="absolute bottom-2 right-2 pointer-events-none bg-black/80 backdrop-blur-sm border border-[var(--neon-green)]/35 p-1.5 text-[8px] text-zinc-400 font-mono flex items-center gap-1 uppercase select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-ping" />
                      <span>SECURE IN-APP SHIELD</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
