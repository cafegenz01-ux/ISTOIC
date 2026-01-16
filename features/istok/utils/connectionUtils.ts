/**
 * IStok Connection & Performance Utilities
 * Enhanced networking and message handling
 */

export type ConnectionStage = 'IDLE' | 'LOCATING' | 'HANDSHAKE' | 'SECURE' | 'RECONNECTING';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'ERROR';
export type SoundType = 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'ERROR' | 'RING';

export interface IStokConfig {
  chunkSize: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  handshakeTimeout: number;
  callTimeout: number;
  maxRetries: number;
}

/**
 * Default IStok configuration
 */
export const DEFAULT_ISTOK_CONFIG: IStokConfig = {
  chunkSize: 1024 * 64, // 64KB
  heartbeatInterval: 2000,
  connectionTimeout: 10000,
  handshakeTimeout: 30000,
  callTimeout: 30000,
  maxRetries: 3
};

/**
 * Check connection is alive
 */
export const isConnectionAlive = (
  isConnected: boolean,
  isPeerAlive: boolean,
  lastHeartbeat: number,
  timeout: number
): boolean => {
  const timeSinceHeartbeat = Date.now() - lastHeartbeat;
  return isConnected && isPeerAlive && timeSinceHeartbeat < timeout;
};

/**
 * Calculate reconnect delay with exponential backoff
 */
export const calculateBackoffDelay = (attempt: number, baseDelay: number = 1000): number => {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
  const jitter = Math.random() * 1000;
  return exponentialDelay + jitter;
};

/**
 * Check if message needs retry
 */
export const shouldRetryMessage = (
  status: MessageStatus,
  timestamp: number,
  maxAge: number = 60000
): boolean => {
  return (
    status === 'PENDING' &&
    Date.now() - timestamp > maxAge
  );
};

/**
 * Validate message size
 */
export const isMessageSizeValid = (message: string, maxSize: number = 65536): boolean => {
  return new Blob([message]).size <= maxSize;
};

/**
 * Format connection status for display
 */
export const formatConnectionStatus = (stage: ConnectionStage): string => {
  const statusMap: Record<ConnectionStage, string> = {
    IDLE: 'Ready',
    LOCATING: 'Locating peer...',
    HANDSHAKE: 'Establishing connection...',
    SECURE: 'Connected',
    RECONNECTING: 'Reconnecting...'
  };
  return statusMap[stage];
};

/**
 * Get connection status color
 */
export const getConnectionStatusColor = (stage: ConnectionStage): string => {
  const colorMap: Record<ConnectionStage, string> = {
    IDLE: 'text-text-muted',
    LOCATING: 'text-warning',
    HANDSHAKE: 'text-info',
    SECURE: 'text-success',
    RECONNECTING: 'text-danger'
  };
  return colorMap[stage];
};

/**
 * Compress message batch
 */
export const compressMessageBatch = (messages: any[]): string => {
  // Simple compression - in production use gzip
  return JSON.stringify(messages);
};

/**
 * Decompress message batch
 */
export const decompressMessageBatch = (compressed: string): any[] => {
  try {
    return JSON.parse(compressed);
  } catch {
    return [];
  }
};

/**
 * Generate unique message ID
 */
export const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
