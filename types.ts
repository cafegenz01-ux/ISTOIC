
/**
 * ISTOIC TITANIUM - CORE TYPE DEFINITIONS
 * High-precision types for Neural Interface, AI Models, and P2P Sync.
 */

// --- CORE DATA: NOTES & TASKS ---

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created: string; // ISO Date String
  updated: string; // ISO Date String
  is_pinned?: boolean;
  is_archived?: boolean;
  tasks?: TaskItem[];
  user?: string; // Owner ID for multi-user scenarios
}

export interface TaskItem {
  id: string;
  text: string;
  isCompleted: boolean;
  dueDate?: string; // ISO Date String
}

// --- AI CHAT SYSTEM TYPES ---

export type PersonaMode = 'hanisah' | 'stoic';

export type MessageRole = 'user' | 'model' | 'system' | 'assistant';

export type MessageStatus = 'success' | 'error' | 'retrying' | 'loading' | 'streaming';

export interface GroundingChunk {
    web?: {
        uri?: string;
        title?: string;
    };
    maps?: {
        uri?: string;
        title?: string;
    };
    // Fallback for other grounding types
    [key: string]: any; 
}

export interface MessageMetadata {
    model?: string;
    provider?: string;
    latency?: number; // In milliseconds
    status: MessageStatus;
    errorDetails?: string;
    groundingChunks?: GroundingChunk[];
    isRerouting?: boolean;
    systemStatus?: string; // E.g., "Rerouting to Llama 3..."
    createdAt?: string; // ISO Date String
    hasAttachment?: boolean;
    retryContext?: {
        prompt: string;
        attachment?: { data: string; mimeType: string };
        persona?: 'hanisah' | 'stoic';
        modelId?: string;
        threadId?: string;
    };
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string | Blob; // Supports text or binary data (audio/image input)
  metadata?: MessageMetadata;
}

export interface ChatThread {
  id: string;
  title: string;
  persona: PersonaMode;
  model_id: string;
  messages: ChatMessage[];
  updated: string; // ISO Date String
  isPinned?: boolean;
  user?: string;
}

// --- LOGGING & DIAGNOSTICS ---

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

// --- MODEL REGISTRY TYPES ---

export type AIProvider = 
    | 'GEMINI' 
    | 'GROQ' 
    | 'DEEPSEEK' 
    | 'OPENAI' 
    | 'XAI' 
    | 'MISTRAL' 
    | 'OPENROUTER';

export type ModelCategory = 
    | 'GEMINI_3' 
    | 'GEMINI_2_5' 
    | 'DEEPSEEK_OFFICIAL' 
    | 'GROQ_VELOCITY' 
    | 'OPEN_ROUTER_ELITE' 
    | 'MISTRAL_NATIVE';

export type ModelSpeed = 'INSTANT' | 'FAST' | 'THINKING' | 'DEEP';

export interface ModelSpecs {
    context: string;      // E.g., "128k"
    contextLimit: number; // E.g., 128000
    speed: ModelSpeed;
    intelligence: number; // 0-100 Score
}

export interface ModelMetadata {
  id: string;
  name: string;
  category: ModelCategory;
  provider: AIProvider;
  description: string;
  specs: ModelSpecs;
}

// --- P2P & NETWORKING TYPES (ISTOK) ---

export type ConnectionStatus = 'HANDSHAKING' | 'READY' | 'DISCONNECTED' | 'ERROR';

export interface IncomingConnection {
  conn: any; // PeerJS DataConnection (typed loosely to avoid hard dependency on PeerJS types here)
  firstData: any; // The handshake payload
  status: ConnectionStatus;
}

export interface GlobalPeerState {
  peer: any; // PeerJS instance
  isPeerReady: boolean;
  peerId: string | null;
  incomingConnection: IncomingConnection | null;
  clearIncoming: () => void;
  forceReconnect: () => void;
}

// --- AUTH & USER PROFILE ---

export interface UserPreferences {
    theme: 'dark' | 'light' | 'system';
    language: 'id' | 'en';
    reducedMotion: boolean;
    autoPlayAudio: boolean;
}

export interface UserProfile {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    bio?: string;
    preferences?: UserPreferences;
}
