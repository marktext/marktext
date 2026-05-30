<template>
  <div
    class="editor-with-tabs"
    :style="{ 'max-width': `calc(100vw - ${effectiveSideBarWidth}px)` }"
  >
    <tabs v-show="showTabBar" />
    <div
      ref="containerEl"
      class="container"
      :class="{ 'split-active': showSplitView }"
    >
      <div
        class="split-pane split-pane-left"
        :style="leftPaneStyle"
      >
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
      <split-divider
        v-if="showSplitView"
        :container-el="containerEl"
        @update:ratio="onRatio"
      />
      <div
        v-if="showSplitView"
        class="split-pane split-pane-right"
        :style="rightPaneStyle"
      >
        <split-preview :file-id="splitFileId" />
      </div>
    </div>
    <tab-notifications />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { storeToRefs } from 'pinia'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import SplitDivider from './SplitDivider.vue'
import SplitPreview from './SplitPreview.vue'

defineProps<{
  markdown: string
  // `cursor` originates as `IFileState.cursor` which is `unknown`
  // (see src/shared/types/files.ts); align here instead of forcing every
  // caller to widen.
  cursor: unknown
  muyaIndexCursor?: unknown
  sourceCode: boolean
  showTabBar: boolean
  textDirection: string
  platform: string
}>()

const layoutStore = useLayoutStore()
const { effectiveSideBarWidth, showSplitView, splitRatio, splitFileId } =
  storeToRefs(layoutStore)

const containerEl = ref<HTMLElement | null>(null)

// When split is inactive the left pane fills the container exactly as before
// (no flex-basis override) so the editor layout is pixel-identical to the
// status quo. Only when split is active do we constrain pane widths.
const leftPaneStyle = computed<CSSProperties>(() =>
  showSplitView.value ? { flex: `0 0 ${splitRatio.value * 100}%` } : {}
)

const rightPaneStyle = computed<CSSProperties>(() => ({
  flex: `1 1 ${(1 - splitRatio.value) * 100}%`
}))

const onRatio = (ratio: number): void => {
  layoutStore.SET_SPLIT_RATIO(ratio)
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
    display: flex;
    flex-direction: row;
  }
}

.split-pane {
  position: relative;
  height: 100%;
  overflow: hidden;
}

/* Without an active split the left pane fills the container exactly like the
   pre-split `.container > editor` layout did. */
.split-pane-left {
  flex: 1 1 auto;
  min-width: 0;
}

.split-pane-right {
  min-width: 0;
}
</style>
