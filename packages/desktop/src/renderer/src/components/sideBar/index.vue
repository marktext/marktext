<template>
  <div
    v-show="showSideBar"
    class="side-bar"
    :style="{ width: `${finalSideBarWidth}px` }"
  >
    <div
      v-if="rightColumn === 'files'"
      class="sidebar-header"
    >
      <span class="sidebar-title">{{ t('sideBar.icons.files') }}</span>
      <icon-tooltip :content="t('sideBar.icons.search')">
        <button
          ref="searchButton"
          type="button"
          class="plain-button search-button"
          :aria-label="t('sideBar.icons.search')"
          @click="openSearch"
        >
          <Search aria-hidden="true" />
        </button>
      </icon-tooltip>
    </div>
    <div class="sidebar-content">
      <tree
        v-if="rightColumn === 'files'"
        :project-tree="projectTree"
        :tabs="tabs"
      />
      <side-bar-search
        v-else-if="rightColumn === 'search'"
        @back="returnToFiles"
      />
    </div>
    <div class="sidebar-footer">
      <icon-tooltip :content="t('sideBar.icons.settings')">
        <button
          type="button"
          class="plain-button settings-button"
          :aria-label="t('sideBar.icons.settings')"
          @click="projectStore.OPEN_SETTING_WINDOW()"
        >
          <Setting aria-hidden="true" />
        </button>
      </icon-tooltip>
    </div>
    <div
      ref="dragBar"
      class="drag-bar"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'

import { Search, Setting } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import Tree from './tree.vue'
import SideBarSearch from './search.vue'
import IconTooltip from '@/components/iconTooltip/index.vue'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const searchButton = ref<HTMLButtonElement | null>(null)
const layoutStore = useLayoutStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const dragBar = ref<HTMLDivElement | null>(null)

const sideBarViewWidth = ref(280)

const { rightColumn, showSideBar, sideBarWidth } = storeToRefs(layoutStore)

const { projectTree } = storeToRefs(projectStore)
const { tabs } = storeToRefs(editorStore)

watch(sideBarWidth, width => {
  sideBarViewWidth.value = Number(width)
})

const finalSideBarWidth = computed<number>(() => {
  if (!showSideBar.value) return 0
  return sideBarViewWidth.value < 220 ? 220 : sideBarViewWidth.value
})

let stopDragging: (() => void) | undefined

onUnmounted(() => stopDragging?.())

onMounted(() => {
  nextTick(() => {
    const dragBarEl = dragBar.value
    if (!dragBarEl) return
    let startX = 0
    let currentSideBarWidth = +sideBarWidth.value
    let startWidth = currentSideBarWidth

    sideBarViewWidth.value = currentSideBarWidth

    const mouseUpHandler = (): void => {
      document.removeEventListener('mousemove', mouseMoveHandler, false)
      document.removeEventListener('mouseup', mouseUpHandler, false)
      layoutStore.SET_SIDE_BAR_WIDTH(currentSideBarWidth)
    }

    const mouseMoveHandler = (event: MouseEvent): void => {
      const offset = event.clientX - startX
      currentSideBarWidth = startWidth + offset
      sideBarViewWidth.value = currentSideBarWidth
    }

    const mouseDownHandler = (event: MouseEvent): void => {
      startX = event.clientX
      startWidth = +sideBarWidth.value
      document.addEventListener('mousemove', mouseMoveHandler, false)
      document.addEventListener('mouseup', mouseUpHandler, false)
    }

    dragBarEl.addEventListener('mousedown', mouseDownHandler, false)
    stopDragging = () => {
      dragBarEl.removeEventListener('mousedown', mouseDownHandler, false)
      document.removeEventListener('mousemove', mouseMoveHandler, false)
      document.removeEventListener('mouseup', mouseUpHandler, false)
    }
  })
})

const openSearch = (): void => {
  layoutStore.SET_LAYOUT({ rightColumn: 'search' })
}

const returnToFiles = (restoreFocus = true): void => {
  layoutStore.SET_LAYOUT({ rightColumn: 'files' })
  if (restoreFocus) nextTick(() => searchButton.value?.focus())
}
</script>

<style scoped>
.side-bar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 280px;
  height: 100vh;
  min-width: 220px;
  padding-top: 32px;
  box-sizing: border-box;
  position: relative;
  color: var(--sideBarColor);
  user-select: none;
  background: var(--sideBarBgColor);
  border-right: 1px solid var(--itemBgColor);
}

.sidebar-header,
.sidebar-footer {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 8px;
  -webkit-app-region: no-drag;
}

.sidebar-title {
  flex: 1;
  padding-left: 7px;
  font-size: 13px;
}

.sidebar-header button,
.sidebar-footer button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: var(--sideBarIconColor);
}

.sidebar-header button:hover,
.sidebar-footer button:hover {
  background: var(--sideBarItemHoverBgColor);
}

.sidebar-header svg,
.sidebar-footer svg {
  width: 18px;
  height: 18px;
}

.sidebar-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.drag-bar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  width: 3px;
  cursor: col-resize;
  -webkit-app-region: no-drag;
}

.drag-bar:hover {
  border-right: 2px solid var(--iconColor);
}
</style>
