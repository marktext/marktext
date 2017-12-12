<template>
  <div class="editor-container">
    <title-bar
      :filename="filename"
    ></title-bar>
    <editor
      :markdown="markdown"
    ></editor>
  </div>
</template>

<script>
  import Editor from '@/components/editor'
  import TitleBar from '@/components/titleBar'
  import { mapState } from 'vuex'

  export default {
    name: 'aganippe',
    components: {
      Editor,
      TitleBar
    },
    computed: {
      ...mapState(['filename', 'markdown'])
    },
    created () {
      this.$store.dispatch('LISTEN_FOR_SAVE')
      this.$store.dispatch('GET_FILENAME')
      this.$store.dispatch('LISTEN_FOR_FILE_LOAD')
    }
  }
</script>

<style>
  .editor-container {
    padding-top: 22px;
  }
</style>
