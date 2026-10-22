<template>
  <div
    class="opened-file"
    :title="file.pathname"
    :aria-label="file.isPreview ? t('editor.tabs.preview', { name: file.filename }) : file.filename"
    :class="[
      {
        active: currentFile?.id === file.id,
        preview: file.isPreview,
        unsaved: !file.isSaved
      }
    ]"
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
  /* The section chevron is inset 15px and 12px wide; both row indicators
     share its center line. */
  --indicator-center: 21px;
  display: flex;
  user-select: none;
  height: 28px;
  line-height: 28px;
  padding: 0 15px 0 35px;
  position: relative;
  color: var(--sideBarColor);
  /* Clipped rather than `display: none` while the row is not hovered, so the
     button stays reachable with Tab and shows itself once focused. */
  & > .close-icon {
    position: absolute;
    top: 4px;
    left: calc(var(--indicator-center) - 10px);
    width: 20px;
    height: 20px;
    border-radius: 4px;
    opacity: 0;
    transition:
      opacity 0.15s ease-in-out,
      background-color 0.15s ease-in-out;
  }
  &:hover > .close-icon,
  & > .close-icon:focus-visible {
    opacity: 1;
  }
  & > .close-icon:hover {
    color: var(--focusColor);
    background-color: var(--floatHoverColor);
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
.opened-file.preview > .name {
  font-style: italic;
}
.unsaved.opened-file > .close-icon {
  opacity: 0;
}
.unsaved.opened-file::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  position: absolute;
  top: 50%;
  left: calc(var(--indicator-center) - 3.5px);
  transform: translateY(-50%);
}
.unsaved.opened-file:has(> .close-icon:hover) > .close-icon,
.unsaved.opened-file > .close-icon:focus-visible {
  opacity: 1;
}
.unsaved.opened-file:has(> .close-icon:hover)::before,
.unsaved.opened-file:focus-within::before {
  visibility: hidden;
}
</style>
