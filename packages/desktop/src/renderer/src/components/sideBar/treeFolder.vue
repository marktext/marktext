<template>
  <div class="side-bar-folder">
    <div
      ref="folderEl"
      class="folder-name"
      :style="{ 'padding-left': `${depth * 6 + 10}px` }"
      :class="[{ active: folder.id === activeItem.id }]"
      :title="folder.pathname"
      @click="folderNameClick"
    >
      <el-icon
        class="icon-arrow"
        :class="{ fold: isCollapsed }"
        :size="12"
      >
        <ArrowRight />
      </el-icon>
      <input
        v-if="renameCache === folder.pathname"
        ref="renameInput"
        v-model="nameInputValue"
        type="text"
        class="rename"
        @click.stop="noop"
        @keypress.enter="rename"
      >
      <span
        v-else
        class="text-overflow"
      >{{ folder.name }}</span>
    </div>
    <div
      v-if="!isCollapsed"
      class="folder-contents"
    >
      <tree-folder
        v-for="childFolder of folder.folders"
        :key="childFolder.id"
        :folder="childFolder"
        :depth="depth + 1"
      />
      <input
        v-if="createCache.dirname === folder.pathname"
        ref="input"
        v-model="nameInputValue"
        type="text"
        class="new-input"
        :style="{ 'margin-left': `${depth * 5 + 15}px` }"
        @keypress.enter="handleInputEnter"
      >
      <File
        v-for="file of folder.files"
        :key="file.id"
        :file="file"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/store/project'
import { showContextMenu } from '../../contextMenu/sideBar'
import bus from '../../bus'
import File from './treeFile.vue'
import { ArrowRight } from '@element-plus/icons-vue'
import type { TreeFolderNode } from './types'

const props = defineProps<{
  folder: TreeFolderNode
  depth: number
}>()

const projectStore = useProjectStore()

const folderEl = ref<HTMLDivElement | null>(null)
const renameInput = ref<HTMLInputElement | null>(null)
const input = ref<HTMLInputElement | null>(null)

// Kept on the tree node, not locally: the Files view is under a v-if and
// remounts on every sidebar view switch (#5631).
const isCollapsed = computed<boolean>({
  get: () => !!props.folder.isCollapsed,
  set: (value) => {
    projectStore.SET_FOLDER_COLLAPSED(props.folder, value)
  }
})

const { renameCache } = storeToRefs(projectStore)
const { createCache } = storeToRefs(projectStore)
const { nameInputValue } = storeToRefs(projectStore)
const { activeItem } = storeToRefs(projectStore)
const { clipboard } = storeToRefs(projectStore)

const handleInputFocus = (): void => {
  // Only the folder that is the create target reacts. Expand it FIRST so the
  // create input renders even when the folder was collapsed, then focus it on
  // the next tick — previously the expand sat behind `if (input.value)`, which
  // is null while collapsed, so New File on a collapsed folder did nothing
  // (#3439).
  if (createCache.value.dirname !== props.folder.pathname) return
  isCollapsed.value = false
  nextTick(() => {
    if (input.value) {
      input.value.focus()
    }
  })
}

const handleInputEnter = (): void => {
  projectStore.CREATE_FILE_DIRECTORY(nameInputValue.value)
}

const folderNameClick = (): void => {
  projectStore.CHANGE_ACTIVE_ITEM(props.folder)
  isCollapsed.value = !isCollapsed.value
}

const noop = (): void => {}

const focusRenameInput = (): void => {
  // The `v-if` input mounts on the next tick; the store seeds its value.
  nextTick(() => {
    if (!renameInput.value) return
    renameInput.value.focus()
    renameInput.value.setSelectionRange(0, props.folder.name.length)
  })
}

const rename = (): void => {
  projectStore.RENAME_IN_SIDEBAR(nameInputValue.value)
}

onMounted(() => {
  if (folderEl.value) {
    folderEl.value.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      projectStore.CHANGE_ACTIVE_ITEM(props.folder)
      showContextMenu(event, !!clipboard.value)
    })
  }
  bus.on('SIDEBAR::show-new-input', handleInputFocus)
  bus.on('SIDEBAR::show-rename-input', focusRenameInput)
})
</script>

<style scoped>
.side-bar-folder {
  & > .folder-name {
    cursor: default;
    user-select: none;
    display: flex;
    align-items: center;
    height: 30px;
    padding-right: 15px;
    & > .icon-arrow {
      flex-shrink: 0;
      color: var(--sideBarIconColor);
      margin-right: 5px;
      transition: transform 0.25s ease-out;
      transform: rotate(90deg);
    }
    & > .icon-arrow.fold {
      transform: rotate(0);
    }
    &:hover {
      background: var(--sideBarItemHoverBgColor);
    }
    /* After :hover so the selection stays visible while the pointer is over it. */
    &.active {
      background: var(--themeColor20);
    }
  }
}
.new-input,
input.rename {
  outline: none;
  height: 22px;
  margin: 5px 0;
  padding: 0 6px;
  color: var(--sideBarColor);
  border: 1px solid var(--focusColor);
  background: var(--floatBorderColor);
  width: 70%;
  border-radius: 3px;
}
</style>
