<template>
  <div
    class="editor-wrapper"
    :class="[{ 'typewriter': typewriter, 'focus': focus, 'source': sourceCode }]"
    :style="{ 'lineHeight': lineHeight, 'fontSize': `${fontSize}px`,
    'font-family': editorFontFamily ? `${editorFontFamily}, ${defaultFontFamily}` : `${defaultFontFamily}` }"
    :dir="textDirection"
  >
    <div
      ref="editor"
      class="editor-component"
    ></div>
    <div
      class="image-viewer"
      v-show="imageViewerVisible"
    >
      <span class="icon-close" @click="setImageViewerVisible(false)">
        <svg :viewBox="CloseIcon.viewBox">
          <use :xlink:href="CloseIcon.url"></use>
        </svg>
      </span>
      <div
        ref="imageViewer"
      >
      </div>
    </div>
    <el-dialog
      :visible.sync="dialogTableVisible"
      :show-close="isShowClose"
      :modal="true"
      custom-class="ag-dialog-table"
      width="454px"
      center
      dir='ltr'
    >
      <div slot="title" class="dialog-title">
        Insert Table
      </div>
      <el-form :model="tableChecker" :inline="true">
        <el-form-item label="Rows">
          <el-input-number
            ref="rowInput"
            size="mini"
            v-model="tableChecker.rows"
            controls-position="right"
            :min="1"
            :max="30"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number
            size="mini"
            v-model="tableChecker.columns"
            controls-position="right"
            :min="1"
            :max="20"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogTableVisible = false">
          Cancel
        </el-button>
        <el-button type="primary" @click="handleDialogTableConfirm">
          OK
        </el-button>
      </div>
    </el-dialog>
    <search
      v-if="!sourceCode"
    ></search>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ViewImage from 'view-image'
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
import FrontMenu from 'muya/lib/ui/frontMenu'
import bus from '../../bus'
import Search from '../search'
import { animatedScrollTo } from '../../util'
import { addCommonStyle, setEditorWidth } from '../../util/theme'
import { guessClipboardFilePath } from '../../util/clipboard'
import { showContextMenu } from '../../contextMenu/editor'
import Printer from '@/services/printService'
import { DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import { moveImageToFolder, uploadImage } from '@/util/fileSystem'
import notice from '@/services/notification'

import 'muya/themes/default.css'
import '@/assets/themes/codemirror/one-dark.css'
import 'view-image/lib/imgViewer.css'
import CloseIcon from '@/assets/icons/close.svg'
import { shell } from 'electron'

const STANDAR_Y = 320

export default {
  components: {
    Search
  },
  props: {
    filename: {
      type: String
    },
    markdown: String,
    cursor: Object,
    textDirection: {
      type: String,
      required: true
    },
    platform: String
  },
  computed: {
    ...mapState({
      preferences: state => state.preferences,
      preferLooseListItem: state => state.preferences.preferLooseListItem,
      autoPairBracket: state => state.preferences.autoPairBracket,
      autoPairMarkdownSyntax: state => state.preferences.autoPairMarkdownSyntax,
      autoPairQuote: state => state.preferences.autoPairQuote,
      bulletListMarker: state => state.preferences.bulletListMarker,
      orderListDelimiter: state => state.preferences.orderListDelimiter,
      tabSize: state => state.preferences.tabSize,
      listIndentation: state => state.preferences.listIndentation,
      frontmatterType: state => state.preferences.frontmatterType,
      lineHeight: state => state.preferences.lineHeight,
      fontSize: state => state.preferences.fontSize,
      codeFontSize: state => state.preferences.codeFontSize,
      codeFontFamily: state => state.preferences.codeFontFamily,
      trimUnnecessaryCodeBlockEmptyLines: state => state.preferences.trimUnnecessaryCodeBlockEmptyLines,
      editorFontFamily: state => state.preferences.editorFontFamily,
      hideQuickInsertHint: state => state.preferences.hideQuickInsertHint,
      editorLineWidth: state => state.preferences.editorLineWidth,
      imageInsertAction: state => state.preferences.imageInsertAction,
      imageFolderPath: state => state.preferences.imageFolderPath,
      theme: state => state.preferences.theme,
      hideScrollbar: state => state.preferences.hideScrollbar,

      currentFile: state => state.editor.currentFile,

      // edit modes
      typewriter: state => state.preferences.typewriter,
      focus: state => state.preferences.focus,
      sourceCode: state => state.preferences.sourceCode
    })
  },
  data () {
    this.defaultFontFamily = DEFAULT_EDITOR_FONT_FAMILY
    this.CloseIcon = CloseIcon
    return {
      selectionChange: null,
      editor: null,
      pathname: '',
      isShowClose: false,
      dialogTableVisible: false,
      imageViewerVisible: false,
      tableChecker: {
        rows: 4,
        columns: 3
      }
    }
  },
  watch: {
    typewriter: function (value) {
      if (value) {
        this.scrollToCursor()
      }
    },
    focus: function (value) {
      this.editor.setFocusMode(value)
    },
    fontSize: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setFont({ fontSize: value })
      }
    },
    lineHeight: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setFont({ lineHeight: value })
      }
    },
    preferLooseListItem: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({
          preferLooseListItem: value
        })
      }
    },
    tabSize: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setTabSize(value)
      }
    },
    theme: function (value, oldValue) {
      if (value !== oldValue && this.editor) {
        // Agreement：Any black series theme needs to contain dark `word`.
        if (/dark/i.test(value)) {
          this.editor.setOptions({
            mermaidTheme: 'dark',
            vegaTheme: 'dark'
          }, true)
        } else {
          this.editor.setOptions({
            mermaidTheme: 'default',
            vegaTheme: 'latimes'
          }, true)
        }
      }
    },
    listIndentation: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setListIndentation(value)
      }
    },
    frontmatterType: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ frontmatterType: value })
      }
    },
    hideQuickInsertHint: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ hideQuickInsertHint: value })
      }
    },
    editorLineWidth: function (value, oldValue) {
      if (value !== oldValue) {
        setEditorWidth(value)
      }
    },
    autoPairBracket: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairBracket: value })
      }
    },
    autoPairMarkdownSyntax: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairMarkdownSyntax: value })
      }
    },
    autoPairQuote: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairQuote: value })
      }
    },
    trimUnnecessaryCodeBlockEmptyLines: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ trimUnnecessaryCodeBlockEmptyLines: value })
      }
    },
    bulletListMarker: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ bulletListMarker: value })
      }
    },
    orderListDelimiter: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ orderListDelimiter: value })
      }
    },
    codeFontSize: function (value, oldValue) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: value,
          codeFontFamily: this.codeFontFamily,
          hideScrollbar: this.hideScrollbar
        })
      }
    },
    codeFontFamily: function (value, oldValue) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: this.codeFontSize,
          codeFontFamily: value,
          hideScrollbar: this.hideScrollbar
        })
      }
    },
    hideScrollbar: function (value, oldValue) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: this.codeFontSize,
          codeFontFamily: this.codeFontFamily,
          hideScrollbar: value
        })
      }
    },
    currentFile: function (value, oldValue) {
      if (value && value !== oldValue) {
        this.scrollToCursor(0)
        // Hide float tools if needed.
        this.editor && this.editor.hideAllFloatTools()
      }
    },
    sourceCode: function (value, oldValue) {
      if (value && value !== oldValue) {
        this.editor && this.editor.hideAllFloatTools()
      }
    }
  },
  created () {
    this.$nextTick(() => {
      this.printer = new Printer()
      const ele = this.$refs.editor
      const {
        focus: focusMode,
        markdown,
        preferLooseListItem,
        typewriter,
        autoPairBracket,
        autoPairMarkdownSyntax,
        autoPairQuote,
        trimUnnecessaryCodeBlockEmptyLines,
        bulletListMarker,
        orderListDelimiter,
        tabSize,
        listIndentation,
        frontmatterType,
        hideQuickInsertHint,
        editorLineWidth,
        theme
      } = this

      // use muya UI plugins
      Muya.use(TablePicker)
      Muya.use(QuickInsert)
      Muya.use(CodePicker)
      Muya.use(EmojiPicker)
      Muya.use(ImagePathPicker)
      Muya.use(ImageSelector, {
        applicationId: process.env.UNSPLASH_ACCESS_KEY,
        secret: process.env.UNSPLASH_SECRET_KEY,
        photoCreatorClick: this.photoCreatorClick
      })
      Muya.use(Transformer)
      Muya.use(ImageToolbar)
      Muya.use(FormatPicker)
      Muya.use(FrontMenu)
      Muya.use(LinkTools, {
        jumpClick: this.jumpClick
      })

      const options = {
        focusMode,
        markdown,
        preferLooseListItem,
        autoPairBracket,
        autoPairMarkdownSyntax,
        trimUnnecessaryCodeBlockEmptyLines,
        autoPairQuote,
        bulletListMarker,
        orderListDelimiter,
        tabSize,
        listIndentation,
        frontmatterType,
        hideQuickInsertHint,
        imageAction: this.imageAction.bind(this),
        imagePathPicker: this.imagePathPicker.bind(this),
        clipboardFilePath: guessClipboardFilePath,
        imagePathAutoComplete: this.imagePathAutoComplete.bind(this)
      }

      if (/dark/i.test(theme)) {
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

      const { container } = this.editor = new Muya(ele, options)

      if (typewriter) {
        this.scrollToCursor()
      }

      // listen for bus events.
      bus.$on('file-loaded', this.setMarkdownToEditor)
      bus.$on('undo', this.handleUndo)
      bus.$on('redo', this.handleRedo)
      bus.$on('selectAll', this.handleSelectAll)
      bus.$on('export', this.handleExport)
      bus.$on('print-service-clearup', this.handlePrintServiceClearup)
      bus.$on('paragraph', this.handleEditParagraph)
      bus.$on('format', this.handleInlineFormat)
      bus.$on('searchValue', this.handleSearch)
      bus.$on('replaceValue', this.handReplace)
      bus.$on('find-action', this.handleFindAction)
      bus.$on('insert-image', this.insertImage)
      bus.$on('image-uploaded', this.handleUploadedImage)
      bus.$on('file-changed', this.handleFileChange)
      bus.$on('editor-blur', this.blurEditor)
      bus.$on('copyAsMarkdown', this.handleCopyPaste)
      bus.$on('copyAsHtml', this.handleCopyPaste)
      bus.$on('pasteAsPlainText', this.handleCopyPaste)
      bus.$on('duplicate', this.handleParagraph)
      bus.$on('createParagraph', this.handleParagraph)
      bus.$on('deleteParagraph', this.handleParagraph)
      bus.$on('insertParagraph', this.handleInsertParagraph)
      bus.$on('editTable', this.handleEditTable)
      bus.$on('scroll-to-header', this.scrollToHeader)
      bus.$on('copy-block', this.handleCopyBlock)
      bus.$on('print', this.handlePrint)
      bus.$on('screenshot-captured', this.handleScreenShot)

      this.editor.on('change', changes => {
        // WORKAROUND: "id: 'muya'"
        this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', Object.assign(changes, { id: 'muya' }))
      })

      this.editor.on('format-click', ({ event, formatType, data }) => {
        const isOsx = this.platform === 'darwin'
        const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey)
        if (formatType === 'link' && ctrlOrMeta) {
          this.$store.dispatch('FORMAT_LINK_CLICK', { data, dirname: window.DIRNAME })
        } else if (formatType === 'image' && ctrlOrMeta) {
          if (this.imageViewer) {
            this.imageViewer.destroy()
          }

          this.imageViewer = new ViewImage(this.$refs.imageViewer, {
            url: data,
            snapView: true
          })

          this.setImageViewerVisible(true)
        }
      })

      this.editor.on('preview-image', ({ data }) => {
        if (this.imageViewer) {
          this.imageViewer.destroy()
        }

        this.imageViewer = new ViewImage(this.$refs.imageViewer, {
          url: data,
          snapView: true
        })

        this.setImageViewerVisible(true)
      })

      this.editor.on('selectionChange', changes => {
        const { y } = changes.cursorCoords
        if (this.typewriter) {
          animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, 100)
        }

        this.selectionChange = changes
        this.$store.dispatch('SELECTION_CHANGE', changes)
      })

      this.editor.on('selectionFormats', formats => {
        this.$store.dispatch('SELECTION_FORMATS', formats)
      })

      this.editor.on('contextmenu', (event, selectionChanges) => {
        showContextMenu(event, selectionChanges)
      })

      document.addEventListener('keyup', this.keyup)

      setEditorWidth(editorLineWidth)
    })
  },
  methods: {
    photoCreatorClick: (url) => {
      shell.openExternal(url)
    },
    jumpClick: (linkInfo) => {
      const { href } = linkInfo

      if (href && href.startsWith('http')) {
        shell.openExternal(href)
      }
    },
    async imagePathAutoComplete (src) {
      const files = await this.$store.dispatch('ASK_FOR_IMAGE_AUTO_PATH', src)
      return files.map(f => {
        const iconClass = f.type === 'directory' ? 'icon-folder' : 'icon-image'
        return Object.assign(f, { iconClass, text: f.file + (f.type === 'directory' ? '/' : '') })
      })
    },
    async imageAction (image, id, alt = '') {
      const { imageInsertAction, imageFolderPath, preferences } = this
      const { pathname } = this.currentFile
      let result
      switch (imageInsertAction) {
        case 'upload': {
          try {
            result = await uploadImage(pathname, image, preferences)
          } catch (err) {
            notice.notify({
              title: 'Upload Image',
              type: 'info',
              message: err
            })
            result = await moveImageToFolder(pathname, image, imageFolderPath)
          }
          break
        }
        case 'folder': {
          result = await moveImageToFolder(pathname, image, imageFolderPath)
          break
        }
        case 'path': {
          if (typeof image === 'string') {
            result = image
          } else {
            // Move image to image folder if it's Blob object.
            result = await moveImageToFolder(pathname, image, imageFolderPath)
          }
          break
        }
      }

      if (id && this.sourceCode) {
        bus.$emit('image-action', {
          id,
          result,
          alt
        })
      }

      return result
    },
    imagePathPicker () {
      return this.$store.dispatch('ASK_FOR_IMAGE_PATH')
    },
    keyup (event) {
      if (event.key === 'Escape') {
        this.setImageViewerVisible(false)
      }
    },

    setImageViewerVisible (status) {
      this.imageViewerVisible = status
    },

    handleUndo () {
      if (this.editor) {
        this.editor.undo()
      }
    },

    handleRedo () {
      if (this.editor) {
        this.editor.redo()
      }
    },

    handleSelectAll () {
      if (this.editor && !this.sourceCode) {
        this.editor.selectAll()
      }
    },

    // Custom copyAsMarkdown copyAsHtml pasteAsPlainText
    handleCopyPaste (type) {
      if (this.editor) {
        this.editor[type]()
      }
    },

    insertImage (src) {
      if (!this.sourceCode) {
        this.editor && this.editor.insertImage({ src })
      }
    },

    handleSearch (value, opt) {
      const searchMatches = this.editor.search(value, opt)
      this.$store.dispatch('SEARCH', searchMatches)
      this.scrollToHighlight()
    },

    handReplace (value, opt) {
      const searchMatches = this.editor.replace(value, opt)
      this.$store.dispatch('SEARCH', searchMatches)
    },

    handleUploadedImage (url, deletionUrl) {
      this.insertImage(url)
      this.$store.dispatch('SHOW_IMAGE_DELETION_URL', deletionUrl)
    },

    scrollToCursor (duration = 300) {
      this.$nextTick(() => {
        const { container } = this.editor
        const { y } = this.editor.getSelection().cursorCoords
        animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, duration)
      })
    },

    scrollToHighlight () {
      return this.scrollToElement('.ag-highlight')
    },

    scrollToHeader (slug) {
      return this.scrollToElement(`#${slug}`)
    },

    scrollToElement (selector) {
      // Scroll to search highlight word
      const { container } = this.editor
      const anchor = document.querySelector(selector)
      if (anchor) {
        const { y } = anchor.getBoundingClientRect()
        const DURATION = 300
        animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, DURATION)
      }
    },

    handleFindAction (action) {
      const searchMatches = this.editor.find(action)
      this.$store.dispatch('SEARCH', searchMatches)
      this.scrollToHighlight()
    },

    async handlePrint () {
      // generate styled HTML with empty title and optimized for printing
      const html = await this.editor.exportStyledHTML('', true)
      this.printer.renderMarkdown(html, true)
      this.$store.dispatch('PRINT_RESPONSE')
    },

    async handleExport (type) {
      const markdown = this.editor.getMarkdown()
      switch (type) {
        case 'styledHtml': {
          const content = await this.editor.exportStyledHTML(this.filename)
          this.$store.dispatch('EXPORT', { type, content, markdown })
          break
        }

        case 'pdf': {
          // generate styled HTML with empty title and optimized for printing
          const html = await this.editor.exportStyledHTML('', true)
          this.printer.renderMarkdown(html, true)
          this.$store.dispatch('EXPORT', { type, markdown })
          break
        }
      }
    },

    handlePrintServiceClearup () {
      this.printer.clearup()
    },

    handleEditParagraph (type) {
      if (type === 'table') {
        this.tableChecker = { rows: 4, columns: 3 }
        this.dialogTableVisible = true
        this.$nextTick(() => {
          this.$refs.rowInput.focus()
        })
      } else {
        this.editor && this.editor.updateParagraph(type)
      }
    },

    // handle `duplicate`, `delete`, `create paragraph bellow`
    handleParagraph (type) {
      const { editor } = this
      if (editor) {
        switch (type) {
          case 'duplicate': {
            return editor.duplicate()
          }
          case 'createParagraph': {
            return editor.insertParagraph('after', '', true)
          }
          case 'deleteParagraph': {
            return editor.deleteParagraph()
          }
          default:
            console.error(`unknow paragraph edit type: ${type}`)
        }
      }
    },

    handleInlineFormat (type) {
      this.editor && this.editor.format(type)
    },

    handleDialogTableConfirm () {
      this.dialogTableVisible = false
      this.editor && this.editor.createTable(this.tableChecker)
    },

    // listen for `open-single-file` event, it will call this method only when open a new file.
    setMarkdownToEditor ({ id, markdown, cursor }) {
      const { editor } = this
      if (editor) {
        editor.clearHistory()
        if (cursor) {
          editor.setMarkdown(markdown, cursor, true)
        } else {
          editor.setMarkdown(markdown)
        }
      }
    },

    // listen for markdown change form source mode or change tabs etc
    handleFileChange ({ id, markdown, cursor, renderCursor, history }) {
      const { editor } = this
      this.$nextTick(() => {
        if (editor) {
          if (history) {
            editor.setHistory(history)
          }
          if (typeof markdown === 'string') {
            editor.setMarkdown(markdown, cursor, renderCursor)
          } else if (cursor) {
            editor.setCursor(cursor)
          }
          if (renderCursor) {
            this.scrollToCursor(0)
          }
        }
      })
    },

    handleInsertParagraph (location) {
      const { editor } = this
      editor && editor.insertParagraph(location)
    },

    handleEditTable (data) {
      const { editor } = this
      editor && editor.editTable(data)
    },

    blurEditor () {
      this.editor.blur()
    },

    handleCopyBlock (name) {
      this.editor.copy(name)
    },

    handleScreenShot () {
      if (this.editor) {
        document.execCommand('paste')
      }
    }
  },
  beforeDestroy () {
    bus.$off('file-loaded', this.setMarkdownToEditor)
    bus.$off('undo', this.handleUndo)
    bus.$off('redo', this.handleRedo)
    bus.$off('selectAll', this.handleSelectAll)
    bus.$off('export', this.handleExport)
    bus.$off('print-service-clearup', this.handlePrintServiceClearup)
    bus.$off('paragraph', this.handleEditParagraph)
    bus.$off('format', this.handleInlineFormat)
    bus.$off('searchValue', this.handleSearch)
    bus.$off('replaceValue', this.handReplace)
    bus.$off('find-action', this.handleFindAction)
    bus.$off('insert-image', this.insertImage)
    bus.$off('image-uploaded', this.handleUploadedImage)
    bus.$off('file-changed', this.handleFileChange)
    bus.$off('editor-blur', this.blurEditor)
    bus.$off('copyAsMarkdown', this.handleCopyPaste)
    bus.$off('copyAsHtml', this.handleCopyPaste)
    bus.$off('pasteAsPlainText', this.handleCopyPaste)
    bus.$off('duplicate', this.handleParagraph)
    bus.$off('createParagraph', this.handleParagraph)
    bus.$off('deleteParagraph', this.handleParagraph)
    bus.$off('insertParagraph', this.handleInsertParagraph)
    bus.$off('editTable', this.handleEditTable)
    bus.$off('scroll-to-header', this.scrollToHeader)
    bus.$off('copy-block', this.handleCopyBlock)
    bus.$off('print', this.handlePrint)
    bus.$off('screenshot-captured', this.handleScreenShot)

    document.removeEventListener('keyup', this.keyup)

    this.editor.destroy()
    this.editor = null
  }
}
</script>

<style>
  .editor-wrapper {
    height: 100%;
    position: relative;
    flex: 1;
    color: var(--editorColor);
    & .ag-dialog-table {
      & .el-button {
        font-size: 13px;
        width: 70px;
      }
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
    background: rgba(0, 0, 0, .8);
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
  .iv-container {
    width: 100%;
    height: 100%;
  }
  .iv-snap-view {
    opacity: 1;
    bottom: 20px;
    right: 20px;
    top: auto;
    left: auto;
  }
</style>
