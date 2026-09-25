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
        <template v-if="diagram">
          <span class="separator" />
          <button
            type="button"
            :title="t('editor.mediaViewer.saveSvg')"
            :aria-label="t('editor.mediaViewer.saveSvg')"
            @click="save('svg')"
          >
            <DownloadIcon />
          </button>
          <button
            type="button"
            :title="t('editor.mediaViewer.savePng')"
            :aria-label="t('editor.mediaViewer.savePng')"
            @click="save('png')"
          >
            <PictureIcon />
          </button>
          <button
            type="button"
            :title="t('editor.mediaViewer.copyImage')"
            :aria-label="t('editor.mediaViewer.copyImage')"
            @click="copy"
          >
            <CopyIcon />
          </button>
        </template>
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
  DocumentCopy as CopyIcon,
  Download as DownloadIcon,
  FullScreen as FitIcon,
  Picture as PictureIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon
} from '@element-plus/icons-vue'
import { ZoomPanController } from '@/util/zoomPan'
import { exportDiagram, type DiagramSource, type ExportFormat } from '@/util/diagramExport'
import notice from '@/services/notification'

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

const diagram = ref<DiagramSource | null>(null)

let controller: ZoomPanController | null = null
let restoreFocusTo: HTMLElement | null = null

const zoomIn = () => controller?.zoomBy(ZOOM_STEP)
const zoomOut = () => controller?.zoomBy(1 / ZOOM_STEP)
const fit = () => controller?.fit()
const actualSize = () => controller?.actualSize()

const clearStage = () => {
  controller?.destroy()
  controller = null
  diagram.value = null
  if (stageRef.value) stageRef.value.innerHTML = ''
}

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const canvasBackground = (): string =>
  getComputedStyle(document.body).getPropertyValue('--editorBgColor').trim() || '#ffffff'

const save = async (format: ExportFormat) => {
  const source = diagram.value
  if (!source) return

  try {
    const image = await exportDiagram(source, format, canvasBackground())
    const filePath = await window.electron.dialog.showSave({
      title: t('editor.mediaViewer.saveTitle'),
      defaultPath: `${source.type}-diagram.${image.extension}`,
      filters: [
        {
          name: image.extension === 'svg' ? 'Scalable Vector Graphics' : 'Portable Network Graphics',
          extensions: [image.extension]
        }
      ]
    })
    if (!filePath) return

    await window.fileUtils.writeFile(filePath, image.data)
    notice.notify({
      type: 'primary',
      message: t('editor.mediaViewer.saved', { path: filePath })
    })
  } catch (error) {
    notice.notify({
      type: 'error',
      message: t('editor.mediaViewer.saveFailed', { error: reason(error) })
    })
  }
}

const copy = async () => {
  const source = diagram.value
  if (!source) return

  try {
    const image = await exportDiagram(source, 'png', canvasBackground())
    const written = await window.electron.clipboard.writeImage(image.data)
    if (!written) throw new Error('The clipboard rejected the image')

    notice.notify({ type: 'primary', message: t('editor.mediaViewer.copied') })
  } catch (error) {
    notice.notify({
      type: 'error',
      message: t('editor.mediaViewer.copyFailed', { error: reason(error) })
    })
  }
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

const open = async (
  mount: (stage: HTMLElement) => HTMLElement,
  name: string,
  source: DiagramSource | null = null
) => {
  const stage = stageRef.value
  if (!stage) return

  clearStage()
  diagram.value = source
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

const openDiagram = (source: DiagramSource, name: string | null) =>
  open(
    (stage) => {
      const figure = document.createElement('figure')
      figure.className = 'mu-diagram-block'
      // Diagram renderers draw dark strokes on an assumed light canvas, so on
      // the overlay's dark scrim the edges would vanish. Give them the
      // editor's own background, which is what they were drawn against.
      figure.style.cssText =
        'max-width:90vw;max-height:90vh;margin:0;padding:16px;border-radius:4px;' +
        'background:var(--editorBgColor);'

      const preview = source.preview.cloneNode(true) as HTMLElement
      // The dialog already carries this name; announcing it twice helps nobody.
      preview.removeAttribute('role')
      preview.removeAttribute('aria-label')
      figure.appendChild(preview)
      stage.appendChild(figure)

      return figure
    },
    name || t('editor.mediaViewer.title'),
    source
  )

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

defineExpose({ openImage, openDiagram, close })
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
  & .separator {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.25);
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
