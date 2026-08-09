import { LanDatabase } from './database';

export function runMigrations(db: LanDatabase): void {
  console.log('[LAN DB] Running relational database schema migrations...');

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      uid TEXT UNIQUE NOT NULL,
      username TEXT,
      displayName TEXT,
      photoURL TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      uid TEXT UNIQUE NOT NULL,
      bio TEXT,
      statusMessage TEXT,
      customStatus TEXT,
      themePreference TEXT,
      encryptionKeyPublic TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      deviceId TEXT UNIQUE NOT NULL,
      userId TEXT NOT NULL,
      platform TEXT,
      deviceName TEXT,
      isApproved INTEGER DEFAULT 1,
      lastActiveAt TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      userId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'direct',
      name TEXT,
      iconURL TEXT,
      lastMessageText TEXT,
      lastMessageTime TEXT,
      created_at TEXT,
      updated_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joinedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      senderName TEXT,
      senderAvatar TEXT,
      text TEXT,
      cipherText TEXT,
      mediaUrl TEXT,
      mediaType TEXT,
      replyToId TEXT,
      isEncrypted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'LAN_ACK',
      operationId TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      readAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      avatarUrl TEXT,
      ownerId TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joinedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      username TEXT,
      userAvatar TEXT,
      lastUpdated TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS story_items (
      id TEXT PRIMARY KEY,
      storyId TEXT NOT NULL,
      userId TEXT NOT NULL,
      mediaUrl TEXT NOT NULL,
      mediaType TEXT DEFAULT 'image',
      caption TEXT,
      musicTrack TEXT,
      expiresAt TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS story_views (
      id TEXT PRIMARY KEY,
      storyItemId TEXT NOT NULL,
      viewerUserId TEXT NOT NULL,
      viewedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS story_reactions (
      id TEXT PRIMARY KEY,
      storyItemId TEXT NOT NULL,
      userId TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      authorName TEXT,
      authorAvatar TEXT,
      content TEXT,
      mediaUrls TEXT,
      likeCount INTEGER DEFAULT 0,
      commentCount INTEGER DEFAULT 0,
      operationId TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      postId TEXT NOT NULL,
      userId TEXT NOT NULL,
      authorName TEXT,
      text TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS post_reactions (
      id TEXT PRIMARY KEY,
      postId TEXT NOT NULL,
      userId TEXT NOT NULL,
      reaction TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT,
      data TEXT,
      isRead INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      mimeType TEXT,
      fileHash TEXT UNIQUE,
      ownerUserId TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS media_metadata (
      id TEXT PRIMARY KEY,
      fileHash TEXT UNIQUE NOT NULL,
      mimeType TEXT,
      width INTEGER,
      height INTEGER,
      duration INTEGER,
      cloudSyncStatus TEXT DEFAULT 'LOCAL_ONLY'
    );

    CREATE TABLE IF NOT EXISTS presence (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'online',
      customStatus TEXT,
      lastActiveAt TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_operations (
      id TEXT PRIMARY KEY,
      operationId TEXT UNIQUE NOT NULL,
      deviceId TEXT NOT NULL,
      userId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      operationType TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'QUEUED',
      version INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      operationId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      localPayload TEXT,
      remotePayload TEXT,
      resolutionStrategy TEXT,
      resolvedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS server_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actorUserId TEXT,
      ipAddress TEXT,
      details TEXT,
      created_at TEXT
    );
  `;

  db.exec(schemaSql);
  console.log('[LAN DB] Schema migrations executed successfully.');
}
