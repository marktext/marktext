<template>
  <div
    class="source-code"
    :class="[theme]"
    ref="sourceCode"
  >
  </div>
</template>

<script>
  import codeMirror, { setMode, setCursorAtLastLine, setTextDirection } from '../../codeMirror'
  import { wordCount as getWordCount } from 'muya/lib/utils'
  import { adjustCursor } from '../../util'
  import bus from '../../bus'

  export default {
    props: {
      theme: {
        type: String,
        required: true
      },
      markdown: String,
      cursor: Object,
      textDirection: {
        type: String,
        required: true
      }
    },

    data () {
      return {
        contentState: null,
        editor: null
      }
    },

    watch: {
      theme: function (value, oldValue) {
        const cm = this.$refs.sourceCode.querySelector('.CodeMirror')
        if (value !== oldValue) {
          if (value === 'dark') {
            cm.classList.remove('cm-s-default')
            cm.classList.add('cm-s-railscasts')
          } else {
            cm.classList.add('cm-s-default')
            cm.classList.remove('cm-s-railscasts')
          }
        }
      },
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
        if (theme === 'dark') codeMirrorConfig.theme = 'railscasts'
        const editor = this.editor = codeMirror(container, codeMirrorConfig)
        bus.$on('file-loaded', this.setMarkdown)
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
        const { editor, cursor } = this
        this.editor.setValue(markdown)
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
    max-width: 860px;
  }
  .source-code .CodeMirror-gutters {
    border-right: none;
    background-color: transparent;
  }
  .source-code .CodeMirror-activeline-background,
  .source-code .CodeMirror-activeline-gutter {
    background: #F2F6FC;
  }
  .source-code.dark,
  .source-code.dark .CodeMirror {
    background: var(--darkBgColor);
  }
  .dark.source-code .CodeMirror-activeline-background,
  .dark.source-code .CodeMirror-activeline-gutter {
    background: #333;
  }
</style>
