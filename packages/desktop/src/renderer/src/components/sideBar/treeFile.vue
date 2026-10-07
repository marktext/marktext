<template>
  <div
    ref="fileEl"
    :title="file.pathname"
    class="side-bar-file"
    :style="{ 'padding-left': `${depth * 6 + 10}px`, opacity: file.isMarkdown ? 1 : 0.75 }"
    :class="[
      { current: currentFile?.pathname === file.pathname, active: file.id === activeItem.id }
    ]"
    @click="handleFileClick"
    @dblclick="handleFileDblClick"
  >
    <file-icon :name="file.name" />
    <input
      v-if="renameCache === file.pathname"
      ref="renameInput"
      v-model="newName"
      type="text"
      class="rename"
      @click.stop="noop"
      @keypress.enter="rename"
    >
    <span v-else>{{ file.name }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'
import FileIcon from './icon.vue'
import { showContextMenu } from '../../contextMenu/sideBar'
import bus from '../../bus'
import { renameSelectionEnd } from './renameKey'
import type { TreeFileNode } from './types'

const props = defineProps<{
  file: TreeFileNode
  depth: number
}>()

const projectStore = useProjectStore()
const editorStore = useEditorStore()

const newName = ref('')
const fileEl = ref<HTMLDivElement | null>(null)
const renameInput = ref<HTMLInputElement | null>(null)

const { renameCache } = storeToRefs(projectStore)
const { activeItem } = storeToRefs(projectStore)
const { clipboard } = storeToRefs(projectStore)
const { currentFile, tabs } = storeToRefs(editorStore)

// from fileMixins
const handleFileClick = (event: MouseEvent): void => {
  // Select before the open-file branch runs, so non-markdown rows select too.
  projectStore.CHANGE_ACTIVE_ITEM(props.file)
  // The second click of a double-click must not re-issue the open request; the
  // dblclick handler upgrades the open that the first click already started.
  if (event.detail === 2) return
  const { isMarkdown, pathname } = props.file
  if (!isMarkdown) return
  const openedTab = tabs.value.find((f) => window.fileUtils.isSamePathSync(f.pathname, pathname))
  if (openedTab) {
    if (currentFile.value?.pathname === openedTab.pathname) {
      return
    }
    editorStore.UPDATE_CURRENT_FILE(openedTab)
    // Restoring the target tab's caret can pull DOM focus into the editor;
    // ask the tree to take it back so the keyboard scope stays here.
    bus.emit('SIDEBAR::focus-tree')
  } else {
    // Keep DOM focus in the tree; the double-click handler hands it to the
    // editor when the user wants to start typing.
    window.electron.ipcRenderer.send('mt::open-file', pathname, { preserveFocus: true })
  }
}

const handleFileDblClick = (): void => {
  if (!props.file.isMarkdown) return
  editorStore.FOCUS_FILE(props.file.pathname)
}

const noop = (): void => {}

const focusRenameInput = (): void => {
  newName.value = props.file.name
  // The `v-if` input mounts on the next tick; selecting before that hits an
  // empty box, and the value must be set first so the range matches the DOM.
  nextTick(() => {
    if (!renameInput.value) return
    renameInput.value.focus()
    renameInput.value.setSelectionRange(0, renameSelectionEnd(props.file.name))
  })
}

const rename = (): void => {
  if (newName.value) {
    projectStore.RENAME_IN_SIDEBAR(newName.value)
  }
}

onMounted(() => {
  if (fileEl.value) {
    fileEl.value.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      projectStore.CHANGE_ACTIVE_ITEM(props.file)
      showContextMenu(event, !!clipboard.value)
    })
  }

  bus.on('SIDEBAR::show-rename-input', focusRenameInput)
})
</script>

<style scoped>
.side-bar-file {
  display: flex;
  position: relative;
  align-items: center;
  cursor: default;
  user-select: none;
  height: 30px;
  box-sizing: border-box;
  padding-right: 15px;
  &:hover {
    background: var(--sideBarItemHoverBgColor);
  }
  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &::before {
    content: '';
    position: absolute;
    display: block;
    left: 0;
    background: var(--themeColor);
    width: 2px;
    height: 0;
    top: 50%;
    transform: translateY(-50%);
    transition: all 0.2s ease;
  }
}
.side-bar-file.current::before {
  height: 100%;
}
.side-bar-file.current > span {
  color: var(--themeColor);
}
/* After :hover so the selection stays visible while the pointer is over it. */
.side-bar-file.active {
  background: var(--themeColor20);
}
.side-bar-file.active > span {
  color: var(--sideBarTitleColor);
}
input.rename {
  height: 22px;
  outline: none;
  margin: 5px 0;
  padding: 0 8px;
  color: var(--sideBarColor);
  border: 1px solid var(--focusColor);
  background: var(--floatBorderColor);
  width: 100%;
  border-radius: 3px;
}
</style>
