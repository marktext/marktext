<template>
  <div class="editor-container">
    <title-bar
      :pathname="pathname"
      :active="windowActive"
      :word-count="wordCount"
    ></title-bar>
    <editor
      :typewriter="typewriter"
      :focus="focus"
      :source-code="sourceCode"
      :markdown="markdown"
      :cursor="cursor"
      v-if="!sourceCode"
    ></editor>
    <source-code
      v-else
      :markdown="markdown"
      :cursor="cursor"
    ></source-code>
    <search
      v-if="!sourceCode"
    ></search>
  </div>
</template>

<script>
  import Editor from '@/components/editor'
  import TitleBar from '@/components/titleBar'
  import Search from '@/components/search'
  import SourceCode from '@/components/sourceCode'
  import { mapState } from 'vuex'

  export default {
    name: 'marktext',
    components: {
      Editor,
      TitleBar,
      Search,
      SourceCode
    },
    data () {
      return {}
    },
    computed: {
      ...mapState(['pathname', 'windowActive', 'wordCount', 'typewriter', 'focus', 'sourceCode', 'markdown', 'cursor'])
    },
    created () {
      const { dispatch } = this.$store

      dispatch('ASK_FOR_MODE')
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
  .editor-container .hide {
    z-index: -1;
    opacity: 0;
    position: absolute;
    left: -10000px;
  }
</style>
