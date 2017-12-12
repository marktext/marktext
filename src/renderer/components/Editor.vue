<template>
  <div ref="editor">
  </div>
</template>

<script>
  import Aganippe from '../../editor'
  import bus from '../bus'

  export default {
    props: {
      markdown: {
        type: String
      }
    },
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

        this.editor.on('auto-save', markdown => {
          console.log('auto-save')
          this.$store.dispatch('SAVE_FILE', markdown)
        })
      })
    },
    methods: {
      handleFileLoaded (file) {
        this.editor && this.editor.setMarkdown(file)
      }
    },
    beforeDestroy () {
      bus.$off('file-loaded', this.handleFileLoaded)
      this.editor = null
    }
  }
</script>

<style scoped>
  @import '../../editor/themes/github.css';
  @import '../../editor/index.css';
</style>
