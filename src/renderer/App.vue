<template>
  <div class="editor-container">
    <title-bar
      :filename="filename"
      :active="windowActive"
      :word-count="wordCount"
    ></title-bar>
    <editor
      :typewriter="typewriter"
      :focus="focus"
      :source-code="sourceCode"
    ></editor>
    <search></search>
  </div>
</template>

<script>
  import Editor from '@/components/editor'
  import TitleBar from '@/components/titleBar'
  import Search from '@/components/search'
  import { mapState } from 'vuex'

  export default {
    name: 'marktext',
    components: {
      Editor,
      TitleBar,
      Search
    },
    data () {
      return {}
    },
    computed: {
      ...mapState(['filename', 'windowActive', 'wordCount', 'typewriter', 'focus', 'sourceCode'])
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
      dispatch('LISTEN_FOR_EDIT')
      dispatch('LISTEN_FOR_VIEW')
      dispatch('LISTEN_FOR_EXPORT')
      dispatch('LISTEN_FOR_PARAGRAPH_INLINE_STYLE')
    }
  }
</script>

<style>
  .editor-container {
    padding-top: 22px;
  }
</style>
