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
import { shell } from 'electron'
import path from 'path'
import log from 'electron-log'
import { mapState } from 'vuex'
// import ViewImage from 'view-image'
import { isChildOfDirectory } from 'common/filesystem/paths'
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
import Search from '../search'
import bus from '@/bus'
import { DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import notice from '@/services/notification'
import Printer from '@/services/printService'
import { SpellcheckerLanguageCommand } from '@/commands'
import { SpellChecker } from '@/spellchecker'
import { isOsx, animatedScrollTo } from '@/util'
import { moveImageToFolder, moveToRelativeFolder, uploadImage } from '@/util/fileSystem'
import { guessClipboardFilePath } from '@/util/clipboard'
import { getCssForOptions, getHtmlToc } from '@/util/pdf'
import { addCommonStyle, setEditorWidth } from '@/util/theme'

import 'muya/themes/default.css'
import '@/assets/themes/codemirror/one-dark.css'
// import 'view-image/lib/imgViewer.css'
import CloseIcon from '@/assets/icons/close.svg'

const STANDAR_Y = 320

export default {
  components: {
    Search
  },

  props: {
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
      superSubScript: state => state.preferences.superSubScript,
      footnote: state => state.preferences.footnote,
      isHtmlEnabled: state => state.preferences.isHtmlEnabled,
      isGitlabCompatibilityEnabled: state => state.preferences.isGitlabCompatibilityEnabled,
      lineHeight: state => state.preferences.lineHeight,
      fontSize: state => state.preferences.fontSize,
      codeFontSize: state => state.preferences.codeFontSize,
      codeFontFamily: state => state.preferences.codeFontFamily,
      codeBlockLineNumbers: state => state.preferences.codeBlockLineNumbers,
      trimUnnecessaryCodeBlockEmptyLines: state => state.preferences.trimUnnecessaryCodeBlockEmptyLines,
      editorFontFamily: state => state.preferences.editorFontFamily,
      hideQuickInsertHint: state => state.preferences.hideQuickInsertHint,
      hideLinkPopup: state => state.preferences.hideLinkPopup,
      autoCheck: state => state.preferences.autoCheck,
      editorLineWidth: state => state.preferences.editorLineWidth,
      imageInsertAction: state => state.preferences.imageInsertAction,
      imagePreferRelativeDirectory: state => state.preferences.imagePreferRelativeDirectory,
      imageRelativeDirectoryName: state => state.preferences.imageRelativeDirectoryName,
      imageFolderPath: state => state.preferences.imageFolderPath,
      theme: state => state.preferences.theme,
      sequenceTheme: state => state.preferences.sequenceTheme,
      hideScrollbar: state => state.preferences.hideScrollbar,
      spellcheckerEnabled: state => state.preferences.spellcheckerEnabled,
      spellcheckerNoUnderline: state => state.preferences.spellcheckerNoUnderline,
      spellcheckerLanguage: state => state.preferences.spellcheckerLanguage,

      currentFile: state => state.editor.currentFile,
      projectTree: state => state.project.projectTree,

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

    sequenceTheme: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ sequenceTheme: value }, true)
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

    superSubScript: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ superSubScript: value }, true)
      }
    },

    footnote: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ footnote: value }, true)
      }
    },

    isHtmlEnabled: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ disableHtml: !value }, true)
      }
    },

    isGitlabCompatibilityEnabled: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ isGitlabCompatibilityEnabled: value }, true)
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

    hideLinkPopup: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ hideLinkPopup: value })
      }
    },

    autoCheck: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoCheck: value })
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

    codeBlockLineNumbers: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ codeBlockLineNumbers: value }, true)
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

    spellcheckerEnabled: function (value, oldValue) {
      if (value !== oldValue) {
        const { editor, spellchecker, spellcheckerLanguage } = this

        // Set Muya's spellcheck container attribute.
        editor.setOptions({ spellcheckEnabled: value })

        // Disable native spell checker
        if (value) {
          spellchecker.activateSpellchecker(spellcheckerLanguage)
        } else {
          spellchecker.deactivateSpellchecker()
        }
      }
    },

    spellcheckerNoUnderline: function (value, oldValue) {
      if (value !== oldValue) {
        // Set Muya's spellcheck container attribute.
        this.editor.setOptions({ spellcheckEnabled: !value })
      }
    },

    spellcheckerLanguage: function (value, oldValue) {
      if (value !== oldValue) {
        this.spellchecker.lang = value
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
        fontSize,
        lineHeight,
        codeBlockLineNumbers,
        listIndentation,
        frontmatterType,
        superSubScript,
        footnote,
        isHtmlEnabled,
        isGitlabCompatibilityEnabled,
        hideQuickInsertHint,
        editorLineWidth,
        theme,
        sequenceTheme,
        spellcheckerEnabled,
        spellcheckerLanguage,
        hideLinkPopup,
        autoCheck
      } = this

      // use muya UI plugins
      Muya.use(TablePicker)
      Muya.use(QuickInsert)
      Muya.use(CodePicker)
      Muya.use(EmojiPicker)
      Muya.use(ImagePathPicker)
      Muya.use(ImageSelector, {
        unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
        photoCreatorClick: this.photoCreatorClick
      })
      Muya.use(Transformer)
      Muya.use(ImageToolbar)
      Muya.use(FormatPicker)
      Muya.use(FrontMenu)
      Muya.use(LinkTools, {
        jumpClick: this.jumpClick
      })
      Muya.use(FootnoteTool)
      Muya.use(TableBarTools)

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
        fontSize,
        lineHeight,
        codeBlockLineNumbers,
        listIndentation,
        frontmatterType,
        superSubScript,
        footnote,
        disableHtml: !isHtmlEnabled,
        isGitlabCompatibilityEnabled,
        hideQuickInsertHint,
        hideLinkPopup,
        autoCheck,
        sequenceTheme,
        spellcheckEnabled: spellcheckerEnabled,
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

      // Create spell check wrapper and enable spell checking if preferred.
      this.spellchecker = new SpellChecker(spellcheckerEnabled, spellcheckerLanguage)

      // Register command palette entry for switching spellchecker language.
      this.switchLanguageCommand = new SpellcheckerLanguageCommand(this.spellchecker)
      setTimeout(() => bus.$emit('cmd::register-command', this.switchLanguageCommand), 100)

      if (typewriter) {
        this.scrollToCursor()
      }

      // listen for bus events.
      bus.$on('file-loaded', this.setMarkdownToEditor)
      bus.$on('invalidate-image-cache', this.handleInvalidateImageCache)
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
      bus.$on('editor-focus', this.focusEditor)
      bus.$on('copyAsMarkdown', this.handleCopyPaste)
      bus.$on('copyAsHtml', this.handleCopyPaste)
      bus.$on('pasteAsPlainText', this.handleCopyPaste)
      bus.$on('duplicate', this.handleParagraph)
      bus.$on('createParagraph', this.handleParagraph)
      bus.$on('deleteParagraph', this.handleParagraph)
      bus.$on('insertParagraph', this.handleInsertParagraph)
      bus.$on('scroll-to-header', this.scrollToHeader)
      bus.$on('screenshot-captured', this.handleScreenShot)
      bus.$on('switch-spellchecker-language', this.switchSpellcheckLanguage)
      bus.$on('open-command-spellchecker-switch-language', this.openSpellcheckerLanguageCommand)
      bus.$on('replace-misspelling', this.replaceMisspelling)

      this.editor.on('change', changes => {
        // WORKAROUND: "id: 'muya'"
        this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', Object.assign(changes, { id: 'muya' }))
      })

      this.editor.on('format-click', ({ event, formatType, data }) => {
        const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey)
        if (formatType === 'link' && ctrlOrMeta) {
          this.$store.dispatch('FORMAT_LINK_CLICK', { data, dirname: window.DIRNAME })
        } else if (formatType === 'image' && ctrlOrMeta) {
          if (this.imageViewer) {
            this.imageViewer.destroy()
          }

          // Disabled due to #2120.
          // this.imageViewer = new ViewImage(this.$refs.imageViewer, {
          //   url: data,
          //   snapView: true
          // })

          this.setImageViewerVisible(true)
        }
      })

      // Disabled due to #2120.
      // this.editor.on('preview-image', ({ data }) => {
      //   if (this.imageViewer) {
      //     this.imageViewer.destroy()
      //   }
      //
      //   this.imageViewer = new ViewImage(this.$refs.imageViewer, {
      //     url: data,
      //     snapView: true
      //   })
      //
      //   this.setImageViewerVisible(true)
      // })

      this.editor.on('selectionChange', changes => {
        const { y } = changes.cursorCoords
        if (this.typewriter) {
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

        this.selectionChange = changes
        this.$store.dispatch('SELECTION_CHANGE', changes)
      })

      this.editor.on('selectionFormats', formats => {
        this.$store.dispatch('SELECTION_FORMATS', formats)
      })

      document.addEventListener('keyup', this.keyup)

      setEditorWidth(editorLineWidth)
    })
  },
  methods: {
    photoCreatorClick: (url) => {
      shell.openExternal(url)
    },

    jumpClick (linkInfo) {
      const { href } = linkInfo
      this.$store.dispatch('FORMAT_LINK_CLICK', { data: { href }, dirname: window.DIRNAME })
    },

    async imagePathAutoComplete (src) {
      const files = await this.$store.dispatch('ASK_FOR_IMAGE_AUTO_PATH', src)
      return files.map(f => {
        const iconClass = f.type === 'directory' ? 'icon-folder' : 'icon-image'
        return Object.assign(f, { iconClass, text: f.file + (f.type === 'directory' ? '/' : '') })
      })
    },

    async imageAction (image, id, alt = '') {
      // TODO(Refactor): Refactor this method.
      const {
        imageInsertAction,
        imageFolderPath,
        imagePreferRelativeDirectory,
        imageRelativeDirectoryName,
        preferences
      } = this
      const {
        filename,
        pathname
      } = this.currentFile

      // Save an image relative to the file if the relative image directory include the filename variable.
      // The image is save relative to the root folder without a variable.
      const saveRelativeToFile = () => {
        return /\${filename}/.test(imageRelativeDirectoryName)
      }

      // Figure out the current working directory.
      const isTabSavedOnDisk = !!pathname
      let relativeBasePath = isTabSavedOnDisk ? path.dirname(pathname) : null
      if (isTabSavedOnDisk && !saveRelativeToFile() && this.projectTree) {
        const { pathname: rootPath } = this.projectTree
        if (rootPath && isChildOfDirectory(rootPath, pathname)) {
          // Save assets relative to root directory.
          relativeBasePath = rootPath
        }
      }

      const getResolvedImagePath = imagePath => {
        const replacement = isTabSavedOnDisk
          // Filename w/o extension
          ? filename.replace(/\.[^/.]+$/, '')
          : ''
        return imagePath.replace(/\${filename}/g, replacement)
      }

      const resolvedImageFolderPath = getResolvedImagePath(imageFolderPath)
      const resolvedImageRelativeDirectoryName = getResolvedImagePath(imageRelativeDirectoryName)
      let destImagePath = ''
      switch (imageInsertAction) {
        case 'upload': {
          try {
            destImagePath = await uploadImage(pathname, image, preferences)
          } catch (err) {
            notice.notify({
              title: 'Upload Image',
              type: 'warning',
              message: err
            })
            destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)
          }
          break
        }
        case 'folder': {
          destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)
          if (isTabSavedOnDisk && imagePreferRelativeDirectory) {
            destImagePath = await moveToRelativeFolder(relativeBasePath, resolvedImageRelativeDirectoryName, pathname, destImagePath)
          }
          break
        }
        case 'path': {
          if (typeof image === 'string') {
            // Input is a local path.
            destImagePath = image
          } else {
            // Save and move image to image folder if input is binary.
            destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)

            // Respect user preferences if tab exists on disk.
            if (isTabSavedOnDisk && imagePreferRelativeDirectory) {
              destImagePath = await moveToRelativeFolder(relativeBasePath, resolvedImageRelativeDirectoryName, pathname, destImagePath)
            }
          }
          break
        }
      }

      if (id && this.sourceCode) {
        bus.$emit('image-action', {
          id,
          result: destImagePath,
          alt
        })
      }
      return destImagePath
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

    switchSpellcheckLanguage (languageCode) {
      const { spellchecker } = this
      const { isEnabled } = spellchecker

      // This method is also called from bus, so validate state before continuing.
      if (!isEnabled) {
        throw new Error('Cannot switch language because spell checker is disabled!')
      }

      spellchecker.switchLanguage(languageCode)
        .then(langCode => {
          if (!langCode) {
            // Unable to switch language due to missing dictionary. The spell checker is now in an invalid state.
            notice.notify({
              title: 'Spelling',
              type: 'warning',
              message: `Unable to switch to language "${languageCode}". Requested language dictionary is missing.`
            })
          }
        })
        .catch(error => {
          log.error(`Error while switching to language "${languageCode}":`)
          log.error(error)

          notice.notify({
            title: 'Spelling',
            type: 'error',
            message: `Error while switching to "${languageCode}": ${error.message}`
          })
        })
    },

    handleInvalidateImageCache () {
      if (this.editor) {
        this.editor.invalidateImageCache()
      }
    },

    openSpellcheckerLanguageCommand () {
      if (!isOsx) {
        bus.$emit('show-command-palette', this.switchLanguageCommand)
      }
    },

    replaceMisspelling ({ word, replacement }) {
      if (this.editor) {
        this.editor._replaceCurrentWordInlineUnsafe(word, replacement)
      }
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
      if (this.sourceCode) {
        return
      }

      if (this.editor && (this.editor.hasFocus() || this.editor.contentState.selectedTableCells)) {
        this.editor.selectAll()
      } else {
        const activeElement = document.activeElement
        const nodeName = activeElement.nodeName
        if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
          activeElement.select()
        }
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

    async handleExport (options) {
      const {
        type,
        header,
        footer,
        headerFooterStyled,
        htmlTitle
      } = options

      if (!/^pdf|print|styledHtml$/.test(type)) {
        throw new Error(`Invalid type to export: "${type}".`)
      }

      const extraCss = getCssForOptions(options)
      const htmlToc = getHtmlToc(this.editor.getTOC(), options)

      switch (type) {
        case 'styledHtml': {
          try {
            const content = await this.editor.exportStyledHTML({
              title: htmlTitle || '',
              printOptimization: false,
              extraCss,
              toc: htmlToc
            })
            this.$store.dispatch('EXPORT', { type, content })
          } catch (err) {
            log.error('Failed to export document:', err)
            notice.notify({
              title: `Printing/Exporting ${htmlTitle || 'html'} failed`,
              type: 'error',
              message: err.message || 'There is something wrong when exporting.'
            })
          }
          break
        }
        case 'pdf': {
          // NOTE: We need to set page size via Electron.
          try {
            const { pageSize, pageSizeWidth, pageSizeHeight, isLandscape } = options
            const pageOptions = {
              pageSize, pageSizeWidth, pageSizeHeight, isLandscape
            }

            const html = await this.editor.exportStyledHTML({
              title: '',
              printOptimization: true,
              extraCss,
              toc: htmlToc,
              header,
              footer,
              headerFooterStyled
            })
            this.printer.renderMarkdown(html, true)
            this.$store.dispatch('EXPORT', { type, pageOptions })
          } catch (err) {
            log.error('Failed to export document:', err)
            notice.notify({
              title: 'Printing/Exporting failed',
              type: 'error',
              message: `There is something wrong when export ${htmlTitle || 'PDF'}.`
            })
            this.handlePrintServiceClearup()
          }
          break
        }
        case 'print': {
          // NOTE: Print doesn't support page size or orientation.
          try {
            const html = await this.editor.exportStyledHTML({
              title: '',
              printOptimization: true,
              extraCss,
              toc: htmlToc,
              header,
              footer,
              headerFooterStyled
            })
            this.printer.renderMarkdown(html, true)
            this.$store.dispatch('PRINT_RESPONSE')
          } catch (err) {
            log.error('Failed to export document:', err)
            notice.notify({
              title: 'Printing/Exporting failed',
              type: 'error',
              message: `There is something wrong when print ${htmlTitle || ''}.`
            })
            this.handlePrintServiceClearup()
          }
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
      } else if (this.editor) {
        this.editor.updateParagraph(type)
      }
    },

    // handle `duplicate`, `delete`, `create paragraph below`
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

    blurEditor () {
      this.editor.blur(false, true)
    },

    focusEditor () {
      this.editor.focus()
    },

    handleScreenShot () {
      if (this.editor) {
        document.execCommand('paste')
      }
    }
  },
  beforeDestroy () {
    bus.$off('file-loaded', this.setMarkdownToEditor)
    bus.$off('invalidate-image-cache', this.handleInvalidateImageCache)
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
    bus.$off('editor-focus', this.focusEditor)
    bus.$off('copyAsMarkdown', this.handleCopyPaste)
    bus.$off('copyAsHtml', this.handleCopyPaste)
    bus.$off('pasteAsPlainText', this.handleCopyPaste)
    bus.$off('duplicate', this.handleParagraph)
    bus.$off('createParagraph', this.handleParagraph)
    bus.$off('deleteParagraph', this.handleParagraph)
    bus.$off('insertParagraph', this.handleInsertParagraph)
    bus.$off('scroll-to-header', this.scrollToHeader)
    bus.$off('screenshot-captured', this.handleScreenShot)
    bus.$off('switch-spellchecker-language', this.switchSpellcheckLanguage)
    bus.$off('open-command-spellchecker-switch-language', this.openSpellcheckerLanguageCommand)
    bus.$off('replace-misspelling', this.replaceMisspelling)

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
    cursor: default;
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
