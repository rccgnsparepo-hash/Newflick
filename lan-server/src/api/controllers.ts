import { Request, Response } from 'express';
import { LanRepository } from '../database/repository';
import { AuthService } from '../auth/authService';
import { MediaManager } from '../storage/mediaManager';
import { WebSocketServerManager } from '../server/websocketServer';
import { CloudSyncEngine } from '../sync/syncEngine';
import { PROTOCOL_VERSION, DEFAULT_LAN_PORT } from '../shared/types';
import { FileStorageManager } from '../storage/fileStorage';

export class ApiControllers {
  private repo: LanRepository;
  private authService: AuthService;
  private mediaManager: MediaManager;
  private wsServer: WebSocketServerManager;
  private syncEngine: CloudSyncEngine;
  private fileStorage: FileStorageManager;
  private startTime: number;

  constructor(
    repo: LanRepository,
    authService: AuthService,
    mediaManager: MediaManager,
    wsServer: WebSocketServerManager,
    syncEngine: CloudSyncEngine,
    fileStorage: FileStorageManager
  ) {
    this.repo = repo;
    this.authService = authService;
    this.mediaManager = mediaManager;
    this.wsServer = wsServer;
    this.syncEngine = syncEngine;
    this.fileStorage = fileStorage;
    this.startTime = Date.now();
  }

  // GET /health
  public getHealth = (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      serverName: this.repo.getSetting('serverName', 'Flick School Server'),
      version: '1.0.0',
      protocolVersion: PROTOCOL_VERSION,
      databaseStatus: 'HEALTHY',
      storageStatus: 'HEALTHY',
      cloudStatus: this.syncEngine.getCloudStatus(),
      connectedClients: this.wsServer.getConnectedClientsCount(),
      activeUsers: this.wsServer.getActiveUsersCount(),
      dbSizeMB: 0.5,
      mediaSizeMB: this.fileStorage.getDirectorySizeMB(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    });
  };

  // POST /api/auth/register-login
  public registerOrLogin = (req: Request, res: Response) => {
    const { uid, username, photoURL, deviceId } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }
    const result = this.authService.registerOrLoginUser(uid, username, photoURL, deviceId);
    res.json(result);
  };

  // GET /api/users
  public getUsers = (req: Request, res: Response) => {
    const users = this.repo.getAllUsers();
    res.json(users);
  };

  // GET /api/conversations
  public getConversations = (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || '';
    const convos = this.repo.getConversationsForUser(userId);
    res.json(convos);
  };

  // POST /api/messages
  public sendMessage = (req: Request, res: Response) => {
    const msg = req.body;
    if (!msg.conversationId || !msg.senderId) {
      return res.status(400).json({ error: 'conversationId and senderId required' });
    }

    this.repo.insertMessage(msg);
    this.wsServer.broadcastAll('message:new', msg);

    res.json({ status: 'OK', messageId: msg.id });
  };

  // GET /api/messages/:conversationId
  public getMessages = (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const messages = this.repo.getMessagesForConversation(conversationId, limit);
    res.json(messages);
  };

  // POST /api/stories
  public createStory = (req: Request, res: Response) => {
    const item = req.body;
    if (!item.userId || !item.mediaUrl) {
      return res.status(400).json({ error: 'userId and mediaUrl required' });
    }
    this.repo.upsertStoryItem(item);
    this.wsServer.broadcastAll('story:new', item);
    res.json({ status: 'OK', storyItemId: item.id });
  };

  // GET /api/stories
  public getStories = (req: Request, res: Response) => {
    const stories = this.repo.getAllActiveStories();
    res.json(stories);
  };

  // POST /api/posts
  public createPost = (req: Request, res: Response) => {
    const post = req.body;
    if (!post.userId || !post.content) {
      return res.status(400).json({ error: 'userId and content required' });
    }
    this.repo.insertPost(post);
    this.wsServer.broadcastAll('post:new', post);
    res.json({ status: 'OK', postId: post.id });
  };

  // GET /api/feed
  public getFeed = (req: Request, res: Response) => {
    const posts = this.repo.getFeedPosts();
    res.json(posts);
  };

  // POST /api/media/upload
  public uploadMedia = (req: Request, res: Response) => {
    try {
      const category = (req.body.category as any) || 'images';
      const filename = req.body.filename || `file_${Date.now()}.png`;
      const base64Data = req.body.fileBase64;

      if (!base64Data) {
        return res.status(400).json({ error: 'fileBase64 is required' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const result = this.mediaManager.handleUpload(buffer, category, filename, req.body.userId);

      res.json({
        status: 'OK',
        publicUrl: result.publicUrl,
        fileHash: result.fileHash,
        fileSize: result.fileSize
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Media upload failed' });
    }
  };

  // Admin Dashboard API - GET /api/admin/status
  public getAdminStatus = (req: Request, res: Response) => {
    res.json({
      serverName: this.repo.getSetting('serverName', 'Flick School Server'),
      port: DEFAULT_LAN_PORT,
      status: 'RUNNING',
      connectedClients: this.wsServer.getConnectedClientsCount(),
      activeUsers: this.wsServer.getActiveUsersCount(),
      dbSizeMB: 0.5,
      mediaSizeMB: this.fileStorage.getDirectorySizeMB(),
      cloudStatus: this.syncEngine.getCloudStatus(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    });
  };
}
