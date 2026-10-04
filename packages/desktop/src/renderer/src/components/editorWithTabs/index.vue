<template>
  <div
    class="editor-with-tabs"
    :style="{ 'max-width': `calc(100vw - ${effectiveSideBarWidth + effectiveAgentWidth}px)` }"
  >
    <tabs v-show="showTabBar" />
    <!-- v-show keeps Muya and CodeMirror mounted, so undo survives the diff tab. -->
    <div
      v-show="!diffActive"
      class="container"
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
    <template v-if="diffOpen">
      <diff-view v-show="diffActive" />
    </template>
    <tab-notifications />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { useEditorStore } from '@/store/editor'
import { useDiffStore } from '@/store/diff'
import { storeToRefs } from 'pinia'
import bus from '@/bus'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import DiffView from '@/components/diffView/index.vue'

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

const { effectiveSideBarWidth, effectiveAgentWidth } = storeToRefs(useLayoutStore())
const { currentFile } = storeToRefs(useEditorStore())
const diffStore = useDiffStore()
const { open: diffOpen, active: diffActive } = storeToRefs(diffStore)

watch(() => currentFile.value?.id, (id, previous) => {
  if (previous && id && id !== previous && diffStore.active) diffStore.showFile()
})

const onTurnDiff = (payload: unknown): void => {
  const data = payload as { turnId?: string; paths?: string[] }
  if (!data.turnId || !data.paths || data.paths.length === 0) return
  diffStore.showTurn(data.turnId, data.paths)
}

onMounted(() => {
  bus.on('agent:show-turn-diff', onTurnDiff)
})

onBeforeUnmount(() => {
  bus.off('agent:show-turn-diff', onTurnDiff)
})
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
  & > .container,
  & > .mt-diff {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}
</style>
