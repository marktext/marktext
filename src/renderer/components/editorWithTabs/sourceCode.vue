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
        'theme': state => state.preferences.theme,
        'currentTab': state => state.editor.currentFile,
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

        bus.$on('file-loaded', this.setMarkdown)
        bus.$on('file-changed', this.handleMarkdownChange)
        bus.$on('dotu-select', this.handleSelectDoutu)

        setMode(editor, 'markdown')
        this.listenChange()
        if (cursor) {
          editor.setCursor(cursor)
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

      bus.$off('file-loaded', this.setMarkdown)
      bus.$off('file-changed', this.handleMarkdownChange)
      bus.$off('dotu-select', this.handleSelectDoutu)

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
          const wordCount = getWordCount(markdown)
          if (this.commitTimer) clearTimeout(this.commitTimer)
          this.commitTimer = setTimeout(() => {
            // See "beforeDestroy" note
            if (!this.viewDestroyed) {
              if (this.tabId) {
                this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', { id: this.tabId, markdown, wordCount, cursor })
              } else {
                // This may occur during tab switching but should not occur otherwise.
                console.warn(`LISTEN_FOR_CONTENT_CHANGE: Cannot commit changes because not tab id was set!`)
              }
            }
          }, 1000)
        })
      },
      // A new file was opened or new tab was added.
      setMarkdown ({ id, markdown }) {
        this.prepareTabSwitch()

        const { editor } = this
        editor.setValue(markdown)
        // NOTE: Don't set the cursor because we load a new file.
        setCursorAtLastLine(editor)
        this.tabId = id
      },
      // Another tab was selected - only listen to get changes but don't set history or other things.
      handleMarkdownChange ({ id, markdown, cursor, renderCursor, history }) {
        this.prepareTabSwitch()

        const { editor } = this
        editor.setValue(markdown)
        // Cursor is null when loading a file or creating a new tab in source code mode.
        if (cursor) {
          editor.setCursor(cursor)
        } else {
          setCursorAtLastLine(editor)
        }
        this.tabId = id
      },
      // Get markdown and cursor from CodeMirror.
      getMarkdownAndCursor (cm) {
        let cursor = cm.getCursor()
        const markdown = cm.getValue()
        const line = cm.getLine(cursor.line)
        const preLine = cm.getLine(cursor.line - 1)
        const nextLine = cm.getLine(cursor.line + 1)
        cursor = adjustCursor(cursor, preLine, line, nextLine)
        return { cursor, markdown }
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
