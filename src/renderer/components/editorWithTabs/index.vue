<template>
    <div
      class="editor-with-tabs"
    >
      <tabs v-show="showTabBar"></tabs>
      <div class="container">
        <editor
          :theme="theme"
          :fileanme="fileanme"
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
        ></editor>
        <source-code
          v-if="sourceCode"
          :theme="theme"
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
      theme: {
        type: String,
        required: true
      },
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
    flex: 1;
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--titleBarHeight));
    overflow: hidden;
    & > .container {
      flex: 1;
      overflow: hidden;
    }
  }
</style>
