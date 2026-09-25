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
      <el-tooltip
        :content="t('editor.mediaViewer.close')"
        v-bind="TOOLTIP"
        placement="bottom-start"
      >
        <button
          type="button"
          class="icon-close"
          :aria-label="t('editor.mediaViewer.close')"
          @click="close"
        >
          <CloseIcon />
        </button>
      </el-tooltip>
      <div class="media-viewer-toolbar">
        <el-tooltip
          :content="t('editor.mediaViewer.zoomOut')"
          v-bind="TOOLTIP"
        >
          <button
            type="button"
            :aria-label="t('editor.mediaViewer.zoomOut')"
            @click="zoomOut"
          >
            <ZoomOutIcon />
          </button>
        </el-tooltip>
        <el-tooltip
          :content="t('editor.mediaViewer.actualSize')"
          v-bind="TOOLTIP"
        >
          <button
            type="button"
            class="zoom-level"
            :aria-label="t('editor.mediaViewer.actualSize')"
            @click="actualSize"
          >
            {{ zoomPercent }}
          </button>
        </el-tooltip>
        <el-tooltip
          :content="t('editor.mediaViewer.zoomIn')"
          v-bind="TOOLTIP"
        >
          <button
            type="button"
            :aria-label="t('editor.mediaViewer.zoomIn')"
            @click="zoomIn"
          >
            <ZoomInIcon />
          </button>
        </el-tooltip>
        <el-tooltip
          :content="t('editor.mediaViewer.fit')"
          v-bind="TOOLTIP"
        >
          <button
            type="button"
            :aria-label="t('editor.mediaViewer.fit')"
            @click="fit"
          >
            <FitIcon />
          </button>
        </el-tooltip>
        <template v-if="diagram">
          <span class="separator" />
          <el-tooltip
            :content="t('editor.mediaViewer.saveSvg')"
            v-bind="TOOLTIP"
          >
            <button
              type="button"
              :aria-label="t('editor.mediaViewer.saveSvg')"
              @click="save('svg')"
            >
              <DownloadIcon />
            </button>
          </el-tooltip>
          <el-tooltip
            :content="t('editor.mediaViewer.savePng')"
            v-bind="TOOLTIP"
          >
            <button
              type="button"
              :aria-label="t('editor.mediaViewer.savePng')"
              @click="save('png')"
            >
              <PictureIcon />
            </button>
          </el-tooltip>
          <el-tooltip
            :content="copied ? t('editor.mediaViewer.copied') : t('editor.mediaViewer.copyImage')"
            v-bind="TOOLTIP"
          >
            <button
              type="button"
              :class="{ 'is-done': copied }"
              :aria-label="copied ? t('editor.mediaViewer.copied') : t('editor.mediaViewer.copyImage')"
              @click="copy"
            >
              <CheckIcon v-if="copied" />
              <CopyIcon v-else />
            </button>
          </el-tooltip>
        </template>
      </div>
      <div
        ref="stageRef"
        class="media-viewer-stage"
      />
      <span
        class="visually-hidden"
        role="status"
        aria-live="polite"
      >{{ copied ? t('editor.mediaViewer.copied') : '' }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Check as CheckIcon,
  Close as CloseIcon,
  DocumentCopy as CopyIcon,
  Download as DownloadIcon,
  FullScreen as FitIcon,
  Picture as PictureIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon
} from '@element-plus/icons-vue'
import { ZoomPanController } from '@/util/zoomPan'
import {
  exportDiagram,
  naturalSvgSize,
  type DiagramSource,
  type ExportFormat
} from '@/util/diagramExport'
import notice from '@/services/notification'

const PAN_STEP = 40
const PAN_STEP_FAST = 160
const ZOOM_STEP = 1.25
const COPIED_FEEDBACK_MS = 3000
const TOOLTIP = {
  effect: 'dark',
  placement: 'bottom',
  // Element Plus teleports the popper to <body> and numbers it from 2000,
  // which the overlay at 10002 would bury.
  zIndex: 10003,
  // Sweeping across the toolbar should not flash a bubble per button, and
  // the default 200ms hide delay leaves the old one up while the next opens.
  showAfter: 150,
  hideAfter: 0
} as const

const emit = defineEmits<{ (event: 'openChange', open: boolean): void }>()

const { t } = useI18n()

const visible = ref(false)
const scale = ref(1)
const label = ref('')
const rootRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)

const zoomPercent = computed(() => `${Math.round(scale.value * 100)}%`)

const diagram = ref<DiagramSource | null>(null)
const copied = ref(false)
const touched = ref(false)

let controller: ZoomPanController | null = null
let restoreFocusTo: HTMLElement | null = null
let copiedTimer = 0
let fitting = false

const zoomIn = () => controller?.zoomBy(ZOOM_STEP)
const zoomOut = () => controller?.zoomBy(1 / ZOOM_STEP)
const fit = () => {
  if (!controller) return
  // A fit is not a gesture: it must not switch off the auto-fit below.
  fitting = true
  controller.fit()
  fitting = false
}

// An image is only measurable once it loads, which can land after the reader
// has already zoomed — their gesture wins.
const fitIfUntouched = () => {
  if (!touched.value) fit()
}
const actualSize = () => controller?.actualSize()

const clearStage = () => {
  controller?.destroy()
  controller = null
  diagram.value = null
  window.clearTimeout(copiedTimer)
  copied.value = false
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
    notice
      .notify({
        type: 'primary',
        title: t('store.editor.exportSuccessTitle'),
        message: t('store.editor.exportSuccessMessage', {
          name: window.path.basename(filePath)
        }),
        showConfirm: true
      })
      .then(() => {
        window.electron.shell.showItemInFolder(filePath)
      })
      // Dismissing the notice rejects; that is not a failure.
      .catch(() => {})
  } catch (error) {
    notice
      .notify({
        type: 'error',
        message: t('editor.mediaViewer.saveFailed', { error: reason(error) })
      })
      // Dismissing the notice rejects; that is not a failure.
      .catch(() => {})
  }
}

const copy = async () => {
  const source = diagram.value
  if (!source) return

  try {
    const image = await exportDiagram(source, 'png', canvasBackground())
    const written = await window.electron.clipboard.writeImage(image.data)
    if (!written) throw new Error('The clipboard rejected the image')

    // The export is asynchronous, so the button this would tick may by now
    // belong to a different diagram — or to none.
    if (diagram.value !== source) return

    // The cursor is already on the button, so confirm there rather than in a
    // notification the reader has to look away for.
    copied.value = true
    window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => {
      copied.value = false
    }, COPIED_FEEDBACK_MS)
  } catch (error) {
    notice
      .notify({
        type: 'error',
        message: t('editor.mediaViewer.copyFailed', { error: reason(error) })
      })
      .catch(() => {})
  }
}

// Every control the reader can reach, in the order Tab should visit them.
const CONTROLS = '.icon-close, .media-viewer-toolbar button'

const moveFocus = (delta: number) => {
  const controls = [...(rootRef.value?.querySelectorAll<HTMLElement>(CONTROLS) ?? [])]
  if (!controls.length) return

  const at = controls.indexOf(document.activeElement as HTMLElement)
  // From the dialog itself, Tab enters at the first control and Shift+Tab at
  // the last.
  const next = at === -1 ? (delta > 0 ? 0 : controls.length - 1) : at + delta
  controls[(next + controls.length) % controls.length].focus()
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
    case 'Tab':
      // `aria-modal` is a claim to assistive tech, not something the browser
      // enforces: without this, Tab walks straight into the editor underneath.
      moveFocus(event.shiftKey ? -1 : 1)
      break
    case 'Enter':
    case ' ':
      // A control the reader has focused has to be operable. Stopping the
      // event here keeps it from the editor; not preventing it leaves the
      // browser to fire the click.
      if (rootRef.value !== document.activeElement) {
        event.stopPropagation()
        return
      }
      event.stopPropagation()
      event.preventDefault()
      return
    default:
      // Everything else is swallowed rather than acted on. The editor's own
      // listeners sit on `document` too, so focus being inside the overlay does
      // not keep keys away from them: Backspace would delete the very image on
      // screen, Space would re-open the viewer over itself.
      event.stopPropagation()
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

  const reopening = visible.value

  clearStage()
  diagram.value = source
  label.value = name
  const content = mount(stage)
  controller = new ZoomPanController(stage, content, {
    // The toolbar and the close control are layered over the stage, and are
    // where the pointer sits after using them.
    wheelSurface: rootRef.value ?? undefined,
    onChange: (state) => {
      scale.value = state.scale
      if (!fitting) touched.value = true
    }
  })
  scale.value = 1
  touched.value = false

  // Re-opening while open would capture the overlay itself as the element to
  // hand focus back to, and closing would then drop focus on the floor.
  if (!reopening) restoreFocusTo = document.activeElement as HTMLElement | null
  visible.value = true
  emit('openChange', true)
  // The overlay is modal, so the keys belong to it wherever focus ended up.
  document.addEventListener('keydown', onKeydown, true)

  await nextTick()
  fitIfUntouched()
  rootRef.value?.focus()
}

const openImage = (url: string) =>
  open((stage) => {
    const img = document.createElement('img')
    img.src = url
    img.style.cssText = 'user-select:none;display:block;'
    img.draggable = false
    // Only measurable once the bytes are in.
    img.addEventListener('load', fitIfUntouched, { once: true })
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
        'margin:0;padding:16px;border-radius:4px;background:var(--editorBgColor);'

      const preview = source.preview.cloneNode(true) as HTMLElement
      // The dialog already carries this name; announcing it twice helps nobody.
      preview.removeAttribute('role')
      preview.removeAttribute('aria-label')

      const live = source.preview.querySelector('svg')
      const clone = preview.querySelector('svg')
      // Renderers leave their root at `width="100%"`, which has no intrinsic
      // size to shrink-to-fit against — the clone would lay out at the CSS
      // default 300px however large the diagram is, and there would be nothing
      // for `fit` to scale down.
      if (live && clone) {
        const { width, height } = naturalSvgSize(live)
        clone.setAttribute('width', String(width))
        clone.setAttribute('height', String(height))
        clone.style.removeProperty('max-width')
      }
      // A PlantUML preview is a remote <img>, measurable only once it decodes.
      preview.querySelector('img')?.addEventListener('load', fitIfUntouched, { once: true })

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

// One teardown path: the two used to drift, and unmounting while open left
// the parent's `viewer-open` latch set.
onBeforeUnmount(close)

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
    padding: 0;
    border: none;
    background: transparent;
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
  & button.is-done {
    color: var(--themeColor);
  }
  & .separator {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.25);
  }
}

.image-viewer .visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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

/* The content is measured to compute the fit scale, so it has to lay out at
   its natural size — flex would otherwise shrink a wide one to the stage and
   report that it already fits. */
.image-viewer > .media-viewer-stage > * {
  flex: none;
}
</style>
