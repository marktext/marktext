<template>
  <div
    v-show="showBar"
    ref="sideBar"
    class="side-bar"
    :class="isRight ? 'side-right' : 'side-left'"
    :style="{ minWidth: `${finalSideBarWidth}px`, width: `${finalSideBarWidth}px` }"
  >
    <div
      v-show="!isRight"
      class="left-column"
    >
      <ul>
        <li
          v-for="(c, index) of sideBarIcons"
          :key="index"
          :class="{ active: c.id === activeColumn }"
          @click="handleLeftIconClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
      <ul
        v-if="!isRight"
        class="bottom"
      >
        <li
          v-for="(c, index) of sideBarBottomIcons"
          :key="index"
          @click="handleLeftBottomClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
    </div>
    <div
      v-show="activeColumn"
      class="right-column"
    >
      <!-- Only mount a panel view while this sidebar is actually shown. The
           `v-show` above keeps a hidden sidebar in the DOM, so without the
           `showBar` guard the secondary sidebar (whose default column is
           'toc') would render a second, hidden `.side-bar-toc` permanently,
           breaking the TOC e2e specs that expect a single instance. -->
      <tree
        v-if="showBar && activeColumn === 'files'"
        :project-tree="projectTree"
        :opened-files="openedFiles"
        :tabs="tabs"
      />
      <side-bar-search v-else-if="showBar && activeColumn === 'search'" />
      <toc v-else-if="showBar && activeColumn === 'toc'" />
    </div>
    <div
      v-show="activeColumn"
      ref="dragBar"
      class="drag-bar"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'

import { sideBarIcons, sideBarBottomIcons } from './help'
import Tree from './tree.vue'
import SideBarSearch from './search.vue'
import Toc from './toc.vue'
import { storeToRefs } from 'pinia'
import type { TabDescriptor } from './types'

// `side` selects which set of layout-store fields this instance is bound to.
// The same component renders both the primary (left) and secondary (right)
// sidebar; app.vue mounts one of each.
const props = withDefaults(defineProps<{ side?: 'left' | 'right' }>(), {
  side: 'left'
})

const layoutStore = useLayoutStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()

const sideBar = ref<HTMLDivElement | null>(null)
const dragBar = ref<HTMLDivElement | null>(null)

const openedFiles = ref<TabDescriptor[]>([])
const sideBarViewWidth = ref(280)

const {
  rightColumn,
  secondaryColumn,
  showSideBar,
  showSecondarySideBar,
  sideBarWidth,
  secondarySideBarWidth
} = storeToRefs(layoutStore)

const { projectTree } = storeToRefs(projectStore)
const { tabs } = storeToRefs(editorStore)

const isRight = computed<boolean>(() => props.side === 'right')

// This side's active view, visibility, persisted width and icon-strip visibility.
const activeColumn = computed<string>(() =>
  isRight.value ? secondaryColumn.value : rightColumn.value
)
const showBar = computed<boolean>(() =>
  isRight.value ? showSecondarySideBar.value : showSideBar.value
)
const persistedWidth = computed<number>(() =>
  Number(isRight.value ? secondarySideBarWidth.value : sideBarWidth.value)
)

const finalSideBarWidth = computed<number>(() => {
  if (!showBar.value) return 0
  // The primary sidebar keeps a 45px icon strip when no view is active; the
  // secondary sidebar has no icon strip.
  if (!activeColumn.value) return isRight.value ? 0 : 45
  return sideBarViewWidth.value < 220 ? 220 : sideBarViewWidth.value
})

const setActiveColumn = (name: string): void => {
  if (isRight.value) {
    layoutStore.SET_LAYOUT({ secondaryColumn: name })
  } else {
    layoutStore.SET_LAYOUT({ rightColumn: name })
  }
}

const changeWidth = (width: number): void => {
  if (isRight.value) {
    layoutStore.CHANGE_SECONDARY_SIDE_BAR_WIDTH(width)
  } else {
    layoutStore.CHANGE_SIDE_BAR_WIDTH(width)
  }
}

onMounted(() => {
  nextTick(() => {
    const dragBarEl = dragBar.value
    if (!dragBarEl) return
    let startX = 0
    let currentSideBarWidth = persistedWidth.value
    let startWidth = currentSideBarWidth

    sideBarViewWidth.value = currentSideBarWidth

    const mouseUpHandler = (): void => {
      document.removeEventListener('mousemove', mouseMoveHandler, false)
      document.removeEventListener('mouseup', mouseUpHandler, false)
      changeWidth(currentSideBarWidth < 220 ? 220 : currentSideBarWidth)
    }

    const mouseMoveHandler = (event: MouseEvent): void => {
      // The left sidebar grows when its right edge is dragged rightwards; the
      // right sidebar grows when its left edge is dragged leftwards (sign flips).
      const offset = isRight.value ? startX - event.clientX : event.clientX - startX
      currentSideBarWidth = startWidth + offset
      sideBarViewWidth.value = currentSideBarWidth
    }

    const mouseDownHandler = (event: MouseEvent): void => {
      startX = event.clientX
      startWidth = persistedWidth.value
      document.addEventListener('mousemove', mouseMoveHandler, false)
      document.addEventListener('mouseup', mouseUpHandler, false)
    }

    dragBarEl.addEventListener('mousedown', mouseDownHandler, false)
  })
})

const handleLeftIconClick = (name: string): void => {
  if (activeColumn.value === name) {
    // Capture the expanded width BEFORE collapsing: once the active column is '',
    // finalSideBarWidth evaluates to the icon strip (45px on the left, 0 on the
    // right) and would overwrite the user's real width with the clamped 220px
    // minimum (#2421).
    const widthToPersist = finalSideBarWidth.value
    setActiveColumn('')
    changeWidth(widthToPersist)
  } else {
    const needDispatch = activeColumn.value === ''
    setActiveColumn(name)
    sideBarViewWidth.value = persistedWidth.value
    if (needDispatch) {
      changeWidth(finalSideBarWidth.value)
    }
  }
}

const handleLeftBottomClick = (name: string): void => {
  if (name === 'settings') {
    projectStore.OPEN_SETTING_WINDOW()
  }
}
</script>

<style scoped>
.side-bar {
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  width: 280px;
  height: 100vh;
  min-width: 220px;
  position: relative;
  color: var(--sideBarColor);
  user-select: none;
  background: var(--sideBarBgColor);
  border-right: 1px solid var(--itemBgColor);
}

/* Secondary (right) sidebar: it has no icon strip; the resize handle and
   border sit on the inner (left) edge since the panel is docked to the
   window's right side. */
.side-bar.side-right {
  border-right: none;
  border-left: 1px solid var(--itemBgColor);
}

.side-bar .left-column svg {
  color: var(--iconColor);
}

.left-column {
  height: 100%;
  width: 45px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-top: 28px;
  box-sizing: border-box;
}

.left-column > ul {
  opacity: 1;
}

.left-column ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}

.left-column ul > li {
  width: 45px;
  height: 45px;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  cursor: pointer;
}

.left-column ul > li > svg {
  width: 18px;
  height: 18px;
  color: var(--sideBarIconColor);
  opacity: 1;
  transition: transform 0.25s ease-in-out;
}

.left-column ul > li.active > svg {
  color: var(--themeColor);
}

.side-bar:hover .left-column ul li svg {
  opacity: 1;
}

.right-column {
  flex: 1;
  width: calc(100% - 50px);
  overflow: hidden;
}

/* The secondary sidebar has no icon strip, so give its view a little breathing
   room off the panel edges. The primary sidebar keeps its icons (which already
   provide that spacing), so it is left untouched. */
.side-bar.side-right .right-column {
  padding: 0 8px;
  box-sizing: border-box;
}

.drag-bar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  width: 3px;
  cursor: col-resize;
}

.side-bar.side-right .drag-bar {
  right: auto;
  left: 0;
}

.drag-bar:hover {
  border-right: 2px solid var(--iconColor);
}
</style>
