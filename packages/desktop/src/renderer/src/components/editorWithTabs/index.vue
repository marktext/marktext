<template>
  <div
    class="editor-with-tabs"
    :style="{ 'max-width': `calc(100vw - ${effectiveSideBarWidth}px)`, '--editor-min-width': `${MIN_EDITOR_WIDTH}px` }"
  >
    <tabs v-show="showTabBar" />
    <div class="container">
      <document-outline />
      <div class="document-body">
        <editor
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
          :platform="platform"
        />
        <source-code
          v-if="sourceCode"
          :markdown="markdown"
          :muya-index-cursor="muyaIndexCursor"
          :text-direction="textDirection"
        />
      </div>
    </div>
    <tab-notifications />
  </div>
</template>

<script setup lang="ts">
import { useLayoutStore } from '@/store/layout'
import { MIN_EDITOR_WIDTH } from '@/util/editorLayout'
import { storeToRefs } from 'pinia'
import DocumentOutline from './outline.vue'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'

defineProps<{
  markdown: string
  // Tab cursor payloads cross the store boundary as unknown.
  cursor: unknown
  muyaIndexCursor?: unknown
  sourceCode: boolean
  showTabBar: boolean
  textDirection: string
  platform: string
}>()

const { effectiveSideBarWidth } = storeToRefs(useLayoutStore())
</script>

<style scoped>
.editor-with-tabs {
  position: relative;
  height: 100%;
  flex: 1;
  min-width: 0;
  container-type: inline-size;
  display: flex;
  flex-direction: column;

  overflow: hidden;
  background: var(--editorBgColor);
  & > .container {
    display: flex;
    position: relative;
    min-height: 0;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
  }
}
.document-body {
  flex: 1;
  min-width: var(--editor-min-width);
  container-type: inline-size;
  height: 100%;
  overflow: hidden;
}
.container:has(.is-resizing) {
  cursor: col-resize;
  user-select: none;
}
</style>
