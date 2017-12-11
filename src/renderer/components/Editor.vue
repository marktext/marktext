<template>
  <div ref="editor">
  </div>
</template>

<script>
  import Aganippe from '../../editor'
  import mixins from './event'
  export default {
    mixins: [ mixins ],
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
      })
      this.handleSave()
      this.listenEvents()
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
