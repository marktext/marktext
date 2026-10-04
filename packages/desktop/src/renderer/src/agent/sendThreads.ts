import type { ThreadPlacement } from '@shared/types/agent'
import type { Thread } from '@shared/types/comments'
import { markdownToTextBlocks } from '@muyajs/core'
import { ref } from 'vue'
import { locateBlocksInSource, resolveAnchor, type LocatedBlock } from '@/agent/anchoring'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'

/** How long to wait for the existing save action before the send is cancelled. */
const SAVE_TIMEOUT_MS = 20_000

export type SendBlockReason = 'mode' | 'harness' | 'model' | 'turn'

const REASON_KEY: Record<SendBlockReason, string> = {
  mode: 'comments.sendBlockedMode',
  harness: 'comments.sendBlockedHarness',
  model: 'comments.sendBlockedModel',
  turn: 'agent.turnWait'
}

/** True from the click until `send-threads` settles, including the running turn. */
export const sendPending = ref(false)

export function sendUnavailableReason(): SendBlockReason | null {
  const preferences = usePreferencesStore()
  if (!preferences.agentModeEnabled) return 'mode'

  const agent = useAgentStore()
  if (agent.turnInProgress) return 'turn'

  const status = agent.harnessStatuses.find((item) => item.id === preferences.agentHarness)
  if (
    status &&
    (!status.found ||
      status.reason === 'not_found' ||
      status.reason === 'not_executable' ||
      status.reason === 'init_failed')
  ) {
    return 'harness'
  }
  if (status?.reason === 'no_models') return 'model'
  if (agent.selectionKnown && !agent.selectionModel) return 'model'
  return null
}

export function sendReasonTitle(reason: SendBlockReason | null): string | undefined {
  if (!reason) return undefined
  return t(REASON_KEY[reason])
}

/**
 * Re-resolve every thread against the text that was just saved. Line numbers
 * in the prompt are inclusive and 1-based; the source map is 0-based, and an
 * exclusive end can sit on the next line at column 0.
 */
export function threadPlacements(markdown: string, threads: readonly Thread[]): ThreadPlacement[] {
  const blocks = markdownToTextBlocks(markdown)
  const located = locateBlocksInSource(markdown, blocks)
  return threads.map((thread) => {
    const resolution = resolveAnchor(blocks, thread.anchor)
    if (resolution.status !== 'anchored') return { threadId: thread.id, orphaned: true }
    const block = located.find((item) => item.index === resolution.index)
    const lines = block ? lineRange(block, resolution.start, resolution.end) : undefined
    return lines
      ? { threadId: thread.id, orphaned: false, lines }
      : { threadId: thread.id, orphaned: false }
  })
}

const lineRange = (
  block: LocatedBlock,
  start: number,
  end: number
): { start: number; end: number } => {
  const from = block.offsetToSource(start)
  const to = block.offsetToSource(end)
  if (!from || !to) return { start: block.startLine + 1, end: block.endLine + 1 }
  let endLine = to.line
  if (to.ch === 0 && endLine > from.line) endLine -= 1
  return { start: from.line + 1, end: endLine + 1 }
}

const notifyBlocked = (reason: SendBlockReason): void => {
  notice.notify({
    title: t('comments.send'),
    type: 'warning',
    message: t(REASON_KEY[reason]),
    time: 4000
  })
}

const notifyKey = (key: string): void => {
  notice.notify({
    title: t('comments.send'),
    type: 'warning',
    message: t(key),
    time: 4000
  })
}

type SaveOutcome = 'ready' | 'failed' | 'timedOut'

/**
 * The menu save writes the current tab and replies with `mt::tab-saved` or
 * `mt::tab-save-failure`. Either miss cancels the send (D11).
 */
const saveCurrentTab = (): Promise<SaveOutcome> => {
  const editor = useEditorStore()
  const file = editor.currentFile
  if (!file?.id) return Promise.resolve('failed')
  if (file.isSaved) return Promise.resolve('ready')

  const id = file.id
  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: SaveOutcome): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopSaved()
      stopFailed()
      resolve(outcome)
    }
    const stopSaved = window.electron.ipcRenderer.on('mt::tab-saved', (_event, tabId) => {
      if (tabId === id) finish('ready')
    })
    const stopFailed = window.electron.ipcRenderer.on('mt::tab-save-failure', (_event, tabId) => {
      if (tabId === id) finish('failed')
    })
    const timer = setTimeout(() => finish('timedOut'), SAVE_TIMEOUT_MS)
    editor.FILE_SAVE()
  })
}

const openThreads = (): Thread[] =>
  useCommentsStore().threads.filter((thread) => thread.status === 'open')

const threadsFor = (scope: 'all' | 'selected'): Thread[] | null => {
  const comments = useCommentsStore()
  if (comments.availability.kind !== 'ready') return null
  if (scope === 'all') {
    const open = openThreads()
    return open.length > 0 ? open : null
  }

  const selected = comments.threads.find((thread) => thread.id === comments.selectedThreadId)
  if (!selected) {
    notifyKey('comments.sendNeedSelection')
    return null
  }
  if (selected.status !== 'open') {
    notifyKey('comments.sendOpenOnly')
    return null
  }
  return [selected]
}

export async function sendCommentThreads(scope: 'all' | 'selected'): Promise<void> {
  if (sendPending.value) {
    notifyBlocked('turn')
    return
  }
  const reason = sendUnavailableReason()
  if (reason) {
    notifyBlocked(reason)
    return
  }

  const batch = threadsFor(scope)
  if (!batch) return

  const comments = useCommentsStore()
  if (comments.availability.kind !== 'ready') return
  const file = comments.availability.file

  sendPending.value = true
  try {
    const saved = await saveCurrentTab()
    if (saved === 'timedOut') {
      notifyKey('comments.sendSaveFailed')
      return
    }
    if (saved !== 'ready') return

    const markdown = useEditorStore().currentFile?.markdown ?? ''
    const anchors = threadPlacements(markdown, batch)
    useLayoutStore().SET_LAYOUT({ showAgentPanel: true, agentPanelTab: 'chat' })
    await window.agent.sendThreads(file, batch.map((thread) => thread.id), anchors)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    notice.notify({
      title: t('comments.send'),
      type: 'error',
      message,
      time: 6000
    })
  } finally {
    sendPending.value = false
  }
}
