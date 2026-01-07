
// ... existing types ...

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created: string; 
  updated: string; 
  is_pinned?: boolean; 
  is_archived?: boolean;
  tasks?: TaskItem[];
  user?: string;
}

export interface TaskItem {
  id: string;
  text: string;
  isCompleted: boolean;
  dueDate?: string; 
}

export interface ChatThread {
  id: string;
  title: string;
  persona: 'hanisah' | 'stoic';
  model_id: string; 
  messages: ChatMessage[];
  updated: string; 
  isPinned?: boolean;
  user?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string | Blob;
  metadata?: {
    model?: string;
    provider?: string;
    latency?: number;
    status: 'success' | 'error' | 'retrying';
    errorDetails?: string;
    groundingChunks?: any[];
    isRerouting?: boolean;
    systemStatus?: string;
  };
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'TODO' | 'KERNEL' | 'TRACE';

export interface LogEntry {
  id: string;
  timestamp: string;
  layer: string;
  level: LogLevel;
  code: string;
  message: string;
  payload?: any;
}

export interface ModelMetadata {
  id: string;
  name: string;
  category: 'GEMINI_3' | 'GEMINI_2_5' | 'DEEPSEEK_OFFICIAL' | 'GROQ_VELOCITY' | 'OPEN_ROUTER_ELITE' | 'MISTRAL_NATIVE';
  provider: 'GEMINI' | 'GROQ' | 'DEEPSEEK' | 'OPENAI' | 'XAI' | 'MISTRAL' | 'OPENROUTER';
  description: string;
  specs: { 
      context: string; 
      contextLimit: number; 
      speed: 'INSTANT' | 'FAST' | 'THINKING' | 'DEEP'; 
      intelligence: number; 
  }
}

// --- NEW STRICT TYPES FOR P2P ---
export interface IncomingConnection {
  conn: any; // PeerJS DataConnection (kept as any for lazy loading, but typed at boundary)
  firstData: any; // The handshake payload
  status: 'HANDSHAKING' | 'READY';
}

export interface GlobalPeerState {
  peer: any; // PeerJS instance
  isPeerReady: boolean;
  peerId: string | null;
  incomingConnection: IncomingConnection | null;
  clearIncoming: () => void;
  forceReconnect: () => void;
}
