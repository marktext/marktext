<template>
  <div
    class="source-code"
    ref="sourceCode"
  >
  </div>
</template>

<script>
import codeMirror, { setMode, setCursorAtLastLine, setTextDirection } from '../../codeMirror'
import { wordCount as getWordCount } from 'muya/lib/utils'
import { mapState } from 'vuex'
import { adjustCursor } from '../../util'
import bus from '../../bus'
import { oneDarkThemes, railscastsThemes } from '@/config'

export default {
  props: {
    markdown: String,
    cursor: Object,
    textDirection: {
      type: String,
      required: true
    }
  },

  computed: {
    ...mapState({
      theme: state => state.preferences.theme,
      sourceCode: state => state.preferences.sourceCode,
      currentTab: state => state.editor.currentFile
    })
  },

  data () {
    return {
      contentState: null,
      editor: null,
      commitTimer: null,
      viewDestroyed: false,
      tabId: null
    }
  },

  watch: {
    textDirection: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        setTextDirection(editor, value)
      }
    }
  },

  created () {
    this.$nextTick(() => {
      // TODO: Should we load markdown from the tab or mapped vue property?
      const { id } = this.currentTab
      const { markdown = '', theme, cursor, textDirection } = this
      const container = this.$refs.sourceCode
      const codeMirrorConfig = {
        value: markdown,
        lineNumbers: true,
        autofocus: true,
        lineWrapping: true,
        styleActiveLine: true,
        direction: textDirection,
        lineNumberFormatter (line) {
          if (line % 10 === 0 || line === 1) {
            return line
          } else {
            return ''
          }
        }
      }
      if (railscastsThemes.includes(theme)) {
        codeMirrorConfig.theme = 'railscasts'
      } else if (oneDarkThemes.includes(theme)) {
        codeMirrorConfig.theme = 'one-dark'
      }
      const editor = this.editor = codeMirror(container, codeMirrorConfig)

      bus.$on('file-loaded', this.handleFileChange)
      bus.$on('file-changed', this.handleFileChange)
      bus.$on('dotu-select', this.handleSelectDoutu)
      bus.$on('selectAll', this.handleSelectAll)

      setMode(editor, 'markdown')
      this.listenChange()
      if (cursor) {
        const { anchor, focus } = cursor
        editor.setSelection(anchor, focus, { scroll: true }) // Scroll the focus into view.
      } else {
        setCursorAtLastLine(editor)
      }
      this.tabId = id
    })
  },
  beforeDestroy () {
    // NOTE: Clear timer and manually commit changes. After mode switching and cleanup may follow
    // further key inputs, so ignore all inputs.
    this.viewDestroyed = true
    if (this.commitTimer) clearTimeout(this.commitTimer)

    bus.$off('file-loaded', this.handleFileChange)
    bus.$off('file-changed', this.handleFileChange)
    bus.$off('dotu-select', this.handleSelectDoutu)
    bus.$off('selectAll', this.handleSelectAll)

    const { editor } = this
    const { cursor, markdown } = this.getMarkdownAndCursor(editor)
    bus.$emit('file-changed', { id: this.tabId, markdown, cursor, renderCursor: true })
  },
  methods: {
    handleSelectDoutu (url) {
      const { editor } = this
      if (editor) {
        editor.replaceSelection(`![](${url})`)
      }
    },
    listenChange () {
      const { editor } = this
      editor.on('cursorActivity', cm => {
        const { cursor, markdown } = this.getMarkdownAndCursor(cm)
        // Attention: the cursor may be `{focus: null, anchor: null}` when press `backspace`
        const wordCount = getWordCount(markdown)
        if (this.commitTimer) clearTimeout(this.commitTimer)
        this.commitTimer = setTimeout(() => {
          // See "beforeDestroy" note
          if (!this.viewDestroyed) {
            if (this.tabId) {
              this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', { id: this.tabId, markdown, wordCount, cursor })
            } else {
              // This may occur during tab switching but should not occur otherwise.
              console.warn('LISTEN_FOR_CONTENT_CHANGE: Cannot commit changes because not tab id was set!')
            }
          }
        }, 1000)
      })
    },
    // Another tab was selected - only listen to get changes but don't set history or other things.
    handleFileChange ({ id, markdown, cursor }) {
      this.prepareTabSwitch()

      const { editor } = this
      if (typeof markdown === 'string') {
        editor.setValue(markdown)
      }
      // Cursor is null when loading a file or creating a new tab in source code mode.
      if (cursor) {
        const { anchor, focus } = cursor
        editor.setSelection(anchor, focus, { scroll: true }) // Scroll the focus into view.
      } else {
        setCursorAtLastLine(editor)
      }
      this.tabId = id
    },
    // Get markdown and cursor from CodeMirror.
    getMarkdownAndCursor (cm) {
      let focus = cm.getCursor('head')
      let anchor = cm.getCursor('anchor')
      const markdown = cm.getValue()
      const adjCursor = cursor => {
        const line = cm.getLine(cursor.line)
        const preLine = cm.getLine(cursor.line - 1)
        const nextLine = cm.getLine(cursor.line + 1)
        return adjustCursor(cursor, preLine, line, nextLine)
      }
      focus = adjCursor(focus)
      anchor = adjCursor(anchor)

      return { cursor: { focus, anchor }, markdown }
    },
    // Commit changes from old tab. Problem: tab was already switched, so commit changes with old tab id.
    prepareTabSwitch () {
      if (this.commitTimer) clearTimeout(this.commitTimer)
      if (this.tabId) {
        const { editor } = this
        const { cursor, markdown } = this.getMarkdownAndCursor(editor)
        this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', { id: this.tabId, markdown, cursor })
        this.tabId = null // invalidate tab id
      }
    },

    handleSelectAll () {
      if (this.sourceCode && this.editor) {
        this.editor.execCommand('selectAll')
      }
    }
  }
}
</script>

<style>
  .source-code {
    height: calc(100vh - var(--titleBarHeight));
    box-sizing: border-box;
    overflow: auto;
  }
  .source-code .CodeMirror {
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
