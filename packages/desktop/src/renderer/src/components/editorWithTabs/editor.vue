<template>
  <div
    class="editor-wrapper"
    :class="[{ typewriter: typewriter, focus: focus, source: sourceCode }]"
    :dir="textDirection"
  >
    <div
      ref="editorRef"
      class="editor-component"
    />
    <div
      v-show="imageViewerVisible"
      class="image-viewer"
    >
      <span
        class="icon-close"
        @click="setImageViewerVisible(false)"
      >
        <CloseIcon />
      </span>
      <div ref="imageViewerRef" />
    </div>
    <el-dialog
      v-model="dialogTableVisible"
      :show-close="isShowClose"
      :modal="true"
      class="ag-insert-table-dialog"
      width="454px"
      center
      dir="ltr"
    >
      <template #title>
        <div class="dialog-title">
          {{ t('editor.insertTable.title') }}
        </div>
      </template>
      <el-form
        :model="tableChecker"
        :inline="true"
      >
        <el-form-item :label="t('editor.insertTable.rows')">
          <el-input-number
            ref="rowInput"
            v-model="tableChecker.rows"
            size="mini"
            controls-position="right"
            :min="1"
            :max="30"
          />
        </el-form-item>
        <el-form-item :label="t('editor.insertTable.columns')">
          <el-input-number
            v-model="tableChecker.columns"
            size="mini"
            controls-position="right"
            :min="1"
            :max="20"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogTableVisible = false">
            {{ t('common.cancel') }}
          </el-button>
          <el-button
            type="primary"
            @click="handleDialogTableConfirm"
          >
            {{ t('common.ok') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <editor-search v-if="!sourceCode" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick, markRaw } from 'vue'
import log from 'electron-log'
import {
  Muya,
  CodeBlockLanguageSelector,
  EmojiSelector,
  FootnoteTool,
  ImageEditTool,
  ImagePathPicker,
  ImageResizeBar,
  ImageToolBar,
  InlineFormatToolbar,
  LinkTools,
  ParagraphFrontButton,
  ParagraphFrontMenu,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  TableChessboard,
  TableColumnToolbar,
  TableDragBar,
  TableRowColumMenu,
  wordCount as muyaWordCount,
  en,
  de,
  es,
  fr,
  ja,
  ko,
  pt,
  tr,
  zhCN,
  zhTW,
  type ILocale
} from '@muyajs/core'
import { exportStyledHTML, type HeaderFooterPart } from '@/util/exportHtml'
import { applyCursor, isIndexCursor } from '@/util/cursor'
import EditorSearch from '../search/index.vue'
import bus from '@/bus'
import { DEFAULT_EDITOR_FONT_FAMILY, DEFAULT_CODE_FONT_FAMILY } from '@/config'
import notice from '@/services/notification'
import Printer from '@/services/printService'
import { SpellcheckerLanguageCommand } from '@/commands'
import { SpellChecker } from '@/spellchecker'
import { isOsx, animatedScrollTo } from '@/util'
import { moveImageToFolder, uploadImage } from '@/util/fileSystem'
import { guessClipboardFilePath } from '@/util/clipboard'
import { getCssForOptions, getHtmlToc, type PdfCssOptions, type HtmlTocOptions } from '@/util/pdf'
import { resolveTocHeadingElement } from '@/util/tocNavigation'
import { addCommonStyle, setEditorWidth } from '@/util/theme'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { SyntheticHistory, type IFileHistoryLike } from './syntheticHistory'

// Importing the engine entrypoint auto-injects its editor CSS (the muya.ts
// module imports its stylesheets at load time). Desktop themes still target the
// legacy `ag-*` DOM (theme migration is a separate phase), so minor visual
// differences against the new `mu-*` DOM are expected.
import '@muyajs/core'
import '@/assets/themes/codemirror/one-dark.css'
import { Close as CloseIcon } from '@element-plus/icons-vue'
import { type InputNumberInstance } from 'element-plus'

const { t } = useI18n()
const STANDAR_Y = 320

// Map the desktop language preference to the engine's bundled locale objects.
const MUYA_LOCALES: Record<string, ILocale> = {
  en,
  de,
  es,
  fr,
  ja,
  ko,
  pt,
  tr,
  'zh-CN': zhCN,
  'zh-TW': zhTW
}

const getMuyaLocale = (language: string): ILocale => MUYA_LOCALES[language] ?? en

// `Muya.use(...)` appends to the static `Muya.plugins` array, and every
// `init()` instantiates the full list. Registration is process-global, so guard
// it with a module-level flag — otherwise remounting this component in the same
// renderer (window reuse / HMR) would register duplicate plugins and spawn
// duplicate UI handlers. The per-plugin option closures (imageAction/jumpClick)
// only read app-singleton Pinia stores, so capturing them once is correct.
let muyaPluginsRegistered = false

// The `@muyajs/core` `Muya` surface is deliberately permissive (`[key: string]:
// any` in muya-core.d.ts); everything that crosses the editor boundary leans on
// it, so the instance handle stays `any` until the engine ships built typings.
type MuyaInstance = any

// The engine's `selection-change` / `json-change` payload. The consumed
// `@muyajs/core` declaration does not re-export this shape, so describe the
// fields the desktop reads (each is re-cast in the body); the index signature
// keeps the boundary permissive for anything not enumerated here.
interface MuyaChange {
  anchorPath?: Array<string | number>
  focusPath?: Array<string | number>
  anchorBlock?: { text?: string } | null
  focusBlock?: { text?: string } | null
  anchorBlockInfo?: { type?: string; functionType?: string } | null
  focusBlockInfo?: { type?: string; functionType?: string } | null
  affiliation?: EngineAffiliationEntry[]
  anchor?: { offset?: number } | null
  focus?: { offset?: number } | null
  cursorCoords?: { y?: number } | null
  formats?: SelectionFormatLike[]
  [key: string]: unknown
}

const props = defineProps<{
  markdown?: string
  cursor?: unknown
  textDirection: string
  platform?: string
}>()

// Get stores
const preferencesStore = usePreferencesStore()
const editorStore = useEditorStore()
const projectStore = useProjectStore()

// Use storeToRefs to extract reactive properties from the stores
const {
  // Preferences
  preferLooseListItem,
  autoPairBracket,
  autoPairMarkdownSyntax,
  autoPairQuote,
  bulletListMarker,
  orderListDelimiter,
  tabSize,
  listIndentation,
  frontmatterType,
  superSubScript,
  footnote,
  isHtmlEnabled,
  isGitlabCompatibilityEnabled,
  lineHeight,
  fontSize,
  codeFontSize,
  codeFontFamily,
  codeBlockLineNumbers,
  trimUnnecessaryCodeBlockEmptyLines,
  editorFontFamily,
  hideQuickInsertHint,
  hideLinkPopup,
  autoCheck,
  editorLineWidth,
  wrapCodeBlocks,
  imageInsertAction,
  imagePreferRelativeDirectory,
  imageRelativeDirectoryBase,
  imageRelativeDirectoryName,
  imageFolderPath,
  theme,
  sequenceTheme,
  hideScrollbar,
  spellcheckerEnabled,
  spellcheckerNoUnderline,
  spellcheckerLanguage,
  language,

  // Edit modes
  typewriter,
  focus,
  sourceCode
} = storeToRefs(preferencesStore)

// Editor store refs
const { currentFile, tabs } = storeToRefs(editorStore)

// Project store refs
const { projectTree } = storeToRefs(projectStore)

// Component state
const defaultFontFamily = DEFAULT_EDITOR_FONT_FAMILY
const resolveEditorFont = (family: string): string =>
  family ? `${family}, ${defaultFontFamily}` : defaultFontFamily
const resolveCodeFont = (family: string): string => `${family}, ${DEFAULT_CODE_FONT_FAMILY}`
const selectionChange = ref<unknown>(null)
const editor = ref<MuyaInstance>(null)
const isShowClose = ref(false)
const dialogTableVisible = ref(false)
const imageViewerVisible = ref<boolean | null>(null)
const tableChecker = reactive({
  rows: 4,
  columns: 3
})

// Template refs
const editorRef = ref<HTMLDivElement | null>(null)
const imageViewerRef = ref<HTMLDivElement | null>(null)
const rowInput = ref<InputNumberInstance | null>(null)

// Non-reactive variables
let printer: Printer | null = null
let spellchecker: any = null
let switchLanguageCommand: SpellcheckerLanguageCommand | null = null
let imageViewer: SimpleImageViewer | null = null
// The engine has no `scroll` event; we listen on the scroll container directly.
let scrollHandler: ((e: Event) => void) | null = null

// The engine's undo/redo history (`getHistory()`) has a different shape than
// the desktop store's `tab.history` (which drives the save/dirty tracking and
// is migrated separately). We therefore keep the real engine history in a
// per-tab map here for restoration across in-session tab switches, and feed the
// store a SYNTHETIC desktop-shaped history.
const engineHistoryByTab = new Map<string, unknown>()

// The WYSIWYG caret captured the instant the user switches INTO source mode.
// Focus moves to CodeMirror while source mode is up, so by the time the tab is
// handed back (`replaceContent`) the live DOM selection no longer points into
// the muya tree. We stash the pre-source caret here and feed it to
// `replaceContent` as the rebuild boundary's restore-selection, so the first
// undo after the handoff returns the caret to where source mode was entered.
let preSourceModeSelection: unknown = null

// Per-tab monotonic save-tracking id allocator. The synthetic history entry id
// is a MONOTONIC, never-reused id keyed on the live document content (see
// `syntheticHistory.ts`), NOT the engine undo-stack depth: depth is reused
// across distinct documents at the same stack height, which falsely showed a
// divergently re-edited tab as clean (Phase G — G6). Reset whenever the engine
// reloads the document via `setContent` (which clears the engine history), so
// the reloaded content is the id-0 baseline matching the store's seeded
// `lastSavedHistoryId: 0`.
const syntheticHistoryByTab = new Map<string, SyntheticHistory>()
const getSyntheticHistory = (id: string, baselineContent: string): SyntheticHistory => {
  let tracker = syntheticHistoryByTab.get(id)
  if (!tracker) {
    tracker = new SyntheticHistory(baselineContent)
    syntheticHistoryByTab.set(id, tracker)
  }
  return tracker
}
// Re-baseline a tab's id allocator to the given content (id 0). Called after
// `setContent` reloads the document so the freshly loaded content is clean.
const resetSyntheticHistory = (id: string, baselineContent: string): void => {
  syntheticHistoryByTab.set(id, new SyntheticHistory(baselineContent))
}
const makeSyntheticHistory = (id: string, content: string): IFileHistoryLike => {
  return getSyntheticHistory(id, content).build(content)
}
// Drop per-tab bookkeeping for tabs that no longer exist. Tab ids are unique
// over the session, so without pruning these maps (and the content -> id map
// each `SyntheticHistory` holds) would grow unbounded as tabs are opened and
// closed. Driven by a watcher on the store's live tab id set.
const pruneClosedTabState = (liveTabIds: Set<string>): void => {
  for (const id of engineHistoryByTab.keys()) {
    if (!liveTabIds.has(id)) engineHistoryByTab.delete(id)
  }
  for (const id of syntheticHistoryByTab.keys()) {
    if (!liveTabIds.has(id)) syntheticHistoryByTab.delete(id)
  }
}

interface SelectionFormatLike {
  type: string
  [key: string]: unknown
}

// Container `blockName` → legacy `functionType`. The engine's affiliation
// entries carry `blockName` but not the legacy `functionType` the desktop
// menu-state builder keys off for `pre`/`figure` containers (table detection +
// Format-menu disable). Re-derive it here so `createApplicationMenuState`'s
// existing `pre`/`figure` branches fire. The `code$` / `multiplemath` /
// `frontmatter` / `html` / `table` values match the legacy muyajs vocabulary
// (`createApplicationMenuState`'s `/frontmatter|html|multiplemath|code$/` test
// and `=== 'table'` check).
const CONTAINER_FUNCTION_TYPE: Record<string, string> = {
  'code-block': 'fencecode',
  frontmatter: 'frontmatter',
  table: 'table',
  'html-block': 'html',
  'math-block': 'multiplemath',
  diagram: 'diagram'
}

interface EngineAffiliationEntry {
  type: string
  blockName: string
  listType?: string
  listItemType?: string
  isLooseListItem?: boolean
  [key: string]: unknown
}

// The engine's `selection-change` payload (since #4410) carries an
// `affiliation` chain (shared-ancestor paragraph-type blocks, outermost-first)
// plus per-endpoint `anchorBlockInfo`/`focusBlockInfo` describing the content
// leaf (`type: 'span'` + `functionType`), alongside the live `anchorBlock`/
// `focusBlock` refs (which carry `.text`). The desktop's application-menu state
// builder (`createApplicationMenuState`) and the selected-text derivation in
// `SELECTION_CHANGE` were written against the legacy `{ start, end, affiliation }`
// shape, so map the new payload onto it:
//   - `start.type`/`end.type` from the leaf info (`'span'`) so the
//     `start.type === 'span'` guards fire,
//   - `start.block.functionType`/`end.block.functionType` from the leaf info so
//     code-content / table-cell detection lights up,
//   - `start.block.text`/`end.block.text` from the live block so the store can
//     still slice the selected text (`SELECTION_CHANGE` → search prefill),
//   - `affiliation` straight through (entries already carry `type` +
//     `listType`/`listItemType`/`isLooseListItem`), surfacing a derived
//     `functionType` on `pre`/`figure` containers for table / code-fence keys.
const adaptSelectionChange = (changes: MuyaChange) => {
  const anchorPath = (changes.anchorPath ?? []) as Array<string | number>
  const focusPath = (changes.focusPath ?? anchorPath) as Array<string | number>
  const anchorBlock = changes.anchorBlock as { text?: string } | null | undefined
  const focusBlock = changes.focusBlock as { text?: string } | null | undefined
  const anchorInfo = changes.anchorBlockInfo as
    | { type?: string; functionType?: string }
    | null
    | undefined
  const focusInfo = changes.focusBlockInfo as
    | { type?: string; functionType?: string }
    | null
    | undefined
  const rawAffiliation = (changes.affiliation ?? []) as EngineAffiliationEntry[]
  const affiliation = rawAffiliation.map((entry) => {
    const functionType =
      entry.type === 'pre' || entry.type === 'figure'
        ? CONTAINER_FUNCTION_TYPE[entry.blockName]
        : undefined
    return functionType ? { ...entry, functionType } : entry
  })
  return {
    start: {
      key: anchorPath.join('/'),
      offset: (changes.anchor?.offset ?? 0) as number,
      block: { text: anchorBlock?.text, functionType: anchorInfo?.functionType },
      type: anchorInfo?.type
    },
    end: {
      key: focusPath.join('/'),
      offset: (changes.focus?.offset ?? 0) as number,
      block: { text: focusBlock?.text, functionType: focusInfo?.functionType },
      type: focusInfo?.type
    },
    affiliation
  }
}

// Build a JSON-serializable cursor from the engine selection (drop the live
// block references so it survives the buffered-state round-trip). `setCursor`
// re-resolves the target blocks from `anchorPath`/`focusPath`.
const serializeCursor = (
  selection: {
    anchor?: { offset: number; path?: Array<string | number> }
    focus?: { offset: number; path?: Array<string | number> }
  } | null
) => {
  if (!selection) return null
  return {
    anchor: selection.anchor ? { offset: selection.anchor.offset } : null,
    focus: selection.focus ? { offset: selection.focus.offset } : null,
    anchorPath: selection.anchor?.path,
    focusPath: selection.focus?.path
  }
}

class SimpleImageViewer {
  container: HTMLElement
  scale: number
  translateX: number
  translateY: number
  isDragging: boolean
  startX: number
  startY: number
  img!: HTMLImageElement
  _onWheel!: (e: WheelEvent) => void
  _onMousedown!: (e: MouseEvent) => void
  _onMousemove!: (e: MouseEvent) => void
  _onMouseup!: () => void

  constructor (container: HTMLElement, { url }: { url: string }) {
    this.container = container
    this.scale = 1
    this.translateX = 0
    this.translateY = 0
    this.isDragging = false
    this.startX = 0
    this.startY = 0
    this._init(url)
  }

  _init (url: string) {
    this.container.innerHTML = ''
    this.img = document.createElement('img')
    this.img.src = url
    this.img.style.cssText =
      'max-width:90vw;max-height:90vh;object-fit:contain;transform-origin:center center;user-select:none;display:block;'
    this.img.draggable = false
    this.container.appendChild(this.img)
    this._bindEvents()
  }

  _updateTransform () {
    this.img.style.transform = `translate(${this.translateX}px,${this.translateY}px) scale(${this.scale})`
  }

  _bindEvents () {
    this._onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      this.scale = Math.max(0.1, Math.min(10, this.scale * factor))
      this._updateTransform()
    }
    this._onMousedown = (e: MouseEvent) => {
      if (e.button !== 0) return
      this.isDragging = true
      this.startX = e.clientX - this.translateX
      this.startY = e.clientY - this.translateY
      this.container.style.cursor = 'grabbing'
      e.preventDefault()
    }
    this._onMousemove = (e: MouseEvent) => {
      if (!this.isDragging) return
      this.translateX = e.clientX - this.startX
      this.translateY = e.clientY - this.startY
      this._updateTransform()
    }
    this._onMouseup = () => {
      this.isDragging = false
      this.container.style.cursor = 'grab'
    }
    this.container.addEventListener('wheel', this._onWheel, { passive: false })
    this.container.addEventListener('mousedown', this._onMousedown)
    document.addEventListener('mousemove', this._onMousemove)
    document.addEventListener('mouseup', this._onMouseup)
  }

  destroy () {
    this.container.removeEventListener('wheel', this._onWheel)
    this.container.removeEventListener('mousedown', this._onMousedown)
    document.removeEventListener('mousemove', this._onMousemove)
    document.removeEventListener('mouseup', this._onMouseup)
    this.container.innerHTML = ''
  }
}

// Watchers
// Prune per-tab engine/synthetic history bookkeeping when tabs close, so the
// maps don't accumulate stale entries (and their content -> id maps) over a long
// session. Watching the id set keeps this cheap — it only fires on tab add/close.
watch(
  () => tabs.value.map((t) => t.id),
  (ids) => {
    pruneClosedTabState(new Set(ids))
  }
)

watch(typewriter, (value) => {
  if (value) {
    scrollToCursor()
  }
})

watch(focus, (value) => {
  if (editor.value) {
    editor.value.setFocusMode(value)
  }
})

watch(fontSize, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ fontSize: value })
  }
})

watch(lineHeight, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ lineHeight: value })
  }
})

watch(editorFontFamily, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ editorFontFamily: resolveEditorFont(value) })
  }
})

watch(preferLooseListItem, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({
      preferLooseListItem: value
    })
  }
})

watch(tabSize, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ tabSize: value })
  }
})

watch(theme, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    // Agreement：Any black series theme needs to contain dark `word`.
    if (/dark/i.test(value)) {
      editor.value.setOptions(
        {
          mermaidTheme: 'dark',
          vegaTheme: 'dark'
        },
        true
      )
    } else {
      editor.value.setOptions(
        {
          mermaidTheme: 'default',
          vegaTheme: 'latimes'
        },
        true
      )
    }
  }
})

watch(sequenceTheme, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ sequenceTheme: value }, true)
  }
})

watch(() => preferencesStore.plantumlServer, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ plantumlServer: value }, true)
  }
})

watch(listIndentation, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setListIndentation(value)
  }
})

watch(frontmatterType, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ frontmatterType: value })
  }
})

watch(superSubScript, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ superSubScript: value }, true)
  }
})

watch(footnote, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ footnote: value }, true)
  }
})

watch(isHtmlEnabled, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ disableHtml: !value }, true)
  }
})

watch(isGitlabCompatibilityEnabled, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ isGitlabCompatibilityEnabled: value }, true)
  }
})

watch(hideQuickInsertHint, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ hideQuickInsertHint: value })
  }
})

watch(editorLineWidth, (value, oldValue) => {
  if (value !== oldValue) {
    setEditorWidth(value)
  }
})

watch(wrapCodeBlocks, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ wrapCodeBlocks: value })
  }
})

watch(autoPairBracket, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ autoPairBracket: value })
  }
})

watch(autoPairMarkdownSyntax, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ autoPairMarkdownSyntax: value })
  }
})

watch(autoPairQuote, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ autoPairQuote: value })
  }
})

watch(trimUnnecessaryCodeBlockEmptyLines, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ trimUnnecessaryCodeBlockEmptyLines: value })
  }
})

watch(bulletListMarker, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ bulletListMarker: value })
  }
})

watch(orderListDelimiter, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ orderListDelimiter: value })
  }
})

watch(hideLinkPopup, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ hideLinkPopup: value })
  }
})

watch(autoCheck, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ autoCheck: value })
  }
})

watch(codeFontSize, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ codeFontSize: value })
    // Source-mode CodeMirror is a separate surface muya doesn't own.
    addCommonStyle({
      codeFontSize: value,
      codeFontFamily: codeFontFamily.value,
      hideScrollbar: hideScrollbar.value
    })
  }
})

watch(codeBlockLineNumbers, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ codeBlockLineNumbers: value }, true)
  }
})

watch(codeFontFamily, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ codeFontFamily: resolveCodeFont(value) })
    // Source-mode CodeMirror is a separate surface muya doesn't own.
    addCommonStyle({
      codeFontSize: codeFontSize.value,
      codeFontFamily: value,
      hideScrollbar: hideScrollbar.value
    })
  }
})

watch(hideScrollbar, (value, oldValue) => {
  if (value !== oldValue) {
    addCommonStyle({
      codeFontSize: codeFontSize.value,
      codeFontFamily: codeFontFamily.value,
      hideScrollbar: value
    })
  }
})

watch(spellcheckerEnabled, (value, oldValue) => {
  if (value !== oldValue) {
    // Set Muya's spellcheck container attribute.
    editor.value.setOptions({ spellcheckEnabled: value })

    // Disable native spell checker
    if (value) {
      spellchecker.activateSpellchecker(spellcheckerLanguage.value)
    } else {
      spellchecker.deactivateSpellchecker()
    }
  }
})

watch(spellcheckerNoUnderline, (value, oldValue) => {
  if (value !== oldValue) {
    // Hide only the spelling squiggle; the native checker (and its right-click
    // suggestions) stays controlled by `spellcheckerEnabled`.
    editor.value.setOptions({ spellcheckHideMarks: value })
  }
})

watch(spellcheckerLanguage, (value, oldValue) => {
  if (value !== oldValue) {
    spellchecker.lang = value
  }
})

watch(currentFile, (value, oldValue) => {
  if (value && value !== oldValue) {
    scrollToCursor(0)
    // Hide float tools if needed.
    if (editor.value) {
      editor.value.hideAllFloatTools()
    }
  }
})

watch(
  sourceCode,
  (value, oldValue) => {
    if (value && value !== oldValue) {
      if (editor.value) {
        editor.value.hideAllFloatTools()
        // Compute the WYSIWYG caret as a source-markdown `{ line, ch }` index
        // cursor JUST-IN-TIME, only when entering source mode (Phase G — G7),
        // and write it to the tab before sourceCode.vue mounts (`flush: 'sync'`
        // runs this before the `v-if`-gated child reads `props.muyaIndexCursor`
        // in its onMounted). This is the inverse of the `setCursorByOffset`
        // source -> WYSIWYG path. Computing it here rather than on every
        // json-change/selection-change avoids serializing the whole document on
        // each keystroke/caret move, and guarantees a fresh (never stale) value.
        if (currentFile.value) {
          currentFile.value.muyaIndexCursor = editor.value.getCursorOffset() ?? null
        }
        // Capture the block-key caret too (same fresh selection getCursorOffset
        // reads) so the post-handoff undo can restore it — see
        // `preSourceModeSelection`.
        preSourceModeSelection = editor.value.getSelection()
      }
    }
  },
  { flush: 'sync' }
)

// Methods
// muya types the callback as (linkInfo: ILinkInfo | null) and href itself can
// be null when the rendered link has no usable href (see issue #4356).
const jumpClick = (linkInfo: { href?: string | null } | null) => {
  if (!linkInfo) return
  const { href } = linkInfo
  editorStore.FORMAT_LINK_CLICK({ data: { href: href ?? null }, dirname: window.DIRNAME })
}

interface ImagePathSuggestion {
  type: 'directory' | 'file' | string
  file: string
  [key: string]: unknown
}

const imagePathAutoComplete = async (src: string) => {
  const files = (await editorStore.ASK_FOR_IMAGE_AUTO_PATH(src)) as unknown as ImagePathSuggestion[]
  return files.map((f) => {
    const iconClass = f.type === 'directory' ? 'icon-folder' : 'icon-image'
    return Object.assign(f, { iconClass, text: f.file + (f.type === 'directory' ? '/' : '') })
  })
}

const imageAction = async (
  image: string | File,
  id: string | null,
  alt: string = ''
): Promise<string> => {
  // TODO(Refactor): Refactor this method.
  if (!currentFile.value) return ''
  const { filename, pathname: currentPathname } = currentFile.value

  // Figure out the current working directory.
  // Save an image relative to the file, otherwise use the project root when available.
  const isTabSavedOnDisk = !!currentPathname
  let relativeBasePath: string | null = isTabSavedOnDisk
    ? window.path.dirname(currentPathname)
    : null
  if (isTabSavedOnDisk && imageRelativeDirectoryBase.value !== 'file' && projectTree.value) {
    const { pathname: rootPath } = projectTree.value as { pathname?: string }
    if (rootPath && window.fileUtils.isChildOfDirectory(rootPath, currentPathname)) {
      // Save assets relative to root directory.
      relativeBasePath = rootPath
    }
  }

  const getResolvedImagePath = (imagePath: string) => {
    const replacement = isTabSavedOnDisk
      ? filename.replace(/\.[^/.]+$/, '') // Filename w/o extension
      : ''
    return imagePath.replace(/\${filename}/g, replacement)
  }

  const resolvedGlobalImageFolderPath = getResolvedImagePath(imageFolderPath.value)
  const resolvedImageRelativeDirectoryName = getResolvedImagePath(imageRelativeDirectoryName.value) // assets/
  const resolvedImageRelativeFullDirectoryPath = relativeBasePath
    ? window.path.join(relativeBasePath, resolvedImageRelativeDirectoryName)
    : null // /root/dir/assets
  let destImagePath = ''
  switch (imageInsertAction.value) {
    case 'upload': {
      try {
        // Pass the full preferences state object to avoid dereferencing non-existent .value
        destImagePath = (await uploadImage(
          currentPathname,
          image,
          preferencesStore.$state as unknown as import('@/util/fileSystem').UploadImagePreferences
        )) as string
      } catch (err) {
        notice.notify({
          title: 'Upload Image',
          type: 'warning',
          message: err as string
        })
        destImagePath = (await moveImageToFolder(
          currentPathname,
          image,
          resolvedGlobalImageFolderPath
        )) as string
      }
      break
    }
    case 'folder': {
      if (isTabSavedOnDisk && imagePreferRelativeDirectory.value) {
        // `image` may be a path string (paste/drag/image-selector) — pass
        // `currentPathname` so moveImageToFolder can resolve relative paths
        // via `path.dirname(pathname)` instead of crashing on `dirname(null)`.
        destImagePath = (await moveImageToFolder(
          currentPathname,
          image,
          resolvedImageRelativeFullDirectoryPath as string,
          true,
          currentPathname
        )) as string
      } else {
        destImagePath = (await moveImageToFolder(
          currentPathname,
          image,
          resolvedGlobalImageFolderPath
        )) as string
      }
      break
    }
    case 'path': {
      if (typeof image === 'string') {
        // Input is a local path.
        destImagePath = image
      } else {
        // Save and move image to image folder if input is binary.

        // Respect user preferences if tab exists on disk.
        if (isTabSavedOnDisk && imagePreferRelativeDirectory.value) {
          destImagePath = (await moveImageToFolder(
            null as unknown as string,
            image,
            resolvedImageRelativeFullDirectoryPath as string,
            true,
            currentPathname
          )) as string
        } else {
          destImagePath = (await moveImageToFolder(
            currentPathname,
            image,
            resolvedGlobalImageFolderPath
          )) as string
        }
      }
      break
    }
  }

  if (id && sourceCode.value) {
    bus.emit('image-action', {
      id,
      result: destImagePath,
      alt
    })
  }
  return destImagePath
}

// Adapt the engine's `imageAction` contract (`{ src, alt, title }`) to the
// desktop's `imageAction(image, id, alt)`. The engine handles a single inline
// image edit (no `id` round-trip / source-mode bus event), so we pass `null`
// for `id`.
const muyaImageAction = (state: { src: string; alt?: string; title?: string }): Promise<string> =>
  imageAction(state.src, null, state.alt ?? '')

const imagePathPicker = () => {
  return editorStore.ASK_FOR_IMAGE_PATH()
}

const keyup = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    setImageViewerVisible(false)
  }
}

const setImageViewerVisible = (status: boolean) => {
  imageViewerVisible.value = status
  if (!status && imageViewer) {
    imageViewer.destroy()
    imageViewer = null
  }
}

const switchSpellcheckLanguage = (languageCode: unknown) => {
  const { isEnabled } = spellchecker

  // This method is also called from bus, so validate state before continuing.
  if (!isEnabled) {
    throw new Error(t('editor.spellcheck.disabledError'))
  }

  spellchecker
    .switchLanguage(languageCode)
    .then((langCode: string | null | undefined) => {
      if (!langCode) {
        // Unable to switch language due to missing dictionary. The spell checker is now in an invalid state.
        notice.notify({
          title: t('editor.spellcheck.title'),
          type: 'warning',
          message: t('editor.spellcheck.languageMissing', { languageCode: languageCode as string })
        })
      }
    })
    .catch((error: unknown) => {
      log.error(
        t('editor.spellcheck.errorSwitchingLanguage', { languageCode: languageCode as string })
      )
      log.error(error)

      const errMsg = (error as { message?: string } | null | undefined)?.message ?? String(error)
      notice.notify({
        title: t('editor.spellcheck.title'),
        type: 'error',
        message: t('editor.spellcheck.switchError', {
          languageCode: languageCode as string,
          error: errMsg
        })
      })
    })
}

const handleInvalidateImageCache = () => {
  if (editor.value) {
    editor.value.invalidateImageCache()
  }
}

const openSpellcheckerLanguageCommand = () => {
  if (!isOsx) {
    bus.emit('show-command-palette', switchLanguageCommand)
  }
}

const replaceMisspelling = (payload: unknown) => {
  const { word, replacement } = payload as { word: string; replacement: string }
  if (editor.value) {
    editor.value.replaceCurrentWordInlineUnsafe(word, replacement)
  }
}

const handleUndo = () => {
  if (editor.value) {
    editor.value.undo()
  }
}

const handleRedo = () => {
  if (editor.value) {
    editor.value.redo()
  }
}

const handleSelectAll = () => {
  if (sourceCode.value) {
    return
  }

  if (editor.value && editor.value.hasFocus()) {
    editor.value.selectAll()
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

// Custom copyAsRich copyAsHtml pasteAsPlainText.
// `copyAsRich` writes the rendered HTML to `text/html` AND the plain text to
// `text/plain`, so pasting into Word/email yields formatted rich text (whereas
// `copyAsHtml` blanks `text/html` and puts the HTML source into `text/plain`).
const COPY_PASTE_METHOD_MAP: Record<string, 'copyAsRich' | 'copyAsHtml' | 'pasteAsPlainText'> = {
  copyAsRich: 'copyAsRich',
  copyAsHtml: 'copyAsHtml',
  pasteAsPlainText: 'pasteAsPlainText'
}
const handleCopyPaste = (type: unknown) => {
  if (editor.value) {
    const method = COPY_PASTE_METHOD_MAP[type as string]
    if (method) editor.value[method]()
  }
}

const insertImage = (src: unknown) => {
  if (!sourceCode.value) {
    editor.value && editor.value.insertImage({ src })
  }
}

// muya's search/replace/find return the live Search instance (circular:
// Search -> muya -> ... -> ScrollPage) and each match carries a live `block`
// reference. The store deep-clones (JSON.stringify) its payload, so extract
// only the plain { index, matches, value } the search UI needs.
const toSearchMatches = (result: unknown) => {
  const r = (result ?? {}) as {
    index?: number
    value?: string
    matches?: Array<{ start: number; end: number; match: string }>
  }
  return {
    index: r.index ?? -1,
    matches: (r.matches ?? []).map((m) => ({ start: m.start, end: m.end, match: m.match })),
    value: r.value ?? ''
  }
}

const handleSearch = (payload: unknown) => {
  const { value, opt } = payload as { value: string; opt: unknown }
  editorStore.SEARCH(toSearchMatches(editor.value.search(value, opt)))
  scrollToHighlight()
}

const handReplace = (payload: unknown) => {
  const { value, opt } = payload as { value: string; opt: unknown }
  editorStore.SEARCH(toSearchMatches(editor.value.replace(value, opt)))
}

const handleUploadedImage = (url: unknown, deletionUrl?: unknown) => {
  insertImage(url)
  editorStore.SHOW_IMAGE_DELETION_URL(deletionUrl as string)
}

// `muya.domNode` is the contenteditable + scroll container (it inherits the
// `.editor-component` class from the original mount point and `overflow:auto`).
// The legacy engine exposed the same element as `muya.container`.
const getScrollContainer = (): HTMLElement | null =>
  (editor.value?.domNode as HTMLElement | undefined) ?? null

// Viewport-relative caret rect (mirrors the engine's `Selection.getCursorCoords`
// / legacy `cursorCoords`). Used for typewriter + keep-cursor-visible scrolling
// when we are not inside a `selection-change` event (which already supplies it).
const getCursorY = (): number | null => {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0).cloneRange()
  let rects = range.getClientRects()
  if (rects.length === 0 && range.startContainer) {
    const parent =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement
    rects = parent ? parent.getClientRects() : rects
  }
  return rects.length ? rects[0].y : null
}

const scrollToCursor = (duration = 300) => {
  nextTick(() => {
    const container = getScrollContainer()
    if (!container) return
    const y = getCursorY()
    if (y == null) return
    animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, duration)
  })
}

const scrollToCords = (y: number) => {
  const container = getScrollContainer()
  if (!container) return
  // Depending on how much the user previously scrolled, sometimes the container has not fully rendered all elements.
  // Hence, container.scrollHeight < [saved scrollTop]
  // What we need to do is to temporarily add a padding to the container so that we can actually set the scrollTop without getting clamped.

  const maxScrollHeight = container.scrollHeight - container.clientHeight // max scroll height is actually calculated as such
  if (y > maxScrollHeight) {
    const editorId = container.firstElementChild as HTMLElement | null
    if (editorId) {
      editorId.style.paddingBottom = `${y - maxScrollHeight + 100}px` // 100px is the default editor padding
      // attach a resize observer so we know when to remove the padding when it is of the "correct" height
      resizeObserverForEditor.observe(editorId)
    }
  }
  requestAnimationFrame(() => {
    if (!container) return
    // wait for the padding to be applied (if any)
    container.style.visibility = 'visible'
    container.style.pointerEvents = 'auto'
    container.scrollTop = y
  })
}

// Smoothly scroll the editor so `anchor` sits at the standard top offset.
// Shared by the TOC, search-highlight, and any other "reveal this element"
// caller so the getBoundingClientRect + animatedScrollTo math lives once.
const scrollElementIntoView = (anchor: Element | null | undefined, duration = 300) => {
  const container = getScrollContainer()
  if (!container || !anchor) return
  const { y } = anchor.getBoundingClientRect()
  animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, duration)
}

const scrollToHighlight = () => {
  return scrollToElement('.mu-highlight')
}

/**
 * Scrolls the editor to the heading for a TOC entry. See
 * `resolveTocHeadingElement` for why the slug is resolved by document order
 * against the top-level headings only.
 * @param slug The TOC entry's slug from the `scroll-to-header` bus event.
 */
const scrollToHeader = (slug: unknown) => {
  const container = getScrollContainer()
  if (!container) return
  scrollElementIntoView(resolveTocHeadingElement(container, editorStore.listToc, slug))
}

// Scrolls to a non-heading in-document anchor target (e.g. a custom
// `<a id="...">`) resolved by `FORMAT_LINK_CLICK` via `getElementById`.
const scrollToAnchorElement = (element: unknown) => {
  if (element instanceof Element) scrollElementIntoView(element)
}

const scrollToElement = (selector: string) => {
  // Scroll to search highlight word
  scrollElementIntoView(document.querySelector(selector))
}

const handleFindAction = (action: unknown) => {
  editorStore.SEARCH(toSearchMatches(editor.value.find(action)))
  scrollToHighlight()
}

interface ExportOptions {
  type: string
  header?: unknown
  footer?: unknown
  headerFooterStyled?: unknown
  htmlTitle?: string
  pageSize?: string
  pageSizeWidth?: number
  pageSizeHeight?: number
  isLandscape?: boolean
  [key: string]: unknown
}

const handleExport = async (options: unknown) => {
  const opts = options as ExportOptions
  const { type, headerFooterStyled, htmlTitle } = opts

  if (!/^pdf|print|styledHtml$/.test(type)) {
    throw new Error(`Invalid type to export: "${type}".`)
  }

  const extraCss = await getCssForOptions(opts as unknown as PdfCssOptions)
  const htmlToc = getHtmlToc(editor.value.getTOC(), opts as unknown as HtmlTocOptions)
  const markdown = editor.value.getMarkdown()
  const header = (opts.header ?? null) as HeaderFooterPart | null
  const footer = (opts.footer ?? null) as HeaderFooterPart | null

  switch (type) {
    case 'styledHtml': {
      try {
        const content = await exportStyledHTML(editor.value, markdown, {
          title: htmlTitle || '',
          printOptimization: false,
          extraCss,
          toc: htmlToc,
          dir: props.textDirection
        })
        editorStore.EXPORT({ type, content })
      } catch (err) {
        log.error('Failed to export document:', err)
        notice.notify({
          title: t('editor.export.failed', { type: htmlTitle || 'html' }),
          type: 'error',
          message:
            (err as { message?: string } | null | undefined)?.message ?? t('editor.export.error')
        })
      }
      break
    }
    case 'pdf': {
      // NOTE: We need to set page size via Electron.
      try {
        const { pageSize, pageSizeWidth, pageSizeHeight, isLandscape } = opts
        const pageOptions = {
          pageSize,
          pageSizeWidth,
          pageSizeHeight,
          isLandscape
        }

        const html = await exportStyledHTML(editor.value, markdown, {
          title: '',
          printOptimization: true,
          extraCss,
          toc: htmlToc,
          header,
          footer,
          headerFooterStyled: headerFooterStyled as boolean | undefined,
          dir: props.textDirection
        })
        printer!.renderMarkdown(html, true)
        editorStore.EXPORT({ type, pageOptions })
      } catch (err) {
        log.error('Failed to export document:', err)
        notice.notify({
          title: t('editor.export.failed', { type: 'PDF' }),
          type: 'error',
          message: t('editor.export.errorExporting', { type: htmlTitle || 'PDF' })
        })
        handlePrintServiceClearup()
      }
      break
    }
    case 'print': {
      // NOTE: Print doesn't support page size or orientation.
      try {
        const html = await exportStyledHTML(editor.value, markdown, {
          title: '',
          printOptimization: true,
          extraCss,
          toc: htmlToc,
          header,
          footer,
          headerFooterStyled: headerFooterStyled as boolean | undefined,
          dir: props.textDirection
        })
        printer!.renderMarkdown(html, true)
        editorStore.PRINT_RESPONSE()
      } catch (err) {
        log.error('Failed to export document:', err)
        notice.notify({
          title: t('editor.print.failed'),
          type: 'error',
          message: t('editor.print.error', { title: htmlTitle || '' })
        })
        handlePrintServiceClearup()
      }
      break
    }
  }
}

const handlePrintServiceClearup = () => {
  printer!.clearup()
}

// Push the current selection to the application-menu / toolbar state. Called on
// every muya selection-change, and again right after a paragraph action: a no-op
// action (e.g. "Paragraph" inside a list/quote) fires no selection-change, so the
// clicked checkbox menu item's auto-toggled OS checkmark would otherwise linger.
const pushSelectionMenuState = (changes: MuyaChange) => {
  editorStore.SELECTION_CHANGE({
    ...adaptSelectionChange(changes),
    // Read the live block tree (O(1)) rather than getState(), which deep-clones
    // the whole document — this runs on every cursor move.
    hasFrontMatter: editor.value?.editor?.scrollPage?.firstChild?.blockName === 'frontmatter'
  })
  // The active inline formats ride along on selection-change — drive the format
  // menu/toolbar state from them.
  editorStore.SELECTION_FORMATS((changes.formats ?? []) as SelectionFormatLike[])
}

const handleEditParagraph = (type: unknown) => {
  if (type === 'table') {
    tableChecker.rows = 4
    tableChecker.columns = 3
    dialogTableVisible.value = true
    nextTick(() => {
      rowInput.value?.focus()
    })
  } else if (editor.value) {
    editor.value.updateParagraph(type)
    // Re-sync the menu so a no-op action (e.g. "Paragraph" inside a list/quote)
    // does not leave the clicked checkbox item checked. A real conversion fires
    // its own selection-change, which resyncs again.
    if (selectionChange.value) {
      pushSelectionMenuState(selectionChange.value as MuyaChange)
    }
  }
}

// handle `duplicate`, `delete`, `create paragraph below`
const handleParagraph = (type: unknown) => {
  if (editor.value) {
    switch (type) {
      case 'duplicate': {
        return editor.value.duplicate()
      }
      case 'createParagraph': {
        return editor.value.insertParagraph('after', '', true)
      }
      case 'deleteParagraph': {
        return editor.value.deleteParagraph()
      }
      default:
        console.error(`unknow paragraph edit type: ${type}`)
    }
  }
}

const handleInlineFormat = (type: unknown) => {
  editor.value && editor.value.format(type)
}

const handleDialogTableConfirm = () => {
  dialogTableVisible.value = false
  editor.value && editor.value.createTable(tableChecker)
}

interface FileLoadedPayload {
  id?: string
  markdown?: string
  cursor?: unknown
}

// listen for `open-single-file` event, it will call this method only when open a new file.
const setMarkdownToEditor = (payload: unknown) => {
  const { id, markdown: newMarkdown, cursor: newCursor } = (payload ?? {}) as FileLoadedPayload
  if (editor.value) {
    // `setContent` resets the document and clears the undo history; only set a
    // cursor afterwards (a freshly-opened file has no history to restore).
    editor.value.setContent(newMarkdown ?? '')
    // The freshly loaded content is this tab's clean baseline (id 0). Re-seed
    // the monotonic save-tracking allocator so undoing an edit back to this
    // content reads as clean again (matches the store's `lastSavedHistoryId: 0`).
    // Seed from the engine's OWN serialization of the loaded document (not the
    // raw payload) so it matches the markdown later emitted on `json-change`
    // — the engine may normalize trailing newlines / whitespace on round-trip.
    if (id) {
      resetSyntheticHistory(id, editor.value.getMarkdown())
    }
    if (newCursor) {
      applyCursor(editor.value, newCursor)
      // A folder-search jump carries an index cursor; a freshly opened file
      // starts scrolled to the top, so reveal the resolved caret.
      if (isIndexCursor(newCursor)) {
        scrollToCursor()
      }
    }
    // `setContent` rebuilds the block tree synchronously but fires no
    // `json-change`, so seed the TOC explicitly (otherwise it stays empty until
    // the first edit, and a file switch keeps the previous file's TOC).
    editorStore.UPDATE_TOC(editor.value.getTOC())
    // A freshly created/opened tab should be ready to type into.
    focusFreshEditor()
  }
}

interface FileChangePayload {
  id?: string
  markdown?: string
  cursor?: unknown
  renderCursor?: boolean
  history?: unknown
  scrollTop?: number
  muyaIndexCursor?: unknown
  blocks?: unknown
  isReload?: boolean
}

// listen for markdown change form source mode or change tabs etc
const handleFileChange = (payload: unknown) => {
  const {
    id,
    markdown: newMarkdown,
    cursor: newCursor,
    muyaIndexCursor,
    history: payloadHistory,
    scrollTop,
    isReload
  } = (payload ?? {}) as FileChangePayload
  if (!editor.value) return
  const container = getScrollContainer()
  if (!container) return

  if (typeof newMarkdown === 'string') {
    // Returning from source-code mode: the WYSIWYG engine is never unmounted
    // while source mode is up (index.vue overlays it via `v-if`), so it still
    // holds the PRE-source-mode document and undo history. Record the bulk
    // source-mode edit as a SINGLE engine undo boundary via `replaceContent`
    // (PG14 parity): the first Ctrl+Z after the handoff reverts the entire
    // source-mode change in one step, matching legacy muyajs' full-state
    // snapshot history. `replaceContent` builds a fully-invertible whole-document
    // ot-json1 op and applies undo/redo via a full block-tree rebuild (never the
    // incremental pick/drop walker), so arbitrary block-type changes round-trip
    // safely.
    //
    // Detection: only sourceCode.vue's onBeforeUnmount emits `file-changed` with
    // a source-mode index cursor AND no block-key `cursor` AND no `history`
    // (see sourceCode.vue ~L368). Every tab-switch / file-reload emitter in
    // editor.ts carries both `cursor` and `history` alongside, so requiring
    // those absent reliably isolates the WYSIWYG<-source handoff from a tab
    // activation that merely replays a tab's persisted `muyaIndexCursor`.
    const isSourceModeHandoff =
      isIndexCursor(muyaIndexCursor) && !newCursor && payloadHistory == null

    if (isSourceModeHandoff) {
      // Record the bulk source-mode edit as a single undo boundary. When the
      // document is unchanged this is a no-op (returns false) and the existing
      // history/content already match — either way the caret still needs
      // remapping below.
      editor.value.replaceContent(newMarkdown, preSourceModeSelection)
      preSourceModeSelection = null
      editorStore.UPDATE_TOC(editor.value.getTOC())
      // Map the CodeMirror `{ line, ch }` cursor onto a block-key cursor so the
      // WYSIWYG caret lands where the source-mode cursor was (PG2).
      editor.value.setCursorByOffset(muyaIndexCursor)
    } else if (isReload) {
      // External disk reload (`loadChange`): the tab is already the live engine
      // document, so record the new on-disk content as a SINGLE invertible undo
      // boundary via `replaceContent` (legacy muyajs full-state-snapshot parity)
      // — the first undo after the reload restores the pre-reload document in one
      // step. `setContent` would clear the engine history and lose that boundary;
      // restoring the per-tab engine history (the tab-switch path) would clobber
      // it too. `replaceContent` preserves the existing undo stack and pushes the
      // boundary on top.
      //
      // The new content is this tab's clean baseline (the store seeds
      // `lastSavedHistoryId: 0`), so re-seed the save-tracking allocator BEFORE
      // applying: `replaceContent` fires a SYNCHRONOUS `json-change` that would
      // otherwise mark the tab dirty against the stale (pre-reload) baseline.
      if (id) {
        resetSyntheticHistory(id, newMarkdown)
      }
      editor.value.replaceContent(newMarkdown)
      editorStore.UPDATE_TOC(editor.value.getTOC())
      if (newCursor) {
        applyCursor(editor.value, newCursor)
      }
    } else {
      // Tab switch / programmatic content swap: `setContent` replaces the
      // document and clears history, so restore the real engine history (kept
      // per-tab) afterwards — preserves undo/redo on in-session tab switch. The
      // `history` in the payload is the synthetic desktop-shaped history used
      // for save tracking, not the engine history.
      editor.value.setContent(newMarkdown)
      // Tab switch swaps content without firing `json-change`, so re-seed the
      // TOC (otherwise returning to an open tab keeps the other tab's TOC).
      editorStore.UPDATE_TOC(editor.value.getTOC())
      if (newCursor) {
        applyCursor(editor.value, newCursor)
      } else if (isIndexCursor(muyaIndexCursor)) {
        // Source-mode handoff for a tab the engine has no history for (e.g.
        // first interaction after load): fall back to a caret-only remap. The
        // engine runs its own setContent dance internally, so restore the
        // history after.
        editor.value.setCursorByOffset(muyaIndexCursor)
      }
      const savedEngineHistory = id ? engineHistoryByTab.get(id) : undefined
      if (savedEngineHistory) {
        editor.value.setHistory(savedEngineHistory)
      }
      // First activation of a tab the save-tracking allocator has never seen:
      // seed its clean baseline from the engine's serialization now, before
      // any edit. For a tab that already has a tracker this is a no-op —
      // switching back must keep the existing content -> id map.
      if (id) {
        getSyntheticHistory(id, editor.value.getMarkdown())
      }
    }
  } else if (newCursor) {
    applyCursor(editor.value, newCursor)
  }

  if (typeof scrollTop === 'number') {
    container.style.visibility = 'hidden'
    container.style.pointerEvents = 'none'
    scrollToCords(scrollTop)
  } else {
    container.style.visibility = 'visible'
    container.style.pointerEvents = 'auto'
    scrollToCursor(0)
  }
}

const handleInsertParagraph = (location: unknown) => {
  editor.value && editor.value.insertParagraph(location)
}

const blurEditor = () => {
  editor.value?.blur(false, true)
}

const flushActiveEditor = () => {
  editor.value?.flush()
}

const focusEditor = () => {
  editor.value?.focus()
}

// Focus a freshly opened/created tab's editor. The sibling `file-changed`
// handler (emitted first, while the store commits the tab switch) hides the
// editor and queues a `requestAnimationFrame` via `scrollToCords` to restore
// it, and focus() is a no-op while the container is `visibility:hidden`. Our
// rAF is registered after that restore rAF, so it runs once the editor is
// visible; then take DOM focus (the engine's `focus()` only sets the selection
// range — the contenteditable also needs focus or no caret blinks) and place
// the caret at the document start.
const focusFreshEditor = () => {
  requestAnimationFrame(() => {
    const ed = editor.value
    if (!ed) return
    ed.domNode.focus()
    ed.focus()
  })
}

// When a focus-trapping modal (the command palette) opens, release the editor's
// contenteditable focus first. element-plus's el-dialog restores focus to the
// previously focused element on close; restoring it into the engine's
// contenteditable while its selection is uncommitted makes the focus-trap and
// the engine's selection handling fight, freezing the renderer. Blurring up
// front removes the editor as the restore target and avoids the loop.
const handleModalOpening = () => {
  if (editor.value && editor.value.hasFocus()) {
    editor.value.blur(true, true)
  }
}

// macOS Edit → Screenshot. The main process captures the region, saves it to a
// PNG, and hands us the path. `document.execCommand('paste')` no longer fires in
// Electron 42 Chromium, so insert the saved image at the cursor through the
// engine (routing via `imageAction` → upload/folder/path).
const handleScreenShot = (filePath?: unknown) => {
  if (editor.value && typeof filePath === 'string' && filePath) {
    editor.value.pasteImage(filePath)
  }
}

const handleResetPaddingBottom = () => {
  const container = getScrollContainer()
  if (!container) return
  const firstChild = container.firstElementChild as HTMLElement | null
  if (!firstChild) return
  const newScollableHeightWithoutPadding =
    container.scrollHeight - container.clientHeight - parseFloat(firstChild.style.paddingBottom)

  if (currentFile.value && newScollableHeightWithoutPadding > currentFile.value.scrollTop) {
    container.style.paddingBottom = ''
    resizeObserverForEditor.unobserve(firstChild) // unobserve #ag-editor-id since we have removed the padding
  }
}

const handleLanguageChanged = (newLocale?: unknown) => {
  if (editor.value) {
    const locale = typeof newLocale === 'string' ? newLocale : language.value
    editor.value.locale(getMuyaLocale(locale))
  }
}
const resizeObserverForEditor = new ResizeObserver(handleResetPaddingBottom)

onMounted(() => {
  printer = new Printer()
  const ele = editorRef.value
  if (!ele) return

  // Register the engine UI plugins once per renderer process (see
  // `muyaPluginsRegistered`). The image-edit tool receives the desktop's image
  // callbacks; LinkTools receives the ctrl/cmd-click jump handler.
  if (!muyaPluginsRegistered) {
    muyaPluginsRegistered = true
    Muya.use(TableChessboard)
    Muya.use(ParagraphQuickInsertMenu)
    Muya.use(CodeBlockLanguageSelector)
    Muya.use(EmojiSelector)
    Muya.use(ImagePathPicker)
    Muya.use(ImageEditTool, {
      imageAction: muyaImageAction,
      imagePathPicker,
      imagePathAutoComplete
    })
    Muya.use(ImageResizeBar)
    Muya.use(ImageToolBar)
    Muya.use(InlineFormatToolbar)
    Muya.use(ParagraphFrontButton)
    Muya.use(ParagraphFrontMenu)
    Muya.use(PreviewToolBar)
    Muya.use(LinkTools, {
      jumpClick
    })
    Muya.use(FootnoteTool)
    Muya.use(TableColumnToolbar)
    Muya.use(TableDragBar)
    Muya.use(TableRowColumMenu)
  }

  const options: Record<string, unknown> = {
    focusMode: focus.value,
    markdown: props.markdown,
    locale: getMuyaLocale(language.value),
    preferLooseListItem: preferLooseListItem.value,
    autoPairBracket: autoPairBracket.value,
    autoPairMarkdownSyntax: autoPairMarkdownSyntax.value,
    trimUnnecessaryCodeBlockEmptyLines: trimUnnecessaryCodeBlockEmptyLines.value,
    autoPairQuote: autoPairQuote.value,
    bulletListMarker: bulletListMarker.value,
    orderListDelimiter: orderListDelimiter.value,
    tabSize: tabSize.value,
    fontSize: fontSize.value,
    lineHeight: lineHeight.value,
    editorFontFamily: resolveEditorFont(editorFontFamily.value),
    codeFontSize: codeFontSize.value,
    codeFontFamily: resolveCodeFont(codeFontFamily.value),
    wrapCodeBlocks: wrapCodeBlocks.value,
    codeBlockLineNumbers: codeBlockLineNumbers.value,
    listIndentation: listIndentation.value,
    frontmatterType: frontmatterType.value,
    superSubScript: superSubScript.value,
    footnote: footnote.value,
    disableHtml: !isHtmlEnabled.value,
    isGitlabCompatibilityEnabled: isGitlabCompatibilityEnabled.value,
    hideQuickInsertHint: hideQuickInsertHint.value,
    hideLinkPopup: hideLinkPopup.value,
    autoCheck: autoCheck.value,
    sequenceTheme: sequenceTheme.value,
    plantumlServer: preferencesStore.plantumlServer,
    spellcheckEnabled: spellcheckerEnabled.value,
    spellcheckHideMarks: spellcheckerNoUnderline.value,
    // Resolve the OS clipboard to a local file path on paste (image-from-file).
    clipboardFilePath: guessClipboardFilePath,
    // Read the OS clipboard's plain text for "Paste as Plain Text" (execCommand('paste') no longer fires).
    clipboardText: () => window.electron.clipboard.readText(),
    // Image-persist callbacks read by the engine's clipboard + drag-drop handlers
    // from `muya.options.*` (distinct from the ImageEditTool plugin option above).
    // Without these, local-file drag-drop, screenshot/binary clipboard paste, and
    // copy-to-assets on a pasted image file silently no-op or insert raw paths.
    imageAction: muyaImageAction,
    getPathForFile: (file: File) => window.electron.webUtils.getPathForFile(file)
  }

  if (/dark/i.test(theme.value)) {
    Object.assign(options, {
      mermaidTheme: 'dark',
      vegaTheme: 'dark'
    })
  } else {
    Object.assign(options, {
      mermaidTheme: 'default',
      vegaTheme: 'latimes'
    })
  }

  // `markRaw` keeps Vue from wrapping the Muya instance in a reactive Proxy.
  // The engine stores live DOM nodes and block-tree references and patches the
  // DOM via snabbdom; proxying them silently breaks identity checks so the
  // document tree never renders.
  const muya = markRaw(new Muya(ele, options))
  // The new engine requires an explicit init() after construction (it builds
  // the document tree and instantiates the registered UI plugins).
  muya.init()
  editor.value = muya
  // The first document's content is set via constructor options, so no
  // `file-loaded` / `setMarkdownToEditor` runs for it — seed its TOC here.
  editorStore.UPDATE_TOC(muya.getTOC())

  // Seed the save-tracking baseline for the mount-loaded document (from the
  // engine's OWN serialization, same reason as setMarkdownToEditor). Without
  // this the allocator is created lazily on the first `json-change` — i.e.
  // after the first edit — so the pristine content never maps to id 0 and
  // undoing back to the on-disk content can never read as clean again (PG15).
  if (currentFile.value?.id) {
    getSyntheticHistory(currentFile.value.id, muya.getMarkdown())
  }

  const container = getScrollContainer()!

  // Listen for language changes and update the engine locale.
  bus.on('language-changed', handleLanguageChanged)

  // Create spell check wrapper and enable spell checking if preferred.
  spellchecker = new SpellChecker(spellcheckerEnabled.value, spellcheckerLanguage.value)

  // Register command palette entry for switching spellchecker language.
  switchLanguageCommand = new SpellcheckerLanguageCommand(spellchecker)
  setTimeout(() => bus.emit('cmd::register-command', switchLanguageCommand), 100)

  if (typewriter.value) {
    scrollToCursor()
  }

  // listen for bus events.
  bus.on('file-loaded', setMarkdownToEditor)
  bus.on('invalidate-image-cache', handleInvalidateImageCache)
  bus.on('undo', handleUndo)
  bus.on('redo', handleRedo)
  bus.on('selectAll', handleSelectAll)
  bus.on('export', handleExport)
  bus.on('print-service-clearup', handlePrintServiceClearup)
  bus.on('paragraph', handleEditParagraph)
  bus.on('format', handleInlineFormat)
  bus.on('searchValue', handleSearch)
  bus.on('replaceValue', handReplace)
  bus.on('find-action', handleFindAction)
  bus.on('insert-image', insertImage)
  bus.on('image-uploaded', handleUploadedImage)
  bus.on('file-changed', handleFileChange)
  bus.on('flush-active-editor', flushActiveEditor)
  bus.on('editor-blur', blurEditor)
  bus.on('editor-focus', focusEditor)
  bus.on('copyAsRich', handleCopyPaste)
  bus.on('copyAsHtml', handleCopyPaste)
  bus.on('pasteAsPlainText', handleCopyPaste)
  bus.on('duplicate', handleParagraph)
  bus.on('createParagraph', handleParagraph)
  bus.on('deleteParagraph', handleParagraph)
  bus.on('insertParagraph', handleInsertParagraph)
  bus.on('scroll-to-header', scrollToHeader)
  bus.on('scroll-to-anchor-element', scrollToAnchorElement)
  bus.on('screenshot-captured', handleScreenShot)
  bus.on('show-command-palette', handleModalOpening)
  bus.on('switch-spellchecker-language', switchSpellcheckLanguage)
  bus.on('open-command-spellchecker-switch-language', openSpellcheckerLanguageCommand)
  bus.on('replace-misspelling', replaceMisspelling)

  // The engine emits a low-level `json-change` ({ op, source, prevDoc, doc })
  // on every document mutation; the desktop's content-change pipeline wants the
  // derived document snapshot (markdown / word count / cursor / history / TOC /
  // block AST), so we compute it here — mirroring the legacy engine's
  // `dispatchChange` payload.
  editor.value.on('json-change', () => {
    // There is a chance that this event is fired AFTER the tab is switched. If we purely rely on this.currentFile later on
    // it can cause invalid updates. Hence, we need the id to identify changes as part of each tab
    if (!currentFile.value || !editor.value) return
    const { id } = currentFile.value
    if (!id) return
    const markdown = editor.value.getMarkdown()
    // Stash the real engine history for in-session tab-switch restoration. The
    // synthetic save-tracking id is derived from the live document content (a
    // monotonic, never-reused id — see `syntheticHistory.ts`), NOT the engine
    // undo-stack depth, which is reused and falsely showed a divergently
    // re-edited tab as clean (Phase G — G6).
    const engineHistory = editor.value.getHistory()
    engineHistoryByTab.set(id, engineHistory)
    editorStore.LISTEN_FOR_CONTENT_CHANGE({
      id,
      markdown,
      wordCount: muyaWordCount(markdown),
      cursor: serializeCursor(editor.value.getSelection()),
      // Synthetic, desktop-shaped history so the store's save/dirty tracking
      // keeps working (the engine history shape is incompatible).
      history: makeSyntheticHistory(id, markdown),
      toc: editor.value.getTOC(),
      blocks: editor.value.getState()
    })
  })

  // The engine does not emit `scroll`; listen on the scroll container directly
  // so the desktop can persist each tab's scroll position.
  scrollHandler = () => {
    if (currentFile.value) {
      editorStore.updateScrollPosition(currentFile.value.id, container.scrollTop)
    }
  }
  container.addEventListener('scroll', scrollHandler, { passive: true })

  // Clicking the hover-to-copy affordance on a heading emits `heading-copy-link`
  // with the heading's stable slug; copy the matching GitHub anchor to the
  // clipboard (resolved via `listToc.find(i => i.slug === key)`).
  editor.value.on('heading-copy-link', ({ key }: { key: string }) => {
    editorStore.copyGithubSlug(key)
  })

  editor.value.on(
    'format-click',
    ({ event, formatType, data }: { event: MouseEvent; formatType: string; data: unknown }) => {
      const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey)
      if (formatType === 'link' && ctrlOrMeta) {
        editorStore.FORMAT_LINK_CLICK({
          data: data as { href: string; [key: string]: unknown },
          dirname: window.DIRNAME
        })
      } else if (formatType === 'image' && ctrlOrMeta) {
        if (imageViewer) {
          imageViewer.destroy()
        }
        if (imageViewerRef.value) {
          imageViewer = new SimpleImageViewer(imageViewerRef.value, { url: data as string })
          setImageViewerVisible(true)
        }
      }
    }
  )

  editor.value.on('preview-image', ({ data }: { data: string }) => {
    if (imageViewer) {
      imageViewer.destroy()
    }
    if (imageViewerRef.value) {
      imageViewer = new SimpleImageViewer(imageViewerRef.value, { url: data })
      setImageViewerVisible(true)
    }
  })

  editor.value.on('selection-change', (changes: MuyaChange) => {
    const y = (changes.cursorCoords?.y ?? null) as number | null
    if (y != null) {
      if (typewriter.value) {
        const startPosition = container.scrollTop
        const toPosition = startPosition + y - STANDAR_Y

        // Prevent micro shakes and unnecessary scrolling.
        if (Math.abs(startPosition - toPosition) > 2) {
          animatedScrollTo(container, toPosition, 100)
        }
      }

      // Used to fix #628: auto scroll cursor to visible if the cursor is too low.
      if (container.clientHeight - y < 100) {
        // editableHeight is the lowest cursor position(till to top) that editor allowed.
        const editableHeight = container.clientHeight - 100
        animatedScrollTo(container, container.scrollTop + (y - editableHeight), 0)
      }
    }

    selectionChange.value = changes
    // Persist the caret so a click/arrow-key move (which never fires
    // `json-change`) survives an in-session tab switch — `tab.cursor` is what
    // `handleFileChange` replays on re-activation. Cheap: serialized caret only.
    if (currentFile.value?.id && editor.value) {
      editorStore.PERSIST_CURSOR(currentFile.value.id, serializeCursor(editor.value.getSelection()))
    }
    pushSelectionMenuState(changes)
  })

  document.addEventListener('keyup', keyup)

  setEditorWidth(editorLineWidth.value)
})

onBeforeUnmount(() => {
  bus.off('file-loaded', setMarkdownToEditor)
  bus.off('invalidate-image-cache', handleInvalidateImageCache)
  bus.off('undo', handleUndo)
  bus.off('redo', handleRedo)
  bus.off('selectAll', handleSelectAll)
  bus.off('export', handleExport)
  bus.off('print-service-clearup', handlePrintServiceClearup)
  bus.off('paragraph', handleEditParagraph)
  bus.off('format', handleInlineFormat)
  bus.off('searchValue', handleSearch)
  bus.off('replaceValue', handReplace)
  bus.off('find-action', handleFindAction)
  bus.off('insert-image', insertImage)
  bus.off('image-uploaded', handleUploadedImage)
  bus.off('file-changed', handleFileChange)
  bus.off('flush-active-editor', flushActiveEditor)
  bus.off('editor-blur', blurEditor)
  bus.off('editor-focus', focusEditor)
  bus.off('copyAsRich', handleCopyPaste)
  bus.off('copyAsHtml', handleCopyPaste)
  bus.off('pasteAsPlainText', handleCopyPaste)
  bus.off('duplicate', handleParagraph)
  bus.off('createParagraph', handleParagraph)
  bus.off('deleteParagraph', handleParagraph)
  bus.off('insertParagraph', handleInsertParagraph)
  bus.off('scroll-to-header', scrollToHeader)
  bus.off('scroll-to-anchor-element', scrollToAnchorElement)
  bus.off('screenshot-captured', handleScreenShot)
  bus.off('show-command-palette', handleModalOpening)
  bus.off('switch-spellchecker-language', switchSpellcheckLanguage)
  bus.off('open-command-spellchecker-switch-language', openSpellcheckerLanguageCommand)
  bus.off('replace-misspelling', replaceMisspelling)
  bus.off('language-changed', handleLanguageChanged)

  document.removeEventListener('keyup', keyup)

  // Remove the manual scroll listener; engine `on(...)` listeners are torn down
  // by `destroy()` → `eventCenter.unsubscribeAll()`.
  if (scrollHandler && editor.value) {
    const container = getScrollContainer()
    container?.removeEventListener('scroll', scrollHandler)
  }
  scrollHandler = null

  resizeObserverForEditor.disconnect()

  if (imageViewer) {
    imageViewer.destroy()
    imageViewer = null
  }

  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
})
</script>

<style>
/* ... existing style ... */
.editor-wrapper {
  height: 100%;
  position: relative;
  /* Contain the editor's z-indexed children (e.g. the math/diagram preview
     popups at z-index 10000) in their own stacking context so they cannot
     paint above modal dialogs rendered outside the editor. */
  isolation: isolate;
  flex: 1;
  color: var(--editorColor);
}

.ag-insert-table-dialog {
  & .el-form--inline {
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
  }
  & .el-form--inline .el-form-item {
    margin-right: 0;
  }
  & .el-input-number {
    width: 100px;
    min-width: 0;
  }
  & .el-button {
    font-size: 13px;
    width: 70px;
  }
}

.editor-wrapper.source {
  position: absolute;
  z-index: -1;
  top: 0;
  left: 0;
  overflow: hidden;
}

.editor-component {
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  cursor: default;
  overflow-anchor: none !important;
}

.editor-component .mu-container {
  padding-top: 20px;
  padding-bottom: 100vh;
}

.typewriter .editor-component {
  padding-top: calc(50vh - 136px);
  padding-bottom: calc(50vh - 54px);
}

.image-viewer {
  position: fixed;
  backdrop-filter: blur(5px);
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 11;
  & .icon-close {
    z-index: 1000;
    width: 30px;
    height: 30px;
    position: absolute;
    top: 50px;
    left: 50px;
    display: block;
    color: #efefef;
    & svg {
      width: 100%;
      height: 100%;
    }
  }
}

.image-viewer > div {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  overflow: hidden;
}
</style>
