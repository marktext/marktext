<template>
  <div
    v-if="marker?.visible && marker.ranges.length"
    class="ai-change-overview"
    :aria-label="marker.status === 'unsaved' ? 'Unsaved AI changes' : 'Saved AI changes'"
  >
    <button
      v-for="(range, index) in marker.ranges"
      :key="`${marker.revisionId}-${index}-${range.startOffset}`"
      class="ai-change-overview-marker"
      :class="marker.status"
      :style="markerStyle(range)"
      type="button"
      :title="markerTitle(range)"
      :aria-label="markerTitle(range)"
      @click="ai.navigateToChange(range.startLine)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAiStore } from '@/store/ai'
import { useEditorStore } from '@/store/editor'
import type { AiChangeRange } from '@/store/aiChangeTracker'

const ai = useAiStore()
const editorStore = useEditorStore()
const { currentChangeMarker } = storeToRefs(ai)
const { currentFile } = storeToRefs(editorStore)
const marker = currentChangeMarker

const lineCount = computed(() => Math.max(1, (currentFile.value?.markdown ?? '').split('\n').length))

const markerStyle = (range: AiChangeRange): Record<string, string> => {
  const start = Math.max(0, Math.min(lineCount.value - 1, range.startLine - 1))
  const end = Math.max(start, Math.min(lineCount.value - 1, range.endLine - 1))
  const top = (start / lineCount.value) * 100
  const height = Math.max(0.8, ((end - start + 1) / lineCount.value) * 100)
  return { top: `${top}%`, height: `${height}%` }
}

const markerTitle = (range: AiChangeRange): string => {
  const status = currentChangeMarker.value?.status === 'saved' ? 'Saved' : 'Unsaved'
  return `${status} AI change · lines ${range.startLine}-${range.endLine}`
}
</script>

<style scoped>
.ai-change-overview {
  position: absolute;
  z-index: 20;
  top: 0;
  right: 4px;
  bottom: 0;
  width: 10px;
  pointer-events: none;
}

.ai-change-overview-marker {
  position: absolute;
  right: 1px;
  width: 6px;
  min-height: 4px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
  pointer-events: auto;
  opacity: 0.9;
}

.ai-change-overview-marker.unsaved {
  background: #d6a400;
}

.ai-change-overview-marker.saved {
  background: #28a86b;
}

.ai-change-overview-marker:hover,
.ai-change-overview-marker:focus-visible {
  width: 9px;
  right: 0;
  outline: 2px solid var(--editorColor);
  outline-offset: 1px;
}
</style>
