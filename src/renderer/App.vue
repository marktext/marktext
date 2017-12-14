<template>
  <div class="editor-container">
    <title-bar
      :filename="filename"
      :active="windowActive"
    ></title-bar>
    <editor></editor>
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
      ...mapState(['filename', 'windowActive'])
    },
    created () {
      this.$store.dispatch('LISTEN_FOR_SAVE_AS')
      this.$store.dispatch('LINTEN_WIN_STATUS')
      this.$store.dispatch('LISTEN_FOR_SAVE')
      this.$store.dispatch('GET_FILENAME')
      this.$store.dispatch('LISTEN_FOR_FILE_LOAD')
      this.$store.dispatch('LISTEN_FOR_FILE_CHANGE')
    }
  }
</script>

<style>
  .editor-container {
    padding-top: 22px;
  }
</style>
