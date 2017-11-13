<template>
  <div ref="editor" class="editor">
  </div>
</template>

<script>
  import Aganippe from '@/editor'
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
  @import '../editor/theme.css';

  .editor {
    outline: none;
    margin: 0 auto;
    padding: 50px 0;
    width: 800px;
  }
</style>
