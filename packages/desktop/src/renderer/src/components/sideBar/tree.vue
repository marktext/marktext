<template>
  <div
    ref="treeView"
    class="tree-view"
  >
    <!-- Opened tabs -->
    <div
      v-if="openedFilesInSidebar"
      class="opened-files"
    >
      <div class="title">
        <el-icon
          class="icon-arrow"
          :class="{ fold: !showOpenedFiles }"
          :size="12"
          @click.stop="toggleOpenedFiles()"
        >
          <ArrowRight />
        </el-icon>
        <span
          class="default-cursor text-overflow"
          @click.stop="toggleOpenedFiles()"
        >{{
          t('sideBar.tree.openedFiles')
        }}</span>
        <icon-tooltip :content="t('sideBar.tree.saveAll')">
          <button
            type="button"
            class="plain-button"
            :aria-label="t('sideBar.tree.saveAll')"
            @click.stop="saveAll(false)"
          >
            <svg
              class="icon"
              aria-hidden="true"
            >
              <use xlink:href="#icon-save-all" />
            </svg>
          </button>
        </icon-tooltip>
        <icon-tooltip :content="t('sideBar.tree.closeAll')">
          <button
            type="button"
            class="plain-button"
            :aria-label="t('sideBar.tree.closeAll')"
            @click.stop="saveAll(true)"
          >
            <svg
              class="icon"
              aria-hidden="true"
            >
              <use xlink:href="#icon-close-all" />
            </svg>
          </button>
        </icon-tooltip>
      </div>
      <div
        v-show="showOpenedFiles"
        ref="openedFilesList"
        class="opened-files-list"
        :style="{ maxHeight: `${openedFilesMaxHeight}px` }"
      >
        <transition-group name="list">
          <opened-file
            v-for="tab of tabs"
            :key="tab.id"
            :file="tab"
          />
        </transition-group>
      </div>
      <div
        v-if="showOpenedFiles && tabCount > MIN_VISIBLE_ROWS"
        class="opened-files-resize"
        role="separator"
        aria-orientation="horizontal"
        :aria-label="t('sideBar.tree.resizeOpenedFiles')"
        :aria-valuenow="openedFilesMaxHeight"
        tabindex="0"
        @mousedown.prevent="startResize"
        @keydown="handleResizeKeydown"
      />
    </div>

    <div
      v-if="projectTree"
      class="project-tree"
    >
      <div
        class="title"
        @contextmenu.prevent="handleRootContextMenu"
      >
        <el-icon
          class="icon-arrow"
          :class="{ fold: !showDirectories }"
          :size="12"
          @click.stop="toggleDirectories()"
        >
          <ArrowRight />
        </el-icon>
        <span
          class="default-cursor text-overflow"
          @click.stop="toggleDirectories()"
        >{{
          projectTree.name
        }}</span>
      </div>
      <div
        v-show="showDirectories"
        ref="treeWrapper"
        class="tree-wrapper"
        tabindex="0"
        @mousedown="handleTreeMouseDown"
        @focusout="handleTreeFocusOut"
        @keydown="handleTreeKeydown"
      >
        <folder
          v-for="folder of projectTree.folders"
          :key="folder.id"
          :folder="folder"
          :depth="depth"
        />
        <input
          v-show="createCacheDirname === projectTree.pathname"
          ref="input"
          v-model="nameInputValue"
          placeholder="Enter .md file name"
          type="text"
          class="new-input"
          :style="{ 'margin-left': `${depth * 5 + 15}px` }"
          @keypress.enter="handleInputEnter"
        >
        <file
          v-for="file of projectTree.files"
          :key="file.id"
          :file="file"
          :depth="depth"
        />
        <div
          v-if="
            projectTree.files.length === 0 &&
              projectTree.folders.length === 0 &&
              createCacheDirname !== projectTree.pathname
          "
          class="empty-project"
        >
          <span>{{ t('sideBar.tree.emptyProject') }}</span>
          <div class="centered-group">
            <button
              class="button-primary"
              @click.stop="createFile"
            >
              {{ t('sideBar.tree.createFile') }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else
      class="open-project"
    >
      <div class="centered-group">
        <el-button
          text
          bg
          type="primary"
          @click="openFolder"
        >
          {{ t('sideBar.tree.openFolder') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'
import Folder from './treeFolder.vue'
import File from './treeFile.vue'
import OpenedFile from './treeOpenedTab.vue'
import IconTooltip from '@/components/iconTooltip/index.vue'
import bus from '../../bus'
import { showContextMenu } from '../../contextMenu/sideBar'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@element-plus/icons-vue'
import { PATH_SEPARATOR } from '@/config'
import { isMac } from '@/util'
import { computeRevealScrollTop } from '@/util/revealTreeRow'
import {
  isEditableTarget,
  isInsideTreeScope,
  isNameInput,
  keepsSidebarSelection,
  shouldTrashSelection
} from './trashKey'
import { shouldRenameSelection } from './renameKey'
import { TREE_ROW_REGISTRY_KEY, toRowKey, type TreeRowRegistry } from './rowRegistry'
import type { TreeNode, TabDescriptor } from './types'

const { t } = useI18n()

const props = defineProps<{
  // Null until a project is opened.
  projectTree: TreeNode | null
  tabs?: TabDescriptor[]
}>()

const depth = 0
// Switching views remounts the tree; persist section expansion across those
// remounts and app restarts (#2421).
const SHOW_DIRECTORIES_KEY = 'side-bar-show-directories'
const SHOW_OPENED_FILES_KEY = 'side-bar-show-opened-files'
const readSectionExpanded = (key: string): boolean => localStorage.getItem(key) !== 'false'
const showDirectories = ref(readSectionExpanded(SHOW_DIRECTORIES_KEY))
const showOpenedFiles = ref(readSectionExpanded(SHOW_OPENED_FILES_KEY))

// Must match the `.opened-file` row height in treeOpenedTab.vue.
const ROW_HEIGHT_PX = 28
// The list shows this many rows before it scrolls and offers a resize handle.
const MIN_VISIBLE_ROWS = 4
const MIN_LIST_HEIGHT_PX = MIN_VISIBLE_ROWS * ROW_HEIGHT_PX
// Space always left below the list for the project tree, including when the
// window shrinks after the list was dragged taller.
const PROJECT_TREE_RESERVE_PX = 150
const OPENED_FILES_HEIGHT_KEY = 'side-bar-opened-files-height'
const storedListHeight = Number(localStorage.getItem(OPENED_FILES_HEIGHT_KEY))
// The height the user asked for. Only ever written by a drag or key press and
// persisted as-is, so a temporary viewport clamp never shrinks the memory.
const listHeight = ref(storedListHeight > 0 ? storedListHeight : MIN_LIST_HEIGHT_PX)
const treeView = ref<HTMLElement | null>(null)
const openedFilesList = ref<HTMLElement | null>(null)
// Tallest the list may render in the current window; the requested height is
// kept separately so the list grows back when the window does.
const listHeightLimit = ref(Infinity)
const input = ref<HTMLInputElement | null>(null)
const treeWrapper = ref<HTMLDivElement | null>(null)

const rowRegistry: TreeRowRegistry = new Map()
provide(TREE_ROW_REGISTRY_KEY, rowRegistry)

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const preferencesStore = usePreferencesStore()

const { createCache } = storeToRefs(projectStore)
const { clipboard } = storeToRefs(projectStore)
const { activeItem } = storeToRefs(projectStore)
const { renameCache } = storeToRefs(projectStore)
const { nameInputValue } = storeToRefs(projectStore)
const { openedFilesInSidebar } = storeToRefs(preferencesStore)

// The create cache is empty when no input is shown.
const createCacheDirname = computed<string | undefined>(() => {
  const cache = createCache.value as { dirname?: string }
  return cache.dirname
})

const tabCount = computed(() => props.tabs?.length ?? 0)

// Never taller than the rows themselves, so closing tabs leaves no gap.
const openedFilesMaxHeight = computed(() => {
  if (tabCount.value <= MIN_VISIBLE_ROWS) return MIN_LIST_HEIGHT_PX
  const contentHeight = tabCount.value * ROW_HEIGHT_PX
  return Math.max(
    MIN_LIST_HEIGHT_PX,
    Math.min(listHeight.value, contentHeight, listHeightLimit.value)
  )
})

const openFolder = (): void => {
  projectStore.ASK_FOR_OPEN_PROJECT()
}

const saveAll = (isClose: boolean): void => {
  editorStore.ASK_FOR_SAVE_ALL(isClose)
}

const createFile = (): void => {
  projectStore.CHANGE_ACTIVE_ITEM(props.projectTree)
  bus.emit('SIDEBAR::new', 'file')
}

const handleRootContextMenu = (event: MouseEvent): void => {
  projectStore.CHANGE_ACTIVE_ITEM(props.projectTree)
  showContextMenu(event, !!clipboard.value)
}

const toggleOpenedFiles = (): void => {
  showOpenedFiles.value = !showOpenedFiles.value
  localStorage.setItem(SHOW_OPENED_FILES_KEY, String(showOpenedFiles.value))
}

const setShowDirectories = (value: boolean): void => {
  showDirectories.value = value
  localStorage.setItem(SHOW_DIRECTORIES_KEY, String(value))
}

const toggleDirectories = (): void => {
  setShowDirectories(!showDirectories.value)
}

const findRow = (pathname: string): HTMLElement | undefined => {
  const key = toRowKey(pathname)
  const row = rowRegistry.get(key)
  if (row) return row
  // Windows paths can differ in case.
  for (const [registered, element] of rowRegistry) {
    if (window.fileUtils.isSamePathSync(registered, key)) return element
  }
  return undefined
}

const scrollRowIntoView = (container: HTMLElement, row: HTMLElement): void => {
  const containerRect = container.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  const scrollTop = computeRevealScrollTop({
    rowTopInContent: rowRect.top - containerRect.top + container.scrollTop,
    rowHeight: rowRect.height,
    viewportHeight: container.clientHeight,
    scrollHeight: container.scrollHeight,
    scrollTop: container.scrollTop
  })
  if (scrollTop !== null) container.scrollTop = scrollTop
}

// Reveals only: the caret, the tree selection and `activeItem` stay untouched.
// `force` (the "Show in Side Bar" command) ignores the preference.
const revealPath = async (
  pathname: string | null | undefined,
  { force = false }: { force?: boolean } = {}
): Promise<void> => {
  if (!pathname) return
  if (!force && !preferencesStore.autoRevealInSidebar) return
  if (!showDirectories.value) {
    if (!force) return
    setShowDirectories(true)
  }
  // Hidden views have no visible row to scroll into view.
  if (!layoutStore.showSideBar || layoutStore.rightColumn !== 'files') return
  if (!projectStore.REVEAL_PATH(pathname)) return

  await nextTick()
  const container = treeWrapper.value
  // Hidden views report a zero-size viewport.
  if (!container || container.offsetParent === null) return

  const row = findRow(pathname)
  if (row) scrollRowIntoView(container, row)
}

const handleRevealPath = (pathname: unknown): void => {
  revealPath(typeof pathname === 'string' ? pathname : null, { force: true })
}

let resizeStartY = 0
let resizeStartHeight = 0

const updateListHeightLimit = (): void => {
  const view = treeView.value
  const list = openedFilesList.value
  if (!view || !list || list.offsetParent === null) return
  const listTop = list.getBoundingClientRect().top - view.getBoundingClientRect().top
  listHeightLimit.value = view.clientHeight - listTop - PROJECT_TREE_RESERVE_PX
}

const treeViewObserver = new ResizeObserver(updateListHeightLimit)

// The list hides via v-show, so toggling it back on never resizes the
// observed tree-view and the stale limit from a hidden window survives.
watch(showOpenedFiles, async () => {
  await nextTick()
  updateListHeightLimit()
})

const requestListHeight = (height: number): void => {
  // The viewport and content clamps are render-only; the persisted request is
  // what the user asked for, so it survives a temporarily small window.
  listHeight.value = Math.max(MIN_LIST_HEIGHT_PX, height)
  localStorage.setItem(OPENED_FILES_HEIGHT_KEY, String(listHeight.value))
}

const handleResizeMove = (event: MouseEvent): void => {
  // Delta off the requested height, not the rendered one: while the viewport
  // clamps the list, a small drag must nudge the request, not replace it with
  // the clamped value.
  requestListHeight(resizeStartHeight + event.clientY - resizeStartY)
}

const stopResize = (): void => {
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

const startResize = (event: MouseEvent): void => {
  resizeStartY = event.clientY
  resizeStartHeight = listHeight.value
  updateListHeightLimit()
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', stopResize)
}

const handleResizeKeydown = (event: KeyboardEvent): void => {
  const step = event.shiftKey ? ROW_HEIGHT_PX * 4 : ROW_HEIGHT_PX
  let next: number | null = null
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = listHeight.value - step
  else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = listHeight.value + step
  else if (event.key === 'Home') next = MIN_LIST_HEIGHT_PX
  else if (event.key === 'End') next = listHeightLimit.value
  if (next === null) return
  event.preventDefault()
  requestListHeight(next)
}

// From createFileOrDirectoryMixins

const handleInputFocus = (): void => {
  nextTick(() => {
    if (input.value) {
      input.value.focus()
    }
  })
}

const handleInputEnter = (): void => {
  projectStore.CREATE_FILE_DIRECTORY(nameInputValue.value)
}

const focusTree = (): void => {
  treeWrapper.value?.focus()
}

// preventDefault stops the browser's default mousedown focus move (to <body>)
// from undoing the focus() call.
const handleTreeMouseDown = (event: MouseEvent): void => {
  if (isEditableTarget(event.target)) return
  if (event.button === 0) event.preventDefault()
  focusTree()
}

// An inline input closing (rename commit / Escape) drops focus to <body>.
const handleTreeFocusOut = (event: FocusEvent): void => {
  if (!isNameInput(event.target)) return
  nextTick(() => {
    if (document.activeElement === document.body) focusTree()
  })
}

const handleDocumentClick = (event: MouseEvent): void => {
  const { target } = event
  if (!target) return
  if (isNameInput(target)) return

  if (isInsideTreeScope(target) && !keepsSidebarSelection(target)) {
    projectStore.CHANGE_ACTIVE_ITEM({})
  }
  projectStore.COMMIT_NAME_INPUT()
}

const handleDocumentContextMenu = (event: MouseEvent): void => {
  const { target } = event
  if (isNameInput(target)) return

  // Right-clicking opens a native menu whose actions read the selection when
  // clicked, so a rename committed here could leave the menu targeting the old
  // path. Cancel the pending input instead (the pre-#3207 behavior); the
  // click-away path above still commits.
  projectStore.CLEAR_NAME_INPUT_STATE()
}

const handleTreeKeydown = (event: KeyboardEvent): void => {
  const { target, key, metaKey } = event
  const editableTarget = isEditableTarget(target)

  if (key === 'Escape') {
    projectStore.CLEAR_NAME_INPUT_STATE()
    projectStore.CHANGE_ACTIVE_ITEM({})
  }

  const isEditingName = !!renameCache.value || !!createCacheDirname.value
  const shouldRename = shouldRenameSelection({
    key,
    selection: activeItem.value,
    projectRootPath: props.projectTree?.pathname,
    pathSeparator: PATH_SEPARATOR,
    isEditingName,
    editableTarget
  })
  if (shouldRename) {
    event.preventDefault()
    event.stopPropagation()
    return bus.emit('SIDEBAR::rename')
  }

  const shouldTrash = shouldTrashSelection({
    key,
    metaKey,
    isMac,
    selection: activeItem.value,
    projectRootPath: props.projectTree?.pathname,
    pathSeparator: PATH_SEPARATOR,
    isEditingName,
    editableTarget
  })
  if (shouldTrash) {
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) bus.emit('SIDEBAR::remove')
    return
  }
}

// The row can arrive after the tab does: opening a project delivers its
// contents incrementally, so every tree change is a new chance to reveal.
watch(
  () => [projectStore.treeVersion, editorStore.currentFile?.pathname] as const,
  ([, pathname]) => {
    revealPath(pathname)
  },
  { flush: 'post' }
)

// The tree stays mounted while the side bar is hidden, so a switch made then
// never scrolled; reveal again as soon as the file list is visible.
watch(
  () => layoutStore.showSideBar && layoutStore.rightColumn === 'files',
  (visible) => {
    if (visible) revealPath(editorStore.currentFile?.pathname)
  },
  { flush: 'post' }
)

onMounted(() => {
  if (treeView.value) treeViewObserver.observe(treeView.value)
  bus.on('SIDEBAR::show-new-input', handleInputFocus)
  bus.on('SIDEBAR::focus-tree', focusTree)
  bus.on('SIDEBAR::reveal-path', handleRevealPath)
  // Capture phase: several click targets (project/collapse headings, editor
  // tabs) call `@click.stop`, which would otherwise keep the click-away commit
  // from running.
  document.addEventListener('click', handleDocumentClick, true)
  document.addEventListener('contextmenu', handleDocumentContextMenu)
  revealPath(editorStore.currentFile?.pathname)
})

onUnmounted(() => {
  treeViewObserver.disconnect()
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', stopResize)
  bus.off('SIDEBAR::show-new-input', handleInputFocus)
  bus.off('SIDEBAR::focus-tree', focusTree)
  bus.off('SIDEBAR::reveal-path', handleRevealPath)
  document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('contextmenu', handleDocumentContextMenu)
})
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.2s;
}
.list-enter, .list-leave-to
  /* .list-leave-active for below version 2.1.8 */ {
  opacity: 0;
  transform: translateX(-50px);
}
.tree-view {
  font-size: 14px;
  color: var(--sideBarColor);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.icon-arrow {
  margin-right: 5px;
  transition: transform 0.25s ease-out;
  transform: rotate(90deg);
  color: var(--sideBarTextColor);
  cursor: pointer;
}

.icon-arrow.fold {
  transform: rotate(0);
}

.opened-files > .title,
.project-tree > .title {
  height: 30px;
  line-height: 30px;
  font-size: 14px;
}

.opened-files .title {
  padding: 0 15px;
  display: flex;
  align-items: center;
}

.opened-files .title > span {
  flex: 1;
}

/* Clipped rather than `display: none` until the header is hovered or holds
   focus, so Tab can still reach the buttons and reveal them. */
.opened-files .title > button {
  color: var(--sideBarColor);
  margin-left: 8px;
  clip-path: inset(50%);
}
.opened-files div.title:hover > button,
.opened-files div.title:focus-within > button {
  clip-path: none;
}

.opened-files div.title > button:hover {
  color: var(--highlightThemeColor);
}
.opened-files {
  display: flex;
  flex-direction: column;
}
.default-cursor {
  cursor: pointer;
}
.opened-files .opened-files-list {
  overflow: auto;
  flex: 1;
}

.opened-files .opened-files-list::-webkit-scrollbar:vertical {
  width: 8px;
}

.opened-files-resize {
  height: 4px;
  flex-shrink: 0;
  cursor: row-resize;
}

.opened-files-resize:hover {
  border-bottom: 2px solid var(--iconColor);
}

.project-tree {
  display: flex;
  flex-direction: column;
  overflow: auto;
  flex: 1;
}

.project-tree > .title {
  padding: 0 15px;
  display: flex;
  align-items: center;
}

.project-tree > .title > span {
  flex: 1;
  user-select: none;
}

.project-tree > .title > a {
  pointer-events: auto;
  cursor: pointer;
  margin-left: 8px;
  color: var(--sideBarIconColor);
  opacity: 0;
}

.project-tree > .title > a:hover {
  color: var(--highlightThemeColor);
}

.project-tree > .title > a.active {
  color: var(--highlightThemeColor);
}

.project-tree > .tree-wrapper {
  overflow: auto;
  flex: 1;
}

.project-tree > .tree-wrapper::-webkit-scrollbar:vertical {
  width: 8px;
}
.project-tree div.title:hover > a {
  opacity: 1;
}
.open-project {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  padding-bottom: 100px;
}

.open-project .centered-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.open-project .el-button {
  margin-top: 20px;
}
.open-project .el-button.is-text.is-has-bg,
.empty-project .el-button.is-text.is-has-bg {
  background-color: var(--buttonPrimaryBgColor);
  color: var(--buttonPrimaryFontColor);
  border-color: transparent;
}
.open-project .el-button.is-text.is-has-bg:hover,
.open-project .el-button.is-text.is-has-bg:focus,
.empty-project .el-button.is-text.is-has-bg:hover,
.empty-project .el-button.is-text.is-has-bg:focus {
  background-color: var(--buttonPrimaryBgColorHover);
  color: var(--buttonPrimaryFontColorHover);
}
.new-input {
  outline: none;
  height: 22px;
  margin: 5px 0;
  padding: 0 6px;
  color: var(--sideBarColor);
  border: 1px solid var(--focusColor);
  background: var(--inputBgColor);
  width: calc(100% - 45px);
  border-radius: 3px;
}
.tree-wrapper {
  position: relative;
}
.tree-wrapper:focus-visible {
  outline: none;
}
.tree-wrapper:focus-within :deep(.side-bar-file.active),
.tree-wrapper:focus-within :deep(.folder-name.active) {
  outline: 1px solid var(--focusColor);
  outline-offset: -1px;
}
.tree-wrapper:not(:focus-within) :deep(.side-bar-file.active),
.tree-wrapper:not(:focus-within) :deep(.folder-name.active) {
  background: color-mix(in srgb, var(--themeColor20) 55%, transparent);
}
.empty-project {
  font-size: 14px;
  display: flex;
  flex-direction: column;
  padding-top: 40px;
  align-items: center;
  color: var(--sideBarTextColor);
  & button {
    margin-top: 10px;
  }
}

.empty-project > a {
  color: var(--highlightThemeColor);
  text-align: center;
  margin-top: 15px;
  text-decoration: none;
}
.bold {
  font-weight: 600;
}
</style>
