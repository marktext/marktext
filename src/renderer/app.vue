<template>
  <div class="editor-container">
    <title-bar
      :pathname="pathname"
      :filename="filename"
      :active="windowActive"
      :word-count="wordCount"
      :theme="theme"
      :platform="platform"
      :is-saved="isSaved"
    ></title-bar>
    <editor
      :typewriter="typewriter"
      :focus="focus"
      :source-code="sourceCode"
      :markdown="markdown"
      :cursor="cursor"
      v-if="!sourceCode"
      :theme="theme"
      :color="color"
      :line-height="lineHeight"
      :font-size="fontSize"
    ></editor>
    <source-code
      v-else
      :markdown="markdown"
      :cursor="cursor"
      :theme="theme"
    ></source-code>
    <bottom-bar
      :source-code="sourceCode"
      :theme="theme"
    ></bottom-bar>
    <aidou></aidou>
    <upload-image></upload-image>
    <about-dialog></about-dialog>
    <font></font>
  </div>
</template>

<script>
  import Editor from '@/components/editor'
  import TitleBar from '@/components/titleBar'
  import BottomBar from '@/components/bottomBar'
  import SourceCode from '@/components/sourceCode'
  import Aidou from '@/components/aidou/aidou'
  import UploadImage from '@/components/uploadImage'
  import AboutDialog from '@/components/about'
  import Font from '@/components/font'
  import { mapState } from 'vuex'

  export default {
    name: 'marktext',
    components: {
      Aidou,
      Editor,
      TitleBar,
      BottomBar,
      SourceCode,
      UploadImage,
      AboutDialog,
      Font
    },
    data () {
      return {}
    },
    computed: {
      ...mapState([
        'pathname', 'filename', 'isSaved', 'windowActive', 'wordCount',
        'typewriter', 'focus', 'sourceCode', 'markdown',
        'cursor', 'theme', 'platform', 'color', 'fontSize', 'lineHeight'
      ])
    },
    created () {
      const { dispatch } = this.$store

      dispatch('ASK_FOR_USER_PREFERENCE')
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
      dispatch('LISTEN_FOR_UPDATE')
      dispatch('LISTEN_FOR_INSERT_IMAGE')
      dispatch('LISTEN_FOR_ABOUT_DIALOG')
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
