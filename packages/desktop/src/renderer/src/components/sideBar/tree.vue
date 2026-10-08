<template>
  <div class="tree-view">
    <div class="title">
      <!-- Placeholder -->
    </div>

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
        <a
          href="javascript:;"
          :title="t('sideBar.tree.saveAll')"
          @click.stop="saveAll(false)"
        >
          <svg
            class="icon"
            aria-hidden="true"
          >
            <use xlink:href="#icon-save-all" />
          </svg>
        </a>
        <a
          href="javascript:;"
          :title="t('sideBar.tree.closeAll')"
          @click.stop="saveAll(true)"
        >
          <svg
            class="icon"
            aria-hidden="true"
          >
            <use xlink:href="#icon-close-all" />
          </svg>
        </a>
      </div>
      <div
        v-show="showOpenedFiles"
        class="opened-files-list"
      >
        <transition-group name="list">
          <opened-file
            v-for="tab of tabs"
            :key="tab.id"
            :file="tab"
          />
        </transition-group>
      </div>
    </div>

    <!-- Project tree view -->
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
  // The project store seeds `projectTree` as `null` until a folder is
  // opened; the template renders the "open project" empty-state behind
  // `v-if="projectTree"`. Type the prop nullable to match runtime + the
  // template guard.
  projectTree: TreeNode | null
  openedFiles?: TabDescriptor[]
  tabs?: TabDescriptor[]
}>()

const depth = 0
// Persist the section collapse state (#2421). The tree is rendered under a
// v-if and is destroyed when the sidebar collapses to its icon strip, so local
// refs reset to expanded on re-open. Back them with localStorage (like the
// sidebar width) so the state survives a re-mount and app restart.
const SHOW_DIRECTORIES_KEY = 'side-bar-show-directories'
const SHOW_OPENED_FILES_KEY = 'side-bar-show-opened-files'
const readSectionExpanded = (key: string): boolean => localStorage.getItem(key) !== 'false'
const showDirectories = ref(readSectionExpanded(SHOW_DIRECTORIES_KEY))
const showOpenedFiles = ref(readSectionExpanded(SHOW_OPENED_FILES_KEY))
const input = ref<HTMLInputElement | null>(null)
const treeWrapper = ref<HTMLDivElement | null>(null)

const rowRegistry: TreeRowRegistry = new Map()
provide(TREE_ROW_REGISTRY_KEY, rowRegistry)

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const preferencesStore = usePreferencesStore()

// Computed properties
const { createCache } = storeToRefs(projectStore)
const { clipboard } = storeToRefs(projectStore)
const { activeItem } = storeToRefs(projectStore)
const { renameCache } = storeToRefs(projectStore)
const { nameInputValue } = storeToRefs(projectStore)
const { openedFilesInSidebar } = storeToRefs(preferencesStore)

// The createCache state is `{ dirname, type }` while an input is shown, and
// `{}` otherwise. Expose a typed accessor for the template so we don't have
// to thread `as any` through every comparison.
const createCacheDirname = computed<string | undefined>(() => {
  const cache = createCache.value as { dirname?: string }
  return cache.dirname
})

// Methods
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
  // Off screen (icon strip, View menu) there is nothing to reveal.
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
    return bus.emit('SIDEBAR::remove')
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
  bus.off('SIDEBAR::show-new-input', handleInputFocus)
  bus.off('SIDEBAR::focus-tree', focusTree)
  bus.off('SIDEBAR::reveal-path', handleRevealPath)
  document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('contextmenu', handleDocumentContextMenu)
})
</script>

<style scoped>
.list-item {
  display: inline-block;
  margin-right: 10px;
}

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
.tree-view > .title {
  height: 35px;
  line-height: 35px;
  padding: 0 15px;
  display: flex;
  flex-shrink: 0;
  flex-direction: row-reverse;
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
  padding-right: 15px;
  display: flex;
  align-items: center;
}

.opened-files .title > span {
  flex: 1;
}

.opened-files .title > a {
  display: none;
  text-decoration: none;
  color: var(--sideBarColor);
  margin-left: 8px;
}
.opened-files div.title:hover > a,
.opened-files div.title > a:hover {
  display: block;
}

.opened-files div.title:hover > a:hover,
.opened-files div.title > a:hover:hover {
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
  max-height: 112px;
  overflow: auto;
  flex: 1;
}

.opened-files .opened-files-list::-webkit-scrollbar:vertical {
  width: 8px;
}

.project-tree {
  display: flex;
  flex-direction: column;
  overflow: auto;
  flex: 1;
}

.project-tree > .title {
  padding-right: 15px;
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
