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
        'theme': state => state.preferences.theme
      })
    },

    data () {
      return {
        contentState: null,
        editor: null
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
      })
    },
    beforeDestroy () {
      bus.$off('file-loaded', this.setMarkdown)
      bus.$off('dotu-select', this.handleSelectDoutu)
      const { markdown, cursor } = this
      bus.$emit('file-changed', { markdown, cursor, renderCursor: true })
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
        let timer = null
        editor.on('cursorActivity', (cm, event) => {
          let cursor = cm.getCursor()
          const markdown = cm.getValue()
          const wordCount = getWordCount(markdown)
          const line = cm.getLine(cursor.line)
          const preLine = cm.getLine(cursor.line - 1)
          const nextLine = cm.getLine(cursor.line + 1)
          cursor = adjustCursor(cursor, preLine, line, nextLine)
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', { markdown, wordCount, cursor })
          }, 1000)
        })
      },
      setMarkdown (markdown) {
        const { editor } = this
        editor.setValue(markdown)
        // // NOTE: Don't set the cursor because we load a new file - no tab switch.
        setCursorAtLastLine(editor)
      },
      // Only listen to get changes. Do not set history or other things.
      handleMarkdownChange({ markdown, cursor, renderCursor, history }) {
        const { editor } = this
        editor.setValue(markdown)
        // Cursor is null when loading a file or creating a new tab in source code mode.
        if (cursor) {
          editor.setCursor(cursor)
        } else {
          setCursorAtLastLine(editor)
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
