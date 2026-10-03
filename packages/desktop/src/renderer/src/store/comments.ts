import type { AnchorResolution } from '@/agent/anchoring'
import { resolveAnchor } from '@/agent/anchoring'
import { markdownToTextBlocks } from '@muyajs/core'
import type { ChatEvent } from '@shared/types/agent'
import type { Anchor, CommentsFile, CommentsMutation, Thread } from '@shared/types/comments'
import { REANCHOR_DEBOUNCE_MS } from '@shared/types/comments'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import bus from '../bus'
import { useAgentStore } from './agent'
import { useEditorStore } from './editor'
import { createUnloadBag } from './releaseOnUnload'

/**
 * Threads for the markdown file open in the current tab. `resolved` is a
 * runtime anchor map (D10): an orphan is never written into the comments JSON.
 * Mutations apply only the `mt::comments::mutate` response.
 */
export type CommentsUnavailableReason = 'untitled' | 'outside' | 'not-markdown'

export type CommentsAvailability =
  | { kind: 'ready'; file: string }
  | { kind: 'unavailable'; reason: CommentsUnavailableReason }

export interface CommentsParseError {
  path: string
  message: string
}

const HINT_KEY: Record<CommentsUnavailableReason, string> = {
  untitled: 'comments.unavailableUntitled',
  outside: 'comments.unavailableOutside',
  'not-markdown': 'comments.unavailableMarkdown'
}

const repoRelative = (root: string, pathname: string): string | null => {
  const relative = window.path.relative(root, pathname)
  if (
    !relative ||
    relative === '.' ||
    relative.startsWith('..') ||
    window.path.isAbsolute(relative)
  ) {
    return null
  }
  return relative.split(window.path.sep).join('/')
}

const describeCurrent = (): CommentsAvailability => {
  const file = useEditorStore().currentFile
  if (!file?.pathname) return { kind: 'unavailable', reason: 'untitled' }

  const repo = useAgentStore().repoState
  if (repo.kind !== 'repo') return { kind: 'unavailable', reason: 'outside' }

  const relative = repoRelative(repo.root, file.pathname)
  if (!relative) return { kind: 'unavailable', reason: 'outside' }

  const name = file.filename || file.pathname
  if (!window.fileUtils.hasMarkdownExtension(name)) {
    return { kind: 'unavailable', reason: 'not-markdown' }
  }

  return { kind: 'ready', file: relative }
}

const documentKey = (): string => {
  const file = useEditorStore().currentFile
  const repo = useAgentStore().repoState
  const root = repo.kind === 'repo' ? repo.root : ''
  return `${root}\0${file?.id ?? ''}\0${file?.pathname ?? ''}`
}

const latestMissingReply = (events: readonly ChatEvent[]): Set<string> => {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event?.type === 'turn_finished') return new Set(event.missingReplyThreadIds)
  }
  return new Set()
}

export const useCommentsStore = defineStore('comments', () => {
  const threads = ref<Thread[]>([])
  const resolved = ref<Map<string, AnchorResolution>>(new Map())
  const selectedThreadId = ref<string | null>(null)
  const showClosed = ref(false)
  const parseError = ref<CommentsParseError | null>(null)
  const missingReply = ref<Set<string>>(new Set())
  const availability = ref<CommentsAvailability>({ kind: 'unavailable', reason: 'untitled' })

  const bag = createUnloadBag()
  let attached = false
  let loading = false
  let request = 0
  let loadedFor: string | null = null
  let reanchorTimer: ReturnType<typeof setTimeout> | null = null

  const unresolvedCount = computed(
    () => threads.value.filter((thread) => thread.status === 'open').length
  )

  const hintKey = computed(() =>
    availability.value.kind === 'unavailable' ? HINT_KEY[availability.value.reason] : null
  )

  const clearReanchorTimer = (): void => {
    if (reanchorTimer !== null) {
      clearTimeout(reanchorTimer)
      reanchorTimer = null
    }
  }

  const clearDocument = (): void => {
    threads.value = []
    resolved.value = new Map()
    selectedThreadId.value = null
    parseError.value = null
    loadedFor = null
  }

  function reanchor(): void {
    const markdown = useEditorStore().currentFile?.markdown ?? ''
    const blocks = markdownToTextBlocks(markdown)
    const next = new Map<string, AnchorResolution>()
    for (const thread of threads.value) {
      next.set(thread.id, resolveAnchor(blocks, thread.anchor))
    }
    resolved.value = next
  }

  const scheduleReanchor = (): void => {
    if (loading || availability.value.kind !== 'ready' || parseError.value) return
    clearReanchorTimer()
    reanchorTimer = setTimeout(() => {
      reanchorTimer = null
      reanchor()
    }, REANCHOR_DEBOUNCE_MS)
  }

  const adopt = (file: CommentsFile, preserveSelection: boolean): void => {
    parseError.value = null
    threads.value = file.threads
    loadedFor = file.file
    const selected = selectedThreadId.value
    const stillThere = selected !== null && file.threads.some((thread) => thread.id === selected)
    if (!preserveSelection || !stillThere) selectedThreadId.value = null
    reanchor()
  }

  const applyParseError = (path: string, message: string): void => {
    parseError.value = { path, message }
    threads.value = []
    resolved.value = new Map()
    selectedThreadId.value = null
    loadedFor = null
  }

  async function loadCurrent(): Promise<void> {
    const ticket = ++request
    clearReanchorTimer()
    const next = describeCurrent()
    availability.value = next

    if (next.kind !== 'ready') {
      loading = false
      clearDocument()
      return
    }

    const sameFile = loadedFor === next.file
    if (!sameFile) clearDocument()
    if (!window.comments) return

    loading = true
    try {
      const result = await window.comments.load(next.file)
      if (ticket !== request) return
      if (result.kind === 'parse_error') {
        applyParseError(result.path, result.message)
        return
      }
      if (result.file.file !== next.file) return
      adopt(result.file, sameFile)
    } catch {
      if (ticket !== request) return
      if (loadedFor !== next.file) clearDocument()
    } finally {
      if (ticket === request) loading = false
    }
  }

  async function commit(mutation: CommentsMutation): Promise<CommentsFile> {
    if (availability.value.kind !== 'ready') {
      throw new Error('comments are unavailable for this file')
    }
    if (parseError.value) throw new Error('comments file is unreadable')
    if (!window.comments) throw new Error('comments bridge is missing')

    const file = await window.comments.mutate(mutation)
    if (availability.value.kind === 'ready' && availability.value.file === file.file) {
      adopt(file, true)
    }
    return file
  }

  // `loadChange` emits `file-changed` with `isReload`: one external edit, resolved
  // in that turn. Keystrokes only update markdown, so they wait out D10's debounce.
  const onFileChanged = (payload: unknown): void => {
    const event = payload as { id?: string; isReload?: boolean }
    if (!event.isReload) return
    const current = useEditorStore().currentFile
    if (!current || event.id !== current.id) return
    if (availability.value.kind !== 'ready' || parseError.value) return
    clearReanchorTimer()
    reanchor()
  }

  const attach = (): void => {
    if (attached) return
    attached = true

    watch(documentKey, () => {
      loadCurrent().catch(() => undefined)
    })

    watch(
      () => useEditorStore().currentFile?.markdown,
      () => {
        scheduleReanchor()
      }
    )

    watch(
      () => useAgentStore().events.length,
      () => {
        missingReply.value = latestMissingReply(useAgentStore().events)
      },
      { immediate: true }
    )
  }

  function listen(): void {
    bag.listen((add) => {
      add(clearReanchorTimer)
      bus.on('file-changed', onFileChanged)
      add(() => {
        bus.off('file-changed', onFileChanged)
      })

      if (window.comments) {
        add(
          window.comments.onChanged(({ file }) => {
            if (availability.value.kind === 'ready' && availability.value.file === file) {
              loadCurrent().catch(() => undefined)
            }
          })
        )
      }
    })

    attach()
    loadCurrent().catch(() => undefined)
  }

  async function createThread(anchor: Anchor, firstText: string): Promise<CommentsFile> {
    if (availability.value.kind !== 'ready') {
      throw new Error('comments are unavailable for this file')
    }
    return commit({ op: 'createThread', file: availability.value.file, anchor, firstText })
  }

  async function addHumanMessage(threadId: string, text: string): Promise<CommentsFile> {
    return commit({ op: 'addHumanMessage', threadId, text })
  }

  async function editHumanMessage(messageId: string, text: string): Promise<CommentsFile> {
    return commit({ op: 'editHumanMessage', messageId, text })
  }

  async function deleteHumanMessage(messageId: string): Promise<CommentsFile> {
    return commit({ op: 'deleteHumanMessage', messageId })
  }

  async function setStatus(threadId: string, status: Thread['status']): Promise<CommentsFile> {
    return commit({ op: 'setStatus', threadId, status })
  }

  async function deleteThread(threadId: string): Promise<CommentsFile> {
    return commit({ op: 'deleteThread', threadId })
  }

  async function appendAgentReply(
    turnId: string,
    threadId: string,
    text: string
  ): Promise<CommentsFile> {
    return commit({ op: 'appendAgentReply', turnId, threadId, text })
  }

  async function moveFile(oldPath: string, newPath: string): Promise<CommentsFile> {
    return commit({ op: 'moveFile', oldPath, newPath })
  }

  return {
    threads,
    resolved,
    selectedThreadId,
    showClosed,
    parseError,
    missingReply,
    availability,
    hintKey,
    unresolvedCount,
    listen,
    stop: bag.stop,
    createThread,
    addHumanMessage,
    editHumanMessage,
    deleteHumanMessage,
    setStatus,
    deleteThread,
    appendAgentReply,
    moveFile
  }
})
