import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import log from 'electron-log'
import bus from '../bus'
import { useEditorStore } from './editor'
import type {
  AiChatMessage,
  AiConnectionSettings,
  AiEditSummary,
  AiInteractionMode,
  AiPreparedRevision,
  AiResponse
} from '@shared/types/ai'
import { AiChangeTracker, rangesFromSummary, fullDocumentRange, type AiChangeMarker } from './aiChangeTracker'

export interface AiApplyPayload {
  tabId: string
  mode: 'edit' | 'undo'
  beforeMarkdown: string
  markdown: string
  onApplied: (success: boolean, markdown?: string) => void
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeDocumentId = (id: string, pathname: string): string => {
  if (pathname) return `path:${pathname}`
  return `tab:${id}`
}

const documentIdentityKind = (documentId: string): 'path' | 'tab' | 'unknown' => {
  if (documentId.startsWith('path:')) return 'path'
  if (documentId.startsWith('tab:')) return 'tab'
  return 'unknown'
}

const featureLog = (message: string, ...args: unknown[]): void => {
  log.info(`[ai-editor] ${message}`, ...args)
}

// Pinia wraps store values in Vue reactive proxies. Electron IPC uses the
// structured clone algorithm, which cannot clone those proxies, so every
// chat message crossing the renderer/main boundary must be copied explicitly.
const toIpcChatMessage = (message: AiChatMessage): AiChatMessage => ({
  id: message.id,
  role: message.role,
  mode: message.mode,
  content: message.content,
  createdAt: message.createdAt,
  revisionId: message.revisionId,
  editSummary: message.editSummary
    ? {
      operationCount: message.editSummary.operationCount,
      addedLines: message.editSummary.addedLines,
      removedLines: message.editSummary.removedLines,
      operations: message.editSummary.operations.map(operation => ({ ...operation }))
    }
    : undefined
})

const toIpcChatMessages = (items: readonly AiChatMessage[]): AiChatMessage[] =>
  items.map(toIpcChatMessage)

export const useAiStore = defineStore('ai', () => {
  const editorStore = useEditorStore()
  const settings = ref<AiConnectionSettings>({
    protocol: 'openai-chat-completions',
    endpoint: '',
    model: '',
    hasApiKey: false
  })
  const mode = ref<AiInteractionMode>((localStorage.getItem('ai-mode') as AiInteractionMode) || 'answer')
  const visible = ref(localStorage.getItem('ai-panel-visible') !== 'false')
  const width = ref(Number(localStorage.getItem('ai-panel-width')) || 380)
  const messages = ref<AiChatMessage[]>([])
  const loading = ref(false)
  const error = ref('')
  const lastAnswer = ref('')
  const pendingRevision = ref<AiPreparedRevision | null>(null)
  const activeRequestId = ref<string | null>(null)
  const activeDocumentId = ref('')
  const changeTracker = new AiChangeTracker()
  const changeVersion = ref(0)
  const lastSavedSequence = new Map<string, number>()
  let saveSequence = 0
  let chatLoadSequence = 0
  let loadedChatDocumentId = ''

  const currentDocumentId = computed(() => {
    const file = editorStore.currentFile
    return file ? normalizeDocumentId(file.id, file.pathname) : ''
  })

  const currentChangeMarker = computed<AiChangeMarker | undefined>(() => {
    const version = changeVersion.value
    const tabId = editorStore.currentFile?.id
    return version >= 0 && tabId ? changeTracker.get(tabId) : undefined
  })

  const publishChangeMarker = (tabId: string): void => {
    const marker = changeTracker.get(tabId)
    bus.emit('ai-change-marker-updated', {
      tabId,
      marker: marker
        ? {
          revisionId: marker.revisionId,
          status: marker.status,
          visible: marker.visible,
          ranges: marker.ranges.map(range => ({ ...range }))
        }
        : undefined
    })
  }

  const refreshChangeMarker = (tabId?: string): void => {
    changeVersion.value += 1
    if (tabId) publishChangeMarker(tabId)
  }

  bus.on('ai-request-change-marker', (tabId) => {
    if (typeof tabId === 'string') publishChangeMarker(tabId)
  })

  bus.on('ai-document-content-changed', (payload) => {
    const data = payload as { id?: string; markdown?: string } | undefined
    if (!data?.id || typeof data.markdown !== 'string') return
    changeTracker.updateDocument(data.id, data.markdown)
    refreshChangeMarker(data.id)
  })
  bus.on('ai-document-saved', (tabId) => {
    if (typeof tabId !== 'string') return
    saveSequence += 1
    lastSavedSequence.set(tabId, saveSequence)
    changeTracker.markSaved(tabId)
    refreshChangeMarker(tabId)
  })
  bus.on('file-loaded', (payload) => {
    const data = payload as { id?: string; markdown?: string } | undefined
    if (!data?.id || typeof data.markdown !== 'string') return
    const marker = changeTracker.get(data.id)
    if (marker && data.markdown !== marker.currentMarkdown && data.markdown !== marker.beforeMarkdown && data.markdown !== marker.afterMarkdown) {
      changeTracker.clear(data.id)
      refreshChangeMarker(data.id)
    }
  })

  const setVisible = (value: boolean): void => {
    visible.value = value
    localStorage.setItem('ai-panel-visible', String(value))
  }

  const togglePanel = (): void => setVisible(!visible.value)

  const setMode = (value: AiInteractionMode): void => {
    mode.value = value
    localStorage.setItem('ai-mode', value)
    error.value = ''
  }

  const setWidth = (value: number): void => {
    width.value = Math.max(320, Math.min(520, Math.round(value)))
    localStorage.setItem('ai-panel-width', String(width.value))
  }

  const navigateToChange = (line: number): void => {
    const tabId = editorStore.currentFile?.id
    if (!tabId || !Number.isFinite(line)) return
    bus.emit('ai-navigate-to-line', { tabId, line: Math.max(1, Math.round(line)) })
  }

  const loadSettings = async(): Promise<void> => {
    try {
      settings.value = await window.electron.ipcRenderer.invoke('mt::ai::get-settings')
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  const loadChat = async(documentId: string = currentDocumentId.value): Promise<void> => {
    if (!documentId || (documentId === activeDocumentId.value && loadedChatDocumentId === documentId)) return
    const loadSequence = ++chatLoadSequence
    activeDocumentId.value = documentId
    try {
      const loadedMessages: AiChatMessage[] = await window.electron.ipcRenderer.invoke('mt::ai::chat-load', documentId)
      if (loadSequence !== chatLoadSequence || documentId !== currentDocumentId.value) return
      messages.value = loadedMessages
      loadedChatDocumentId = documentId
    } catch (err) {
      if (loadSequence !== chatLoadSequence || documentId !== currentDocumentId.value) return
      error.value = err instanceof Error ? err.message : String(err)
      messages.value = []
      loadedChatDocumentId = documentId
    }
  }

  const saveChat = async(): Promise<void> => {
    if (activeDocumentId.value) {
      await window.electron.ipcRenderer.invoke(
        'mt::ai::chat-save',
        activeDocumentId.value,
        toIpcChatMessages(messages.value.slice(-10))
      )
    }
  }

  const clearChat = async(): Promise<void> => {
    messages.value = []
    lastAnswer.value = ''
    if (activeDocumentId.value) {
      await window.electron.ipcRenderer.invoke('mt::ai::chat-clear', activeDocumentId.value)
    }
  }

  const appendMessage = (
    role: 'user' | 'assistant',
    content: string,
    messageMode: AiInteractionMode,
    options: { revisionId?: string; editSummary?: AiEditSummary } = {}
  ): void => {
    messages.value.push({
      id: createId(),
      role,
      mode: messageMode,
      content,
      createdAt: Date.now(),
      ...options
    })
    messages.value = messages.value.slice(-10)
  }

  const submit = async(prompt: string): Promise<void> => {
    const file = editorStore.currentFile
    const value = prompt.trim()
    if (!file || !value || loading.value) return
    editorStore.flushActiveEditor()
    const requestTabId = file.id
    const requestDocumentId = normalizeDocumentId(file.id, file.pathname)
    const requestId = createId()
    await loadChat(requestDocumentId)
    const requestFile = editorStore.currentFile
    if (
      !requestFile ||
      requestFile.id !== requestTabId ||
      normalizeDocumentId(requestFile.id, requestFile.pathname) !== requestDocumentId
    ) {
      featureLog('request skipped because active document changed requestId=%s', requestId)
      await loadChat()
      return
    }
    const documentId = requestDocumentId
    const baseMarkdown = requestFile.markdown
    const requestMode = mode.value
    appendMessage('user', value, requestMode)
    featureLog(
      'request snapshot mode=%s documentKind=%s markdownChars=%s contextMessages=%s requestId=%s',
      requestMode,
      documentIdentityKind(documentId),
      baseMarkdown.length,
      messages.value.length - 1,
      requestId
    )
    error.value = ''
    loading.value = true
    activeRequestId.value = requestId
    try {
      const response: AiResponse = await window.electron.ipcRenderer.invoke('mt::ai::request', {
        requestId,
        documentId,
        mode: requestMode,
        prompt: value,
        markdown: baseMarkdown,
        messages: toIpcChatMessages(messages.value.slice(0, -1))
      })
      if (requestId !== activeRequestId.value || documentId !== currentDocumentId.value) return
      if (requestMode === 'answer') {
        appendMessage('assistant', response.content, requestMode)
        lastAnswer.value = response.content
        await saveChat()
      } else if (response.markdown !== undefined) {
        await applyEdit(response, requestTabId, baseMarkdown)
      }
    } catch (err) {
      if (requestId === activeRequestId.value) {
        error.value = err instanceof Error ? err.message : String(err)
      }
    } finally {
      if (requestId === activeRequestId.value) {
        loading.value = false
        activeRequestId.value = null
      }
    }
  }

  const applyEdit = async(response: AiResponse, tabId: string, beforeMarkdown: string): Promise<void> => {
    editorStore.flushActiveEditor()
    const currentFile = editorStore.currentFile
    const nextMarkdown = response.markdown
    if (
      response.baseMarkdown !== beforeMarkdown ||
      response.documentId !== currentDocumentId.value ||
      currentFile?.id !== tabId ||
      currentFile.markdown !== beforeMarkdown ||
      nextMarkdown === undefined
    ) {
      error.value = 'The document changed while the AI was working. The edit was discarded.'
      return
    }
    if (nextMarkdown === beforeMarkdown) {
      appendMessage('assistant', '', response.mode, { editSummary: response.editSummary })
      await saveChat()
      return
    }
    const revision = await window.electron.ipcRenderer.invoke('mt::ai::revision-prepare', {
      documentId: response.documentId,
      beforeMarkdown,
      afterMarkdown: nextMarkdown,
      mode: response.mode
    })
    pendingRevision.value = revision
    const applySaveSequence = saveSequence
    await new Promise<void>((resolve) => {
      const payload: AiApplyPayload = {
        tabId,
        mode: 'edit',
        beforeMarkdown,
        markdown: nextMarkdown,
        onApplied: (success, markdown) => {
          const finishApply = async(): Promise<void> => {
            if (!success || !markdown || !pendingRevision.value) {
              error.value = 'The AI edit could not be applied because the document changed.'
              pendingRevision.value = null
              resolve()
              return
            }
            try {
              await window.electron.ipcRenderer.invoke(
                'mt::ai::revision-commit',
                pendingRevision.value.revisionId,
                response.documentId,
                markdown
              )
              const ranges = response.mode === 'rewrite'
                ? fullDocumentRange(markdown)
                : rangesFromSummary(markdown, response.editSummary)
              changeTracker.apply(
                tabId,
                pendingRevision.value.revisionId,
                beforeMarkdown,
                markdown,
                ranges
              )
              if ((lastSavedSequence.get(tabId) ?? 0) > applySaveSequence) {
                changeTracker.markSaved(tabId)
              }
              refreshChangeMarker(tabId)
              appendMessage('assistant', '', response.mode, {
                revisionId: pendingRevision.value.revisionId,
                editSummary: response.editSummary
              })
              await saveChat()
            } catch (err) {
              error.value = err instanceof Error ? err.message : String(err)
            } finally {
              pendingRevision.value = null
              resolve()
            }
          }
          finishApply().catch(() => resolve())
        }
      }
      bus.emit('ai-apply-markdown', payload)
    })
  }

  const stop = (): void => {
    if (!activeRequestId.value) return
    const requestId = activeRequestId.value
    window.electron.ipcRenderer.send('mt::ai::cancel', requestId)
    activeRequestId.value = null
    loading.value = false
  }

  const undoAiEdit = async(): Promise<void> => {
    const file = editorStore.currentFile
    const documentId = currentDocumentId.value
    if (!file || !documentId || loading.value) return
    editorStore.flushActiveEditor()
    const result = await window.electron.ipcRenderer.invoke('mt::ai::revision-undo', documentId, file.markdown)
    if (!result) {
      error.value = 'AI undo refused because the document has changed since the AI edit.'
      return
    }
    await new Promise<void>((resolve) => {
      const payload: AiApplyPayload = {
        tabId: file.id,
        mode: 'undo',
        beforeMarkdown: file.markdown,
        markdown: result.afterMarkdown,
        onApplied: (success) => {
          if (!success) error.value = 'The AI undo could not be applied.'
          resolve()
        }
      }
      bus.emit('ai-apply-markdown', payload)
    })
    if (result) {
      changeTracker.clear(file.id)
      refreshChangeMarker(file.id)
    }
  }

  return {
    settings,
    mode,
    visible,
    width,
    messages,
    loading,
    error,
    lastAnswer,
    currentChangeMarker,
    currentDocumentId,
    setVisible,
    togglePanel,
    setMode,
    setWidth,
    navigateToChange,
    loadSettings,
    loadChat,
    clearChat,
    submit,
    stop,
    undoAiEdit
  }
})
