import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
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

  const currentDocumentId = computed(() => {
    const file = editorStore.currentFile
    return file ? normalizeDocumentId(file.id, file.pathname) : ''
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

  const loadSettings = async(): Promise<void> => {
    try {
      settings.value = await window.electron.ipcRenderer.invoke('mt::ai::get-settings')
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  const loadChat = async(documentId: string = currentDocumentId.value): Promise<void> => {
    if (!documentId || documentId === activeDocumentId.value) return
    activeDocumentId.value = documentId
    try {
      messages.value = await window.electron.ipcRenderer.invoke('mt::ai::chat-load', documentId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      messages.value = []
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
    await loadChat()
    const documentId = currentDocumentId.value
    const baseMarkdown = editorStore.currentFile?.markdown ?? file.markdown
    const requestId = createId()
    const requestMode = mode.value
    appendMessage('user', value, requestMode)
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
        await applyEdit(response, file.id, baseMarkdown)
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
    currentDocumentId,
    setVisible,
    togglePanel,
    setMode,
    setWidth,
    loadSettings,
    loadChat,
    clearChat,
    submit,
    stop,
    undoAiEdit
  }
})
