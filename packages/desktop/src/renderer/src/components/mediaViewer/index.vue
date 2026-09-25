<template>
  <Teleport to="body">
    <div
      v-show="visible"
      ref="rootRef"
      class="image-viewer"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      tabindex="-1"
    >
      <span
        class="icon-close"
        role="button"
        tabindex="0"
        :title="t('editor.mediaViewer.close')"
        :aria-label="t('editor.mediaViewer.close')"
        @click="close"
        @keydown.enter.prevent="close"
        @keydown.space.prevent="close"
      >
        <CloseIcon />
      </span>
      <div class="media-viewer-toolbar">
        <button
          type="button"
          :title="t('editor.mediaViewer.zoomOut')"
          :aria-label="t('editor.mediaViewer.zoomOut')"
          @click="zoomOut"
        >
          <ZoomOutIcon />
        </button>
        <button
          type="button"
          class="zoom-level"
          :title="t('editor.mediaViewer.actualSize')"
          :aria-label="t('editor.mediaViewer.actualSize')"
          @click="actualSize"
        >
          {{ zoomPercent }}
        </button>
        <button
          type="button"
          :title="t('editor.mediaViewer.zoomIn')"
          :aria-label="t('editor.mediaViewer.zoomIn')"
          @click="zoomIn"
        >
          <ZoomInIcon />
        </button>
        <button
          type="button"
          :title="t('editor.mediaViewer.fit')"
          :aria-label="t('editor.mediaViewer.fit')"
          @click="fit"
        >
          <FitIcon />
        </button>
      </div>
      <div
        ref="stageRef"
        class="media-viewer-stage"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Close as CloseIcon,
  FullScreen as FitIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon
} from '@element-plus/icons-vue'
import { ZoomPanController } from '@/util/zoomPan'

const PAN_STEP = 40
const PAN_STEP_FAST = 160
const ZOOM_STEP = 1.25

const emit = defineEmits<{ (event: 'openChange', open: boolean): void }>()

const { t } = useI18n()

const visible = ref(false)
const scale = ref(1)
const label = ref('')
const rootRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)

const zoomPercent = computed(() => `${Math.round(scale.value * 100)}%`)

let controller: ZoomPanController | null = null
let restoreFocusTo: HTMLElement | null = null

const zoomIn = () => controller?.zoomBy(ZOOM_STEP)
const zoomOut = () => controller?.zoomBy(1 / ZOOM_STEP)
const fit = () => controller?.fit()
const actualSize = () => controller?.actualSize()

const clearStage = () => {
  controller?.destroy()
  controller = null
  if (stageRef.value) stageRef.value.innerHTML = ''
}

const onKeydown = (event: KeyboardEvent) => {
  if (!visible.value) return

  const step = event.shiftKey ? PAN_STEP_FAST : PAN_STEP
  switch (event.key) {
    case 'Escape':
      close()
      break
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
      zoomOut()
      break
    case '0':
      fit()
      break
    case '1':
      actualSize()
      break
    case 'ArrowLeft':
      controller?.panBy(step, 0)
      break
    case 'ArrowRight':
      controller?.panBy(-step, 0)
      break
    case 'ArrowUp':
      controller?.panBy(0, step)
      break
    case 'ArrowDown':
      controller?.panBy(0, -step)
      break
    default:
      return
  }
  event.preventDefault()
  event.stopPropagation()
}

const open = async (mount: (stage: HTMLElement) => HTMLElement, name: string) => {
  const stage = stageRef.value
  if (!stage) return

  clearStage()
  label.value = name
  const content = mount(stage)
  controller = new ZoomPanController(stage, content, {
    onChange: (state) => {
      scale.value = state.scale
    }
  })
  scale.value = 1

  restoreFocusTo = document.activeElement as HTMLElement | null
  visible.value = true
  emit('openChange', true)
  // The overlay is modal, so the keys belong to it wherever focus ended up.
  document.addEventListener('keydown', onKeydown, true)

  await nextTick()
  rootRef.value?.focus()
}

const openImage = (url: string) =>
  open((stage) => {
    const img = document.createElement('img')
    img.src = url
    img.style.cssText =
      'max-width:90vw;max-height:90vh;object-fit:contain;user-select:none;display:block;'
    img.draggable = false
    stage.appendChild(img)
    return img
  }, t('editor.mediaViewer.title'))

const close = () => {
  if (!visible.value) return

  document.removeEventListener('keydown', onKeydown, true)
  visible.value = false
  clearStage()
  emit('openChange', false)
  restoreFocusTo?.focus()
  restoreFocusTo = null
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true)
  clearStage()
})

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
  & .icon-close:focus-visible,
  & .media-viewer-toolbar button:focus-visible {
    outline: 2px solid #efefef;
    outline-offset: 2px;
  }
}

.media-viewer-toolbar {
  position: absolute;
  z-index: 1000;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  & button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #efefef;
    font-size: 12px;
    cursor: pointer;
  }
  & button:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  & button > svg {
    width: 16px;
    height: 16px;
  }
  & .zoom-level {
    font-variant-numeric: tabular-nums;
  }
}

.image-viewer > .media-viewer-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  overflow: hidden;
}
</style>
