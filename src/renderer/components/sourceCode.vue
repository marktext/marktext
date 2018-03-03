<template>
  <div class="source-code" ref="sourceCode">
  </div>
</template>

<script>
  import codeMirror, { setMode, setCursorAtLastLine } from '../../editor/codeMirror'
  import ContentState from '../../editor/contentState'
  import bus from '../bus'

  export default {
    props: {
      markdown: String,
      cursor: Object
    },
    data () {
      return {
        contentState: null,
        editor: null
      }
    },
    created () {
      this.$nextTick(() => {
        const { markdown = '' } = this
        this.contentState = new ContentState()
        const container = this.$refs.sourceCode
        const editor = this.editor = codeMirror(container, {
          value: markdown,
          lineNumbers: true,
          autofocus: true,
          lineWrapping: true,
          styleActiveLine: true,
          lineNumberFormatter (line) {
            if (line % 10 === 0 || line === 1) {
              return line
            } else {
              return ''
            }
          }
        })
        bus.$on('file-loaded', this.setMarkdown)

        editor.on('cursorActivity', (cm, event) => {
          const cursor = cm.getCursor()
          const markdown = cm.getValue()
          // get word count
          this.contentState.importMarkdown(markdown, cursor)
          const wordCount = this.contentState.wordCount()
          this.$store.dispatch('SAVE_FILE', { markdown, cursor, wordCount })
        })

        setMode(editor, 'markdown')
        this.setMarkdown(markdown)
      })
    },
    beforeDestory () {
      bus.$off('file-loaded', this.setMarkdown)
    },
    methods: {
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
    height: calc(100vh - 22px);
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
</style>
