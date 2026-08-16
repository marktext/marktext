export type AiProtocol = 'openai-chat-completions' | 'anthropic-messages'
export type AiInteractionMode = 'answer' | 'edit'

export interface AiConnectionSettings {
  protocol: AiProtocol
  endpoint: string
  model: string
  hasApiKey: boolean
}

export interface AiConnectionSettingsInput {
  protocol: AiProtocol
  endpoint: string
  model: string
  apiKey?: string
}

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  mode: AiInteractionMode
  content: string
  createdAt: number
}

export interface AiRequest {
  requestId: string
  documentId: string
  mode: AiInteractionMode
  prompt: string
  markdown: string
  messages: AiChatMessage[]
}

export interface AiResponse {
  requestId: string
  mode: AiInteractionMode
  content: string
  documentId: string
  baseMarkdown: string
}

export interface AiTestResult {
  ok: boolean
  message: string
}

export interface AiRevisionRequest {
  documentId: string
  beforeMarkdown: string
  afterMarkdown: string
  mode: AiInteractionMode
}

export interface AiPreparedRevision extends AiRevisionRequest {
  revisionId: string
  preparedAt: number
}

export interface AiUndoResult {
  revisionId: string
  documentId: string
  beforeMarkdown: string
  afterMarkdown: string
}
