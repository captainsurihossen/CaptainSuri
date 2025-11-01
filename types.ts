export type ChatRole = 'user' | 'jarvis';

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  role: ChatRole;
  text?: string;
  imageUrl?: string;
  sources?: GroundingSource[];
}

export interface FunctionCallInfo {
  name: string;
  args: Record<string, any>;
}

export type AssistantStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'error' | 'waitingForWakeWord';

// Fix: Define and export AIStudio interface to resolve global declaration errors.
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}
