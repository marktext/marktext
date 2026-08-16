export type AiProtocol = 'openai-chat-completions' | 'anthropic-messages'
export type AiInteractionMode = 'answer' | 'edit' | 'rewrite'
export type AiRecoveryStrategy = 'direct' | 'local-normalization' | 'model-repair' | 'whole-document-fallback'

export interface AiRecoveryInfo {
  strategy: AiRecoveryStrategy
  attempts: number
  changes?: string[]
  requiresConfirmation?: boolean
  warning?: string
}

export type AiImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

export const AI_IMAGE_MIME_TYPES: readonly AiImageMimeType[] = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
])

export const AI_MAX_IMAGE_COUNT = 10
export const AI_MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const AI_MAX_IMAGE_TOTAL_BYTES = 30 * 1024 * 1024

export interface AiImageAttachment {
  id: string
  name: string
  mimeType: AiImageMimeType
  byteSize: number
}

export interface AiImageUpload extends AiImageAttachment {
  data: Uint8Array
}

export interface AiImageData {
  mimeType: AiImageMimeType
  data: Uint8Array
}

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
  revisionId?: string
  editSummary?: AiEditSummary
  attachments?: AiImageAttachment[]
}

export interface AiRequest {
  requestId: string
  documentId: string
  mode: AiInteractionMode
  prompt: string
  markdown: string
  messages: AiChatMessage[]
  attachments?: AiImageUpload[]
}

export interface AiEditOperationSummary {
  startLine: number
  endLine: number
  addedLines: number
  removedLines: number
  /** The exact changed span in the resulting document, when available. */
  afterStartLine?: number
  afterEndLine?: number
  afterStartOffset?: number
  afterEndOffset?: number
}

export interface AiEditSummary {
  operationCount: number
  addedLines: number
  removedLines: number
  operations: AiEditOperationSummary[]
}

export interface AiResponse {
  requestId: string
  mode: AiInteractionMode
  content: string
  summary?: string
  markdown?: string
  editSummary?: AiEditSummary
  recovery?: AiRecoveryInfo
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
