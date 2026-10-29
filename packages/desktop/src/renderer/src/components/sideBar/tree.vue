<template>
  <div
    ref="treeView"
    class="tree-view"
  >
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
        ref="resizeHandle"
        class="opened-files-resize"
        role="separator"
        aria-orientation="horizontal"
        :aria-label="t('sideBar.tree.resizeOpenedFiles')"
        :aria-valuenow="openedFilesMaxHeight"
        :aria-valuemin="minimumHeight"
        :aria-valuemax="maximumHeight"
        tabindex="0"
        @pointerdown="startResize"
        @pointermove="handleResizeMove"
        @pointerup="handleResizeEnd"
        @pointercancel="handleResizeEnd"
        @lostpointercapture="handleResizeEnd"
        @keydown="handleResizeKeydown"
      />
    </div>

    <div
      ref="treeWrapper"
      class="project-trees tree-wrapper"
      :class="{ 'no-project': !roots.length }"
      tabindex="0"
      @mousedown="handleTreeMouseDown"
      @focusout="handleTreeFocusOut"
      @keydown="handleTreeKeydown"
    >
      <div
        v-for="root in roots"
        :key="root.key"
        class="project-tree"
      >
        <div
          :ref="
            (el) => {
              if (el) rootRows.set(root.key, el as HTMLElement)
            }
          "
          class="title project-root"
          role="button"
          tabindex="0"
          :title="root.error || root.pathname"
          :aria-expanded="!root.tree.isCollapsed"
          @click.stop="toggleRoot(root)"
          @contextmenu.prevent="handleRootContextMenu($event, root)"
          @keydown="handleRootKeydown($event, root)"
        >
          <el-icon
            class="icon-arrow"
            :class="{ fold: root.tree.isCollapsed }"
            :size="12"
          >
            <ArrowRight />
          </el-icon>
          <span class="text-overflow">{{ projectStore.ROOT_LABEL(root) }}</span>
        </div>
        <div
          v-show="!root.tree.isCollapsed"
          class="tree-contents"
        >
          <div
            v-if="root.status !== 'ready'"
            class="root-status"
            role="status"
          >
            {{
              t(
                root.status === 'loading'
                  ? 'sideBar.tree.loadingFolder'
                  : 'sideBar.tree.unavailableFolder'
              )
            }}
          </div>
          <folder
            v-for="folder of root.tree.folders"
            :key="folder.id"
            :folder="folder"
            :depth="depth"
          />
          <input
            v-if="createCacheDirname === root.pathname"
            :ref="
              (el) => {
                if (el) input = el as HTMLInputElement
              }
            "
            v-model="nameInputValue"
            type="text"
            class="new-input"
            :style="{ 'margin-left': `${depth * 5 + 15}px` }"
            @keypress.enter="handleInputEnter"
          >
          <file
            v-for="file of root.tree.files"
            :key="file.id"
            :file="file"
            :depth="depth"
          />
          <div
            v-if="
              root.status === 'ready' &&
                !root.tree.files.length &&
                !root.tree.folders.length &&
                createCacheDirname !== root.pathname
            "
            class="empty-project"
          >
            <span>{{ t('sideBar.tree.emptyProject') }}</span>
            <div class="centered-group">
              <button
                class="button-primary"
                @click.stop="createFile(root)"
              >
                {{ t('sideBar.tree.createFile') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="!roots.length"
        class="open-project"
      >
        <div class="centered-group">
          <el-button
            text
            bg
            type="primary"
            @click="projectStore.ASK_FOR_OPEN_PROJECT()"
          >
            {{ t('sideBar.tree.openFolder') }}
          </el-button>
        </div>
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
import { MIN_VISIBLE_ROWS, useOpenedFilesResize } from './useOpenedFilesResize'
import { useTabReorder } from '../useTabReorder'
import IconTooltip from '@/components/iconTooltip/index.vue'
import bus from '../../bus'
import { showRootContextMenu } from '../../contextMenu/sideBar'
import type { RootView } from '@/store/project'
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
import type { TabDescriptor } from './types'

const { t } = useI18n()

const props = defineProps<{ tabs?: TabDescriptor[] }>()

const depth = 0

const input = ref<HTMLInputElement | null>(null)
const treeWrapper = ref<HTMLDivElement | null>(null)

const rootRows = new Map<string, HTMLElement>()
const rowRegistry: TreeRowRegistry = new Map()
provide(TREE_ROW_REGISTRY_KEY, rowRegistry)

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const showOpenedFiles = computed({
  get: () => layoutStore.openedFilesExpanded,
  set: (expanded) => layoutStore.SET_OPENED_FILES({ expanded })
})
const preferencesStore = usePreferencesStore()

const { roots, createCache } = storeToRefs(projectStore)
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

const {
  treeView,
  openedFilesList,
  resizeHandle,
  openedFilesMaxHeight,
  minimumHeight,
  maximumHeight,
  startResize,
  handleResizeMove,
  handleResizeEnd,
  handleResizeKeydown
} = useOpenedFilesResize(
  tabCount,
  computed(
    () =>
      openedFilesInSidebar.value &&
      showOpenedFiles.value &&
      layoutStore.showSideBar &&
      layoutStore.rightColumn === 'files'
  ),
  {
        preferredHeight: computed({
          get: () => layoutStore.openedFilesHeight,
          set: (preferredHeightPx) => layoutStore.SET_OPENED_FILES({ preferredHeightPx })
        }),
        persist: (preferredHeightPx) => layoutStore.SET_OPENED_FILES({ preferredHeightPx })
  }
)

useTabReorder(openedFilesList, openedFilesList, 'vertical')

const saveAll = (isClose: boolean): void => {
  editorStore.ASK_FOR_SAVE_ALL(isClose)
}

const createFile = (root: RootView): void => {
  projectStore.CHANGE_ACTIVE_ITEM(root.tree)
  bus.emit('SIDEBAR::new', 'file')
}

const toggleRoot = (root: RootView): void => {
  projectStore.CHANGE_ACTIVE_ITEM(root.tree)
  projectStore.SET_FOLDER_COLLAPSED(root.tree, !root.tree.isCollapsed)
}

const handleRootContextMenu = (
  event: { clientX: number; clientY: number },
  root: RootView
): void => {
  projectStore.CHANGE_ACTIVE_ITEM(root.tree)
  showRootContextMenu(
    event,
    !!clipboard.value,
    root.status === 'ready',
    () => {
      void window.electron.ipcRenderer.invoke('mt::project-remove-root', root.key)
    },
    () => {
      void window.electron.ipcRenderer.invoke('mt::project-retry-root', root.key)
    }
  )
}

const handleRootKeydown = (event: KeyboardEvent, root: RootView): void => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    toggleRoot(root)
  } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    event.preventDefault()
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    handleRootContextMenu({ clientX: rect.left, clientY: rect.bottom }, root)
  }
}

const focusRoot = (key: unknown): void => {
  const row = typeof key === 'string' ? rootRows.get(key) : undefined
  if (row?.isConnected) row.focus()
  else document.querySelector<HTMLButtonElement>('.side-bar .add-folder-button')?.focus()
}

const toggleOpenedFiles = (): void => {
  showOpenedFiles.value = !showOpenedFiles.value
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
  // Initial restoration keeps deliberate folds until the user navigates to another tab.
  if (!force && projectStore.restoringSession) return
  if (!force && !preferencesStore.autoRevealInSidebar) return
  const root = projectStore.FIND_ROOT(pathname)
  if (!root || root.status !== 'ready') return
  if (root.tree.isCollapsed) {
    if (!force) return
    projectStore.SET_FOLDER_COLLAPSED(root.tree, false)
  }
  // Hidden views have no visible row to scroll into view.
  if (!layoutStore.showSideBar || layoutStore.rightColumn !== 'files') return
  if (!projectStore.REVEAL_PATH(pathname)) return

  await nextTick()
  const container = treeWrapper.value
  // Hidden views report a zero-size viewport.
  if (!container || container.offsetParent === null) return

  const row = findRow(projectStore.TREE_PATH(pathname))
  if (row) scrollRowIntoView(container, row)
}

const handleRevealPath = (pathname: unknown): void => {
  revealPath(typeof pathname === 'string' ? pathname : null, { force: true })
}

const handleInputFocus = (): void => {
  const root = roots.value.find((root) => root.pathname === createCacheDirname.value)
  if (root) projectStore.SET_FOLDER_COLLAPSED(root.tree, false)
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
    projectRootPath: projectStore.FIND_ROOT(activeItem.value?.pathname || '')?.pathname,
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
    projectRootPath: projectStore.FIND_ROOT(activeItem.value?.pathname || '')?.pathname,
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
  bus.on('SIDEBAR::focus-root', focusRoot)
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
  bus.off('SIDEBAR::focus-root', focusRoot)
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
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.default-cursor {
  cursor: pointer;
}
.opened-files .opened-files-list {
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1;
}

.opened-files .opened-files-list::-webkit-scrollbar:vertical {
  width: 8px;
}

.opened-files-resize {
  height: 4px;
  flex-shrink: 0;
  cursor: row-resize;
  touch-action: none;
  user-select: none;
}

.opened-files-resize:hover,
.opened-files-resize:focus-visible {
  background: var(--iconColor);
}

.opened-files-resize:focus-visible {
  outline: 1px solid var(--focusColor);
  outline-offset: -1px;
}

.project-trees {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.project-trees.no-project {
  display: flex;
  flex-direction: column;
}
.project-tree {
  display: flex;
  flex-direction: column;
}
.project-root {
  cursor: pointer;
}
.project-root:focus-visible {
  outline: 1px solid var(--focusColor);
  outline-offset: -1px;
}
.root-status {
  padding: 8px 15px;
  color: var(--sideBarTextColor);
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
