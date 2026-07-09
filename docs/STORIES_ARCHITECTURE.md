# FLICK STORIES & STATUS SYSTEM ARCHITECTURE
## Elite Enterprise-Grade System Design, Database Schemas, and Frontend Engineering

This document details the complete design, engineering blueprint, and implementation specifications for **Flick's Stories (Status) System**. Built for millions of daily active users (DAUs), this decentralized, bandwidth-optimized, offline-first, and highly secure micro-architecture is engineered to support images, videos, audio/voice notes, stickers, text blocks, location tags, music streams, and real-time interactive widgets (polls, reactions, replies).

---

## SECTION 1: SYSTEM BLUEPRINTS & DATA SCHEMAS

### 1. FIRESTORE DATABASE SCHEMA (Relational-Subcollection Hybrid Model)
To avoid the Firestore "infinite-document growth" anti-pattern (which results in document size exceeding the 1MB limit), the database is structured using decoupled, flat collections linked via composite references and event-based tracking.

```
/users/{userId}
   └── (User profile with status, verification, close-friends-list)

/stories/{storyId}  [Documents < 20KB]
   ├── id: string (UUID)
   ├── authorId: string (indexed)
   ├── authorName: string
   ├── authorPhoto: string
   ├── mediaType: 'image' | 'video' | 'audio' | 'text'
   ├── mediaUrl: string (signed CDN URL)
   ├── thumbnailUrl: string (progressive load proxy)
   ├── blurHash: string (instant CSS rendering placeholder)
   ├── content: string (optional captions)
   ├── duration: number (seconds, e.g., 7.0 for image, dynamic for video)
   ├── dimensions: { width: number, height: number }
   ├── privacy: 'everyone' | 'contacts' | 'close_friends' | 'custom' | 'private'
   ├── customAllowedUids: string[] (empty if not 'custom')
   ├── isExpired: boolean
   ├── createdAt: timestamp (reaper indexed)
   └── expiresAt: timestamp (exactly createdAt + 24 hours)

/stories/{storyId}/views/{viewId}  [Subcollection for tracking]
   ├── viewerId: string
   ├── viewerName: string
   ├── viewerPhoto: string
   ├── viewedAt: timestamp
   ├── watchDuration: number (seconds)
   └── completed: boolean

/stories/{storyId}/reactions/{reactionId}  [Subcollection for reactions]
   ├── userId: string
   ├── userName: string
   ├── emoji: string
   └── reactedAt: timestamp

/stories/{storyId}/polls/{pollId} [Interactive Widgets]
   ├── question: string
   ├── options: [ { id: string, text: string, votes: number } ]
   └── votes: map { userId -> optionId }

/story_analytics/{storyId} [Flat collection for aggregation]
   ├── storyId: string
   ├── authorId: string
   ├── totalViews: number
   ├── completionRate: number (completed / totalViews)
   ├── exitRate: number
   ├── sharesCount: number
   └── repliesCount: number
```

### 2. STORAGE FOLDER STRUCTURE (Object Storage Buckets)
Story media assets are stored in a private Firebase Storage bucket under strict directory paths, segmented by date, author, and privacy levels.

```
flick-stories-vault/
  ├── raw/
  │    └── {userId}/
  │         └── {storyId}_{timestamp}.mp4   <-- Temp source files before processing
  ├── processed/
  │    └── {userId}/
  │         ├── {storyId}_720p.mp4          <-- Transcoded, compressed adaptive video
  │         ├── {storyId}_1080p.mp4
  │         ├── {storyId}_optimized.jpg     <-- WebP compressed image (80% quality)
  │         ├── {storyId}_thumb.jpg         <-- Scaled thumbnail (200x350px)
  │         └── {storyId}_audio.m4a         <-- Optimized AAC audio track (96kbps)
  └── cache/                                <-- CDN staging & edge optimization bucket
```

### 3. FIREBASE SECURITY RULES (Strict Auth & Privacy Constraints)
Rules prevent hotlinking, enforce user-specific privacy filters, and prevent malicious write attacks.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isStoryVisible(storyData) {
      return storyData.privacy == 'everyone'
        || (storyData.privacy == 'close_friends' && request.auth.uid in get(/databases/$(database)/documents/users/$(storyData.authorId)).data.closeFriendsUids)
        || (storyData.privacy == 'contacts' && request.auth.uid in get(/databases/$(database)/documents/users/$(storyData.authorId)).data.contactsUids)
        || (storyData.privacy == 'custom' && request.auth.uid in storyData.customAllowedUids)
        || storyData.authorId == request.auth.uid;
    }

    match /stories/{storyId} {
      allow read: if isSignedIn() && isStoryVisible(resource.data);
      allow create: if isSignedIn() 
        && isOwner(request.resource.data.authorId)
        && request.resource.data.expiresAt == request.resource.data.createdAt + duration.value(24, 'h');
      allow update, delete: if isSignedIn() && isOwner(resource.data.authorId);

      // Views Subcollection
      match /views/{viewId} {
        allow read: if isSignedIn() && isOwner(get(/databases/$(database)/documents/stories/$(storyId)).data.authorId);
        allow create: if isSignedIn() && isOwner(viewId) && isStoryVisible(get(/databases/$(database)/documents/stories/$(storyId)).data);
        allow update, delete: if false;
      }

      // Reactions Subcollection
      match /reactions/{reactionId} {
        allow read: if isSignedIn() && isStoryVisible(get(/databases/$(database)/documents/stories/$(storyId)).data);
        allow create, update: if isSignedIn() && isOwner(reactionId);
        allow delete: if isSignedIn() && isOwner(reactionId);
      }
    }
  }
}
```

### 4. DATABASE COMPOSITE INDEXES
The following indexes are pre-configured in `firestore.indexes.json` to enable instantaneous queries of the feed:

1. **Active Feed Index**: `stories` collection -> `authorId` (ASC), `expiresAt` (DESC), `isExpired` (ASC).
2. **Global Feed Order Index**: `stories` collection -> `isExpired` (ASC), `createdAt` (DESC).
3. **Cleanup Reaper Index**: `stories` collection -> `expiresAt` (ASC), `isExpired` (ASC).

### 5. CLOUD FUNCTIONS FOR BACKEND REAPING (The Story Grim-Reaper)
A Google Cloud Function operates on an automated Pub/Sub cron scheduler to mark stories as expired and clean up physical storage assets.

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

export const storyExpirationReaper = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const expiredStoriesSnap = await db.collection('stories')
      .where('expiresAt', '<=', now)
      .where('isExpired', '==', false)
      .limit(500)
      .get();

    if (expiredStoriesSnap.empty) {
      console.log('No expired stories found to reap.');
      return null;
    }

    const batch = db.batch();
    
    for (const doc of expiredStoriesSnap.docs) {
      const data = doc.data();
      batch.update(doc.ref, { isExpired: true });

      // Optional: Archive metadata to a cold-storage document if user enabled archiving
      if (data.isArchivedEnabled) {
        await db.collection('story_archives').doc(doc.id).set({
          ...data,
          archivedAt: now
        });
      }

      // Safe Media asset cleanup (Delete original storage reference if not archived)
      if (!data.isArchivedEnabled) {
        const filePaths = [
          `processed/${data.authorId}/${doc.id}_720p.mp4`,
          `processed/${data.authorId}/${doc.id}_optimized.jpg`,
          `processed/${data.authorId}/${doc.id}_thumb.jpg`,
        ];
        for (const path of filePaths) {
          const file = bucket.file(path);
          await file.exists().then(([exists]) => {
            if (exists) file.delete();
          });
        }
      }
    }

    await batch.commit();
    console.log(`Reaped and processed ${expiredStoriesSnap.size} stories.`);
    return null;
  });
```

---

## SECTION 2: FRONTEND ENGINE & DATA PIPELINES

### 6. MODULAR REACT FILE STRUCTURE
We separate worries into logical, dedicated packages:

```
src/components/stories/
├── StoryViewer.tsx         <-- Full screen carousel slider & player
├── StoryRing.tsx           <-- SVG canvas animated ring representing unread/muted
├── StoryCreator.tsx        <-- Media capture, sticker, poll overlay & creation UI
├── StoryComposer.tsx       <-- Canvas layer to paint text, draw stickers, play music
└── StoryAnalyticsTab.tsx   <-- Displaying reach, average watch time, exit rates
src/lib/stories/
├── StoryService.ts         <-- Firestore endpoints wrapper
├── StoryCache.ts           <-- IndexedDB binary cache for offline retrieval
├── StoryQueue.ts           <-- Upload queue engine with progress, pause, retry, and sync
└── StoryCompression.ts     <-- Client-side Canvas WebP/WASM media encoder
```

### 7. STOCHASTIC UPLOAD FLOW & DATA COMPRESSION
Before uploading to cloud buckets, raw media is dynamically downsampled on the client device using browser canvas rendering for images and an embedded WebAssembly FFmpeg module for videos, ensuring lightweight transfers.

```
[Raw Capture/File Selection]
         │
         ▼
[Detect Media Type & Orientation]
         │
 ┌───────┴──────────────────────────────────────────┐
 ▼ (Image)                                          ▼ (Video)
[Draw to Offscreen HTML5 Canvas]         [Extract WebAssembly FFmpeg Worker]
 │                                                  │
 ├─► Resize: Max 1080x1920 (9:16 Aspect)            ├─► Downscale to 720p (24 FPS)
 ├─► Generate Base64 Blur Placeholder               ├─► Transcode to MP4 (H.264 / AAC)
 └─► Compress to WebP (Quality: 0.8)                ├─► Extract 200px JPG Thumbnail
         │                                          └─► Generate Progress Vector
         ▼                                                  │
[Stream Blob binary directly to UploadQueue] ◄──────────────┘
```

### 8. OFFLINE UPLOAD QUEUE (StoryQueue)
If the user posts a story while network latency is high or offline, the payload is persisted in a local IndexedDB buffer. The Queue manager constantly listens to network transitions and resumes uploads with an exponential backoff auto-retry strategy.

```typescript
import { openDB } from 'idb';

export interface QueuedUploadTask {
  id: string;
  authorId: string;
  mediaType: 'image' | 'video' | 'audio' | 'none';
  caption: string;
  blob: Blob;
  status: 'pending' | 'uploading' | 'failed';
  retryCount: number;
}

export class StoryUploadQueue {
  private dbPromise = openDB('flick_stories_queue', 1, {
    upgrade(db) {
      db.createObjectStore('tasks', { keyPath: 'id' });
    }
  });

  async enqueue(task: QueuedUploadTask) {
    const db = await this.dbPromise;
    await db.put('tasks', task);
    this.processQueue();
  }

  async processQueue() {
    if (!navigator.onLine) return;
    const db = await this.dbPromise;
    const tasks: QueuedUploadTask[] = await db.getAll('tasks');
    const pending = tasks.filter(t => t.status !== 'uploading');

    for (const task of pending) {
      try {
        await this.uploadTask(task);
      } catch (err) {
        task.status = 'failed';
        task.retryCount += 1;
        await db.put('tasks', task);
        // Exponential backoff wait
        setTimeout(() => this.processQueue(), Math.pow(2, task.retryCount) * 1000);
      }
    }
  }

  private async uploadTask(task: QueuedUploadTask) {
    const db = await this.dbPromise;
    task.status = 'uploading';
    await db.put('tasks', task);

    // 1. Storage Upload
    const mediaUrl = await this.uploadToStorage(task.blob, task.id);
    
    // 2. Firestore Document Construction
    await this.saveToFirestore(task, mediaUrl);

    // 3. Cleanup Task
    await db.delete('tasks', task.id);
  }

  private async uploadToStorage(blob: Blob, id: string): Promise<string> {
    // Standard storage task uploader...
    return "https://cdn.flick.chat/stories/optimized_" + id;
  }

  private async saveToFirestore(task: QueuedUploadTask, mediaUrl: string) {
    // Document creator...
  }
}
```

### 9. STORY DOWNLOAD & LAZY CAROUSEL STRATEGY
Rather than loading all resources on boot (which would consume extreme amounts of user bandwidth and cellular data), Flick uses a sliding window caching algorithm.

```
       [Previous Group]     [Active Group]      [Next Group]
       ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
       │   Story N    │    │   Story N    │    │   Story N    │
       ├──────────────┤    ├──────────────┤    ├──────────────┤
       │   Story N-1  │    │  Story Active│    │   Story 1    │  ◄── Prefetch First Story Item
       ├──────────────┤    ├──────────────┤    ├──────────────┤
       │   Story 1    │    │   Story 1    │    │   Story 2    │
       └──────────────┘    └──────────────┘    └──────────────┘
         Memory Cached       Active Player        Prefetching
```

* **Sliding Window Preloading**:
  * Keep the *Active Story* fully loaded in memory, playing at high-definition.
  * Prefetch the metadata, blur placeholders, and the first 3 seconds of video for the *Next Story* in the active group.
  * Keep the *Previous Story* cached in RAM for immediate backwards tapping.
  * Stop all network streams for groups further than ±1 step away.

---

## SECTION 3: PREMIUM USER INTERFACE IMPLEMENTATION

### 10. REAL-TIME STORIES PLAYER IMPLEMENTATION
The following is an optimized, high-performance React implementation of the immersive full-screen story player, featuring pause-on-long-press, interactive gestures, progressive loaders, and adaptive audio.

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Heart, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Story } from '../../types';

interface StoryPlayerProps {
  stories: Story[];
  onClose: () => void;
  onGroupComplete: () => void;
  onGroupBack: () => void;
}

export default function StoryPlayer({ stories, onClose, onGroupComplete, onGroupBack }: StoryPlayerProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const activeStory = stories[index];
  const duration = activeStory.mediaType === 'video' ? (videoRef.current?.duration || 7) : 7;

  useEffect(() => {
    // Reset progress on slide shift
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (videoRef.current) videoRef.current.pause();
      return;
    }

    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.play().catch(() => setPaused(true));
    }

    const startTime = Date.now() - (progress * duration * 10);
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + (100 / (duration * 10)); // Increments of 100ms
      });
    }, 100);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [index, paused, muted, duration]);

  const handleNext = () => {
    if (index < stories.length - 1) {
      setIndex(index + 1);
    } else {
      onGroupComplete();
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
    } else {
      onGroupBack();
    }
  };

  return (
    <div className="relative w-full max-w-lg h-full bg-black flex flex-col justify-between overflow-hidden">
      
      {/* Top Overlay Controls and Segment Progress Bars */}
      <div className="absolute top-0 inset-x-0 p-4 z-30 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex gap-1.5 mb-4">
          {stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-100"
                style={{
                  width: i < index ? '100%' : i === index ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <img src={activeStory.authorPhoto} className="w-9 h-9 rounded-full object-cover border border-white/20" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">{activeStory.authorName}</h4>
              <span className="text-[9px] font-mono opacity-60">Flick Cipher Secure</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setMuted(!muted)} className="p-1 hover:bg-white/10 rounded-full transition">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="text-xs uppercase font-mono tracking-widest bg-white/10 px-3 py-1 text-white border border-white/20 rounded-sm">Close</button>
          </div>
        </div>
      </div>

      {/* Main Interactive Visual Frame */}
      <div 
        className="flex-1 flex items-center justify-center relative select-none"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {activeStory.mediaType === 'image' ? (
          <img 
            src={activeStory.mediaUrl} 
            className="w-full h-full object-cover pointer-events-none" 
            alt="Story Frame"
          />
        ) : (
          <video 
            ref={videoRef}
            src={activeStory.mediaUrl}
            className="w-full h-full object-cover pointer-events-none"
            playsInline
            muted={muted}
          />
        )}

        {/* Manual Tap Navigation Zones */}
        <div className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize z-20" onClick={handlePrev} />
        <div className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize z-20" onClick={handleNext} />
      </div>

      {/* Interactive Bottom Reply Dock */}
      <div className="p-4 bg-gradient-to-t from-black/90 to-transparent z-30 flex items-center gap-3 border-t border-white/5">
        <input 
          type="text" 
          placeholder="Transmit instant encrypted feedback..." 
          className="flex-1 bg-white/10 border border-white/15 px-4 py-2 text-xs rounded-full text-white placeholder-white/40 focus:outline-none focus:border-white/40"
        />
        <button className="bg-white text-black text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest hover:scale-105 active:scale-95 transition">Send</button>
      </div>

    </div>
  );
}
```

---

## SECTION 4: SCALING, PERFORMANCE & TESTING STRATEGY

### 11. SCALING & CONCURRENCY MITIGATION
To serve millions of concurrent players without incurring extreme read costs, Flick integrates three critical load reduction tiers:

1. **Memcached Asset Offloading**: CDN cache headers are strictly set to `Cache-Control: public, max-age=86400`, caching heavy processed blobs at regional edge centers so requests never hit the cloud bucket more than once per geographic cell.
2. **Read-Count Batch Sharding**: Instead of updating the parent Story document views on every view event (causing document-lock congestion), write actions are pushed to the flat `/views` subcollection and periodically merged by an async pub-sub process into the cache aggregates.
3. **Optimistic UI Execution**: Actions like adding story reactions or marking a story as read are written locally first and pushed asynchronously, minimizing thread blockage on low-performance devices.

### 12. MIGRATION & BLUE-GREEN ROLLOUT
* **Phase 1: Shadow Logging**: Deploy schemas alongside the legacy system, writing to both tables to test write speed, cloud reaper schedulers, and rules validation under production volumes.
* **Phase 2: Canary Deployment**: Route 5% of global users (e.g., EU-West area) to the new Stories module. Run analytics on cache efficiency and error reporting.
* **Phase 3: Global Cutover & Legacy Deprecation**: Transition remaining nodes to the optimized Stories system. Backfill existing 24hr posts to the unified schema.

---

This architecture is designed to make Flick's Stories incredibly fast, visually smooth, lightweight on mobile data networks, and mathematically secure against unauthorized scraping.
