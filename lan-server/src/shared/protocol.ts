import { PROTOCOL_VERSION, DEFAULT_LAN_PORT, SERVICE_TYPE } from './types';

export const EVENTS = {
  // Connection
  HANDSHAKE: 'handshake',
  HANDSHAKE_ACK: 'handshake:ack',
  PING: 'ping',
  PONG: 'pong',

  // Messages
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_READ: 'message:read',
  REACTION_NEW: 'reaction:new',
  REACTION_REMOVE: 'reaction:remove',

  // Presence & Typing
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',

  // Stories & Feed
  STORY_NEW: 'story:new',
  STORY_UPDATE: 'story:update',
  STORY_DELETE: 'story:delete',
  POST_NEW: 'post:new',
  POST_UPDATE: 'post:update',

  // Notifications & Sync
  NOTIFICATION_NEW: 'notification:new',
  SYNC_START: 'sync:start',
  SYNC_PROGRESS: 'sync:progress',
  SYNC_COMPLETE: 'sync:complete'
};

export const PROTOCOL_CONFIG = {
  protocolVersion: PROTOCOL_VERSION,
  defaultPort: DEFAULT_LAN_PORT,
  serviceType: SERVICE_TYPE,
  heartbeatIntervalMs: 15000,
  clientTimeoutMs: 35000
};
