<template>
  <div class="split-preview">
    <div class="split-preview-header">
      <span class="split-preview-filename">{{ filename }}</span>
    </div>
    <div class="split-preview-body">
      <!-- `renderedHtml` is sanitized by markdownToHtml() via ExportHtml/dompurify. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="renderedHtml" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/editor'
import markdownToHtml from '@/util/markdownToHtml'

const props = defineProps<{
  fileId: string | null
}>()

const editorStore = useEditorStore()
const { currentFile, getFileById } = storeToRefs(editorStore)

// The previewed tab: the explicitly selected `fileId` when it resolves to an
// open tab, otherwise fall back to the active editor file so the split always
// shows something meaningful.
const targetFile = computed(() => getFileById.value(props.fileId) ?? currentFile.value)

const filename = computed<string>(() => targetFile.value?.filename ?? '')
const markdown = computed<string>(() => targetFile.value?.markdown ?? '')

const renderedHtml = ref('')

// Debounce + sequence token: only the most recent async render is applied so
// rapid edits can't let a stale result overwrite a newer one (race guard).
let renderToken = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const render = (md: string): void => {
  const token = ++renderToken
  markdownToHtml(md)
    .then((html) => {
      if (token === renderToken) {
        renderedHtml.value = html
      }
    })
    .catch((err) => {
      console.error('Split preview render failed', err)
    })
}

const scheduleRender = (md: string): void => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    render(md)
  }, 200)
}

watch(
  () => [props.fileId, markdown.value],
  () => {
    scheduleRender(markdown.value)
  }
)

onMounted(() => {
  render(markdown.value)
})
</script>

<style scoped>
.split-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--editorBgColor);
  border-left: 1px solid var(--itemBgColor);
}

.split-preview-header {
  flex: 0 0 auto;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  color: var(--editorColor50);
  user-select: none;
  border-bottom: 1px solid var(--itemBgColor);
  overflow: hidden;
}

.split-preview-filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split-preview-body {
  flex: 1;
  overflow: auto;
  padding: 20px 40px;
  box-sizing: border-box;
}
</style>
