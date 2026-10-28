<template>
  <aside
    ref="outlineRef"
    class="document-outline"
    :class="{
      'is-expanded': docked,
      'is-floating': !docked,
      'is-visible': visible,
      'is-right': onRight,
      'is-resizing': resizing
    }"
    :style="{ '--outline-width': `${width}px` }"
    :aria-label="t('sideBar.toc.title')"
    @focusin="enter"
    @focusout="handleFocusOut"
    @keydown.esc.stop="dismiss"
  >
    <icon-tooltip
      :content="toggleLabel"
      :placement="onRight ? 'left' : 'right'"
    >
      <span class="outline-toggle-anchor">
        <button
          ref="toggleRef"
          class="plain-button outline-toggle"
          type="button"
          :aria-label="toggleLabel"
          :aria-expanded="visible"
          aria-controls="document-outline-tree"
          @mouseenter="enter"
          @mouseleave="leave"
          @click="toggle"
        >
          <svg
            :class="{ 'points-right': docked && onRight }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
          >
            <path
              v-if="docked"
              d="m11 6-6 6 6 6m7-12-6 6 6 6"
            />
            <path
              v-else
              d="M4 6h16M4 12h12M4 18h8"
            />
          </svg>
        </button>
      </span>
    </icon-tooltip>
    <div
      id="document-outline-tree"
      class="outline-body"
      :aria-hidden="!visible"
      :inert="!visible"
      @mouseenter="enter"
      @mouseleave="leave"
    >
      <span
        v-if="docked"
        class="outline-title"
        :title="t('sideBar.toc.title')"
      >{{
        t('sideBar.toc.title')
      }}</span>
      <icon-tooltip :content="bulkLabel">
        <span
          v-show="hasHeadings"
          class="outline-bulk-anchor"
        >
          <button
            class="plain-button outline-bulk-toggle"
            type="button"
            :aria-label="bulkLabel"
            :disabled="!tocRef?.canToggleAll"
            @mousedown.prevent
            @click="tocRef?.toggleAll()"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"
            >
              <path d="M8 4h12v12M4 8h12v12H4z" />
              <path :d="tocRef?.allCollapsed ? 'M7 14h6m-3-3v6' : 'M7 14h6'" />
            </svg>
          </button>
        </span>
      </icon-tooltip>
      <toc
        ref="tocRef"
        :visible="visible"
      />
    </div>
    <div
      v-if="docked"
      class="outline-resizer"
      role="separator"
      tabindex="0"
      :aria-label="t('sideBar.toc.resize')"
      aria-orientation="vertical"
      :aria-valuemin="MIN_WIDTH"
      :aria-valuemax="maximumWidth"
      :aria-valuenow="width"
      @pointerdown.prevent="startResize"
      @pointermove="resize"
      @pointerup="finishResize"
      @pointercancel="finishResize"
      @lostpointercapture="finishResize"
      @keydown="resizeWithKeyboard"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { MIN_EDITOR_WIDTH } from '@/util/editorLayout'
import Toc from '../sideBar/toc.vue'
import IconTooltip from '@/components/iconTooltip/index.vue'
import bus from '@/bus'

const { t } = useI18n()
const layoutStore = useLayoutStore()
const { showToc } = storeToRefs(layoutStore)
const editorStore = useEditorStore()
const hasHeadings = computed(() => editorStore.listToc.length > 0)
const outlineRef = ref<HTMLElement | null>(null)
const toggleRef = ref<HTMLButtonElement | null>(null)
const tocRef = ref<InstanceType<typeof Toc> | null>(null)
const bulkLabel = computed(() =>
  t(tocRef.value?.allCollapsed ? 'sideBar.toc.expandAll' : 'sideBar.toc.collapseAll')
)
const hovering = ref(false)
const docked = showToc
const onRight = computed(() => layoutStore.outlinePosition === 'right')
const visible = computed(() => docked.value || hovering.value)
const toggleLabel = computed(() => t(docked.value ? 'sideBar.toc.collapse' : 'sideBar.toc.expand'))
const MIN_WIDTH = 180
const MAX_WIDTH = 600
const WIDTH_STORAGE_KEY = 'outline-width'
const normalizeWidth = (value: string | null): number => {
  const width = Number(value)
  return Number.isFinite(width) && width > 0 ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)) : 220
}
const legacyWidth = ref(
  layoutStore.managed ? 220 : normalizeWidth(localStorage.getItem(WIDTH_STORAGE_KEY))
)
const preferredWidth = computed({
  get: () => (layoutStore.managed ? layoutStore.outlineWidth : legacyWidth.value),
  set: (value) => {
    if (layoutStore.managed) layoutStore.SET_OUTLINE_WIDTH(value)
    else legacyWidth.value = value
  }
})
const containerWidth = ref(window.innerWidth)
const maximumWidth = computed(() =>
  Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, containerWidth.value - MIN_EDITOR_WIDTH))
)
const width = computed(() => Math.min(preferredWidth.value, maximumWidth.value))
const resizing = ref(false)
let dragStart: { x: number; width: number; direction: number } | undefined
let observer: ResizeObserver | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
watch(showToc, () => {
  clearTimeout(closeTimer)
  hovering.value = false
  finishResize()
})

const enter = (): void => {
  clearTimeout(closeTimer)
  hovering.value = true
}
const leave = (): void => {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    hovering.value = false
  }, 150)
}
const dismiss = (): void => {
  clearTimeout(closeTimer)
  if (!docked.value) toggleRef.value?.focus()
  hovering.value = false
}
const handleFocusOut = (event: FocusEvent): void => {
  if (!outlineRef.value?.contains(event.relatedTarget as Node | null)) leave()
}
const toggle = (): void => {
  layoutStore.TOGGLE_LAYOUT_ENTRY('showToc')
}

const setAllExpanded = (expanded: unknown): void => {
  if (typeof expanded !== 'boolean' || !tocRef.value?.canToggleAll) return
  if (!showToc.value) layoutStore.TOGGLE_LAYOUT_ENTRY('showToc')
  enter()
  tocRef.value.setAllExpanded(expanded)
}

const setWidth = (value: number): void => {
  preferredWidth.value = Math.max(MIN_WIDTH, Math.min(maximumWidth.value, value))
}
const startResize = (event: PointerEvent): void => {
  if (event.button !== 0 || !event.isPrimary) return
  dragStart = { x: event.clientX, width: width.value, direction: onRight.value ? -1 : 1 }
  resizing.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const resize = (event: PointerEvent): void => {
  if (!dragStart) return
  setWidth(dragStart.width + (event.clientX - dragStart.x) * dragStart.direction)
}
const finishResize = (): void => {
  if (!dragStart) return
  dragStart = undefined
  resizing.value = false
  if (!layoutStore.managed) localStorage.setItem(WIDTH_STORAGE_KEY, String(preferredWidth.value))
}
const resizeWithKeyboard = (event: KeyboardEvent): void => {
  const direction = onRight.value ? -1 : 1
  if (event.key === 'ArrowLeft') setWidth(width.value - 10 * direction)
  else if (event.key === 'ArrowRight') setWidth(width.value + 10 * direction)
  else if (event.key === 'Home') setWidth(MIN_WIDTH)
  else if (event.key === 'End') setWidth(maximumWidth.value)
  else return
  event.preventDefault()
  if (!layoutStore.managed) localStorage.setItem(WIDTH_STORAGE_KEY, String(preferredWidth.value))
}
watch(onRight, finishResize)
onMounted(() => {
  bus.on('outline:set-all-expanded', setAllExpanded)
  const container = outlineRef.value?.parentElement
  if (!container) return
  containerWidth.value = container.clientWidth
  observer = new ResizeObserver(() => {
    containerWidth.value = container.clientWidth
  })
  observer.observe(container)
})
onBeforeUnmount(() => {
  bus.off('outline:set-all-expanded', setAllExpanded)
  observer?.disconnect()
  clearTimeout(closeTimer)
})
</script>

<style scoped>
.document-outline {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 5;
  pointer-events: none;
  width: 48px;
  height: 100%;
  color: var(--sideBarColor);
  box-sizing: border-box;
}
.document-outline.is-right {
  inset: 0 0 0 auto;
  order: 1;
}
.document-outline.is-expanded {
  position: relative;
  inset: auto;
  flex: 0 0 var(--outline-width);
  width: var(--outline-width);
  border-right: 1px solid var(--itemBgColor);
}
.document-outline.is-expanded.is-right {
  border-right: 0;
  border-left: 1px solid var(--itemBgColor);
}
.outline-toggle-anchor {
  display: block;
  width: 48px;
}
.is-right .outline-toggle-anchor {
  margin-left: auto;
}
.outline-toggle {
  pointer-events: auto;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 24px 8px 8px;
  border-radius: 5px;
  color: var(--sideBarIconColor);
}
.outline-toggle:hover {
  background: var(--sideBarItemHoverBgColor);
}
.outline-toggle svg {
  width: 20px;
  height: 20px;
}
.outline-toggle svg.points-right {
  transform: rotate(180deg);
}
.outline-title {
  position: absolute;
  top: 0;
  left: 48px;
  right: 48px;
  height: 32px;
  line-height: 32px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.outline-resizer {
  position: absolute;
  inset: 0 0 0 auto;
  z-index: 2;
  box-sizing: border-box;
  width: 3px;
  cursor: col-resize;
  pointer-events: auto;
  touch-action: none;
  -webkit-app-region: no-drag;
}
.is-right .outline-resizer {
  inset: 0 auto 0 0;
}
.outline-resizer:hover,
.outline-resizer:focus-visible,
.is-resizing .outline-resizer {
  border-right: 2px solid var(--iconColor);
}
.is-right .outline-resizer:hover,
.is-right .outline-resizer:focus-visible,
.is-right.is-resizing .outline-resizer {
  border-right: 0;
  border-left: 2px solid var(--iconColor);
}
.outline-bulk-anchor {
  position: absolute;
  top: 0;
  right: 8px;
  opacity: 0;
}
.is-right .outline-bulk-anchor {
  left: 8px;
  right: auto;
}
.document-outline:hover .outline-bulk-anchor,
.document-outline:focus-within .outline-bulk-anchor {
  opacity: 1;
}
.outline-bulk-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 5px;
  color: var(--sideBarIconColor);
}
.outline-bulk-toggle:hover:not(:disabled) {
  background: var(--sideBarItemHoverBgColor);
}
.outline-bulk-toggle:disabled {
  opacity: 0.4;
}
.outline-bulk-toggle:focus-visible {
  outline: 1px solid var(--focusColor);
}
.outline-bulk-toggle svg {
  width: 20px;
  height: 20px;
}
.outline-body {
  position: absolute;
  inset: 24px auto 16px 0;
  box-sizing: border-box;
  width: var(--outline-width);
  padding: 40px 8px 12px;
  background: var(--editorBgColor);
  border-radius: 8px;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-8px);
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    visibility 180ms;
  pointer-events: none;
}
.is-expanded .outline-body {
  width: 100%;
  border-radius: 0;
}
.is-right .outline-body {
  left: auto;
  right: 0;
  transform: translateX(8px);
}
.is-visible .outline-body {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
  pointer-events: auto;
}
.is-floating .outline-body {
  top: 16px;
}
.is-floating .outline-bulk-anchor {
  top: 8px;
}
.is-floating.is-visible .outline-body {
  box-shadow: 3px 4px 16px rgb(0 0 0 / 10%);
}
@media (prefers-reduced-motion: reduce) {
  .outline-body {
    transition: none;
  }
}
</style>

<style>
/* Muya mounts this affordance on body, outside the editor's stacking context. */
body:has(.document-outline.is-floating.is-visible) .mu-front-button-wrapper {
  visibility: hidden;
}
</style>
