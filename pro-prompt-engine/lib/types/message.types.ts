export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

export type MessageType =
  | 'PING' | 'INFERENCE' | 'SCORE' | 'REFACTOR' | 'GENERATE'
  | 'GET_PROFILE' | 'SET_PROFILE' | 'GET_ALL_PROFILES' | 'SET_ACTIVE_PROFILE' | 'DELETE_PROFILE'
  | 'GET_SNIPPETS' | 'SAVE_SNIPPET' | 'DELETE_SNIPPET'
  | 'SAVE_CONTEXT' | 'GET_SETTINGS' | 'SET_SETTINGS'
  | 'HEARTBEAT_PING' | 'LOAD_MODEL' | 'UNLOAD_MODEL' | 'GET_STATE'
  | 'INJECT_TOOLBAR' | 'SCAN_WEBPAGE' | 'TOGGLE_AUTOCOMPLETE' | 'TOGGLE_TEXT_SELECT'
  | 'AUTOCOMPLETE' | 'SNIPPET_QUERY' | 'CONTEXT_FEED'
  | 'GET_PROVIDER_STATUS' | 'SET_ACTIVE_PROVIDER' | 'CHECK_PII'
  | 'GET_PROMPT_HISTORY' | 'MODEL_STATE_CHANGED' | 'PROVIDER_CHANGED'
  | 'KEEP_ALIVE_PING' | 'KEEP_ALIVE_PONG' | 'SW_HEARTBEAT' | 'SW_HEARTBEAT_ACK'
  | 'MODEL_DOWNLOAD_REQUIRED';

export interface ExtensionResponse<T = unknown> {
  status: 'success' | 'error' | 'not_implemented' | 'unknown_type';
  data?: T;
  message?: string;
  timestamp?: number;
}

export interface ScoreResult { score: number; critique: string; }
export interface RefactorResult {
  originalPrompt: string;
  refinedPrompt: string;
  score: number;
  iterations: number;
  critique: string;
}
