<template>
  <div
    class="editor-wrapper"
    :class="[
      { typewriter: typewriter, focus: focus, source: sourceCode, 'viewer-open': viewerOpen }
    ]"
    :dir="textDirection"
  >
    <div
      ref="editorRef"
      class="editor-component"
    />
    <media-viewer
      ref="mediaViewer"
      @open-change="viewerOpen = $event"
    />
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
import {
  computed,
  ref,
  shallowRef,
  reactive,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  markRaw
} from 'vue'
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
  type IHistorySelection,
  type IPreviewDiagramPayload,
  type IMuyaOptions,
  type IReplaceOption,
  type ISearchOption,
  type ISerializedHistory
} from '@muyajs/core'
import { getMuyaLocale } from '@/util/muyaLocale'
import { exportStyledHTML, type HeaderFooterPart } from '@/util/exportHtml'
import { applyCursor, isIndexCursor } from '@/util/cursor'
import EditorSearch from '../search/index.vue'
import MediaViewer from '../mediaViewer/index.vue'
import bus from '@/bus'
import { DEFAULT_EDITOR_FONT_FAMILY, DEFAULT_CODE_FONT_FAMILY } from '@/config'
import notice from '@/services/notification'
import Printer from '@/services/printService'
import { SpellcheckerLanguageCommand } from '@/commands'
import { SpellChecker } from '@/spellchecker'
import { isMac, animatedScrollTo } from '@/util'
import { moveImageToFolder, uploadImage } from '@/util/fileSystem'
import { guessClipboardFilePath } from '@/util/clipboard'
import { dataURLToFile } from '@/util/dataURLToFile'
import { getCssForOptions, getHtmlToc, type PdfCssOptions, type HtmlTocOptions } from '@/util/pdf'
import {
  getTocHeadingScrollTop,
  resolveTocHeadingElement,
  TOP_LEVEL_HEADINGS_SELECTOR
} from '@/util/tocNavigation'
import { findActiveHeadingSlug, type HeadingPosition } from '@/util/findActiveHeading'
import { addCommonStyle, setEditorWidth } from '@/util/theme'
import { usePreferencesStore } from '@/store/preferences'
import {
  registerDocumentView,
  pruneSourceHistory
} from '../../services/documentMode'
import { popupContextMenu } from '../../contextMenu/popupMenu'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { SyntheticHistory, type IFileHistoryLike } from './syntheticHistory'

// Import the engine entrypoint for its editor styles.
import '@muyajs/core'
import '@/assets/themes/codemirror/one-dark.css'
import { type InputNumberInstance } from 'element-plus'

const { t } = useI18n()
const STANDAR_Y = 320

// `Muya.use(...)` appends to the static `Muya.plugins` array, and every
// `init()` instantiates the full list. Registration is process-global, so guard
// it with a module-level flag — otherwise remounting this component in the same
// renderer (window reuse / HMR) would register duplicate plugins and spawn
// duplicate UI handlers. The per-plugin option closures (imageAction/jumpClick)
// only read app-singleton Pinia stores, so capturing them once is correct.
let muyaPluginsRegistered = false

// Desktop fields consumed from engine change events; other engine fields remain opaque.
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

const preferencesStore = usePreferencesStore()
const editorStore = useEditorStore()
const projectStore = useProjectStore()

const {
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
  texMathDollars,
  texMathGfm,
  texMathSingleBackslash,
  texMathDoubleBackslash,
  highlightSyntax,
  inlineDiff,
  multilineBlockquote,
  githubAlerts,
  isHtmlEnabled,
  softNewlineAsSpace,
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

  typewriter: typewriterPreference,
  focus: focusPreference,
  sourceCode: sourceCodePreference
} = storeToRefs(preferencesStore)

const { currentFile, tabs } = storeToRefs(editorStore)
const sourceCode = computed(() => sourceCodePreference.value && !currentFile.value?.readOnly)
const typewriter = computed(() => typewriterPreference.value && !currentFile.value?.readOnly)
const focus = computed(() => focusPreference.value && !currentFile.value?.readOnly)
let loadingContent = false
const readingSelectionChanged = () => {
  if (!currentFile.value?.readOnly || !editor.value) return
  const selection = document.getSelection()
  if (selection?.anchorNode && editor.value.domNode.contains(selection.anchorNode)) {
    setSelectionWordCountFromText(selection.toString())
  }
}

const { projectTree } = storeToRefs(projectStore)

// Preferences loaded from disk allow arbitrary strings; the engine accepts two themes.
const toSequenceTheme = (value: string): IMuyaOptions['sequenceTheme'] =>
  value as IMuyaOptions['sequenceTheme']

const defaultFontFamily = DEFAULT_EDITOR_FONT_FAMILY
const resolveEditorFont = (family: string): string =>
  family ? `${family}, ${defaultFontFamily}` : defaultFontFamily
const resolveCodeFont = (family: string): string => `${family}, ${DEFAULT_CODE_FONT_FAMILY}`
const selectionChange = ref<unknown>(null)
// `shallowRef`: the engine instance is `markRaw`d anyway, and a deep ref
// would map `Muya` through `UnwrapRef` and lose the class's own type.
const editor = shallowRef<Muya | null>(null)
const isShowClose = ref(false)
const dialogTableVisible = ref(false)
const tableChecker = reactive({
  rows: 4,
  columns: 3
})

const editorRef = ref<HTMLDivElement | null>(null)
const mediaViewer = ref<InstanceType<typeof MediaViewer> | null>(null)
const viewerOpen = ref(false)
const rowInput = ref<InputNumberInstance | null>(null)

let printer: Printer | null = null
let spellchecker: SpellChecker | null = null
let switchLanguageCommand: SpellcheckerLanguageCommand | null = null
// The engine has no `scroll` event; we listen on the scroll container directly.
let scrollHandler: ((e: Event) => void) | null = null

// Keep engine undo history per tab; the store uses a separate save-tracking history shape.
const engineHistoryByTab = new Map<string, ISerializedHistory>()

// Capture the WYSIWYG caret before source mode moves DOM focus into CodeMirror.
let preSourceModeSelection: IHistorySelection | null = null

// Track save state by content with monotonic IDs; undo depth is reused for different documents.
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
// Tab IDs are session-unique; prune closed tabs so per-tab maps cannot grow indefinitely.
const pruneClosedTabState = (liveTabIds: Set<string>): void => {
  pruneSourceHistory(liveTabIds)
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

// Adapt engine blockName to the functionType expected by desktop menu state.
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
    { type?: string; functionType?: string } | null | undefined
  const focusInfo = changes.focusBlockInfo as
    { type?: string; functionType?: string } | null | undefined
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

// The engine reports only committed selections, so recounting per notification
// is cheap; a caret reports no text and stops here.
const setSelectionWordCountFromText = (selectedText: string) => {
  const hasSelection = selectedText.trim().length > 0
  if (!hasSelection && editorStore.selectionWordCount == null) return

  editorStore.SET_SELECTION_WORD_COUNT(hasSelection ? muyaWordCount(selectedText) : null)
}

// Drop live block references so cursors survive buffered-state serialization.
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

// Watch tab IDs to prune history maps only when tabs are added or closed.
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

// In source-code mode the Paragraph and Format menus operate on the hidden
// WYSIWYG engine, so grey them out. On return to WYSIWYG, re-apply the menu
// state for the CURRENT cursor context (a code block/table still disables some
// items) rather than blanket-enabling everything (#3531).
watch(sourceCode, (isSource) => {
  const windowId = window.marktext?.env?.windowId ?? -1
  if (isSource) {
    window.electron.ipcRenderer.send('mt::set-editor-format-menus-enabled', windowId, false)
    return
  }
  nextTick(() => {
    if (selectionChange.value) {
      pushSelectionMenuState(selectionChange.value as MuyaChange)
    } else {
      window.electron.ipcRenderer.send('mt::set-editor-format-menus-enabled', windowId, true)
    }
  })
})

// nextTick: the rebuilt headings have to be in the DOM before we pair them up.
watch(
  () => editorStore.listToc,
  () => {
    nextTick(rebuildHeadingCache)
  }
)

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
    editor.value.setOptions({ sequenceTheme: toSequenceTheme(value) }, true)
  }
})

watch(
  () => preferencesStore.plantumlServer,
  (value, oldValue) => {
    if (value !== oldValue && editor.value) {
      editor.value.setOptions({ plantumlServer: value }, true)
    }
  }
)

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

// `setOptions(..., true)` re-renders headings in place without emitting
// `json-change`, so nothing else refreshes the outline after a toggle.
const applyOutlineAffectingOption = (options: Partial<IMuyaOptions>): void => {
  const muya = editor.value
  if (!muya) return
  muya.setOptions(options, true)
  editorStore.REFRESH_TOC(muya.getTOC())
}

watch(superSubScript, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ superSubScript: value })
})

watch(footnote, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ footnote: value })
})

watch(texMathDollars, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ texMathDollars: value })
})

watch(isHtmlEnabled, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ disableHtml: !value }, true)
  }
})

watch(texMathGfm, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ texMathGfm: value })
})

watch(texMathSingleBackslash, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ texMathSingleBackslash: value })
})

watch(texMathDoubleBackslash, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ texMathDoubleBackslash: value })
})

watch(highlightSyntax, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ highlightSyntax: value })
})

watch(inlineDiff, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ inlineDiff: value })
})

watch(githubAlerts, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ githubAlerts: value })
})

watch(multilineBlockquote, (value, oldValue) => {
  if (value !== oldValue) applyOutlineAffectingOption({ multilineBlockquote: value })
})

watch(softNewlineAsSpace, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setOptions({ softNewlineAsSpace: value }, true)
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
  if (value === oldValue) return

  editor.value?.setOptions({ spellcheckEnabled: value })

  if (value) {
    spellchecker?.activateSpellchecker(spellcheckerLanguage.value)
  } else {
    spellchecker?.deactivateSpellchecker()
  }
})

watch(spellcheckerNoUnderline, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    // Hide only the spelling squiggle; the native checker (and its right-click
    // suggestions) stays controlled by `spellcheckerEnabled`.
    editor.value.setOptions({ spellcheckHideMarks: value })
  }
})

watch(spellcheckerLanguage, (value, oldValue) => {
  if (value !== oldValue && spellchecker) {
    spellchecker.lang = value
  }
})

watch(currentFile, (value, oldValue) => {
  if (value && value !== oldValue) {
    scrollToCursor(0)
    if (editor.value) {
      editor.value.hideAllFloatTools()
    }
    // The viewer holds a node from the outgoing document, and keeps the
    // incoming one at `pointer-events: none` while it is up.
    mediaViewer.value?.close()
  }
})

watch(
  sourceCode,
  (value, oldValue) => {
    if (value && value !== oldValue) {
      if (editor.value?.isReadOnly) return
      // The viewer holds a rendering of a document that is about to stop being
      // shown, and holds the editor behind it inert while it is up.
      mediaViewer.value?.close()
      if (editor.value) {
        editor.value.hideAllFloatTools()
        // Flush the engine's queued rAF-batch ops into the tab before
        // sourceCode.vue mounts and snapshots `currentFile.markdown` — an edit
        // made in the same frame as the mode switch (e.g. a task-checkbox
        // click) would otherwise be missing from the snapshot, and the swap
        // back out of source mode cancels the scheduled flush, dropping the
        // edit permanently. Same guard as saving (#3803) and tab switch
        // (#2938).
        editor.value.flush()
        // Save a source-markdown cursor before the source view mounts and moves focus.
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

watch(
  () => currentFile.value?.readOnly,
  (value) => {
    editor.value?.setReadOnly(!!value)
  },
  { flush: 'sync' }
)

// Engine links may have no usable href (#4356).
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
  if (!currentFile.value) return ''
  const { filename, pathname: currentPathname } = currentFile.value

  // A pasted screenshot / bitmap clipboard comes in as a `data:` URL string
  // rather than a file path. `moveImageToFolder` and `uploadImage` treat any
  // string as a local path, which would silently keep the base64 inline — so
  // normalize it back into a `File` up front and let the branches below handle
  // it as binary.
  if (typeof image === 'string' && image.startsWith('data:')) {
    const file = dataURLToFile(image)
    if (file) image = file
  }

  // Use the saved file directory, falling back to the project root for untitled tabs.
  const isTabSavedOnDisk = !!currentPathname
  let relativeBasePath: string | null = isTabSavedOnDisk
    ? window.path.dirname(currentPathname)
    : null
  if (isTabSavedOnDisk && imageRelativeDirectoryBase.value !== 'file' && projectTree.value) {
    const { pathname: rootPath } = projectTree.value as { pathname?: string }
    if (rootPath && window.fileUtils.isChildOfDirectory(rootPath, currentPathname)) {
      relativeBasePath = rootPath
    }
  }

  const getResolvedImagePath = (imagePath: string) => {
    const replacement = isTabSavedOnDisk
      ? filename.replace(/\.[^/.]+$/, '')
      : ''
    return imagePath.replace(/\${filename}/g, replacement)
  }

  const resolvedGlobalImageFolderPath = getResolvedImagePath(imageFolderPath.value)
  const resolvedImageRelativeDirectoryName = getResolvedImagePath(imageRelativeDirectoryName.value)
  const resolvedImageRelativeFullDirectoryPath = relativeBasePath
    ? window.path.join(relativeBasePath, resolvedImageRelativeDirectoryName)
    : null
  let destImagePath = ''
  switch (imageInsertAction.value) {
    case 'upload': {
      try {
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
        destImagePath = image
      } else {

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

// Growing a selection across blocks fires no `selection-change`.
// TODO(Selection): drop this and its `keyup` branch once the engine reports it.
const SELECTION_KEYS = new Set([
  'Shift',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown'
])

const keyup = (event: KeyboardEvent) => {
  if (!sourceCode.value && editor.value && SELECTION_KEYS.has(event.key)) {
    setSelectionWordCountFromText(editor.value.getSelectedText())
  }
}

const switchSpellcheckLanguage = (languageCode: unknown) => {
  // This method is also called from bus, so validate state before continuing.
  if (!spellchecker?.isEnabled) {
    throw new Error(t('editor.spellcheck.disabledError'))
  }

  const lang = languageCode as string

  spellchecker
    .switchLanguage(lang)
    .then((switched: boolean) => {
      if (!switched) {
        notice.notify({
          title: t('editor.spellcheck.title'),
          type: 'warning',
          message: t('editor.spellcheck.languageMissing', { languageCode: lang })
        })
      }
    })
    .catch((error: unknown) => {
      log.error(t('editor.spellcheck.errorSwitchingLanguage', { languageCode: lang }))
      log.error(error)

      const errMsg = (error as { message?: string } | null | undefined)?.message ?? String(error)
      notice.notify({
        title: t('editor.spellcheck.title'),
        type: 'error',
        message: t('editor.spellcheck.switchError', {
          languageCode: lang,
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
  if (!isMac) {
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
  if (sourceCode.value) {
    return
  }

  if (editor.value) {
    editor.value.undo()
  }
}

const handleRedo = () => {
  if (sourceCode.value) {
    return
  }

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

// Rich copy sets text/html and text/plain; HTML copy puts source only in text/plain.
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
    editor.value && editor.value.insertImage({ src: src as string })
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
  if (!editor.value) return
  const { value, opt } = payload as { value: string; opt?: ISearchOption }
  editorStore.SEARCH(toSearchMatches(editor.value.search(value, opt)))
  scrollToHighlight()
}

const handReplace = (payload: unknown) => {
  if (!editor.value) return
  const { value, opt } = payload as { value: string; opt?: IReplaceOption }
  editorStore.SEARCH(toSearchMatches(editor.value.replace(value, opt)))
}

const handleFindAction = (action: unknown) => {
  if (!editor.value) return
  editorStore.SEARCH(toSearchMatches(editor.value.find(action as 'previous' | 'next')))
  scrollToHighlight()
}

const handleUploadedImage = (url: unknown, deletionUrl?: unknown) => {
  insertImage(url)
  editorStore.SHOW_IMAGE_DELETION_URL(deletionUrl as string)
}

// The engine DOM node owns scrolling as well as contenteditable.
const getScrollContainer = (): HTMLElement | null =>
  (editor.value?.domNode as HTMLElement | undefined) ?? null

// Viewport-relative caret position for scrolling outside selection-change events.
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
  // Match Muya's caret geometry at soft wraps (#3510).
  return rects.length ? rects[range.collapsed ? rects.length - 1 : 0].y : null
}

// Only the slug-to-element pairing is cached. Positions are not: typing body
// text moves every later heading without changing the TOC, so a stored offset
// is stale within a keystroke and the highlight lands a section ahead.
interface CachedHeading {
  slug: string
  el: HTMLElement
}

let headingElementCache: CachedHeading[] = []

const rebuildHeadingCache = (): void => {
  const container = getScrollContainer()
  if (!container || editorStore.listToc.length === 0) {
    headingElementCache = []
    return
  }
  const headingEls = container.querySelectorAll(TOP_LEVEL_HEADINGS_SELECTOR)
  headingElementCache = editorStore.listToc
    .map((item, index) => {
      const el = headingEls[index] as HTMLElement | undefined
      if (!el || typeof item.slug !== 'string') return null
      return { slug: item.slug, el }
    })
    .filter((entry): entry is CachedHeading => entry != null)
}

// Measured with `getBoundingClientRect`, not `offsetTop`: the caret's position
// is fractional, and rounding the headings to whole pixels reports the one the
// caret sits in as the heading above it.
const updateActiveHeading = (viewportY: number): void => {
  if (headingElementCache.length === 0) return
  const positions: HeadingPosition[] = headingElementCache
    .filter(({ el }) => el.getClientRects().length > 0)
    .map(({ slug, el }) => ({
      slug,
      top: el.getBoundingClientRect().top
    }))
  if (positions.length) editorStore.SET_ACTIVE_HEADING(findActiveHeadingSlug(positions, viewportY))
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
  // Temporarily pad partially rendered documents so saved scroll offsets are not clamped.

  const maxScrollHeight = container.scrollHeight - container.clientHeight
  if (y > maxScrollHeight) {
    const editorId = container.firstElementChild as HTMLElement | null
    if (editorId) {
      editorId.style.paddingBottom = `${y - maxScrollHeight + 100}px` // 100px is the default editor padding
      resizeObserverForEditor.observe(editorId)
    }
  }
  requestAnimationFrame(() => {
    if (!container) return
    container.style.visibility = 'visible'
    container.style.pointerEvents = 'auto'
    container.scrollTop = y
  })
}

// Smoothly scroll the editor so `anchor` sits at the standard caret offset.
// Shared by search highlights and non-heading in-document anchors.
const scrollElementIntoView = (anchor: Element | null | undefined, duration = 300) => {
  const container = getScrollContainer()
  if (!container || !anchor) return
  const { y } = anchor.getBoundingClientRect()
  animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, duration)
}

const scrollToHighlight = () => {
  return scrollToElement('.mu-highlight')
}

/** Resolve TOC slugs against top-level headings in document order. */
const scrollToHeader = (slug: unknown) => {
  const container = getScrollContainer()
  if (!container) return
  const heading = resolveTocHeadingElement(container, editorStore.listToc, slug)
  if (!heading) return
  editor.value?.revealElement(heading)
  animatedScrollTo(container, getTocHeadingScrollTop(container, heading), 300)
}

// Custom anchors are resolved separately from heading slugs.
const scrollToAnchorElement = (element: unknown) => {
  if (element instanceof Element) {
    editor.value?.revealElement(element)
    scrollElementIntoView(element)
  }
}

const scrollToElement = (selector: string) => {
  scrollElementIntoView(document.querySelector(selector))
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

  const muya = editor.value
  if (!muya) return

  editorStore.flushActiveEditor()
  const extraCss = await getCssForOptions(opts as unknown as PdfCssOptions)
  const htmlToc = getHtmlToc(muya.getTOC(), opts as unknown as HtmlTocOptions)
  // The hidden WYSIWYG engine keeps its pre-source-mode document until the handoff.
  const markdown = sourceCode.value ? (editorStore.currentFile?.markdown ?? '') : muya.getMarkdown()
  const header = (opts.header ?? null) as HeaderFooterPart | null
  const footer = (opts.footer ?? null) as HeaderFooterPart | null

  switch (type) {
    case 'styledHtml': {
      try {
        const content = await exportStyledHTML(muya, markdown, {
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

        const html = await exportStyledHTML(muya, markdown, {
          title: '',
          printOptimization: true,
          extraCss,
          toc: htmlToc,
          header,
          footer,
          headerFooterStyled: headerFooterStyled as boolean | undefined,
          dir: props.textDirection
        })
        await printer!.renderMarkdown(html, props.textDirection)
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
        const html = await exportStyledHTML(muya, markdown, {
          title: '',
          printOptimization: true,
          extraCss,
          toc: htmlToc,
          header,
          footer,
          headerFooterStyled: headerFooterStyled as boolean | undefined,
          dir: props.textDirection
        })
        await printer!.renderMarkdown(html, props.textDirection)
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
  editorStore.SELECTION_FORMATS((changes.formats ?? []) as SelectionFormatLike[])
}

const handleEditParagraph = (type: unknown) => {
  if (sourceCode.value) {
    return
  }
  if (type === 'table') {
    tableChecker.rows = 4
    tableChecker.columns = 3
    dialogTableVisible.value = true
    nextTick(() => {
      rowInput.value?.focus()
    })
  } else if (editor.value) {
    editor.value.updateParagraph(type as string)
    // Re-sync the menu so a no-op action (e.g. "Paragraph" inside a list/quote)
    // does not leave the clicked checkbox item checked. A real conversion fires
    // its own selection-change, which resyncs again.
    if (selectionChange.value) {
      pushSelectionMenuState(selectionChange.value as MuyaChange)
    }
  }
}

const handleParagraph = (type: unknown) => {
  if (sourceCode.value) {
    return
  }
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
        console.error(`unknown paragraph edit type: ${type}`)
    }
  }
}

const handleInlineFormat = (type: unknown) => {
  if (sourceCode.value) {
    return
  }
  editor.value && editor.value.format(type as string)
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

const setMarkdownToEditor = (payload: unknown) => {
  const { id, markdown: newMarkdown, cursor: newCursor } = (payload ?? {}) as FileLoadedPayload
  if (editor.value) {
    // `setContent` resets the document and clears the undo history; only set a
    // cursor afterwards (a freshly-opened file has no history to restore).
    editor.value.setContent(newMarkdown ?? '')
    // Seed baseline ID 0 from engine serialization so undoing the first edit marks the tab clean.
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
    if (editorStore.TAKE_OPEN_INTENT(currentFile.value?.pathname) !== false) focusFreshEditor()
  }
}

interface FileChangePayload {
  reason?: string
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

const handleFileChange = (payload: unknown) => {
  const {
    id,
    markdown: newMarkdown,
    cursor: newCursor,
    muyaIndexCursor,
    history: payloadHistory,
    scrollTop,
    isReload,
    reason
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
      reason === 'source-handoff' ||
      (isIndexCursor(muyaIndexCursor) && !newCursor && payloadHistory == null)

    if (isSourceModeHandoff) {
      // Record source edits as one undo boundary; remap the caret even when content is unchanged.
      loadingContent = true
      try {
        editor.value.replaceContent(newMarkdown, preSourceModeSelection)
        if (id) {
          engineHistoryByTab.set(id, editor.value.getHistory())
          if (currentFile.value?.id === id)
            currentFile.value.history = makeSyntheticHistory(id, newMarkdown)
        }
      } finally {
        loadingContent = false
      }
      preSourceModeSelection = null
      editorStore.UPDATE_TOC(editor.value.getTOC())
      // Map the CodeMirror `{ line, ch }` cursor onto a block-key cursor so the
      // WYSIWYG caret lands where the source-mode cursor was (PG2).
      if (isIndexCursor(muyaIndexCursor)) editor.value.setCursorByOffset(muyaIndexCursor)
    } else if (isReload) {
      // Keep external disk reloads undoable, restoring the pre-reload document on the first undo.
      if (id) {
        resetSyntheticHistory(id, newMarkdown)
      }
      loadingContent = true
      try {
        editor.value.replaceContent(newMarkdown)
        if (id) engineHistoryByTab.set(id, editor.value.getHistory())
      } finally {
        loadingContent = false
      }
      editorStore.UPDATE_TOC(editor.value.getTOC())
      if (newCursor) {
        applyCursor(editor.value, newCursor)
      }
    } else {
      // setContent clears history; restore this tab’s engine history after replacing its document.
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
      // Seed new trackers before edits; retain existing content IDs when switching back to a tab.
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
  editor.value && editor.value.insertParagraph(location as Parameters<Muya['insertParagraph']>[0])
}

const blurEditor = () => {
  editor.value?.blur(false, true)
}

const flushActiveEditor = () => {
  editor.value?.flush()
}

// The engine's `focus()` only sets the selection range; the contenteditable
// also needs DOM focus or no caret blinks.
const focusEditor = () => {
  const ed = editor.value
  if (!ed) return
  ed.domNode.focus()
  ed.focus()
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

// Chromium no longer fires programmatic paste; insert the saved screenshot via imageAction.
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
  const newScrollableHeightWithoutPadding =
    container.scrollHeight - container.clientHeight - parseFloat(firstChild.style.paddingBottom)

  if (currentFile.value && newScrollableHeightWithoutPadding > currentFile.value.scrollTop) {
    container.style.paddingBottom = ''
    resizeObserverForEditor.unobserve(firstChild)
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

  const options: Partial<IMuyaOptions> = {
    focusMode: focus.value,
    markdown: props.markdown,
    readOnly: !!currentFile.value?.readOnly,
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
    texMathDollars: texMathDollars.value,
    texMathGfm: texMathGfm.value,
    texMathSingleBackslash: texMathSingleBackslash.value,
    texMathDoubleBackslash: texMathDoubleBackslash.value,
    highlightSyntax: highlightSyntax.value,
    inlineDiff: inlineDiff.value,
    multilineBlockquote: multilineBlockquote.value,
    githubAlerts: githubAlerts.value,
    disableHtml: !isHtmlEnabled.value,
    softNewlineAsSpace: softNewlineAsSpace.value,
    hideQuickInsertHint: hideQuickInsertHint.value,
    hideLinkPopup: hideLinkPopup.value,
    autoCheck: autoCheck.value,
    sequenceTheme: toSequenceTheme(sequenceTheme.value),
    plantumlServer: preferencesStore.plantumlServer,
    spellcheckEnabled: spellcheckerEnabled.value,
    spellcheckHideMarks: spellcheckerNoUnderline.value,
    clipboardFilePath: guessClipboardFilePath,
    // Read the OS clipboard's plain text for "Paste as Plain Text" (execCommand('paste') no longer fires).
    clipboardText: () => window.electron.clipboard.readText(),
    clipboardWriteText: window.electron.clipboard.writeText,
    fetchLinkHtml: (url) => window.electron.fetchLinkHtml(url),
    // Clipboard and drag-drop handlers read these callbacks from engine options, separately from ImageEditTool.
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

  // Keep the engine outside Vue proxies: DOM/block identity is required by rendering.
  const muya = markRaw(new Muya(ele, options))
  muya.init({ focus: editorStore.TAKE_OPEN_INTENT(currentFile.value?.pathname) !== false })
  editor.value = muya
  muya.on(
    'reading-context-menu',
    ({ event, href, image }: { event: MouseEvent; href?: string; image?: string }) => {
      const hasSelection = document.getSelection()?.isCollapsed === false
      popupContextMenu(
        [
          {
            label: t('menu.edit.copy'),
            enabled: hasSelection,
            click: () => {
              document.execCommand('copy')
            }
          },
          {
            label: t('menu.edit.copyAsRich'),
            enabled: hasSelection,
            click: () => muya.copyAsRich()
          },
          {
            label: t('menu.edit.copyAsHtml'),
            enabled: hasSelection,
            click: () => muya.copyAsHtml()
          },
          { label: t('menu.edit.selectAll'), click: () => muya.selectAll() },
          ...(href
            ? [
                {
                  label: t('readingMode.copyLink'),
                  click: () => window.electron.clipboard.writeText(href)
                }
              ]
            : []),
          ...(image
            ? [
                {
                  label: t('readingMode.viewImage'),
                  click: () => mediaViewer.value?.openImage(image)
                }
              ]
            : [])
        ],
        { x: event.clientX, y: event.clientY }
      )
    }
  )
  document.addEventListener('selectionchange', readingSelectionChanged)
  registerDocumentView((value) => muya.setReadOnly(value))
  // The first document's content is set via constructor options, so no
  // `file-loaded` / `setMarkdownToEditor` runs for it — seed its TOC here.
  editorStore.UPDATE_TOC(muya.getTOC())

  // Seed the mount-loaded document before its first edit so pristine content maps to ID 0.
  if (currentFile.value?.id) {
    getSyntheticHistory(currentFile.value.id, muya.getMarkdown())
  }

  const container = getScrollContainer()!

  bus.on('language-changed', handleLanguageChanged)

  spellchecker = new SpellChecker(spellcheckerEnabled.value, spellcheckerLanguage.value)

  switchLanguageCommand = new SpellcheckerLanguageCommand(spellchecker)
  setTimeout(() => bus.emit('cmd::register-command', switchLanguageCommand), 100)

  if (typewriter.value) {
    scrollToCursor()
  }

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

  // Engine json-change emits operations; the desktop pipeline consumes a derived document snapshot.
  editor.value.on('json-change', () => {
    if (loadingContent || currentFile.value?.readOnly) return
    // Capture the tab ID before a later tab switch can redirect this update.
    if (!currentFile.value || !editor.value) return
    const { id } = currentFile.value
    if (!id) return
    const markdown = editor.value.getMarkdown()
    // Persist engine undo history separately from content-based save tracking.
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
    if (!sourceCode.value) updateActiveHeading(container.getBoundingClientRect().top + 80)
    if (currentFile.value) {
      editorStore.updateScrollPosition(currentFile.value.id, container.scrollTop)
    }
  }
  container.addEventListener('scroll', scrollHandler, { passive: true })

  editor.value.on(
    'heading-copy-link',
    async ({ key, onCopied }: { key: string; onCopied?: (ok: boolean) => void }) => {
      const ok = await editorStore.copyGithubSlug(key)
      onCopied?.(ok)
    }
  )

  editor.value.on(
    'format-click',
    ({ event, formatType, data }: { event: MouseEvent; formatType: string; data: unknown }) => {
      const ctrlOrMeta = (isMac && event.metaKey) || (!isMac && event.ctrlKey)
      if (formatType === 'link' && (ctrlOrMeta || currentFile.value?.readOnly)) {
        editorStore.FORMAT_LINK_CLICK({
          data: data as { href: string; [key: string]: unknown },
          dirname: window.DIRNAME
        })
      } else if (formatType === 'image' && ctrlOrMeta) {
        mediaViewer.value?.openImage(data as string)
      }
    }
  )

  editor.value.on('preview-image', ({ data }: { data: string }) => {
    mediaViewer.value?.openImage(data)
  })

  // A preference toggle can change the result set under an open find bar; its
  // count/index come from a snapshot the search handlers own.
  editor.value.on('search-refreshed', (result: unknown) => {
    editorStore.SEARCH(toSearchMatches(result))
    scrollToHighlight()
  })

  editor.value.on('preview-diagram', (payload: IPreviewDiagramPayload) => {
    const options = editor.value?.options
    mediaViewer.value?.openDiagram(
      {
        type: payload.type,
        code: payload.code,
        preview: payload.preview,
        mermaidTheme: options?.mermaidTheme ?? 'default',
        vegaTheme: options?.vegaTheme ?? 'latimes',
        plantumlServer: options?.plantumlServer ?? '',
        sequenceTheme: toSequenceTheme(sequenceTheme.value)
      },
      payload.label
    )
  })

  editor.value.on('selection-change', (changes: MuyaChange) => {
    const y = (changes.cursorCoords?.y ?? null) as number | null
    if (y != null && !currentFile.value?.readOnly) {
      // Before the scrolling below: a 0-duration `animatedScrollTo` assigns
      // `scrollTop` at once, moving the headings out from under `y`.
      updateActiveHeading(y)

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
        const editableHeight = container.clientHeight - 100
        animatedScrollTo(container, container.scrollTop + (y - editableHeight), 0)
      } else if (y < 100) {
        // Symmetric to #628: scroll up when the cursor rises above the top edge
        // (e.g. Arrow-Up), otherwise the caret leaves the viewport (#3329).
        animatedScrollTo(container, container.scrollTop + (y - 100), 0)
      }
    }

    selectionChange.value = changes
    if (!sourceCode.value && editor.value) {
      setSelectionWordCountFromText(editor.value.getSelectedText())
    }
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
  registerDocumentView(null)
  document.removeEventListener('selectionchange', readingSelectionChanged)
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
  editorStore.SET_SELECTION_WORD_COUNT(null)

  // Remove the manual scroll listener; engine `on(...)` listeners are torn down
  // by `destroy()` → `eventCenter.unsubscribeAll()`.
  if (scrollHandler && editor.value) {
    const container = getScrollContainer()
    container?.removeEventListener('scroll', scrollHandler)
  }
  scrollHandler = null

  resizeObserverForEditor.disconnect()

  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
})
</script>

<style>
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
  /* `z-index: -1` only hides the editor visually; `document.elementsFromPoint`
     ignores stacking, so muya's mousemove-driven float tools (front button/menu,
     table drag/column toolbars, preview toolbar) still re-trigger over the source
     editor. Drop the subtree from hit-testing too so they cannot (#4731). */
  pointer-events: none;
}

/* `document.elementsFromPoint` ignores stacking, so muya's mousemove-driven
   float tools would keep re-triggering under the open viewer (#4731 again). */
.editor-wrapper.viewer-open .editor-component {
  pointer-events: none;
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
</style>
