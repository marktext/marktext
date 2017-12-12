<template>
  <div ref="editor">
  </div>
</template>

<script>
  import Aganippe from '../../editor'

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

        const unwatch = this.$watch('markdown', newValue => {
          if (newValue !== '' && this.editor) {
            this.editor.setMarkdown(newValue)
            unwatch()
          }
        })

        this.editor.on('auto-save', markdown => {
          console.log('auto-save')
          this.$store.dispatch('SAVE_FILE', markdown)
        })
      })
    },
    destroyed () {
      this.editor = null
    }
  }
</script>

<style scoped>
  @import '../../editor/themes/github.css';
  @import '../../editor/index.css';
</style>
