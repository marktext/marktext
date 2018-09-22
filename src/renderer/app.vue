<template>
  <div
    class="editor-container"
  >
    <title-bar
      :project="projectTree"
      :pathname="pathname"
      :filename="filename"
      :active="windowActive"
      :word-count="wordCount"
      :theme="theme"
      :platform="platform"
      :is-saved="isSaved"
    ></title-bar>
    <div class="editor-middle">
      <side-bar></side-bar>
      <recent
        v-if="!hasCurrentFile && init"
      ></recent>
      <editor-with-tabs
        v-if="hasCurrentFile && init"
        :markdown="markdown"
        :filename="filename"
        :cursor="cursor"
        :theme="theme"
        :source-code="sourceCode"
        :show-tab-bar="showTabBar"
        :text-direction="textDirection"
      ></editor-with-tabs>
    </div>
    <bottom-bar
      :source-code="sourceCode"
      :theme="theme"
    ></bottom-bar>
    <aidou></aidou>
    <upload-image></upload-image>
    <about-dialog></about-dialog>
    <font></font>
    <rename></rename>
    <tweet></tweet>
  </div>
</template>

<script>
  import { ipcRenderer } from 'electron'
  import Recent from '@/components/recent'
  import EditorWithTabs from '@/components/editorWithTabs'
  import TitleBar from '@/components/titleBar'
  import SideBar from '@/components/sideBar'
  import BottomBar from '@/components/bottomBar'
  import Aidou from '@/components/aidou/aidou'
  import UploadImage from '@/components/uploadImage'
  import AboutDialog from '@/components/about'
  import Font from '@/components/font'
  import Rename from '@/components/rename'
  import Tweet from '@/components/tweet'
  import { mapState } from 'vuex'
  import bus from '@/bus'

  export default {
    name: 'marktext',
    components: {
      Aidou,
      Recent,
      EditorWithTabs,
      TitleBar,
      SideBar,
      BottomBar,
      UploadImage,
      AboutDialog,
      Font,
      Rename,
      Tweet
    },
    data () {
      return {}
    },
    computed: {
      ...mapState({
        'showTabBar': state => state.layout.showTabBar,
        'sourceCode': state => state.preferences.sourceCode,
        'theme': state => state.preferences.theme
      }),
      ...mapState({
        'projectTree': state => state.project.projectTree,
        'pathname': state => state.editor.currentFile.pathname,
        'filename': state => state.editor.currentFile.filename,
        'isSaved': state => state.editor.currentFile.isSaved,
        'markdown': state => state.editor.currentFile.markdown,
        'cursor': state => state.editor.currentFile.cursor,
        'wordCount': state => state.editor.currentFile.wordCount,
        'textDirection': state => state.editor.currentFile.textDirection
      }),
      ...mapState([
        'windowActive', 'platform', 'init'
      ]),
      hasCurrentFile () {
        return this.markdown !== undefined
      }
    },
    created () {
      const { dispatch } = this.$store
      // store/index.js
      dispatch('LINTEN_WIN_STATUS')
      // module: tweet
      dispatch('LISTEN_FOR_TWEET')
      // module: layout
      dispatch('LISTEN_FOR_LAYOUT')
      dispatch('LISTEN_FOR_REQUEST_LAYOUT')
      // module: listenForMain
      dispatch('LISTEN_FOR_IMAGE_PATH')
      dispatch('LISTEN_FOR_EDIT')
      dispatch('LISTEN_FOR_VIEW')
      dispatch('LISTEN_FOR_ABOUT_DIALOG')
      dispatch('LISTEN_FOR_PARAGRAPH_INLINE_STYLE')
      // module: project
      dispatch('LISTEN_FOR_UPDATE_PROJECT')
      dispatch('LISTEN_FOR_LOAD_PROJECT')
      dispatch('LISTEN_FOR_SIDEBAR_CONTEXT_MENU')
      // module: autoUpdates
      dispatch('LISTEN_FOR_UPDATE')
      // module: editor
      dispatch('ASK_FOR_USER_PREFERENCE')
      dispatch('ASK_FOR_MODE')
      dispatch('LISTEN_FOR_CLOSE')
      dispatch('LISTEN_FOR_SAVE_AS')
      dispatch('LISTEN_FOR_MOVE_TO')
      dispatch('LISTEN_FOR_SAVE')
      dispatch('LISTEN_FOR_SET_PATHNAME')
      dispatch('LISTEN_FOR_OPEN_SINGLE_FILE')
      dispatch('LISTEN_FOR_OPEN_BLANK_WINDOW')
      dispatch('LISTEN_FOR_SAVE_CLOSE')
      dispatch('LISTEN_FOR_EXPORT_PRINT')
      dispatch('LISTEN_FOR_INSERT_IMAGE')
      dispatch('LISTEN_FOR_RENAME')
      dispatch('LINTEN_FOR_SET_LINE_ENDING')
      dispatch('LISTEN_FOR_NEW_TAB')
      dispatch('LISTEN_FOR_CLOSE_TAB')
      dispatch('LINTEN_FOR_EXPORT_SUCCESS')
      dispatch('LISTEN_FOR_SET_TEXT_DIRECTION')
      dispatch('LISTEN_FOR_TEXT_DIRECTION_MENU')
      // module: notification
      dispatch('LISTEN_FOR_NOTIFICATION')

      // prevent Chromium's default behavior and try to open the first file
      window.addEventListener('dragover', function (e) {
        e.preventDefault()
        if (e.dataTransfer.types.indexOf('Files') >= 0) {
          if (e.dataTransfer.items.length === 1 && /png|jpg|jpeg|gif/.test(e.dataTransfer.items[0].type)) {
            bus.$emit('upload-image')
          }
          e.dataTransfer.dropEffect = 'copy'
        } else {
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'none'
        }
      }, false)

      window.addEventListener('drop', e => {
        e.preventDefault()
        if (e.dataTransfer.files) {
          const fileList = []
          for (const file of e.dataTransfer.files) {
            // console.log(file)
            fileList.push(file.path)
          }
          ipcRenderer.send('AGANI::window::drop', fileList)
        }
      }, false)
    }
  }
</script>

<style scoped>
  .editor-container {
    padding-top: var(--titleBarHeight);
  }
  .editor-container .hide {
    z-index: -1;
    opacity: 0;
    position: absolute;
    left: -10000px;
  }
  .editor-middle {
    display: flex;
    min-height: calc(100vh - var(--titleBarHeight));
    & > .editor {
      flex: 1;
    }
  }
</style>
