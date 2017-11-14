<template>
  <ul ref="editor">
  </ul>
</template>

<script>
  import Aganippe from '../../editor'
  export default {
    data () {
      return {
        editor: null
      }
    },
    created () {
      this.$nextTick(() => {
        const ele = this.$refs.editor
        this.editor = new Aganippe(ele)
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
