<template>
  <div
    class="editor-wrapper"
    :class="[{ 'typewriter': typewriter, 'focus': focus, 'source': sourceCode }]"
    :style="{ 'lineHeight': lineHeight, 'fontSize': fontSize,
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
            :min="2"
            :max="20"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number
            size="mini"
            v-model="tableChecker.columns"
            controls-position="right"
            :min="2"
            :max="20"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogTableVisible = false" size="mini">
          Cancel
        </el-button>
        <el-button type="primary" @click="handleDialogTableConfirm" size="mini">
          Ok
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
  import FormatPicker from 'muya/lib/ui/formatPicker'
  import FrontMenu from 'muya/lib/ui/frontMenu'
  import bus from '../../bus'
  import Search from '../search.vue'
  import { animatedScrollTo } from '../../util'
  import { showContextMenu } from '../../contextMenu/editor'
  import Printer from '@/services/printService'
  import { DEFAULT_EDITOR_FONT_FAMILY } from '@/config'

  import 'muya/themes/default.css'
  import '@/assets/themes/codemirror/one-dark.css'
  import 'view-image/lib/imgViewer.css'
  import CloseIcon from '@/assets/icons/close.svg'

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
        'preferLooseListItem': state => state.preferences.preferLooseListItem,
        'autoPairBracket': state => state.preferences.autoPairBracket,
        'autoPairMarkdownSyntax': state => state.preferences.autoPairMarkdownSyntax,
        'autoPairQuote': state => state.preferences.autoPairQuote,
        'bulletListMarker': state => state.preferences.bulletListMarker,
        'tabSize': state => state.preferences.tabSize,
        'listIndentation': state => state.preferences.listIndentation,
        'lineHeight': state => state.preferences.lineHeight,
        'fontSize': state => state.preferences.fontSize,
        'lightColor': state => state.preferences.lightColor,
        'darkColor': state => state.preferences.darkColor,
        'editorFontFamily': state => state.preferences.editorFontFamily,
        'hideQuickInsertHint': state => state.preferences.hideQuickInsertHint,
        'theme': state => state.preferences.theme,
        // edit modes
        'typewriter': state => state.preferences.typewriter,
        'focus': state => state.preferences.focus,
        'sourceCode': state => state.preferences.sourceCode
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
          editor.setListItemPreference(value)
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
          bulletListMarker,
          tabSize,
          listIndentation,
          hideQuickInsertHint,
          theme
        } = this

        // use muya UI plugins
        Muya.use(TablePicker)
        Muya.use(QuickInsert)
        Muya.use(CodePicker)
        Muya.use(EmojiPicker)
        Muya.use(ImagePathPicker)
        Muya.use(FormatPicker)
        Muya.use(FrontMenu)

        const options = {
          focusMode,
          markdown,
          preferLooseListItem,
          autoPairBracket,
          autoPairMarkdownSyntax,
          autoPairQuote,
          bulletListMarker,
          tabSize,
          listIndentation,
          hideQuickInsertHint
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
        bus.$on('export', this.handleExport)
        bus.$on('print-service-clearup', this.handlePrintServiceClearup)
        bus.$on('paragraph', this.handleEditParagraph)
        bus.$on('format', this.handleInlineFormat)
        bus.$on('searchValue', this.handleSearch)
        bus.$on('replaceValue', this.handReplace)
        bus.$on('find', this.handleFind)
        bus.$on('insert-image', this.handleSelect)
        bus.$on('image-uploaded', this.handleUploadedImage)
        bus.$on('file-changed', this.handleMarkdownChange)
        bus.$on('editor-blur', this.blurEditor)
        bus.$on('image-auto-path', this.handleImagePath)
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

        // when cursor is in `![](cursor)` will emit `insert-image`
        this.editor.on('insert-image', type => {
          if (type === 'absolute' || type === 'relative') {
            this.$store.dispatch('ASK_FOR_INSERT_IMAGE', type)
          } else if (type === 'upload') {
            bus.$emit('upload-image')
          }
        })

        this.editor.on('image-path-autocomplement', src => {
          this.$store.dispatch('ASK_FOR_IMAGE_AUTO_PATH', src)
        })

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
      })
    },
    methods: {
      keyup (event) {
        if (event.key === 'Escape') {
          this.setImageViewerVisible(false)
        }
      },

      handleImagePath (files) {
        const { editor } = this
        editor && editor.showAutoImagePath(files)
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

      // Custom copyAsMarkdown copyAsHtml pasteAsPlainText
      handleCopyPaste (type) {
        if (this.editor) {
          this.editor[type]()
        }
      },

      handleSelect (url) {
        if (!this.sourceCode) {
          this.editor && this.editor.insertImage(url)
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
        this.handleSelect(url)
        this.$store.dispatch('SHOW_IMAGE_DELETION_URL', deletionUrl)
      },

      scrollToCursor () {
        this.$nextTick(() => {
          const { container } = this.editor
          const { y } = this.editor.getSelection().cursorCoords
          animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, 300)
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

      handleFind (action) {
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
              return
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
      setMarkdownToEditor ({id, markdown}) {
        const { editor } = this
        if (editor) {
          editor.clearHistory()
          // NOTE: Don't set the cursor because we load a new file - no tab switch.
          editor.setMarkdown(markdown)
        }
      },

      // listen for markdown change form source mode or change tabs etc
      handleMarkdownChange ({ id, markdown, cursor, renderCursor, history }) {
        const { editor } = this
        this.$nextTick(() => {
          if (editor) {
            if (history) {
              editor.setHistory(history)
            }
            editor.setMarkdown(markdown, cursor, renderCursor)
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
      }
    },
    beforeDestroy () {
      bus.$off('file-loaded', this.setMarkdownToEditor)
      bus.$off('undo', this.handleUndo)
      bus.$off('redo', this.handleRedo)
      bus.$off('export', this.handleExport)
      bus.$off('print-service-clearup', this.handlePrintServiceClearup)
      bus.$off('paragraph', this.handleEditParagraph)
      bus.$off('format', this.handleInlineFormat)
      bus.$off('searchValue', this.handleSearch)
      bus.$off('replaceValue', this.handReplace)
      bus.$off('find', this.handleFind)
      bus.$off('insert-image', this.handleSelect)
      bus.$off('image-uploaded', this.handleUploadedImage)
      bus.$off('file-changed', this.handleMarkdownChange)
      bus.$off('editor-blur', this.blurEditor)
      bus.$off('image-auto-path', this.handleImagePath)
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
        width: 70px;
      }
      & .el-button:focus,
      & .el-button:hover {
        color: var(--themeColor);
        border-color: var(--highlightColor);
        background-color: var(--selectionColor);
      }
      & .el-button--primary {
        color: #fff;
        background: var(--themeColor);
        border-color: var(--highlightColor);

      }
      & .el-input-number.is-controls-right .el-input__inner {
        background: var(--itemBgColor);
        color: var(--editorColor);
      }
      & .el-input-number.is-controls-right .el-input__inner:focus {
        border-color: var(--themeColor);
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
