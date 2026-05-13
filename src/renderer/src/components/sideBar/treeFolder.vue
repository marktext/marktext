<template>
  <div class="side-bar-folder">
    <div
      ref="folderEl"
      class="folder-name"
      :style="{ 'padding-left': `${depth * 20 + 20}px` }"
      :class="[{ active: folder.id === activeItem.id }]"
      :title="folder.pathname"
      @click="folderNameClick"
    >
      <svg
        class="icon"
        aria-hidden="true"
      >
        <use :xlink:href="`#${isCollapsed ? 'icon-folder-close' : 'icon-folder-open'}`" />
      </svg>
      <input
        v-if="renameCache === folder.pathname"
        ref="renameInput"
        v-model="newName"
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
        v-model="createName"
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

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/store/project'
import { showContextMenu } from '../../contextMenu/sideBar'
import bus from '../../bus'
import File from './treeFile.vue'

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    required: true
  }
})

const projectStore = useProjectStore()

const createName = ref('')
const newName = ref('')

const folderEl = ref(null)
const renameInput = ref(null)
const input = ref(null)

// Use a local reactive state for isCollapsed that syncs with the prop
const isCollapsed = ref(props.folder.isCollapsed)

const { renameCache } = storeToRefs(projectStore)
const { createCache } = storeToRefs(projectStore)
const { activeItem } = storeToRefs(projectStore)
const { clipboard } = storeToRefs(projectStore)

const handleInputFocus = () => {
  nextTick(() => {
    if (input.value) {
      input.value.focus()
      createName.value = ''
      if (props.folder) {
        isCollapsed.value = false
      }
    }
  })
}

const handleInputEnter = () => {
  projectStore.CREATE_FILE_DIRECTORY(createName.value)
}

const folderNameClick = () => {
  isCollapsed.value = !isCollapsed.value
}

const noop = () => {}

const focusRenameInput = () => {
  nextTick(() => {
    if (renameInput.value) {
      renameInput.value.focus()
      newName.value = props.folder.name
    }
  })
}

const rename = () => {
  if (newName.value) {
    projectStore.RENAME_IN_SIDEBAR(newName.value)
  }
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
    & > svg {
      flex-shrink: 0;
      color: var(--sideBarIconColor);
      margin-right: 5px;
    }
    &:hover {
      background: var(--sideBarItemHoverBgColor);
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
  border: 1px solid var(--floatBorderColor);
  background: var(--floatBorderColor);
  width: 70%;
  border-radius: 3px;
}
</style>
