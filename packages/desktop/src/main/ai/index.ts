import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import type {
  AiChatMessage,
  AiConnectionSettings,
  AiConnectionSettingsInput,
  AiEditSummary,
  AiProtocol,
  AiPreparedRevision,
  AiRequest,
  AiResponse,
  AiRevisionRequest,
  AiTestResult,
  AiUndoResult
} from '@shared/types/ai'
import { runDocumentEditAgent } from './documentEditAgent'
import {
  answerSystemPrompt,
  buildDocumentContext,
  connectionTestSystemPrompt,
  connectionTestUserPrompt,
  previousPreciseEditContextMessage,
  previousRewriteContextMessage,
  rewriteSystemPrompt
} from './prompts'

const DEFAULT_PROTOCOL = 'openai-chat-completions' as const
const SETTINGS_FILE = 'ai-connection.json'
const KEY_FILE = 'ai-connection-key.json'
const CHAT_FILE = 'ai-chat.json'
const REVISION_FILE = 'ai-revisions.json'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_CONTEXT_MESSAGES = 10
const REQUEST_TIMEOUT_MS = 300_000

type ProviderMessage = { role: 'user' | 'assistant'; content: string }

interface ProviderResponse {
  content: string
  truncated: boolean
}

const normalizeRevisionMarkdown = (value: string): string => value.replace(/[\r\n]+$/, '')

interface StoredSettings {
  protocol: AiConnectionSettings['protocol']
  endpoint: string
  model: string
}

interface StoredRevision extends AiPreparedRevision {
  status: 'prepared' | 'committed'
  committedAt?: number
}

interface StoredRevisionState {
  revisions: StoredRevision[]
}

const featureLog = (message: string, ...args: unknown[]): void => {
  log.info(`[ai-editor] ${message}`, ...args)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const value: unknown = JSON.parse(await fsPromises.readFile(filePath, 'utf8'))
    return value as T
  } catch {
    return fallback
  }
}

const writeJsonAtomic = async(filePath: string, value: unknown): Promise<void> => {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`
  await fsPromises.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  try {
    await fsPromises.rename(tempPath, filePath)
  } catch {
    // Windows cannot replace an existing file with rename in every filesystem
    // configuration; keep the same recoverable temp-file path and retry.
    await fsPromises.unlink(filePath).catch(() => undefined)
    await fsPromises.rename(tempPath, filePath)
  }
  try {
    await fsPromises.chmod(filePath, 0o600)
  } catch {
    // chmod is best effort on filesystems that do not expose POSIX modes.
  }
}

const validateEndpoint = (endpoint: string): string => {
  const value = endpoint.trim()
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Endpoint must be a complete HTTPS URL.')
  }
  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS endpoints are supported.')
  }
  if (!url.hostname) {
    throw new Error('Endpoint must include a hostname.')
  }
  return url.toString()
}

const validateInput = (input: AiConnectionSettingsInput): StoredSettings => {
  if (input.protocol !== 'openai-chat-completions' && input.protocol !== 'anthropic-messages') {
    throw new Error('Unsupported AI protocol.')
  }
  const endpoint = validateEndpoint(input.endpoint)
  const model = input.model.trim()
  if (!model) throw new Error('Model is required.')
  return { protocol: input.protocol, endpoint, model }
}

const resolveRequestEndpoint = (settings: StoredSettings): string => {
  const url = new URL(settings.endpoint)
  const pathname = url.pathname.replace(/\/+$/, '')
  if (settings.protocol === 'openai-chat-completions') {
    if (!pathname.endsWith('/chat/completions')) {
      url.pathname = `${pathname}/chat/completions`
    }
  } else if (!pathname.endsWith('/messages')) {
    url.pathname = pathname.endsWith('/v1')
      ? `${pathname}/messages`
      : `${pathname}/v1/messages`
  }
  return url.toString()
}

const toPublicSettings = (settings: StoredSettings, apiKey: string): AiConnectionSettings => ({
  ...settings,
  hasApiKey: apiKey.length > 0
})

const normalizeMessages = (messages: unknown): AiChatMessage[] => {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((item): item is AiChatMessage => {
      if (!isRecord(item)) return false
      return (
        typeof item.id === 'string' &&
        (item.role === 'user' || item.role === 'assistant') &&
        (item.mode === 'answer' || item.mode === 'edit' || item.mode === 'rewrite') &&
        typeof item.content === 'string' &&
        typeof item.createdAt === 'number'
      )
    })
    .map((item) => {
      const summary = item.editSummary
      const editSummary: AiEditSummary | undefined = isRecord(summary) &&
        typeof summary.operationCount === 'number' &&
        typeof summary.addedLines === 'number' &&
        typeof summary.removedLines === 'number' &&
        Array.isArray(summary.operations)
        ? {
          operationCount: summary.operationCount,
          addedLines: summary.addedLines,
          removedLines: summary.removedLines,
          operations: summary.operations.filter(isRecord).filter(operation =>
            typeof operation.startLine === 'number' &&
            typeof operation.endLine === 'number' &&
            typeof operation.addedLines === 'number' &&
            typeof operation.removedLines === 'number'
          ).map(operation => ({
            startLine: operation.startLine as number,
            endLine: operation.endLine as number,
            addedLines: operation.addedLines as number,
            removedLines: operation.removedLines as number,
            afterStartLine: typeof operation.afterStartLine === 'number'
              ? operation.afterStartLine as number
              : operation.startLine as number,
            afterEndLine: typeof operation.afterEndLine === 'number'
              ? operation.afterEndLine as number
              : operation.endLine as number,
            afterStartOffset: typeof operation.afterStartOffset === 'number'
              ? operation.afterStartOffset as number
              : undefined,
            afterEndOffset: typeof operation.afterEndOffset === 'number'
              ? operation.afterEndOffset as number
              : undefined
          }))
        }
        : undefined
      return {
        ...item,
        revisionId: typeof item.revisionId === 'string' ? item.revisionId : undefined,
        editSummary
      }
    })
    .slice(-MAX_CONTEXT_MESSAGES)
}

const extractText = (payload: unknown): string => {
  if (!isRecord(payload)) return ''
  const choices = payload.choices
  if (Array.isArray(choices)) {
    const message = choices[0]
    if (isRecord(message) && isRecord(message.message)) {
      const content = message.message.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content
          .filter(isRecord)
          .map((part) => (typeof part.text === 'string' ? part.text : ''))
          .join('')
      }
    }
  }
  const content = payload.content
  if (Array.isArray(content)) {
    return content
      .filter(isRecord)
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
  }
  return ''
}

const isTruncatedResponse = (payload: unknown, protocol: AiProtocol): boolean => {
  if (!isRecord(payload)) return false
  if (protocol === 'anthropic-messages') return payload.stop_reason === 'max_tokens'
  const choices = payload.choices
  if (!Array.isArray(choices) || !isRecord(choices[0])) return false
  return choices[0].finish_reason === 'length'
}

const assertRewriteOutput = (value: string): string => {
  const content = value.trim()
  if (!content) throw new Error('The model returned an empty document.')
  if (/^```/.test(content) || /```$/.test(content)) {
    throw new Error('The model returned a fenced document instead of Markdown.')
  }
  return content
}

class AiService {
  private readonly settingsPath: string
  private readonly keyPath: string
  private readonly chatPath: string
  private readonly revisionPath: string
  private readonly controllers = new Map<string, AbortController>()

  constructor(userDataPath: string) {
    this.settingsPath = path.join(userDataPath, SETTINGS_FILE)
    this.keyPath = path.join(userDataPath, KEY_FILE)
    this.chatPath = path.join(userDataPath, CHAT_FILE)
    this.revisionPath = path.join(userDataPath, REVISION_FILE)
  }

  private async readSettings(): Promise<{ settings: StoredSettings; apiKey: string }> {
    const settings = await readJson<StoredSettings>(this.settingsPath, {
      protocol: DEFAULT_PROTOCOL,
      endpoint: '',
      model: ''
    })
    const apiKeyValue = await readJson<unknown>(this.keyPath, '')
    const apiKey = typeof apiKeyValue === 'string' ? apiKeyValue : ''
    return {
      settings: {
        protocol:
          settings.protocol === 'anthropic-messages'
            ? 'anthropic-messages'
            : DEFAULT_PROTOCOL,
        endpoint: typeof settings.endpoint === 'string' ? settings.endpoint : '',
        model: typeof settings.model === 'string' ? settings.model : ''
      },
      apiKey
    }
  }

  async getSettings(): Promise<AiConnectionSettings> {
    const { settings, apiKey } = await this.readSettings()
    return toPublicSettings(settings, apiKey)
  }

  async saveSettings(input: AiConnectionSettingsInput): Promise<AiConnectionSettings> {
    const settings = validateInput(input)
    const previous = await this.readSettings()
    await writeJsonAtomic(this.settingsPath, settings)
    if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
      await writeJsonAtomic(this.keyPath, input.apiKey.trim())
    } else if (!fs.existsSync(this.keyPath) && previous.apiKey) {
      await writeJsonAtomic(this.keyPath, previous.apiKey)
    }
    featureLog('connection settings saved')
    return toPublicSettings(settings, (await this.readSettings()).apiKey)
  }

  async deleteKey(): Promise<AiConnectionSettings> {
    try {
      await fsPromises.unlink(this.keyPath)
    } catch {
      // Deleting an already absent key is idempotent.
    }
    featureLog('connection key deleted')
    return this.getSettings()
  }

  private async requestProvider(
    settings: StoredSettings,
    apiKey: string,
    system: string,
    messages: ProviderMessage[],
    requestId: string,
    signal?: AbortSignal
  ): Promise<ProviderResponse> {
    if (!apiKey) throw new Error('Configure an API key in AI settings first.')
    if (!settings.endpoint || !settings.model) {
      throw new Error('Configure an AI endpoint and model first.')
    }
    const requestEndpoint = resolveRequestEndpoint(settings)
    featureLog(
      'request start protocol=%s endpoint=%s model=%s requestId=%s',
      settings.protocol,
      requestEndpoint,
      settings.model,
      requestId
    )
    const controller = new AbortController()
    const abortFromParent = () => controller.abort()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', abortFromParent, { once: true })
    } else {
      this.controllers.set(requestId, controller)
    }
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      featureLog(
        'request timeout protocol=%s endpoint=%s model=%s requestId=%s timeoutMs=%s',
        settings.protocol,
        requestEndpoint,
        settings.model,
        requestId,
        REQUEST_TIMEOUT_MS
      )
      controller.abort()
    }, REQUEST_TIMEOUT_MS)
    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        'content-type': 'application/json'
      }
      let body: Record<string, unknown>
      if (settings.protocol === 'anthropic-messages') {
        headers['x-api-key'] = apiKey
        headers['api-key'] = apiKey
        headers['anthropic-version'] = ANTHROPIC_VERSION
        body = { model: settings.model, max_tokens: 4096, system, messages }
      } else {
        headers.authorization = `Bearer ${apiKey}`
        // Some OpenAI-compatible gateways, including MiMo Token Plan, document
        // `api-key` instead of the standard Authorization header.
        headers['api-key'] = apiKey
        body = { model: settings.model, messages: [{ role: 'system', content: system }, ...messages] }
      }
      const response = await fetch(requestEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        redirect: 'error',
        signal: controller.signal
      })
      featureLog(
        'request response status=%s protocol=%s endpoint=%s model=%s requestId=%s',
        response.status,
        settings.protocol,
        requestEndpoint,
        settings.model,
        requestId
      )
      const text = await response.text()
      let payload: unknown
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
      if (!response.ok) {
        const providerMessage = isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
          ? payload.error.message
          : `Provider returned HTTP ${response.status}.`
        throw new Error(`Provider returned HTTP ${response.status} from ${requestEndpoint}. ${providerMessage}`)
      }
      const content = extractText(payload)
      if (!content) throw new Error('The provider returned no text content.')
      return { content, truncated: isTruncatedResponse(payload, settings.protocol) }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) {
          throw new Error(`AI provider request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`)
        }
        featureLog(
          'request cancelled protocol=%s endpoint=%s model=%s requestId=%s',
          settings.protocol,
          requestEndpoint,
          settings.model,
          requestId
        )
        throw new Error('AI request was cancelled.')
      }
      featureLog(
        'request error name=%s message=%s protocol=%s endpoint=%s model=%s requestId=%s',
        error instanceof Error ? error.name : 'unknown',
        error instanceof Error ? error.message : String(error),
        settings.protocol,
        requestEndpoint,
        settings.model,
        requestId
      )
      throw error
    } finally {
      clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', abortFromParent)
      else this.controllers.delete(requestId)
    }
  }

  async testSettings(input: AiConnectionSettingsInput): Promise<AiTestResult> {
    try {
      const settings = validateInput(input)
      const current = await this.readSettings()
      const apiKey = input.apiKey?.trim() || current.apiKey
      await this.requestProvider(
        settings,
        apiKey,
        connectionTestSystemPrompt,
        [{ role: 'user', content: connectionTestUserPrompt }],
        `test-${crypto.randomUUID()}`
      )
      return { ok: true, message: 'Connection succeeded.' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async request(request: AiRequest): Promise<AiResponse> {
    if (!request.requestId || !request.documentId) throw new Error('Invalid AI request.')
    const { settings, apiKey } = await this.readSettings()
    const recentMessages = normalizeMessages(request.messages).map(({ role, mode, content }) => ({
      role,
      content: content || (mode === 'rewrite' ? previousRewriteContextMessage : previousPreciseEditContextMessage)
    }))
    let documentKind = 'unknown'
    if (request.documentId.startsWith('path:')) documentKind = 'path'
    else if (request.documentId.startsWith('tab:')) documentKind = 'tab'
    featureLog(
      'request input mode=%s documentKind=%s markdownChars=%s contextMessages=%s requestId=%s',
      request.mode,
      documentKind,
      request.markdown.length,
      recentMessages.length,
      request.requestId
    )
    const documentContext = buildDocumentContext(request.markdown)
    if (request.mode === 'answer') {
      const result = await this.requestProvider(
        settings,
        apiKey,
        answerSystemPrompt,
        [...recentMessages, { role: 'user', content: `${request.prompt}${documentContext}` }],
        request.requestId
      )
      featureLog(
        'request content received mode=%s contentChars=%s requestId=%s',
        request.mode,
        result.content.length,
        request.requestId
      )
      return {
        requestId: request.requestId,
        mode: request.mode,
        content: result.content.trim(),
        documentId: request.documentId,
        baseMarkdown: request.markdown
      }
    }

    const controller = new AbortController()
    this.controllers.set(request.requestId, controller)
    try {
      if (request.mode === 'rewrite') {
        const result = await this.requestProvider(
          settings,
          apiKey,
          rewriteSystemPrompt,
          [...recentMessages, { role: 'user', content: `${request.prompt}${documentContext}` }],
          request.requestId,
          controller.signal
        )
        if (result.truncated) throw new Error('The model response was truncated before a complete document was returned.')
        const markdown = assertRewriteOutput(result.content)
        featureLog(
          'request content received mode=%s contentChars=%s requestId=%s',
          request.mode,
          markdown.length,
          request.requestId
        )
        return {
          requestId: request.requestId,
          mode: request.mode,
          content: '',
          markdown,
          documentId: request.documentId,
          baseMarkdown: request.markdown
        }
      }

      const result = await runDocumentEditAgent({
        markdown: request.markdown,
        instruction: request.prompt,
        contextMessages: recentMessages,
        requestId: request.requestId,
        signal: controller.signal,
        generate: async(agentRequest) => {
          const generated = await this.requestProvider(
            settings,
            apiKey,
            agentRequest.system,
            agentRequest.messages,
            agentRequest.requestId,
            agentRequest.signal
          )
          return { content: generated.content, truncated: generated.truncated }
        },
        onValidationFailure: diagnostic => {
          featureLog(
            'edit agent validation failure attempt=%s error=%s responseChars=%s responseLines=%s searchMarkers=%s legacySearchMarkers=%s dividerMarkers=%s legacyDividerMarkers=%s replaceMarkers=%s legacyReplaceMarkers=%s requestId=%s',
            diagnostic.attempt,
            diagnostic.error,
            diagnostic.responseChars,
            diagnostic.responseLines,
            diagnostic.searchMarkers,
            diagnostic.legacySearchMarkers,
            diagnostic.dividerMarkers,
            diagnostic.legacyDividerMarkers,
            diagnostic.replaceMarkers,
            diagnostic.legacyReplaceMarkers,
            request.requestId
          )
        }
      })
      featureLog(
        'edit agent applied mode=%s attempts=%s operations=%s addedLines=%s removedLines=%s requestId=%s',
        request.mode,
        result.attempts,
        result.summary.operationCount,
        result.summary.addedLines,
        result.summary.removedLines,
        request.requestId
      )
      return {
        requestId: request.requestId,
        mode: request.mode,
        content: '',
        markdown: result.markdown,
        editSummary: result.summary,
        documentId: request.documentId,
        baseMarkdown: request.markdown
      }
    } finally {
      this.controllers.delete(request.requestId)
    }
  }

  cancel(requestId: string): void {
    if (this.controllers.has(requestId)) {
      featureLog('request cancel requested requestId=%s', requestId)
      this.controllers.get(requestId)?.abort()
    }
  }

  async loadChat(documentId: string): Promise<AiChatMessage[]> {
    const all = await readJson<Record<string, unknown>>(this.chatPath, {})
    return normalizeMessages(all[documentId])
  }

  async saveChat(documentId: string, messages: AiChatMessage[]): Promise<void> {
    const all = await readJson<Record<string, unknown>>(this.chatPath, {})
    all[documentId] = normalizeMessages(messages)
    await writeJsonAtomic(this.chatPath, all)
  }

  async clearChat(documentId: string): Promise<void> {
    const all = await readJson<Record<string, unknown>>(this.chatPath, {})
    delete all[documentId]
    await writeJsonAtomic(this.chatPath, all)
  }

  private async readRevisions(): Promise<StoredRevisionState> {
    const state = await readJson<StoredRevisionState>(this.revisionPath, { revisions: [] })
    return { revisions: Array.isArray(state.revisions) ? state.revisions : [] }
  }

  async prepareRevision(request: AiRevisionRequest): Promise<AiPreparedRevision> {
    if (!request.documentId) throw new Error('Invalid document identity.')
    const revision: StoredRevision = {
      ...request,
      revisionId: crypto.randomUUID(),
      preparedAt: Date.now(),
      status: 'prepared'
    }
    const state = await this.readRevisions()
    state.revisions.push(revision)
    await writeJsonAtomic(this.revisionPath, state)
    featureLog(
      'revision prepared revisionId=%s beforeChars=%s afterChars=%s',
      revision.revisionId,
      revision.beforeMarkdown.length,
      revision.afterMarkdown.length
    )
    return revision
  }

  async commitRevision(revisionId: string, documentId: string, afterMarkdown: string): Promise<void> {
    const state = await this.readRevisions()
    const revision = state.revisions.find((item) => item.revisionId === revisionId)
    if (!revision || revision.documentId !== documentId) throw new Error('Revision is no longer valid.')
    // Muya may normalize Markdown while applying a replacement. The renderer
    // sends that serialized result back, which is the canonical content for
    // undo and must replace the model's pre-serialization output.
    revision.afterMarkdown = afterMarkdown
    revision.status = 'committed'
    revision.committedAt = Date.now()
    await writeJsonAtomic(this.revisionPath, state)
    featureLog(
      'revision committed revisionId=%s afterChars=%s',
      revisionId,
      afterMarkdown.length
    )
  }

  async undoRevision(documentId: string, currentMarkdown: string): Promise<AiUndoResult | null> {
    const state = await this.readRevisions()
    const revision = [...state.revisions]
      .reverse()
      .find((item) => item.documentId === documentId && item.status === 'committed')
    if (!revision || normalizeRevisionMarkdown(revision.afterMarkdown) !== normalizeRevisionMarkdown(currentMarkdown)) return null
    const inverse: StoredRevision = {
      revisionId: crypto.randomUUID(),
      documentId,
      beforeMarkdown: currentMarkdown,
      afterMarkdown: revision.beforeMarkdown,
      mode: 'edit',
      preparedAt: Date.now(),
      status: 'committed',
      committedAt: Date.now()
    }
    state.revisions.push(inverse)
    await writeJsonAtomic(this.revisionPath, state)
    return {
      revisionId: inverse.revisionId,
      documentId,
      beforeMarkdown: inverse.beforeMarkdown,
      afterMarkdown: inverse.afterMarkdown
    }
  }

  async migrateDocumentIdentity(fromDocumentId: string, toDocumentId: string): Promise<void> {
    if (!fromDocumentId || !toDocumentId || fromDocumentId === toDocumentId) return
    const chats = await readJson<Record<string, unknown>>(this.chatPath, {})
    if (chats[fromDocumentId] !== undefined) {
      chats[toDocumentId] = chats[toDocumentId] ?? chats[fromDocumentId]
      delete chats[fromDocumentId]
      await writeJsonAtomic(this.chatPath, chats)
    }
    const state = await this.readRevisions()
    let changed = false
    for (const revision of state.revisions) {
      if (revision.documentId === fromDocumentId) {
        revision.documentId = toDocumentId
        changed = true
      }
    }
    if (changed) await writeJsonAtomic(this.revisionPath, state)
  }
}

export const registerAiIpcHandlers = (userDataPath: string): void => {
  const aiService = new AiService(userDataPath)
  const broadcastSettings = (settings: AiConnectionSettings): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('mt::ai-settings-changed', settings)
    }
  }
  ipcMain.handle('mt::ai::get-settings', () => aiService.getSettings())
  ipcMain.handle('mt::ai::save-settings', async(_event, settings: AiConnectionSettingsInput) => {
    const saved = await aiService.saveSettings(settings)
    broadcastSettings(saved)
    return saved
  })
  ipcMain.handle('mt::ai::delete-key', async() => {
    const saved = await aiService.deleteKey()
    broadcastSettings(saved)
    return saved
  })
  ipcMain.handle('mt::ai::test-settings', (_event, settings: AiConnectionSettingsInput) => aiService.testSettings(settings))
  ipcMain.handle('mt::ai::request', (_event, request: AiRequest) => aiService.request(request))
  ipcMain.on('mt::ai::cancel', (_event, requestId: string) => aiService.cancel(requestId))
  ipcMain.handle('mt::ai::chat-load', (_event, documentId: string) => aiService.loadChat(documentId))
  ipcMain.handle('mt::ai::chat-save', (_event, documentId: string, messages: AiChatMessage[]) => aiService.saveChat(documentId, messages))
  ipcMain.handle('mt::ai::chat-clear', (_event, documentId: string) => aiService.clearChat(documentId))
  ipcMain.handle('mt::ai::revision-prepare', (_event, request: AiRevisionRequest) => aiService.prepareRevision(request))
  ipcMain.handle('mt::ai::revision-commit', (_event, revisionId: string, documentId: string, afterMarkdown: string) => aiService.commitRevision(revisionId, documentId, afterMarkdown))
  ipcMain.handle('mt::ai::revision-undo', (_event, documentId: string, currentMarkdown: string) => aiService.undoRevision(documentId, currentMarkdown))
  ipcMain.handle('mt::ai::revision-migrate', (_event, fromDocumentId: string, toDocumentId: string) => aiService.migrateDocumentIdentity(fromDocumentId, toDocumentId))
  featureLog('IPC handlers registered')
}
