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
      const { dispatch } = this.$store
      dispatch('LISTEN_FOR_CLOSE')
      dispatch('LISTEN_FOR_SAVE_AS')
      dispatch('LINTEN_WIN_STATUS')
      dispatch('LISTEN_FOR_SAVE')
      dispatch('GET_FILENAME')
      dispatch('LISTEN_FOR_FILE_LOAD')
      dispatch('LISTEN_FOR_FILE_CHANGE')
      dispatch('LISTEN_FOR_UNDO_REDO')
    }
  }
</script>

<style>
  .editor-container {
    padding-top: 22px;
  }
</style>
