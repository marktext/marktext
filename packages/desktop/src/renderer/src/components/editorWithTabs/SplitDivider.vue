<template>
  <div
    class="split-divider"
    @mousedown.prevent="startDrag"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

const props = defineProps<{
  containerEl: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'update:ratio', ratio: number): void
}>()

const clamp = (ratio: number): number => Math.min(0.9, Math.max(0.1, ratio))

const onMouseMove = (event: MouseEvent): void => {
  const el = props.containerEl
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = (event.clientX - rect.left) / rect.width
  emit('update:ratio', clamp(ratio))
}

const onMouseUp = (): void => {
  document.removeEventListener('mousemove', onMouseMove, false)
  document.removeEventListener('mouseup', onMouseUp, false)
}

const startDrag = (): void => {
  document.addEventListener('mousemove', onMouseMove, false)
  document.addEventListener('mouseup', onMouseUp, false)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove, false)
  document.removeEventListener('mouseup', onMouseUp, false)
})
</script>

<style scoped>
.split-divider {
  flex: 0 0 auto;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  background: var(--itemBgColor);
  transition: background 0.15s ease-in-out;
}

.split-divider:hover {
  background: var(--themeColor);
}
</style>
