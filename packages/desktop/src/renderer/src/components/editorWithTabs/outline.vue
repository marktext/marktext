<template>
  <aside
    v-show="hasHeadings"
    ref="outlineRef"
    class="document-outline"
    :class="{ 'is-expanded': docked, 'is-floating': !docked, 'is-visible': visible }"
    :aria-label="t('sideBar.toc.title')"
    @focusin="enter"
    @focusout="handleFocusOut"
    @keydown.esc.stop="dismiss"
  >
    <icon-tooltip
      :content="toggleLabel"
      placement="right"
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
      <icon-tooltip :content="bulkLabel">
        <span class="outline-bulk-anchor">
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
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import Toc from '../sideBar/toc.vue'
import IconTooltip from '@/components/iconTooltip/index.vue'
import bus from '@/bus'

const { t } = useI18n()
const layoutStore = useLayoutStore()
const { showToc } = storeToRefs(layoutStore)
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const hasHeadings = computed(() => editorStore.listToc.length > 0)
const outlineRef = ref<HTMLElement | null>(null)
const toggleRef = ref<HTMLButtonElement | null>(null)
const tocRef = ref<InstanceType<typeof Toc> | null>(null)
const bulkLabel = computed(() => t(tocRef.value?.allCollapsed
  ? 'sideBar.toc.expandAll'
  : 'sideBar.toc.collapseAll'))
const compact = ref(true)
const hovering = ref(false)
const docked = computed(() => showToc.value && !compact.value)
const visible = computed(() => hasHeadings.value && (docked.value || hovering.value))
const toggleLabel = computed(() => t(docked.value ? 'sideBar.toc.collapse' : 'sideBar.toc.expand'))
let observer: ResizeObserver | undefined
let observedColumn: HTMLElement | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined
watch(hasHeadings, (hasHeadings) => {
  if (!hasHeadings) {
    clearTimeout(closeTimer)
    hovering.value = false
  }
})

const enter = (): void => {
  clearTimeout(closeTimer)
  hovering.value = true
}
const leave = (): void => {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => { hovering.value = false }, 150)
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
  if (compact.value) {
    enter()
  } else {
    hovering.value = false
    layoutStore.TOGGLE_LAYOUT_ENTRY('showToc')
  }
}

const setAllExpanded = (expanded: unknown): void => {
  if (typeof expanded !== 'boolean' || !tocRef.value?.canToggleAll) return
  if (!showToc.value) layoutStore.TOGGLE_LAYOUT_ENTRY('showToc')
  enter()
  tocRef.value.setAllExpanded(expanded)
}

const updateDocking = (): void => {
  const container = outlineRef.value?.parentElement
  if (!container) return
  const selector = preferencesStore.sourceCode ? '.source-code .CodeMirror' : '.editor-wrapper:not(.source) .mu-container'
  const column = container.querySelector<HTMLElement>(selector)
  if (column !== observedColumn) {
    if (observedColumn) observer?.unobserve(observedColumn)
    observedColumn = column
    if (column) observer?.observe(column)
  }
  // Measure the actual column so px, ch, percentage widths and themes all
  // reserve enough room for the 220px outline plus a 24px gap.
  compact.value = !column || column.getBoundingClientRect().left - container.getBoundingClientRect().left < 244
}
watch([hasHeadings, () => editorStore.currentFile?.id, () => preferencesStore.sourceCode], () => nextTick(updateDocking), { flush: 'post' })
onMounted(() => {
  bus.on('outline:set-all-expanded', setAllExpanded)
  const container = outlineRef.value?.parentElement
  if (!container) return
  observer = new ResizeObserver(updateDocking)
  observer.observe(container)
  nextTick(updateDocking)
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
}
.document-outline.is-expanded {
  width: 220px;
}
.outline-toggle-anchor {
  display: block;
  width: 48px;
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
.outline-bulk-anchor {
  position: absolute;
  top: 0;
  right: 8px;
  opacity: 0;
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
  width: 220px;
  padding: 40px 8px 12px;
  background: var(--editorBgColor);
  border-radius: 8px;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-8px);
  transition: opacity 180ms ease, transform 180ms ease, visibility 180ms;
  pointer-events: none;
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
