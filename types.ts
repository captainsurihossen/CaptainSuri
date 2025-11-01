
export type ChatRole = 'user' | 'jarvis';

export interface ChatMessage {
  role: ChatRole;
  text?: string;
  imageUrl?: string;
}

export interface FunctionCallInfo {
  name: string;
  args: Record<string, any>;
}

export type AssistantStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'error';