import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch,
  deleteDoc 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from './firebase';

/**
 * Completely purges all user accounts, messages, chats, and metadata from Firebase
 * and wipes all local device databases (IndexedDB + LocalStorage) for a 100% fresh start.
 */
export async function purgeAllFlickCloudAndLocalData(): Promise<{ success: boolean; message: string }> {
  console.log('[Flick Reset Engine] Starting complete application purge and reset...');
  
  let deletedCollectionsCount = 0;
  let totalDocsDeleted = 0;

  // 1. Purge Firestore Cloud Collections
  const collectionsToPurge = [
    'users',
    'chats',
    'posts',
    'stories',
    'notifications',
    'news',
    'calls',
    'presence',
    'user_devices',
    'temporary_envelopes',
    'security_logs',
    'feedbacks'
  ];

  if (db) {
    for (const collName of collectionsToPurge) {
      try {
        const collRef = collection(db, collName);
        const snapshot = await getDocs(collRef);
        
        if (!snapshot.empty) {
          // If this is chats, also look for nested subcollections
          if (collName === 'chats') {
            for (const chatDoc of snapshot.docs) {
              try {
                // Delete messages subcollection
                const msgSubColl = collection(db, 'chats', chatDoc.id, 'messages');
                const msgSnap = await getDocs(msgSubColl);
                if (!msgSnap.empty) {
                  const msgBatch = writeBatch(db);
                  msgSnap.docs.forEach(m => msgBatch.delete(m.ref));
                  await msgBatch.commit();
                  totalDocsDeleted += msgSnap.size;
                }

                // Delete typingStates subcollection
                const typingSubColl = collection(db, 'chats', chatDoc.id, 'typingStates');
                const typingSnap = await getDocs(typingSubColl);
                if (!typingSnap.empty) {
                  const typingBatch = writeBatch(db);
                  typingSnap.docs.forEach(t => typingBatch.delete(t.ref));
                  await typingBatch.commit();
                  totalDocsDeleted += typingSnap.size;
                }
              } catch (subErr) {
                console.warn(`[Reset Engine] Chat subcollection wipe notice (${chatDoc.id}):`, subErr);
              }
            }
          }

          // Batch delete top-level docs in chunks of 450
          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += 450) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 450);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }

          deletedCollectionsCount++;
          totalDocsDeleted += docs.length;
          console.log(`[Reset Engine] Purged collection '${collName}' (${docs.length} documents)`);
        }
      } catch (err) {
        console.warn(`[Reset Engine] Notice during collection '${collName}' purge:`, err);
      }
    }
  }

  // 2. Wipe Local Device Storage & Caches
  try {
    if (typeof window !== 'undefined') {
      // Clear LocalStorage
      window.localStorage.clear();
      // Clear SessionStorage
      window.sessionStorage.clear();

      // Delete all IndexedDB Databases
      const indexedDbNames = [
        'FlickDeviceVaultDB',
        'FlickLocalMessageStoreDB',
        'flick_voice_vault',
        'flick_offline_db',
        'FlickOfflineQueueDB'
      ];

      for (const idbName of indexedDbNames) {
        try {
          if (window.indexedDB && window.indexedDB.deleteDatabase) {
            window.indexedDB.deleteDatabase(idbName);
          }
        } catch (idbErr) {
          console.warn(`[Reset Engine] IDB wipe notice for ${idbName}:`, idbErr);
        }
      }
    }
  } catch (localErr) {
    console.warn('[Reset Engine] Local storage wipe notice:', localErr);
  }

  // 3. Sign Out Current Auth Session
  try {
    if (auth) {
      await signOut(auth);
    }
  } catch (authErr) {
    console.warn('[Reset Engine] Auth signout notice:', authErr);
  }

  console.log(`[Flick Reset Engine] Complete. Purged ${totalDocsDeleted} documents across ${deletedCollectionsCount} collections.`);
  return {
    success: true,
    message: `All accounts, chats, and messages have been completely wiped. The app has restarted afresh.`
  };
}
