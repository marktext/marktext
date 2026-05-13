<template>
  <div
    class="opened-file"
    :title="file.pathname"
    :class="[{ active: currentFile.id === file.id, unsaved: !file.isSaved }]"
    @click="selectFile(file)"
  >
    <svg
      class="icon"
      aria-hidden="true"
      @click.stop="removeFileInTab(file)"
    >
      <use xlink:href="#icon-close-small" />
    </svg>
    <span class="name">{{ file.filename }}</span>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/editor'

defineProps({
  file: {
    type: Object,
    required: true
  }
})

const editorStore = useEditorStore()

const { currentFile } = storeToRefs(editorStore)

const selectFile = (file) => {
  if (file.id !== currentFile.value.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file) => {
  const { isSaved } = file
  if (isSaved) {
    editorStore.FORCE_CLOSE_TAB(file)
  } else {
    editorStore.CLOSE_UNSAVED_TAB(file)
  }
}
</script>

<style scoped>
.opened-file {
  display: flex;
  user-select: none;
  height: 28px;
  line-height: 28px;
  padding-left: 35px;
  position: relative;
  color: var(--sideBarColor);
  & > svg {
    display: none;
    width: 10px;
    height: 10px;
    position: absolute;
    top: 9px;
    left: 10px;
  }
  &:hover > svg {
    display: inline-block;
  }
  &:hover {
    background: var(--sideBarItemHoverBgColor);
  }
  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.opened-file.active {
  color: var(--highlightThemeColor);
}
.unsaved.opened-file::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  position: absolute;
  top: 11px;
  left: 12px;
}
.unsaved.opened-file:hover::before {
  content: none;
}
</style>
