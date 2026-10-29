<template>
  <div class="editor-tabs">
    <div
      ref="tabContainer"
      class="scrollable-tabs"
    >
      <ul
        ref="tabDropContainer"
        class="tabs-container"
      >
        <li
          v-for="file of tabs"
          :key="file.id"
          :title="file.pathname"
          :aria-label="
            file.isPreview ? t('editor.tabs.preview', { name: file.filename }) : file.filename
          "
          :class="{
            active: currentFile?.id === file.id,
            preview: file.isPreview,
            unsaved: !file.isSaved
          }"
          :data-id="file.id"
          @click.stop="selectFile(file)"
          @click.middle.stop.prevent="removeFileInTab(file)"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <el-icon
            v-if="file.readOnly"
            class="reading-lock"
            :title="t('readingMode.title')"
            :aria-label="t('readingMode.title')"
          >
            <Lock />
          </el-icon>
          <span>{{ file.filename }}</span>
          <span class="unsaved-dot" />
          <button
            type="button"
            class="plain-button close-icon"
            :aria-label="t('editor.tabs.close', { name: file.filename })"
            @click.stop="removeFileInTab(file)"
          >
            <el-icon :size="12">
              <Close />
            </el-icon>
          </button>
        </li>
      </ul>
    </div>
    <icon-tooltip :content="t('menu.file.newTab')">
      <button
        type="button"
        class="plain-button new-file"
        :aria-label="t('menu.file.newTab')"
        @click.stop="newFile()"
      >
        <el-icon :size="16">
          <Plus />
        </el-icon>
      </button>
    </icon-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'
import { useTabReorder } from '../useTabReorder'
import { Plus, Close, Lock } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import IconTooltip from '@/components/iconTooltip/index.vue'
import { showContextMenu } from '../../contextMenu/tabs'
import type { IFileState } from '@shared/types/files'

const { t } = useI18n()
const editorStore = useEditorStore()

const { currentFile, tabs } = storeToRefs(editorStore)

const tabContainer = ref<HTMLElement | null>(null)
const tabDropContainer = ref<HTMLElement | null>(null)
useTabReorder(tabDropContainer, tabContainer, 'horizontal')

const selectFile = (file: IFileState) => {
  if (file.id !== currentFile.value?.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file: IFileState) => {
  editorStore.CLOSE_TAB(file)
}

const newFile = () => {
  editorStore.NEW_UNTITLED_TAB({})
}

// Keep the active tab visible when the selection changes by something other
// than a direct click on a visible tab (keyboard cycle, switch-by-index, open
// from the sidebar): the strip has `overflow: hidden` and only scrolls on the
// wheel, so an off-screen tab would otherwise stay hidden (#3958).
const scrollActiveTabIntoView = () => {
  const container = tabContainer.value
  if (!container) return
  const activeTab = container.querySelector<HTMLElement>('li.active')
  if (!activeTab) return

  const containerRect = container.getBoundingClientRect()
  const tabRect = activeTab.getBoundingClientRect()
  if (tabRect.left < containerRect.left) {
    container.scrollLeft -= containerRect.left - tabRect.left
  } else if (tabRect.right > containerRect.right) {
    container.scrollLeft += tabRect.right - containerRect.right
  }
}

const handleTabScroll = (event: WheelEvent) => {
  // Use mouse wheel value first but prioritize X value more (e.g. touchpad input).
  let delta = event.deltaY
  if (event.deltaX !== 0) {
    delta = event.deltaX
  }

  const tabsEl = tabContainer.value
  if (!tabsEl) return
  const newLeft = Math.max(0, Math.min(tabsEl.scrollLeft + delta, tabsEl.scrollWidth))
  tabsEl.scrollLeft = newLeft
}

const handleContextMenu = (event: MouseEvent, tab: IFileState) => {
  if (tab.id) {
    showContextMenu(event, tab)
  }
}

watch(
  () => currentFile.value?.id,
  () => {
    nextTick(scrollActiveTabIntoView)
  }
)

onMounted(() => {
  tabContainer.value?.addEventListener('wheel', handleTabScroll)
})

onBeforeUnmount(() => {
  tabContainer.value?.removeEventListener('wheel', handleTabScroll)
})
</script>

<style scoped>
.reading-lock {
  margin-inline-end: 6px;
  flex-shrink: 0;
}

/* Padding widens the hit area and keeps the inset focus ring off the glyph. */
.close-icon {
  padding: 2px;
  border-radius: 4px;
  transition:
    opacity 0.15s ease-in-out,
    background-color 0.15s ease-in-out;
}

.close-icon:hover {
  color: var(--focusColor);
  background-color: var(--floatHoverColor);
}

.editor-tabs {
  position: relative;
  display: flex;
  flex-direction: row;
  height: 28px;
  user-select: none;
  box-shadow: 0px 0px 9px 2px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  &:hover > .new-file {
    opacity: 1 !important;
  }
}
.scrollable-tabs {
  flex: 0 1 auto;
  height: 28px;
  overflow: hidden;
}
.tabs-container {
  min-width: min-content;
  list-style: none;
  margin: 0;
  padding: 0;
  height: 28px;
  position: relative;
  display: flex;
  flex-direction: row;
  overflow-y: hidden;
  z-index: 2;
  &::-webkit-scrollbar:horizontal {
    display: none;
  }
  & > li {
    transition: all 0.15s ease-in-out;
    position: relative;
    padding: 0 28px 0 8px;
    cursor: pointer;
    color: var(--editorColor50);
    font-size: 12px;
    line-height: 28px;
    height: 28px;
    max-width: 280px;
    display: flex;
    align-items: center;
    &[aria-grabbed='true'] {
      color: var(--editorColor30) !important;
    }
    & > .close-icon {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      margin: 0;
      box-sizing: border-box;
      opacity: 0;
    }
    &:focus {
      outline: none;
    }
    &:hover {
      background: var(--floatBgColor) !important;
    }
    &:hover > .close-icon,
    & > .close-icon:focus-visible {
      opacity: 1;
    }
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    & > .unsaved-dot {
      display: none;
      position: absolute;
      top: 11px;
      right: 11px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--themeColor);
      flex-shrink: 0;
    }
  }
  & > li.unsaved {
    & > .close-icon {
      opacity: 0;
    }
    & > .unsaved-dot {
      display: block;
    }
    &:has(> .close-icon:hover) > .close-icon,
    & > .close-icon:focus-visible {
      opacity: 1;
    }
    &:has(> .close-icon:hover) > .unsaved-dot,
    &:focus-within > .unsaved-dot {
      visibility: hidden;
    }
  }
  & > li.active {
    background: var(--itemBgColor);
    z-index: 3;
    &:after {
      content: '';
      position: absolute;
      left: 0;
      bottom: 0;
      right: 0;
      height: 2px;
      background: var(--themeColor);
    }
  }
  & > li.preview > span {
    font-style: italic;
  }
}
.editor-tabs > .new-file {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-right: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-around;
  cursor: pointer;
  color: var(--editorColor50);
  opacity: 0;
  &.always-visible,
  &:focus-visible {
    opacity: 1;
  }
}

.editor-tabs > .new-file:hover {
  transition: all 0.15s ease-in-out;
  & > svg {
    fill: var(--focusColor);
  }
}

</style>
