<template>
    <div
      class="editor-with-tabs"
    >
      <tabs v-show="showTabBar"></tabs>
      <div class="container">
        <editor
          :fileanme="filename"
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
          :platform="platform"
        ></editor>
        <source-code
          v-if="sourceCode"
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
        ></source-code>
      </div>
    </div>
</template>

<script>
  import Tabs from './tabs.vue'
  import Editor from './editor.vue'
  import SourceCode from './sourceCode.vue'

  export default {
    props: {
      filename: {
        type: String
      },
      markdown: {
        type: String,
        required: true
      },
      cursor: {
        validator (value) {
          return typeof value === 'object'
        },
        required: true
      },
      sourceCode: {
        type: Boolean,
        required: true
      },
      showTabBar: {
        type: Boolean,
        required: true
      },
      textDirection: {
        type: String,
        required: true
      },
      platform: {
        type: String,
        required: true
      }
    },
    components: {
      Tabs,
      Editor,
      SourceCode
    }
  }
</script>

<style scoped>
  .editor-with-tabs {
    width: 100%;
    height: 100%;
    padding-top: var(--titleBarHeight);
    flex: 1;
    display: flex;
    flex-direction: column;
    
    overflow: hidden;
    background: var(--editorBgColor);
    & > .container {
      flex: 1;
      overflow: hidden;
    }
  }
</style>
