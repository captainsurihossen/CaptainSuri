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

// Fix: Define AIStudio within the `declare global` block to make it a true global
// type and avoid module scope conflicts that lead to declaration errors.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio: AIStudio;
  }
}
