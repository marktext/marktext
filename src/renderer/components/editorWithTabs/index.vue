<template>
    <div
      class="editor-with-tabs"
    >
      <tabs v-show="showTabBar"></tabs>
      <div class="container">
        <editor
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
      <tab-notifications></tab-notifications>
    </div>
</template>

<script>
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'

export default {
  props: {
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
    SourceCode,
    TabNotifications
  }
}
</script>

<style scoped>
  .editor-with-tabs {
    position: relative;
    height: 100%;
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
