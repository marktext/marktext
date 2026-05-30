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

interface SourceHeading {
  line: number
  level: number
  content: string
}

interface MuyaIndexCursorLike {
  anchor: CMCursor
  focus: CMCursor
}

const SOURCE_FOLD_GUTTER = 'CodeMirror-foldgutter'
const SOURCE_LINE_GUTTER = 'CodeMirror-linenumbers'

const getSourceFoldOptions = () => ({
  rangeFinder: codeMirror.fold.markdown,
  widget: '...',
  minFoldSize: 0,
  scanUp: false,
  clearOnEnter: true
})

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
    unfoldAllSourceHeadings()
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

const clearSourceFolds = (cm: CMInstance) => {
  const marks = cm.getAllMarks()

  for (const mark of marks) {
    if (mark.__isFold) {
      mark.clear()
    }
  }
}

const foldAllSourceHeadings = () => {
  if (!sourceCode.value || !editor.value) return

  const cm = editor.value
  cm.operation(() => {
    clearSourceFolds(cm)

    for (let line = cm.firstLine(); line <= cm.lastLine(); line += 1) {
      const pos = codeMirror.Pos(line, 0)
      const range = codeMirror.fold.markdown(cm, pos)

      if (range) {
        cm.foldCode(pos, getSourceFoldOptions(), 'fold')
        line = range.to.line
      }
    }
  })
}

const unfoldAllSourceHeadings = () => {
  if (!sourceCode.value || !editor.value) return

  const cm = editor.value
  cm.operation(() => clearSourceFolds(cm))
}

const unfoldSourceLine = (line: number) => {
  if (!editor.value) return

  const cm = editor.value
  cm.operation(() => {
    const marks = cm.getAllMarks()

    for (const mark of marks) {
      if (!mark.__isFold) continue

      const range = mark.find()
      if (range && range.from.line <= line && line <= range.to.line) {
        mark.clear()
      }
    }
  })
}

const isHeaderToken = (cm: CMInstance, line: number): boolean => {
  const tokenType = cm.getTokenTypeAt(codeMirror.Pos(line, 0))
  return typeof tokenType === 'string' && /\bheader\b/.test(tokenType)
}

const getSourceHeadingAtLine = (cm: CMInstance, line: number): SourceHeading | null => {
  const text = cm.getLine(line)
  if (typeof text !== 'string') return null

  const atxMatch = /^(?: {0,3})(#{1,6})(?:\s+|$)/.exec(text)
  if (atxMatch && isHeaderToken(cm, line)) {
    return {
      line,
      level: atxMatch[1].length,
      content: text.replace(/^\s*#{1,6}\s{1,}/, '').trim()
    }
  }

  const nextLine = cm.getLine(line + 1)
  if (
    text.trim() &&
    typeof nextLine === 'string' &&
    /^[=-]+\s*$/.test(nextLine) &&
    isHeaderToken(cm, line + 1)
  ) {
    return {
      line,
      level: nextLine[0] === '=' ? 1 : 2,
      content: text.trim()
    }
  }

  return null
}

const findSourceLineForHeadingSlug = (slug: string): number | null => {
  if (!editor.value) return null

  const toc = editorStore.listToc
  const targetIndex = toc.findIndex((item) => item.slug === slug)
  const target = toc[targetIndex]
  if (
    targetIndex < 0 ||
    !target ||
    typeof target.content !== 'string' ||
    typeof target.lvl !== 'number'
  ) {
    return null
  }

  const occurrence = toc.slice(0, targetIndex + 1).filter((item) => {
    return item.content === target.content && item.lvl === target.lvl
  }).length
  let seen = 0
  const cm = editor.value

  for (let line = cm.firstLine(); line <= cm.lastLine(); line += 1) {
    const heading = getSourceHeadingAtLine(cm, line)

    if (heading && heading.content === target.content && heading.level === target.lvl) {
      seen += 1
      if (seen === occurrence) return heading.line
    }
  }

  return null
}

const scrollToSourceHeader = (slug: unknown) => {
  if (!sourceCode.value || typeof slug !== 'string' || !editor.value) return

  const line = findSourceLineForHeadingSlug(slug)
  if (line === null) return

  unfoldSourceLine(line)
  requestAnimationFrame(() => {
    if (!editor.value) return

    editor.value.focus()
    editor.value.setCursor(line, 0)
    editor.value.scrollIntoView({ line, ch: 0 }, 120)
  })
}

const handleFoldAllHeadings = () => {
  foldAllSourceHeadings()
}

const handleUnfoldAllHeadings = () => {
  unfoldAllSourceHeadings()
}

const handleUndo = () => {
  if (!sourceCode.value || !editor.value) return

  unfoldAllSourceHeadings()
  editor.value.undo()
}

const handleRedo = () => {
  if (!sourceCode.value || !editor.value) return

  unfoldAllSourceHeadings()
  editor.value.redo()
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

const listenChange = () => {
  editor.value.on('cursorActivity', (cm: CMInstance) => {
    saveContent(cm)
  })
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
    lineNumbers: true,
    autofocus: true,
    lineWrapping: true,
    gutters: [SOURCE_LINE_GUTTER, SOURCE_FOLD_GUTTER],
    foldGutter: getSourceFoldOptions(),
    foldOptions: getSourceFoldOptions(),
    styleActiveLine: true,
    direction: textDirection,
    viewportMargin: Infinity,
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

  bus.on('file-loaded', handleFileChange)
  bus.on('invalidate-image-cache', handleInvalidateImageCache)
  bus.on('file-changed', handleFileChange)
  bus.on('undo', handleUndo)
  bus.on('redo', handleRedo)
  bus.on('selectAll', handleSelectAll)
  bus.on('foldAllHeadings', handleFoldAllHeadings)
  bus.on('unfoldAllHeadings', handleUnfoldAllHeadings)
  bus.on('scroll-to-header', scrollToSourceHeader)
  bus.on('image-action', handleImageAction)

  // For some reason, code mirror does not seem to play well with Vue's refs if we reference editor.value directly.
  // See https://github.com/codemirror/codemirror5/issues/6886 - hence, we need to use a local variable first.
  const codeMirrorInstance = codeMirror(container, codeMirrorConfig)

  // `markdown-math` wraps the standard Markdown mode and delegates `$...$` and
  // `$$...$$` spans to stex so subscript underscores in math do not flip the
  // outer mode into emphasis. See src/renderer/src/codeMirror/markdownMathMode.js.
  codeMirrorInstance.setOption('mode', 'markdown-math')

  codeMirrorInstance.on('contextmenu', (_cm: CMInstance, event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  if (isValidMuyaIndexCursor(muyaIndexCursor)) {
    const { anchor, focus } = muyaIndexCursor
    codeMirrorInstance.setSelection(anchor, focus, { scroll: true })
  } else {
    setCursorAtFirstLine(codeMirrorInstance)
  }

  editor.value = codeMirrorInstance
  tabId.value = id

  listenChange()
})

onBeforeUnmount(() => {
  viewDestroyed.value = true
  if (commitTimer.value) clearTimeout(commitTimer.value)

  bus.off('file-loaded', handleFileChange)
  bus.off('invalidate-image-cache', handleInvalidateImageCache)
  bus.off('file-changed', handleFileChange)
  bus.off('undo', handleUndo)
  bus.off('redo', handleRedo)
  bus.off('selectAll', handleSelectAll)
  bus.off('foldAllHeadings', handleFoldAllHeadings)
  bus.off('unfoldAllHeadings', handleUnfoldAllHeadings)
  bus.off('scroll-to-header', scrollToSourceHeader)
  bus.off('image-action', handleImageAction)

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
.source-code .CodeMirror-foldmarker {
  color: var(--editorColor);
  text-shadow: none;
}
.source-code .CodeMirror-foldgutter-open,
.source-code .CodeMirror-foldgutter-folded {
  color: var(--editorColor);
}
.source-code .CodeMirror-activeline-background,
.source-code .CodeMirror-activeline-gutter {
  background: var(--floatHoverColor);
}
</style>
