export const PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_LAN_PORT = 47821;
export const SERVICE_TYPE = '_flick._tcp';

export type NetworkMode = 'AUTO' | 'ONLINE' | 'LAN' | 'OFFLINE';
export type ConnectionStatus = 'ONLINE' | 'SCHOOL_LAN' | 'OFFLINE' | 'SYNCING';

export interface ServerInfo {
  serverId: string;
  serverName: string;
  ipAddress: string;
  port: number;
  protocolVersion: string;
  flickVersion: string;
  capabilities: string[];
  online: boolean;
  activeUsers: number;
  connectedDevices: number;
  cloudStatus: 'CONNECTED' | 'DISCONNECTED' | 'SYNCING' | 'ERROR';
  dbSizeMB: number;
  mediaSizeMB: number;
  uptimeSeconds: number;
}

export interface WsMessage<T = any> {
  event: string;
  payload: T;
  operationId?: string;
  timestamp: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  deviceId: string;
  expiresAt: string;
  isApproved: boolean;
  isAdmin: boolean;
}

export interface SyncOperation {
  operationId: string;
  deviceId: string;
  userId: string;
  entityType: 'message' | 'conversation' | 'story' | 'post' | 'profile' | 'reaction' | 'notification';
  entityId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  status: 'QUEUED' | 'LAN_PENDING' | 'LAN_ACK' | 'CLOUD_PENDING' | 'SYNCED' | 'FAILED';
  version: number;
}
