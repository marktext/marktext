<template>
  <Teleport to="body">
    <div
      v-show="visible"
      ref="rootRef"
      class="image-viewer"
    >
      <span
        class="icon-close"
        @click="close"
      >
        <CloseIcon />
      </span>
      <div ref="stageRef" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { Close as CloseIcon } from '@element-plus/icons-vue'
import { ZoomPanController } from '@/util/zoomPan'

const emit = defineEmits<{ (event: 'openChange', open: boolean): void }>()

const visible = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)

let controller: ZoomPanController | null = null

const clearStage = () => {
  controller?.destroy()
  controller = null
  if (stageRef.value) stageRef.value.innerHTML = ''
}

const openImage = (url: string) => {
  const stage = stageRef.value
  if (!stage) return

  clearStage()
  const img = document.createElement('img')
  img.src = url
  img.style.cssText =
    'max-width:90vw;max-height:90vh;object-fit:contain;user-select:none;display:block;'
  img.draggable = false
  stage.appendChild(img)
  controller = new ZoomPanController(stage, img)

  visible.value = true
  emit('openChange', true)
}

const close = () => {
  if (!visible.value) return

  visible.value = false
  clearStage()
  emit('openChange', false)
}

onBeforeUnmount(clearStage)

defineExpose({ openImage, close })
</script>

<style>
.image-viewer {
  position: fixed;
  backdrop-filter: blur(5px);
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  /* Above muya's floats (z-index 10000), which are appended to <body> — hence
     the Teleport: inside `.editor-wrapper` the `isolation: isolate` there caps
     this whole subtree below them no matter what z-index it carries. */
  z-index: 10002;
  & .icon-close {
    z-index: 1000;
    width: 30px;
    height: 30px;
    position: absolute;
    top: 50px;
    left: 50px;
    display: block;
    color: #efefef;
    cursor: pointer;
    & svg {
      width: 100%;
      height: 100%;
    }
  }
}

.image-viewer > div {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  overflow: hidden;
}
</style>
