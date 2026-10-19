<template>
  <div
    class="opened-file"
    :title="file.pathname"
    :class="[{ active: currentFile?.id === file.id, unsaved: !file.isSaved }]"
    @click="selectFile(file)"
  >
    <button
      type="button"
      class="plain-button close-icon"
      :aria-label="t('editor.tabs.close', { name: file.filename })"
      @click.stop="removeFileInTab(file)"
    >
      <el-icon :size="10">
        <Close />
      </el-icon>
    </button>
    <span class="name">{{ file.filename }}</span>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { Close } from '@element-plus/icons-vue'
import type { TabDescriptor } from './types'

defineProps<{
  file: TabDescriptor
}>()

const { t } = useI18n()
const editorStore = useEditorStore()

const { currentFile } = storeToRefs(editorStore)

const selectFile = (file: TabDescriptor): void => {
  if (file.id !== currentFile.value?.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file: TabDescriptor): void => {
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
  /* Clipped rather than `display: none` while the row is not hovered, so the
     button stays reachable with Tab and shows itself once focused. */
  & > .close-icon {
    position: absolute;
    top: 2px;
    left: 3px;
    width: 24px;
    height: 24px;
    clip-path: inset(50%);
  }
  &:hover > .close-icon,
  & > .close-icon:focus-visible {
    clip-path: none;
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
.unsaved.opened-file:hover::before,
.unsaved.opened-file:focus-within::before {
  content: none;
}
</style>
