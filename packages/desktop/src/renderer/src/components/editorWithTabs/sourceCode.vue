<template>
  <div
    ref="sourceCodeContainer"
    class="source-code"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import codeMirror, { setCursorAtFirstLine, setTextDirection } from '../../codeMirror'
import { wordCount as getWordCount } from 'muya/lib/utils'
import { adjustCursor } from '../../util'
import bus from '../../bus'
import { oneDarkThemes, railscastsThemes } from '@/config'

// CodeMirror 5 ships no first-party types; the wrapper in src/renderer/src/
// codeMirror/index.ts also keeps the surface intentionally loose.
type CMInstance = any
type CMCursor = any

interface SourceTemplateOptions {
  rebuildAfterInsert?: boolean
}

interface SourceSelection {
  anchor: CMCursor
  focus: CMCursor
}

interface SourceRebuildOptions {
  markdown?: string
  preserveScroll?: boolean
  scrollSelection?: boolean
}

interface SourceHistorySnapshot {
  markdown: string
  selection: SourceSelection
}

interface SourceHistoryEntry {
  before: SourceHistorySnapshot
  after: SourceHistorySnapshot
}

interface MuyaIndexCursorLike {
  anchor: CMCursor
  focus: CMCursor
}

const props = defineProps<{
  markdown?: string
  muyaIndexCursor?: unknown
  textDirection: string
}>()

const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

const sourceCodeContainer = ref<HTMLDivElement | null>(null)

const editor = ref<CMInstance>(null)
const commitTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const viewDestroyed = ref(false)
const suppressCursorActivitySave = ref(false)
const sourceHistoryUndoStack = ref<SourceHistoryEntry[]>([])
const sourceHistoryRedoStack = ref<SourceHistoryEntry[]>([])
const tabId = ref<string | null>(null)

const { theme, sourceCode } = storeToRefs(preferencesStore)
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

const getMarkdownAndCursor = (cm: CMInstance) => {
  let focus = cm.getCursor('head')
  let anchor = cm.getCursor('anchor')

  const markdown: string = cm.getValue()
  const convertToMuyaCursor = (cursor: CMCursor) => {
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
  if (tabId.value) {
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
    const didChange = editor.value.getValue() !== newMarkdown
    editor.value.setValue(newMarkdown)
    if (didChange) {
      clearNativeHistory(editor.value)
      clearSourceHistory()
    }
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
}

const handleInvalidateImageCache = () => {
  if (editor.value) {
    editor.value.invalidateImageCache()
  }
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

interface ImageActionPayload {
  id: string
  result: string
  alt: string
}

const handleImageAction = (payload: unknown) => {
  const { id, result, alt } = payload as ImageActionPayload
  const value: string = editor.value.getValue()
  const focus = editor.value.getCursor('focus')
  const anchor = editor.value.getCursor('anchor')
  const lines: string[] = value.split('\n')
  const index = lines.findIndex((line: string) => line.indexOf(id) > 0)

  if (index > -1) {
    const oldLine = lines[index]
    lines[index] = oldLine.replace(new RegExp(`!\\[${id}\\]\\(.*\\)`), `![${alt}](${result})`)
    const newValue = lines.join('\n')
    editor.value.setValue(newValue)
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

    const adjustPointer = (pointer: CMCursor) => {
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
      editor.value.setSelection(anchor, focus, { scroll: true })
    } else {
      setCursorAtFirstLine(editor.value)
    }
  }
}

const clearNativeHistory = (cm: CMInstance): void => {
  cm.clearHistory?.()
  cm.markClean?.()
}

const clearSourceHistory = (): void => {
  sourceHistoryUndoStack.value = []
  sourceHistoryRedoStack.value = []
}

const saveContent = (cm: CMInstance) => {
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

const getCursorByOffset = (origin: CMCursor, text: string, offset: number): CMCursor => {
  const lines = text.slice(0, offset).split('\n')
  if (lines.length === 1) {
    return {
      line: origin.line,
      ch: origin.ch + lines[0].length
    }
  }

  return {
    line: origin.line + lines.length - 1,
    ch: lines[lines.length - 1].length
  }
}

const focusSourceEditor = (
  cm: CMInstance,
  selection: SourceSelection | null = null
): void => {
  const focus = () => {
    if (viewDestroyed.value || editor.value !== cm) return

    if (selection) {
      cm.setSelection(selection.anchor, selection.focus, { scroll: false })
    }

    cm.focus()
    setTimeout(() => saveContent(cm), 0)
  }

  requestAnimationFrame(() => {
    if (viewDestroyed.value || editor.value !== cm) return

    focus()
  })
}

const getSourceSnapshot = (cm: CMInstance): SourceHistorySnapshot => {
  return {
    markdown: cm.getValue(),
    selection: {
      anchor: cm.getCursor('anchor'),
      focus: cm.getCursor('head')
    }
  }
}

const getSourceCodeMirrorConfig = (markdown: string): Record<string, unknown> => {
  const codeMirrorConfig: Record<string, unknown> = {
    value: markdown,
    lineNumbers: true,
    autofocus: true,
    lineWrapping: true,
    styleActiveLine: true,
    direction: props.textDirection,
    viewportMargin: Infinity,
    extraKeys: {
      'Ctrl-Z': () => executeSourceHistoryCommand('undo'),
      'Cmd-Z': () => executeSourceHistoryCommand('undo'),
      'Shift-Ctrl-Z': () => executeSourceHistoryCommand('redo'),
      'Shift-Cmd-Z': () => executeSourceHistoryCommand('redo'),
      'Ctrl-Y': () => executeSourceHistoryCommand('redo'),
      'Cmd-Y': () => executeSourceHistoryCommand('redo')
    },
    lineNumberFormatter (line: number) {
      if (line % 10 === 0 || line === 1) {
        return line
      } else {
        return ''
      }
    }
  }

  if (railscastsThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'railscasts'
  } else if (oneDarkThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'one-dark'
  }

  return codeMirrorConfig
}

const handleSourceContextMenu = (_cm: CMInstance, event: Event): void => {
  event.preventDefault()
  event.stopPropagation()
}

const listenChange = (cm: CMInstance) => {
  cm.on('cursorActivity', (instance: CMInstance) => {
    if (suppressCursorActivitySave.value) return

    saveContent(instance)
  })
}

const configureSourceEditor = (
  cm: CMInstance,
  selection: SourceSelection | null = null,
  scrollSelection = false
): void => {
  cm.setOption('mode', 'markdown-math')
  cm.on('contextmenu', handleSourceContextMenu)
  clearNativeHistory(cm)

  if (selection) {
    cm.setSelection(selection.anchor, selection.focus, { scroll: scrollSelection })
  } else {
    setCursorAtFirstLine(cm)
  }
}

const createSourceEditor = (
  markdown: string,
  selection: SourceSelection | null = null,
  scrollSelection = false
): CMInstance | null => {
  const container = sourceCodeContainer.value
  if (!container) return null

  const cm = codeMirror(container, getSourceCodeMirrorConfig(markdown))
  configureSourceEditor(cm, selection, scrollSelection)
  listenChange(cm)
  editor.value = cm
  return cm
}

const restoreSourceSnapshot = (cm: CMInstance, snapshot: SourceHistorySnapshot): void => {
  const nextCm = rebuildSourceEditor(cm, snapshot.selection, {
    markdown: snapshot.markdown,
    scrollSelection: true
  })

  requestAnimationFrame(() => {
    if (viewDestroyed.value || editor.value !== nextCm) return

    setTimeout(() => saveContent(nextCm), 0)
  })
}

const rememberSourceHistory = (
  before: SourceHistorySnapshot,
  after: SourceHistorySnapshot
): void => {
  sourceHistoryUndoStack.value.push({ before, after })
  sourceHistoryRedoStack.value = []
}

const maybeRestoreSourceHistory = (command: 'undo' | 'redo'): boolean => {
  const cm = editor.value
  const sourceStack = command === 'undo'
    ? sourceHistoryUndoStack.value
    : sourceHistoryRedoStack.value
  const targetStack = command === 'undo'
    ? sourceHistoryRedoStack.value
    : sourceHistoryUndoStack.value
  const entry = sourceStack[sourceStack.length - 1]

  if (!entry) return false

  const expectedMarkdown = command === 'undo' ? entry.after.markdown : entry.before.markdown
  if (cm.getValue() !== expectedMarkdown) return false

  sourceStack.pop()
  targetStack.push(entry)
  restoreSourceSnapshot(cm, command === 'undo' ? entry.before : entry.after)
  return true
}

const executeSourceHistoryCommand = (command: 'undo' | 'redo'): void => {
  if (!sourceCode.value || !editor.value) return

  if (maybeRestoreSourceHistory(command)) return

  const historySize = editor.value.historySize?.()
  if (historySize && historySize[command] <= 0) {
    editor.value.focus()
    return
  }

  editor.value.execCommand(command)
  requestAnimationFrame(() => editor.value?.focus())
  setTimeout(() => {
    if (editor.value) saveContent(editor.value)
  }, 0)
}

const handleSourceUndo = (): void => {
  executeSourceHistoryCommand('undo')
}

const handleSourceRedo = (): void => {
  executeSourceHistoryCommand('redo')
}

const rebuildSourceEditor = (
  cm: CMInstance,
  selection: SourceSelection,
  options: SourceRebuildOptions = {}
): CMInstance => {
  if (viewDestroyed.value || editor.value !== cm) return cm

  const { preserveScroll = true, scrollSelection = false } = options
  const markdown = options.markdown ?? cm.getValue()
  const scrollInfo = preserveScroll ? cm.getScrollInfo?.() : null
  const wrapper = cm.getWrapperElement?.() as HTMLElement | null | undefined
  const container = sourceCodeContainer.value

  if (!container) return cm

  suppressCursorActivitySave.value = true
  if (wrapper?.parentElement) {
    wrapper.parentElement.removeChild(wrapper)
  }
  const nextCm = createSourceEditor(markdown, selection, scrollSelection) ?? cm
  if (scrollInfo && nextCm !== cm) {
    nextCm.scrollTo(scrollInfo.left, scrollInfo.top)
  }
  suppressCursorActivitySave.value = false

  requestAnimationFrame(() => {
    if (viewDestroyed.value || editor.value !== nextCm) return

    nextCm.refresh()
    if (scrollInfo) {
      nextCm.scrollTo(scrollInfo.left, scrollInfo.top)
    }
    nextCm.focus()
    setTimeout(() => saveContent(nextCm), 0)
  })

  return nextCm
}

const replaceSelectionWithTemplate = (
  template: string,
  selectionStart: number,
  selectionEnd: number,
  options: SourceTemplateOptions = {}
): void => {
  const cm = editor.value
  const from = cm.getCursor('from')
  const anchor = getCursorByOffset(from, template, selectionStart)
  const focus = getCursorByOffset(from, template, selectionEnd)

  if (options.rebuildAfterInsert) {
    const before = getSourceSnapshot(cm)
    cm.operation(() => {
      cm.replaceSelection(template)
    })
    rememberSourceHistory(before, {
      markdown: cm.getValue(),
      selection: { anchor, focus }
    })
    rebuildSourceEditor(cm, { anchor, focus })
  } else {
    cm.operation(() => {
      cm.replaceSelection(template)
      cm.setSelection(anchor, focus, { scroll: false })
    })
    focusSourceEditor(cm)
  }
}

const wrapSourceSelection = (prefix: string, suffix: string, placeholder: string): void => {
  const cm = editor.value
  const selection = cm.getSelection()
  const text = selection || placeholder
  const template = `${prefix}${text}${suffix}`

  replaceSelectionWithTemplate(template, prefix.length, prefix.length + text.length)
}

const insertSourceCodeFence = (): void => {
  const cm = editor.value
  const selection = cm.getSelection()
  const text = selection || 'code'
  const prefix = '```\n'
  const suffix = '\n```'
  const template = `${prefix}${text}${suffix}`

  replaceSelectionWithTemplate(template, prefix.length, prefix.length + text.length, {
    rebuildAfterInsert: true
  })
}

const insertSourceLink = (): void => {
  const cm = editor.value
  const selection = cm.getSelection()
  const text = selection || 'text'
  const template = `[${text}](url)`

  if (selection) {
    const urlStart = text.length + 3
    replaceSelectionWithTemplate(template, urlStart, urlStart + 3)
  } else {
    replaceSelectionWithTemplate(template, 1, 1 + text.length)
  }
}

const insertSourceImage = (): void => {
  const cm = editor.value
  const selection = cm.getSelection()
  const alt = selection || 'alt'
  const template = `![${alt}](path)`

  if (selection) {
    const pathStart = alt.length + 4
    replaceSelectionWithTemplate(template, pathStart, pathStart + 4)
  } else {
    replaceSelectionWithTemplate(template, 2, 2 + alt.length)
  }
}

const insertSourceTable = (): void => {
  const cm = editor.value
  const from = cm.getCursor('from')
  const to = cm.getCursor('to')
  const beforeSelection = cm.getLine(from.line).slice(0, from.ch)
  const afterSelection = cm.getLine(to.line).slice(to.ch)
  const prefix = beforeSelection.trim() ? '\n\n' : ''
  const suffix = afterSelection.trim() ? '\n\n' : '\n'
  const template = `${prefix}| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |${suffix}`
  const selectionStart = prefix.length + 2

  replaceSelectionWithTemplate(template, selectionStart, selectionStart + 8, {
    rebuildAfterInsert: true
  })
}

const insertSourceFrontMatter = (): void => {
  const cm = editor.value
  const origin = { line: 0, ch: 0 }
  const template = '---\ntitle: \n---\n\n'
  const titleCursor = getCursorByOffset(origin, template, 11)
  const before = getSourceSnapshot(cm)

  cm.operation(() => {
    cm.replaceRange(template, origin)
  })
  rememberSourceHistory(before, {
    markdown: cm.getValue(),
    selection: { anchor: titleCursor, focus: titleCursor }
  })
  rebuildSourceEditor(cm, { anchor: titleCursor, focus: titleCursor }, {
    preserveScroll: false,
    scrollSelection: true
  })
}

const stripLinePrefix = (line: string): string => {
  return line.replace(/^\s{0,3}(?:[-+*]\s(?:\[[ xX]\]\s)?|\d+[.)]\s|>\s?|#{1,6}\s+)/, '')
}

const getListMarkerLength = (line: string): number => {
  return line.match(/^(?:[-+*]\s(?:\[[ xX]\]\s)?|\d+[.)]\s)/)?.[0].length ?? 0
}

const replaceSelectedLines = (
  formatter: (lines: string[]) => string[],
  selectionFactory?: (replacementLines: string[], startLine: number) => SourceSelection
): void => {
  const cm = editor.value
  const from = cm.getCursor('from')
  const to = cm.getCursor('to')
  const startLine = Math.min(from.line, to.line)
  let endLine = Math.max(from.line, to.line)

  if (to.ch === 0 && endLine > startLine) {
    endLine -= 1
  }

  const lines: string[] = []
  for (let line = startLine; line <= endLine; line++) {
    lines.push(cm.getLine(line))
  }

  const replacementLines = formatter(lines)
  const replacement = replacementLines.join('\n')
  const start = { line: startLine, ch: 0 }
  const end = { line: endLine, ch: cm.getLine(endLine).length }
  const replacementEnd = {
    line: startLine + replacementLines.length - 1,
    ch: replacementLines[replacementLines.length - 1].length
  }
  const selection = selectionFactory?.(replacementLines, startLine) ?? {
    anchor: start,
    focus: replacementEnd
  }

  cm.operation(() => {
    cm.replaceRange(replacement, start, end)
    cm.setSelection(selection.anchor, selection.focus, { scroll: false })
  })
  requestAnimationFrame(() => cm.focus())
  setTimeout(() => saveContent(cm), 0)
}

const setSourceHeading = (level: number): void => {
  replaceSelectedLines((lines) => {
    const prefix = `${'#'.repeat(level)} `
    return lines.map((line) => `${prefix}${line.replace(/^\s{0,3}#{1,6}\s+/, '') || 'Heading'}`)
  })
}

const setSourceList = (marker: 'bullet' | 'ordered' | 'task'): void => {
  replaceSelectedLines(
    (lines) => {
      return lines.map((line, index) => {
        const text = stripLinePrefix(line) || 'list item'
        if (marker === 'ordered') return `${index + 1}. ${text}`
        if (marker === 'task') return `- [ ] ${text}`
        return `- ${text}`
      })
    },
    (replacementLines, startLine) => {
      const firstLine = replacementLines[0]
      return {
        anchor: { line: startLine, ch: getListMarkerLength(firstLine) },
        focus: { line: startLine, ch: firstLine.length }
      }
    }
  )
}

const setSourceQuote = (): void => {
  replaceSelectedLines(
    (lines) => lines.map((line) => `> ${stripLinePrefix(line) || 'quote'}`),
    (replacementLines, startLine) => ({
      anchor: { line: startLine, ch: 2 },
      focus: { line: startLine, ch: replacementLines[0].length }
    })
  )
}

const handleSourceToolbarCommand = (command: unknown): void => {
  if (!sourceCode.value || !editor.value) return

  switch (command) {
    case 'format.strong':
      wrapSourceSelection('**', '**', 'bold')
      break
    case 'format.emphasis':
      wrapSourceSelection('*', '*', 'italic')
      break
    case 'format.strike':
      wrapSourceSelection('~~', '~~', 'strikethrough')
      break
    case 'format.inline-code':
      wrapSourceSelection('`', '`', 'code')
      break
    case 'format.hyperlink':
      insertSourceLink()
      break
    case 'format.image':
      insertSourceImage()
      break
    case 'paragraph.heading-1':
      setSourceHeading(1)
      break
    case 'paragraph.heading-2':
      setSourceHeading(2)
      break
    case 'paragraph.heading-3':
      setSourceHeading(3)
      break
    case 'paragraph.heading-4':
      setSourceHeading(4)
      break
    case 'paragraph.heading-5':
      setSourceHeading(5)
      break
    case 'paragraph.heading-6':
      setSourceHeading(6)
      break
    case 'paragraph.quote-block':
      setSourceQuote()
      break
    case 'paragraph.code-fence':
      insertSourceCodeFence()
      break
    case 'paragraph.bullet-list':
      setSourceList('bullet')
      break
    case 'paragraph.order-list':
      setSourceList('ordered')
      break
    case 'paragraph.task-list':
      setSourceList('task')
      break
    case 'paragraph.table':
      insertSourceTable()
      break
    case 'paragraph.front-matter':
      insertSourceFrontMatter()
      break
    case 'edit.undo':
      executeSourceHistoryCommand('undo')
      break
    case 'edit.redo':
      executeSourceHistoryCommand('redo')
      break
  }
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

  const { markdown, muyaIndexCursor } = props

  bus.on('file-loaded', handleFileChange)
  bus.on('invalidate-image-cache', handleInvalidateImageCache)
  bus.on('file-changed', handleFileChange)
  bus.on('selectAll', handleSelectAll)
  bus.on('image-action', handleImageAction)
  bus.on('source-code::toolbar-command', handleSourceToolbarCommand)
  bus.on('undo', handleSourceUndo)
  bus.on('redo', handleSourceRedo)

  if (isValidMuyaIndexCursor(muyaIndexCursor)) {
    const { anchor, focus } = muyaIndexCursor
    createSourceEditor(markdown ?? '', { anchor, focus }, true)
  } else {
    createSourceEditor(markdown ?? '')
  }

  tabId.value = id
})

onBeforeUnmount(() => {
  viewDestroyed.value = true
  if (commitTimer.value) clearTimeout(commitTimer.value)

  bus.off('file-loaded', handleFileChange)
  bus.off('invalidate-image-cache', handleInvalidateImageCache)
  bus.off('file-changed', handleFileChange)
  bus.off('selectAll', handleSelectAll)
  bus.off('image-action', handleImageAction)
  bus.off('source-code::toolbar-command', handleSourceToolbarCommand)
  bus.off('undo', handleSourceUndo)
  bus.off('redo', handleSourceRedo)

  const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
  bus.emit('file-changed', {
    id: tabId.value,
    markdown: newMarkdown,
    muyaIndexCursor: cursor,
    renderCursor: true
  })
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
</style>
