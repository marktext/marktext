<template>
  <div
    ref="splitViewRef"
    class="split-view"
  >
    <div
      class="split-source"
      :style="{ width: `${splitRatio * 100}%` }"
    >
      <source-code
        :markdown="markdown"
        :muya-index-cursor="muyaIndexCursor"
        :text-direction="textDirection"
      />
    </div>
    <div
      class="split-divider"
      @mousedown="handleDividerMouseDown"
    />
    <div
      class="split-preview"
      :style="{ width: `${(1 - splitRatio) * 100}%` }"
    >
      <div class="split-preview-scroll">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="split-preview-content"
          contenteditable="false"
          v-html="previewHtml"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import markdownToHtml from '@/util/markdownToHtml'
import SourceCode from './sourceCode.vue'

const SOURCE_PREVIEW_DEBOUNCE = 120
const MIN_PANE_WIDTH = 260

const props = defineProps<{
  markdown?: string
  muyaIndexCursor?: unknown
  textDirection: string
}>()

const splitViewRef = ref<HTMLDivElement | null>(null)
const splitRatio = ref(0.5)
const previewHtml = ref('')
const previewTimer = ref<ReturnType<typeof setTimeout> | null>(null)

let renderToken = 0
let isDragging = false

const clampRatio = (ratio: number, width: number): number => {
  if (!Number.isFinite(width) || width <= MIN_PANE_WIDTH * 2) {
    return 0.5
  }
  const min = MIN_PANE_WIDTH / width
  const max = 1 - min
  return Math.min(max, Math.max(min, ratio))
}

const renderPreview = async (markdown: string): Promise<void> => {
  const token = ++renderToken
  const html = await markdownToHtml(markdown)
  if (token === renderToken) {
    previewHtml.value = html
  }
}

const schedulePreviewRender = (markdown: string): void => {
  if (previewTimer.value) {
    clearTimeout(previewTimer.value)
  }
  previewTimer.value = setTimeout(() => {
    previewTimer.value = null
    renderPreview(markdown)
  }, SOURCE_PREVIEW_DEBOUNCE)
}

watch(
  () => props.markdown,
  (markdown) => {
    schedulePreviewRender(markdown ?? '')
  },
  { immediate: true }
)

const handleDividerMouseMove = (event: MouseEvent): void => {
  if (!isDragging || !splitViewRef.value) {
    return
  }
  const rect = splitViewRef.value.getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width
  splitRatio.value = clampRatio(ratio, rect.width)
}

const stopDividerDrag = (): void => {
  if (!isDragging) {
    return
  }
  isDragging = false
  document.removeEventListener('mousemove', handleDividerMouseMove, false)
  document.removeEventListener('mouseup', stopDividerDrag, false)
}

const handleDividerMouseDown = (event: MouseEvent): void => {
  event.preventDefault()
  isDragging = true
  document.addEventListener('mousemove', handleDividerMouseMove, false)
  document.addEventListener('mouseup', stopDividerDrag, false)
}

onBeforeUnmount(() => {
  stopDividerDrag()
  if (previewTimer.value) {
    clearTimeout(previewTimer.value)
    previewTimer.value = null
  }
})
</script>

<style scoped>
.split-view {
  height: 100%;
  display: flex;
  overflow: hidden;
}

.split-source,
.split-preview {
  height: 100%;
  min-width: 0;
  overflow: hidden;
}

.split-divider {
  width: 5px;
  flex: 0 0 5px;
  cursor: col-resize;
  border-left: 1px solid var(--itemBgColor);
  border-right: 1px solid var(--itemBgColor);
}

.split-preview {
  background: var(--editorBgColor);
}

.split-preview-scroll {
  height: 100%;
  overflow: auto;
  padding: 28px 28px 64px;
  box-sizing: border-box;
}

.split-preview-content :deep(article.markdown-body) {
  color: var(--editorColor);
}

.split-source :deep(.source-code .CodeMirror) {
  max-width: none;
  margin: 20px 12px 28px;
}

.split-source :deep(.source-code .CodeMirror-gutters) {
  border-right: 1px solid var(--itemBgColor);
}
</style>
