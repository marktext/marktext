<template>
  <div ref="editor" class="editor-component">
  </div>
</template>

<script>
  import Aganippe from '../../editor'
  import bus from '../bus'

  export default {
    data () {
      return {
        editor: null,
        pathname: ''
      }
    },
    created () {
      this.$nextTick(() => {
        const ele = this.$refs.editor
        this.editor = new Aganippe(ele)

        bus.$on('file-loaded', this.handleFileLoaded)
        bus.$on('undo', () => this.editor.undo())
        bus.$on('redo', () => this.editor.redo())
        bus.$on('export', this.handleExport)

        this.editor.on('change', (markdown, wordCount) => {
          this.$store.dispatch('SAVE_FILE', { markdown, wordCount })
        })
      })
    },
    methods: {
      async handleExport (type) {
        switch (type) {
          case 'styledHtml': {
            const content = await this.editor.exportStyledHTML()
            this.$store.dispatch('EXPORT', { type, content })
            break
          }
        }
      },
      handleFileLoaded (file) {
        this.editor && this.editor.setMarkdown(file)
      }
    },
    beforeDestroy () {
      bus.$off('file-loaded', this.handleFileLoaded)
      bus.$off('export-styled-html', this.handleExport('styledHtml'))
      this.editor = null
    }
  }
</script>

<style scoped>
  @import '../../editor/themes/github.css';
  @import '../../editor/index.css';
  .editor-component {
    height: calc(100vh - 22px);
    overflow: auto;
  }
</style>
