<template>
  <div
    ref="sourceCodeContainer"
    class="source-code"
  />
</template>

<script setup lang="ts">
import { ref, shallowRef, markRaw, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useLayoutStore } from '@/store/layout'
import { findMarkdownHeadingLine, scrollSourceEditorToLine } from '@/util/sourceModeToc'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type CodeMirror from 'codemirror'
import codeMirror, { setCursorAtFirstLine, setTextDirection } from '../../codeMirror'
import { resolveAnchor } from '@/agent/anchoring'
import { markdownToTextBlocks, wordCount as getWordCount } from '@muyajs/core'
import { REANCHOR_DEBOUNCE_MS } from '@shared/types/comments'
import { adjustCursor } from '../../util'
import bus from '../../bus'
import notice from '@/services/notification'
import { popupContextMenu } from '@/contextMenu/popupMenu'
import { oneDarkThemes, railscastsThemes } from '@/config'
import { DRAFT_DECORATION_ID, startCommentFromRange } from './commentSession'
import { sourceCommentMarks, sourceSelectionRange } from './sourceComments'

interface MuyaIndexCursorLike {
  anchor: CodeMirror.Position
  focus: CodeMirror.Position
}

const props = defineProps<{
  markdown?: string
  muyaIndexCursor?: unknown
  textDirection: string
}>()

const { t } = useI18n()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const agentStore = useAgentStore()
const commentsStore = useCommentsStore()
const layoutStore = useLayoutStore()

const sourceCodeContainer = ref<HTMLDivElement | null>(null)

const editor = shallowRef<CodeMirror.Editor | null>(null)
const commitTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const viewDestroyed = ref(false)
const tabId = ref<string | null>(null)

const {
  theme,
  sourceCode,
  sourceCodeLineNumbers,
  texMathDollars,
  texMathGfm,
  texMathSingleBackslash,
  texMathDoubleBackslash
} = storeToRefs(preferencesStore)
const { currentFile: currentTab } = storeToRefs(editorStore)

const isValidMuyaIndexCursor = (cursor: unknown): cursor is MuyaIndexCursorLike => {
  const c = cursor as MuyaIndexCursorLike | null | undefined
  return !!(c && c.anchor && c.focus)
}

watch(
  () => props.textDirection,
  (value, oldValue) => {
    if (value !== oldValue && editor.value) {
      setTextDirection(editor.value, value)
    }
  }
)

watch(sourceCodeLineNumbers, (value) => {
  editor.value?.setOption('lineNumbers', value)
})

// A fresh instance reads these at mount; the watch is for a preference changed
// while the source view is already open (#5446).
const markdownMathMode = () => ({
  name: 'markdown-math',
  texMathDollars: texMathDollars.value,
  texMathGfm: texMathGfm.value,
  texMathSingleBackslash: texMathSingleBackslash.value,
  texMathDoubleBackslash: texMathDoubleBackslash.value
})

watch([texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash], () => {
  editor.value?.setOption('mode', markdownMathMode())
})

const getMarkdownAndCursor = (cm: CodeMirror.Editor) => {
  let focus = cm.getCursor('head')
  let anchor = cm.getCursor('anchor')

  const markdown: string = cm.getValue()
  const convertToMuyaCursor = (cursor: CodeMirror.Position) => {
    const line = cm.getLine(cursor.line)
    const preLine = cm.getLine(cursor.line - 1)
    const nextLine = cm.getLine(cursor.line + 1)
    return adjustCursor(
      cursor,
      preLine,
      line,
      nextLine,
      (lineNumber) => {
        return cm.getLine(lineNumber)
      },
      cm.lineCount()
    )
  }

  anchor = convertToMuyaCursor(anchor) // Selection start as Muya cursor
  focus = convertToMuyaCursor(focus) // Selection end as Muya cursor

  // Normalize cursor that `anchor` is always before `focus` because
  // this is the expected behavior in Muya.
  if (anchor && focus && anchor.line > focus.line) {
    const tmpCursor = focus
    focus = anchor
    anchor = tmpCursor
  }
  return { cursor: { focus, anchor }, markdown }
}

/**
 * This is to write the OLD content of the editor before switching to another tab
 * @param id
 */
const prepareTabSwitch = () => {
  if (commitTimer.value) clearTimeout(commitTimer.value)
  if (tabId.value && editor.value) {
    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
    editorStore.LISTEN_FOR_CONTENT_CHANGE({
      id: tabId.value,
      markdown: newMarkdown,
      muyaIndexCursor: cursor
    })
    tabId.value = null
  }
}

interface FileChangePayloadLike {
  id: string
  markdown?: string
  muyaIndexCursor?: unknown
}

const handleFileChange = (payload: unknown) => {
  const { id, markdown: newMarkdown, muyaIndexCursor } = payload as FileChangePayloadLike
  if (!editor.value) return

  // On same-tab reload (external file change), preserve scroll across
  // setValue. Snapshot every plausible scroll element (the outer
  // .source-code div, CodeMirror's own scroller, and the nearest scrollable
  // ancestor) and restore each, since which one is actually active depends
  // on CodeMirror's height:auto + outer overflow:auto interplay. Re-apply
  // on nextTick and the next animation frame to outlast layout side-effects
  // from sibling handlers: muya editor.vue also listens for file-changed.
  // A cross-tab switch must instead commit the outgoing tab's state; the
  // fresh markdown from disk would otherwise overwrite uncommitted edits.
  const isSameTabReload = tabId.value && tabId.value === id
  const scrollTargets: Array<{ el: HTMLElement; top: number }> = []
  if (isSameTabReload) {
    const seen = new Set<HTMLElement>()
    const consider = (el: HTMLElement | null | undefined) => {
      if (el && !seen.has(el)) {
        seen.add(el)
        scrollTargets.push({ el, top: el.scrollTop })
      }
    }
    consider(sourceCodeContainer.value)
    consider(editor.value.getScrollerElement?.() as HTMLElement | null | undefined)
    let node: HTMLElement | null = sourceCodeContainer.value?.parentElement ?? null
    while (node && node !== document.body) {
      const overflowY = window.getComputedStyle(node).overflowY
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        consider(node)
        break
      }
      node = node.parentElement
    }
  } else {
    prepareTabSwitch()
    tabId.value = id
  }

  if (typeof newMarkdown === 'string') {
    editor.value.setValue(newMarkdown)
  }

  // t('editor.sourceCode.cursorNullComment')
  if (isValidMuyaIndexCursor(muyaIndexCursor)) {
    const { anchor, focus } = muyaIndexCursor

    editor.value.setSelection(anchor, focus, { scroll: true }) // Scroll the focus into view.
  } else if (scrollTargets.length) {
    const restoreScroll = () => {
      for (const { el, top } of scrollTargets) el.scrollTop = top
    }
    restoreScroll()
    nextTick(restoreScroll)
    requestAnimationFrame(restoreScroll)
  } else {
    setCursorAtFirstLine(editor.value)
  }
  paintCommentMarks()
}

const handleSelectAll = () => {
  if (!sourceCode.value) {
    return
  }

  if (editor.value && editor.value.hasFocus()) {
    editor.value.execCommand('selectAll')
  } else {
    const activeElement = document.activeElement as HTMLElement | null
    const nodeName = activeElement?.nodeName
    if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
      const selectable = activeElement as HTMLInputElement | HTMLTextAreaElement | null
      if (selectable && typeof selectable.select === 'function') {
        selectable.select()
      }
    }
  }
}

const handleUndo = () => {
  if (!sourceCode.value) {
    return
  }

  if (editor.value) {
    editor.value.execCommand('undo')
  }
}

const handleRedo = () => {
  if (!sourceCode.value) {
    return
  }

  if (editor.value) {
    editor.value.execCommand('redo')
  }
}

interface ImageActionPayload {
  id: string
  result: string
  alt: string
}

const handleImageAction = (payload: unknown) => {
  const cm = editor.value
  if (!cm) return

  const { id, result, alt } = payload as ImageActionPayload
  const value: string = cm.getValue()
  const focus = cm.getCursor('focus')
  const anchor = cm.getCursor('anchor')
  const lines: string[] = value.split('\n')
  const index = lines.findIndex((line: string) => line.indexOf(id) > 0)

  if (index > -1) {
    const oldLine = lines[index]
    lines[index] = oldLine.replace(new RegExp(`!\\[${id}\\]\\(.*\\)`), `![${alt}](${result})`)
    const newValue = lines.join('\n')
    cm.setValue(newValue)
    const match = /(!\[.*\]\(.*\))/.exec(oldLine)
    if (!match) {
      // t('editor.sourceCode.imageStructureDeletedComment')
      return
    }
    const range = {
      start: match.index,
      end: match.index + match[1].length
    }
    const delta = alt.length + result.length + 5 - match[1].length

    const adjustPointer = (pointer: CodeMirror.Position) => {
      if (!pointer) {
        return
      }
      if (pointer.line !== index) {
        return
      }
      if (pointer.ch <= range.start) {
        // do nothing.
      } else if (pointer.ch > range.start && pointer.ch < range.end) {
        pointer.ch = range.start + alt.length + result.length + 5
      } else {
        pointer.ch += delta
      }
    }

    adjustPointer(focus)
    adjustPointer(anchor)
    if (focus && anchor) {
      cm.setSelection(anchor, focus, { scroll: true })
    } else {
      setCursorAtFirstLine(cm)
    }
  }
}

// `cursorActivity` fires per drag step, so key the dedup on the ranges rather
// than on `getSelection()`, which copies the whole selection.
let lastSelectionKey = ''

const selectionKey = (cm: CodeMirror.Editor): string =>
  cm
    .listSelections()
    .map(({ anchor, head }) => `${anchor.line}:${anchor.ch}-${head.line}:${head.ch}`)
    .join(',')

const updateSelectionWordCount = (cm: CodeMirror.Editor) => {
  const key = selectionKey(cm)
  if (key === lastSelectionKey && editorStore.selectionWordCount != null) return
  lastSelectionKey = key

  const selectedText = cm.getSelection()
  const hasSelection = selectedText.trim().length > 0
  if (!hasSelection && editorStore.selectionWordCount == null) return

  editorStore.SET_SELECTION_WORD_COUNT(hasSelection ? getWordCount(selectedText) : null)
}

const saveContent = (cm: CodeMirror.Editor) => {
  const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(cm)
  // Attention: the cursor may be `{focus: null, anchor: null}` when press `backspace`
  const wordCount = getWordCount(newMarkdown)
  // See "beforeDestroy" note
  if (!viewDestroyed.value) {
    if (tabId.value) {
      editorStore.LISTEN_FOR_CONTENT_CHANGE({
        id: tabId.value,
        markdown: newMarkdown,
        wordCount,
        muyaIndexCursor: cursor
      })
    } else {
      // This may occur during tab switching but should not occur otherwise.
      console.warn('LISTEN_FOR_CONTENT_CHANGE: Cannot commit changes because not tab id was set!')
    }
  }
}

const commentMarkers = new Map<string, CodeMirror.TextMarker>()
let paintTimer: ReturnType<typeof setTimeout> | null = null
let scrollFromMark = false
let stopCommentMenu: (() => void) | null = null

const currentSourceRange = (cm: CodeMirror.Editor) =>
  sourceSelectionRange(cm.getValue(), cm.getCursor('anchor'), cm.getCursor('head'))

const publishCommentable = (cm: CodeMirror.Editor): void => {
  const available = agentStore.agentAvailable && currentSourceRange(cm) !== null
  window.electron.ipcRenderer.send('mt::editor-comment-available', available)
}

const clearCommentMarks = (): void => {
  for (const marker of commentMarkers.values()) marker.clear()
  commentMarkers.clear()
}

const paintCommentMarks = (): void => {
  const cm = editor.value
  if (!cm) return
  clearCommentMarks()

  const markdown = cm.getValue()
  const pending = commentsStore.draft
  let draftRange: { index: number; start: number; end: number } | null = null
  if (pending) {
    const resolution = resolveAnchor(markdownToTextBlocks(markdown), pending.anchor)
    if (resolution.status === 'anchored') {
      draftRange = {
        index: resolution.index,
        start: resolution.start,
        end: resolution.end
      }
    }
  }

  for (const mark of sourceCommentMarks(
    {
      threads: commentsStore.threads,
      resolved: commentsStore.resolved,
      selectedThreadId: commentsStore.selectedThreadId,
      showClosed: commentsStore.showClosed,
      draft: draftRange
    },
    markdown
  )) {
    commentMarkers.set(
      mark.id,
      cm.markText(mark.from, mark.to, {
        className: mark.className,
        attributes: { 'data-comment-id': mark.id },
        inclusiveLeft: false,
        inclusiveRight: false
      })
    )
  }
}

const scheduleCommentMarks = (): void => {
  if (paintTimer) clearTimeout(paintTimer)
  paintTimer = setTimeout(() => {
    paintTimer = null
    paintCommentMarks()
  }, REANCHOR_DEBOUNCE_MS)
}

const scrollToThread = (id: string): void => {
  const found = commentMarkers.get(id)?.find()
  const cm = editor.value
  const container = sourceCodeContainer.value
  if (!found || !('from' in found) || !cm || !container) return
  const top = cm.heightAtLine(found.from.line, 'local')
  container.scrollTo({ top: Math.max(top - 80, 0), behavior: 'smooth' })
}

const openCommentsTab = (): void => {
  layoutStore.SET_LAYOUT({ showAgentPanel: true, agentPanelTab: 'comments' })
}

const onAgentComment = (): void => {
  const cm = editor.value
  if (!cm) return
  const markdown = cm.getValue()
  const range = currentSourceRange(cm)
  const result = startCommentFromRange(markdownToTextBlocks(markdown), range)
  if (result.kind === 'blocked') {
    notice.notify({
      title: t('comments.comment'),
      type: 'warning',
      message: t('comments.blocked'),
      time: 4000
    })
    return
  }
  paintCommentMarks()
}

const onShowInText = (): void => {
  const id = commentsStore.selectedThreadId
  if (id) scrollToThread(id)
}

const onCommentMouseDown = (_cm: CodeMirror.Editor, event: Event): void => {
  const target = event.target
  if (!(target instanceof Element)) return
  const id = target.closest('.mt-comment')?.getAttribute('data-comment-id')
  if (!id || id === DRAFT_DECORATION_ID) return
  if (commentsStore.selectedThreadId !== id) {
    scrollFromMark = true
    commentsStore.selectedThreadId = id
  }
  openCommentsTab()
}

const showSourceContextMenu = (cm: CodeMirror.Editor, event: MouseEvent): void => {
  const commentable = agentStore.agentAvailable && currentSourceRange(cm) !== null
  popupContextMenu(
    [
      {
        label: t('comments.comment'),
        enabled: commentable,
        click: () => onAgentComment()
      },
      { type: 'separator' },
      { role: 'cut', label: t('contextMenu.cut') },
      { role: 'copy', label: t('contextMenu.copy') },
      { role: 'paste', label: t('contextMenu.paste') }
    ],
    { x: event.clientX, y: event.clientY }
  )
}

const listenChange = (cm: CodeMirror.Editor) => {
  cm.on('cursorActivity', (instance: CodeMirror.Editor) => {
    saveContent(instance)
    updateSelectionWordCount(instance)
    publishCommentable(instance)
  })
  cm.on('change', () => {
    scheduleCommentMarks()
  })
  cm.on('mousedown', onCommentMouseDown)
}

// #3580: in Source Code mode the WYSIWYG container is hidden, so the
// `scroll-to-header` bus event (emitted when a TOC entry is clicked) must scroll
// CodeMirror instead. Resolve the TOC entry to its heading line in the source.
watch(
  () =>
    [
      commentsStore.threads,
      commentsStore.resolved,
      commentsStore.selectedThreadId,
      commentsStore.showClosed,
      commentsStore.draft
    ] as const,
  () => {
    paintCommentMarks()
  }
)

watch(
  () => commentsStore.selectedThreadId,
  (id) => {
    if (scrollFromMark) {
      scrollFromMark = false
      return
    }
    if (id) scrollToThread(id)
  }
)

const handleScrollToHeader = (slug: unknown) => {
  if (!editor.value) return
  const index = editorStore.listToc.findIndex(item => item.slug === slug)
  if (index < 0) return
  const line = findMarkdownHeadingLine(editor.value.getValue(), index)
  if (line < 0) return
  // `.source-code` is the scroll container (CodeMirror renders full-height with
  // viewportMargin: Infinity, so its own scroller never scrolls).
  scrollSourceEditorToLine(editor.value, line, sourceCodeContainer.value)
}

onMounted(() => {
  if (!currentTab.value) return
  const { id } = currentTab.value
  // reset currentTab scrollTop position because the codeMirror scroll position is completely different from the muya scroll position
  // reset blocks as well because the blocks are only valid in muya
  // reset cursor because this is a direct "key-cursor", not a muyaIndexCursor, which is {focus: number, anchor: number}
  currentTab.value.scrollTop = 0
  currentTab.value.blocks = undefined
  currentTab.value.cursor = undefined

  const { markdown, muyaIndexCursor, textDirection } = props
  const container = sourceCodeContainer.value
  const codeMirrorConfig: Record<string, unknown> = {
    value: markdown,
    lineNumbers: sourceCodeLineNumbers.value,
    autofocus: true,
    lineWrapping: true,
    styleActiveLine: true,
    direction: textDirection,
    viewportMargin: Infinity
  }

  if (railscastsThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'railscasts'
  } else if (oneDarkThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'one-dark'
  }

  bus.on('file-loaded', handleFileChange)
  bus.on('file-changed', handleFileChange)
  bus.on('selectAll', handleSelectAll)
  bus.on('undo', handleUndo)
  bus.on('redo', handleRedo)
  bus.on('image-action', handleImageAction)
  bus.on('scroll-to-header', handleScrollToHeader)

  // CodeMirror's line tree relies on object identity and must not be proxied by Vue.
  const codeMirrorInstance = markRaw(codeMirror(container, codeMirrorConfig))

  // See src/renderer/src/codeMirror/markdownMathMode.ts.
  codeMirrorInstance.setOption('mode', markdownMathMode())

  codeMirrorInstance.on('contextmenu', (cm: CodeMirror.Editor, event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    if (event instanceof MouseEvent) showSourceContextMenu(cm, event)
  })

  if (isValidMuyaIndexCursor(muyaIndexCursor)) {
    const { anchor, focus } = muyaIndexCursor
    codeMirrorInstance.setSelection(anchor, focus, { scroll: true })
  } else {
    setCursorAtFirstLine(codeMirrorInstance)
  }

  editor.value = codeMirrorInstance
  tabId.value = id
  updateSelectionWordCount(codeMirrorInstance)

  listenChange(codeMirrorInstance)
  bus.on('agent:comment', onAgentComment)
  bus.on('agent:show-in-text', onShowInText)
  stopCommentMenu = window.electron.ipcRenderer.on('mt::cm-comment', onAgentComment)
  paintCommentMarks()
  publishCommentable(codeMirrorInstance)
})

onBeforeUnmount(() => {
  viewDestroyed.value = true
  if (commitTimer.value) clearTimeout(commitTimer.value)

  bus.off('file-loaded', handleFileChange)
  bus.off('file-changed', handleFileChange)
  bus.off('selectAll', handleSelectAll)
  bus.off('undo', handleUndo)
  bus.off('redo', handleRedo)
  bus.off('image-action', handleImageAction)
  editorStore.SET_SELECTION_WORD_COUNT(null)
  lastSelectionKey = ''
  bus.off('scroll-to-header', handleScrollToHeader)
  bus.off('agent:comment', onAgentComment)
  bus.off('agent:show-in-text', onShowInText)
  stopCommentMenu?.()
  if (paintTimer) clearTimeout(paintTimer)
  clearCommentMarks()

  if (editor.value) {
    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
    bus.emit('file-changed', {
      id: tabId.value,
      markdown: newMarkdown,
      muyaIndexCursor: cursor,
      renderCursor: true
    })
  }
})
</script>

<style>
.source-code {
  height: calc(100vh - var(--titleBarHeight));
  box-sizing: border-box;
  overflow: auto;
}
.source-code .CodeMirror {
  height: auto;
  margin: 50px auto;
  max-width: var(--editorAreaWidth);
  background: transparent;
}
.source-code .CodeMirror-gutters {
  border-right: none;
  background-color: transparent;
}
.source-code .CodeMirror-activeline-background,
.source-code .CodeMirror-activeline-gutter {
  background: var(--floatHoverColor);
}
/* Fade the delimiters against the formula. Dimming the inherited colour rather
   than naming one is what carries across every theme; 0.65 is the lowest value
   still clearing 3:1 in all of them, with one-dark at 3.67 setting the floor. */
.source-code .CodeMirror .cm-formatting-math {
  opacity: 0.65;
}
.source-code .mt-comment {
  background: var(--commentMarkBg);
  border-bottom: 1px solid var(--commentMarkUnderline);
}
.source-code .mt-comment.mt-comment-active {
  background: var(--commentMarkBgActive);
  border-bottom: 2px solid var(--commentMarkUnderlineActive);
}
.source-code .mt-comment.mt-comment-draft {
  border-bottom-style: dashed;
}
</style>
