<template>
  <div
    class="editor-wrapper"
    :class="[{ typewriter: typewriter, focus: focus, source: sourceCode }]"
    :style="{
      lineHeight: lineHeight,
      fontSize: `${fontSize}px`,
      'font-family': editorFontFamily
        ? `${editorFontFamily}, ${defaultFontFamily}`
        : `${defaultFontFamily}`
    }"
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
            {{
              t('common.ok')
            }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <editor-search v-if="!sourceCode" />
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import log from 'electron-log'
import Muya from 'muya/lib'
import TablePicker from 'muya/lib/ui/tablePicker'
import QuickInsert from 'muya/lib/ui/quickInsert'
import CodePicker from 'muya/lib/ui/codePicker'
import EmojiPicker from 'muya/lib/ui/emojiPicker'
import ImagePathPicker from 'muya/lib/ui/imagePicker'
import ImageSelector from 'muya/lib/ui/imageSelector'
import ImageToolbar from 'muya/lib/ui/imageToolbar'
import Transformer from 'muya/lib/ui/transformer'
import FormatPicker from 'muya/lib/ui/formatPicker'
import LinkTools from 'muya/lib/ui/linkTools'
import FootnoteTool from 'muya/lib/ui/footnoteTool'
import TableBarTools from 'muya/lib/ui/tableTools'
import FrontMenu from 'muya/lib/ui/frontMenu'
import EditorSearch from '../search'
import bus from '@/bus'
import { DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import notice from '@/services/notification'
import Printer from '@/services/printService'
import { SpellcheckerLanguageCommand } from '@/commands'
import { SpellChecker } from '@/spellchecker'
import { isOsx, animatedScrollTo } from '@/util'
import { moveImageToFolder, uploadImage } from '@/util/fileSystem'
import { guessClipboardFilePath } from '@/util/clipboard'
import { getCssForOptions, getHtmlToc } from '@/util/pdf'
import { addCommonStyle, setEditorWidth, setWrapCodeBlocks } from '@/util/theme'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import 'muya/themes/default.css'
import '@/assets/themes/codemirror/one-dark.css'
import CloseIcon from '@/assets/icons/close.svg'

const { t } = useI18n()
const STANDAR_Y = 320

const props = defineProps({
  markdown: String,
  cursor: Object,
  textDirection: {
    type: String,
    required: true
  },
  platform: String
})

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

  // Edit modes
  typewriter,
  focus,
  sourceCode
} = storeToRefs(preferencesStore)

// Editor store refs
const { currentFile } = storeToRefs(editorStore)

// Project store refs
const { projectTree } = storeToRefs(projectStore)

// Component state
const defaultFontFamily = DEFAULT_EDITOR_FONT_FAMILY
const selectionChange = ref(null)
const editor = ref(null)
const isShowClose = ref(false)
const dialogTableVisible = ref(false)
const imageViewerVisible = ref(null)
const tableChecker = reactive({
  rows: 4,
  columns: 3
})

// Template refs
const editorRef = ref(null)
const imageViewerRef = ref(null)
const rowInput = ref(null)

// Non-reactive variables
let printer = null
let spellchecker = null
let switchLanguageCommand = null
let imageViewer = null

class SimpleImageViewer {
  constructor (container, { url }) {
    this.container = container
    this.scale = 1
    this.translateX = 0
    this.translateY = 0
    this.isDragging = false
    this.startX = 0
    this.startY = 0
    this._init(url)
  }

  _init (url) {
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
    this._onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      this.scale = Math.max(0.1, Math.min(10, this.scale * factor))
      this._updateTransform()
    }
    this._onMousedown = (e) => {
      if (e.button !== 0) return
      this.isDragging = true
      this.startX = e.clientX - this.translateX
      this.startY = e.clientY - this.translateY
      this.container.style.cursor = 'grabbing'
      e.preventDefault()
    }
    this._onMousemove = (e) => {
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
    editor.value.setFont({ fontSize: value })
  }
})

watch(lineHeight, (value, oldValue) => {
  if (value !== oldValue && editor.value) {
    editor.value.setFont({ lineHeight: value })
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
    editor.value.setTabSize(value)
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
  if (value !== oldValue) {
    setWrapCodeBlocks(value)
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
  if (value !== oldValue) {
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
  if (value !== oldValue) {
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
    // Set Muya's spellcheck container attribute.
    editor.value.setOptions({ spellcheckEnabled: !value })
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

watch(sourceCode, (value, oldValue) => {
  if (value && value !== oldValue) {
    if (editor.value) {
      editor.value.hideAllFloatTools()
    }
  }
})

// Methods
const photoCreatorClick = (url) => {
  window.electron.shell.openExternal(url)
}

const jumpClick = (linkInfo) => {
  const { href } = linkInfo
  editorStore.FORMAT_LINK_CLICK({ data: { href }, dirname: window.DIRNAME })
}

const imagePathAutoComplete = async (src) => {
  const files = await editorStore.ASK_FOR_IMAGE_AUTO_PATH(src)
  return files.map((f) => {
    const iconClass = f.type === 'directory' ? 'icon-folder' : 'icon-image'
    return Object.assign(f, { iconClass, text: f.file + (f.type === 'directory' ? '/' : '') })
  })
}

const imageAction = async (image, id, alt = '') => {
  // TODO(Refactor): Refactor this method.
  const { filename, pathname: currentPathname } = currentFile.value

  // Figure out the current working directory.
  // Save an image relative to the file, otherwise use the project root when available.
  const isTabSavedOnDisk = !!currentPathname
  console.log('isTabSavedOnDisk', isTabSavedOnDisk, 'currentPathname', currentPathname)
  let relativeBasePath = isTabSavedOnDisk ? window.path.dirname(currentPathname) : null
  if (isTabSavedOnDisk && imageRelativeDirectoryBase.value !== 'file' && projectTree.value) {
    const { pathname: rootPath } = projectTree.value
    if (rootPath && window.fileUtils.isChildOfDirectory(rootPath, currentPathname)) {
      // Save assets relative to root directory.
      relativeBasePath = rootPath
    }
  }

  const getResolvedImagePath = (imagePath) => {
    const replacement =
      isTabSavedOnDisk
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
        destImagePath = await uploadImage(currentPathname, image, preferencesStore.$state)
      } catch (err) {
        notice.notify({
          title: 'Upload Image',
          type: 'warning',
          message: err
        })
        destImagePath = await moveImageToFolder(
          currentPathname,
          image,
          resolvedGlobalImageFolderPath
        )
      }
      break
    }
    case 'folder': {
      if (isTabSavedOnDisk && imagePreferRelativeDirectory.value) {
        destImagePath = await moveImageToFolder(
          null,
          image,
          resolvedImageRelativeFullDirectoryPath,
          true,
          currentPathname
        )
      } else {
        destImagePath = await moveImageToFolder(
          currentPathname,
          image,
          resolvedGlobalImageFolderPath
        )
      }
      break
    }
    case 'path': {
      if (typeof image === 'string') {
        // Input is a local path.
        destImagePath = image
      } else {
        // Save and move image to image folder if input is binary.
        console.log('imageAction: moving image to relative directory', {
          resolvedImageRelativeFullDirectoryPath,
          resolvedImageRelativeDirectoryName
        })

        // Respect user preferences if tab exists on disk.
        if (isTabSavedOnDisk && imagePreferRelativeDirectory.value) {
          destImagePath = await moveImageToFolder(
            null,
            image,
            resolvedImageRelativeFullDirectoryPath,
            true,
            currentPathname
          )
          console.log('moved image to relative directory', { destImagePath })
        } else {
          destImagePath = await moveImageToFolder(
            currentPathname,
            image,
            resolvedGlobalImageFolderPath
          )
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

const imagePathPicker = () => {
  return editorStore.ASK_FOR_IMAGE_PATH()
}

const keyup = (event) => {
  if (event.key === 'Escape') {
    setImageViewerVisible(false)
  }
}

const setImageViewerVisible = (status) => {
  imageViewerVisible.value = status
  if (!status && imageViewer) {
    imageViewer.destroy()
    imageViewer = null
  }
}

const switchSpellcheckLanguage = (languageCode) => {
  const { isEnabled } = spellchecker

  // This method is also called from bus, so validate state before continuing.
  if (!isEnabled) {
    throw new Error(t('editor.spellcheck.disabledError'))
  }

  spellchecker
    .switchLanguage(languageCode)
    .then((langCode) => {
      if (!langCode) {
        // Unable to switch language due to missing dictionary. The spell checker is now in an invalid state.
        notice.notify({
          title: t('editor.spellcheck.title'),
          type: 'warning',
          message: t('editor.spellcheck.languageMissing', { languageCode })
        })
      }
    })
    .catch((error) => {
      log.error(t('editor.spellcheck.errorSwitchingLanguage', { languageCode }))
      log.error(error)

      notice.notify({
        title: t('editor.spellcheck.title'),
        type: 'error',
        message: t('editor.spellcheck.switchError', { languageCode, error: error.message })
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

const replaceMisspelling = ({ word, replacement }) => {
  if (editor.value) {
    editor.value._replaceCurrentWordInlineUnsafe(word, replacement)
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

  if (editor.value && (editor.value.hasFocus() || editor.value.contentState.selectedTableCells)) {
    editor.value.selectAll()
  } else {
    const activeElement = document.activeElement
    const nodeName = activeElement.nodeName
    if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
      if (typeof activeElement.select === 'function') {
        activeElement.select()
      }
    }
  }
}

// Custom copyAsRich copyAsHtml pasteAsPlainText
const handleCopyPaste = (type) => {
  if (editor.value) {
    editor.value[type]()
  }
}

const insertImage = (src) => {
  if (!sourceCode.value) {
    editor.value && editor.value.insertImage({ src })
  }
}

const handleSearch = ({ value, opt }) => {
  const searchMatches = editor.value.search(value, opt)
  editorStore.SEARCH(searchMatches)
  scrollToHighlight()
}

const handReplace = ({ value, opt }) => {
  const searchMatches = editor.value.replace(value, opt)
  editorStore.SEARCH(searchMatches)
}

const handleUploadedImage = (url, deletionUrl) => {
  insertImage(url)
  editorStore.SHOW_IMAGE_DELETION_URL(deletionUrl)
}

const scrollToCursor = (duration = 300) => {
  nextTick(() => {
    const { container } = editor.value
    if (!container) return
    const { y } = editor.value.getSelection().cursorCoords
    animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, duration)
  })
}

const scrollToCords = (y) => {
  const { container } = editor.value
  // Depending on how much the user previously scrolled, sometimes the container has not fully rendered all elements.
  // Hence, container.scrollHeight < [saved scrollTop]
  // What we need to do is to temporarily add a padding to the container so that we can actually set the scrollTop without getting clamped.

  const maxScrollHeight = container.scrollHeight - container.clientHeight // max scroll height is actually calculated as such
  if (y > maxScrollHeight) {
    const editorId = container.firstElementChild
    editorId.style.paddingBottom = `${y - maxScrollHeight + 100}px` // 100px is the default ag-editor-id padding
    // attach a resize observer so we know when to remove the padding when it is of the "correct" height
    resizeObserverForEditor.observe(editorId)
  }
  requestAnimationFrame(() => {
    if (!container) return
    // wait for the padding to be applied (if any)
    container.style.visibility = 'visible'
    container.style.pointerEvents = 'auto'
    container.scrollTop = y
  })
}

const scrollToHighlight = () => {
  return scrollToElement('.ag-highlight')
}

const scrollToHeader = (slug) => {
  return scrollToElement(`#${slug}`)
}

const scrollToElement = (selector) => {
  // Scroll to search highlight word
  const { container } = editor.value
  const anchor = document.querySelector(selector)
  if (anchor) {
    const { y } = anchor.getBoundingClientRect()
    const DURATION = 300
    animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, DURATION)
  }
}

const handleFindAction = (action) => {
  const searchMatches = editor.value.find(action)
  editorStore.SEARCH(searchMatches)
  scrollToHighlight()
}

const handleExport = async (options) => {
  const { type, header, footer, headerFooterStyled, htmlTitle } = options

  if (!/^pdf|print|styledHtml$/.test(type)) {
    throw new Error(`Invalid type to export: "${type}".`)
  }

  const extraCss = getCssForOptions(options)
  const htmlToc = getHtmlToc(editor.value.getTOC(), options)

  switch (type) {
    case 'styledHtml': {
      try {
        const content = await editor.value.exportStyledHTML({
          title: htmlTitle || '',
          printOptimization: false,
          extraCss,
          toc: htmlToc
        })
        editorStore.EXPORT({ type, content })
      } catch (err) {
        log.error('Failed to export document:', err)
        notice.notify({
          title: t('editor.export.failed', { type: htmlTitle || 'html' }),
          type: 'error',
          message: err.message || t('editor.export.error')
        })
      }
      break
    }
    case 'pdf': {
      // NOTE: We need to set page size via Electron.
      try {
        const { pageSize, pageSizeWidth, pageSizeHeight, isLandscape } = options
        const pageOptions = {
          pageSize,
          pageSizeWidth,
          pageSizeHeight,
          isLandscape
        }

        const html = await editor.value.exportStyledHTML({
          title: '',
          printOptimization: true,
          extraCss,
          toc: htmlToc,
          header,
          footer,
          headerFooterStyled
        })
        printer.renderMarkdown(html, true)
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
        const html = await editor.value.exportStyledHTML({
          title: '',
          printOptimization: true,
          extraCss,
          toc: htmlToc,
          header,
          footer,
          headerFooterStyled
        })
        printer.renderMarkdown(html, true)
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
  printer.clearup()
}

const handleEditParagraph = (type) => {
  if (type === 'table') {
    tableChecker.rows = 4
    tableChecker.columns = 3
    dialogTableVisible.value = true
    nextTick(() => {
      rowInput.value.focus()
    })
  } else if (editor.value) {
    editor.value.updateParagraph(type)
  }
}

// handle `duplicate`, `delete`, `create paragraph below`
const handleParagraph = (type) => {
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

const handleInlineFormat = (type) => {
  editor.value && editor.value.format(type)
}

const handleDialogTableConfirm = () => {
  dialogTableVisible.value = false
  editor.value && editor.value.createTable(tableChecker)
}

// listen for `open-single-file` event, it will call this method only when open a new file.
const setMarkdownToEditor = ({ markdown: newMarkdown, cursor: newCursor }) => {
  if (editor.value) {
    editor.value.clearHistory()
    if (newCursor) {
      editor.value.setMarkdown(newMarkdown, newCursor, true)
    } else {
      editor.value.setMarkdown(newMarkdown)
    }
  }
}

// listen for markdown change form source mode or change tabs etc
const handleFileChange = ({
  markdown: newMarkdown,
  cursor: newCursor,
  renderCursor,
  history,
  scrollTop,
  muyaIndexCursor,
  blocks = undefined
}) => {
  const { container } = editor.value

  if (editor.value) {
    if (history) {
      editor.value.setHistory(history)
    }

    if (typeof newMarkdown === 'string') {
      console.log('handleFileChange: setting markdown with cursor and renderCursor', {
        newCursor,
        renderCursor,
        muyaIndexCursor,
        blocks
      })
      editor.value.setMarkdown(newMarkdown, newCursor, renderCursor, muyaIndexCursor, blocks)
    } else if (newCursor) {
      editor.value.setCursor(newCursor)
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
}

const handleInsertParagraph = (location) => {
  editor.value && editor.value.insertParagraph(location)
}

const blurEditor = () => {
  editor.value.blur(false, true)
}

const focusEditor = () => {
  editor.value.focus()
}

const handleScreenShot = () => {
  if (editor.value) {
    document.execCommand('paste')
  }
}

const handleResetPaddingBottom = () => {
  const { container } = editor.value
  const newScollableHeightWithoutPadding =
    container.scrollHeight -
    container.clientHeight -
    parseFloat(container.firstElementChild.style.paddingBottom)

  if (newScollableHeightWithoutPadding > currentFile.value.scrollTop) {
    container.style.paddingBottom = ''
    resizeObserverForEditor.unobserve(container.firstElementChild) // unobserve #ag-editor-id since we have removed the padding
  }
}

const handleLanguageChanged = () => {
  if (editor.value) {
    editor.value.setOptions({ t })
  }
}
const resizeObserverForEditor = new ResizeObserver(handleResetPaddingBottom)

onMounted(() => {
  printer = new Printer()
  const ele = editorRef.value

  // use muya UI plugins
  Muya.use(TablePicker)
  Muya.use(QuickInsert)
  Muya.use(CodePicker)
  Muya.use(EmojiPicker)
  Muya.use(ImagePathPicker)
  Muya.use(ImageSelector, {
    unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
    photoCreatorClick
  })
  Muya.use(Transformer)
  Muya.use(ImageToolbar)
  Muya.use(FormatPicker)
  Muya.use(FrontMenu)
  Muya.use(LinkTools, {
    jumpClick
  })
  Muya.use(FootnoteTool)
  Muya.use(TableBarTools)

  const options = {
    focusMode: focus.value,
    markdown: props.markdown,
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
    spellcheckEnabled: spellcheckerEnabled.value,
    imageAction,
    imagePathPicker,
    clipboardFilePath: guessClipboardFilePath,
    imagePathAutoComplete,
    t // Add the translation function
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

  editor.value = new Muya(ele, options)

  const { container } = editor.value

  // Listen for language changes and update Muya's translation function
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
  bus.on('screenshot-captured', handleScreenShot)
  bus.on('switch-spellchecker-language', switchSpellcheckLanguage)
  bus.on('open-command-spellchecker-switch-language', openSpellcheckerLanguageCommand)
  bus.on('replace-misspelling', replaceMisspelling)

  editor.value.on('change', (changes) => {
    // There is a chance that this event is fired AFTER the tab is switched. If we purely rely on this.currentFile later on
    // it can cause invalid updates. Hence, we need the id to identify changes as part of each tab
    const { id } = currentFile.value
    if (id) {
      editorStore.LISTEN_FOR_CONTENT_CHANGE(
        Object.assign(changes, { id, blocks: editor.value.contentState.getBlocks() })
      )
    }
  })

  editor.value.on('scroll', (scrollEvent) => {
    editorStore.updateScrollPosition(currentFile.value.id, scrollEvent.scrollTop)
  })

  editor.value.on('heading-copy-link', ({ key }) => {
    editorStore.copyGithubSlug(key)
  })

  editor.value.on('format-click', ({ event, formatType, data }) => {
    const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey)
    if (formatType === 'link' && ctrlOrMeta) {
      editorStore.FORMAT_LINK_CLICK({ data, dirname: window.DIRNAME })
    } else if (formatType === 'image' && ctrlOrMeta) {
      if (imageViewer) {
        imageViewer.destroy()
      }
      imageViewer = new SimpleImageViewer(imageViewerRef.value, { url: data })
      setImageViewerVisible(true)
    }
  })

  editor.value.on('preview-image', ({ data }) => {
    if (imageViewer) {
      imageViewer.destroy()
    }
    imageViewer = new SimpleImageViewer(imageViewerRef.value, { url: data })
    setImageViewerVisible(true)
  })

  editor.value.on('selectionChange', (changes) => {
    const { y } = changes.cursorCoords
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

    selectionChange.value = changes
    editorStore.SELECTION_CHANGE(changes)
  })

  editor.value.on('selectionFormats', (formats) => {
    editorStore.SELECTION_FORMATS(formats)
  })

  document.addEventListener('keyup', keyup)

  setWrapCodeBlocks(wrapCodeBlocks.value)
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
  bus.off('screenshot-captured', handleScreenShot)
  bus.off('switch-spellchecker-language', switchSpellcheckLanguage)
  bus.off('open-command-spellchecker-switch-language', openSpellcheckerLanguageCommand)
  bus.off('replace-misspelling', replaceMisspelling)
  bus.off('language-changed', handleLanguageChanged)

  document.removeEventListener('keyup', keyup)
  editor.value.off('change')
  editor.value.off('scroll')
  editor.value.off('heading-copy-link')
  editor.value.off('format-click')
  editor.value.off('selectionChange')
  editor.value.off('selectionFormats')

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
    & svg {
      fill: #efefef;
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
