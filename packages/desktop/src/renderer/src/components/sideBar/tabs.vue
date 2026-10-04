<template>
  <div class="side-bar-tabs">
    <div class="title">
      <span>{{ t('sideBar.tabs.title') }}</span>
      <el-icon
        class="new-file"
        :size="16"
        @click.stop="newFile()"
      >
        <Plus />
      </el-icon>
    </div>
    <ul
      ref="tabList"
      class="tab-list"
    >
      <li
        v-for="file of tabs"
        :key="file.id"
        :title="file.pathname ?? undefined"
        :class="{ active: currentFile?.id === file.id, unsaved: !file.isSaved }"
        :data-id="file.id"
        @click.stop="selectFile(file)"
        @click.middle="editorStore.CLOSE_TAB(file)"
        @contextmenu.prevent="showContextMenu($event, file)"
      >
        <span class="name">{{ file.filename }}</span>
        <span class="unsaved-dot" />
        <el-icon
          class="close-icon"
          :size="12"
          @click.stop="removeFileInTab(file)"
        >
          <Close />
        </el-icon>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import dragula from 'dragula'
import { Plus, Close } from '@element-plus/icons-vue'
import { useEditorStore } from '@/store/editor'
import { showContextMenu } from '../../contextMenu/tabs'
import type { IFileState } from '@shared/types/files'

// Same click-vs-drag threshold as the horizontal tab bar (#4895).
const DRAG_THRESHOLD_PX = 5

const { t } = useI18n()
const editorStore = useEditorStore()
const { currentFile, tabs } = storeToRefs(editorStore)

const tabList = ref<HTMLElement | null>(null)
let drake: dragula.Drake | null = null

const selectFile = (file: IFileState): void => {
  if (file.id !== currentFile.value?.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file: IFileState): void => {
  if (file.isSaved) {
    editorStore.FORCE_CLOSE_TAB(file)
  } else {
    editorStore.CLOSE_UNSAVED_TAB(file)
  }
}

const newFile = (): void => {
  editorStore.NEW_UNTITLED_TAB({})
}

watch(
  () => currentFile.value?.id,
  () => {
    nextTick(() => {
      tabList.value?.querySelector<HTMLElement>('li.active')?.scrollIntoView({ block: 'nearest' })
    })
  }
)

onMounted(() => {
  if (!tabList.value) return
  drake = dragula([tabList.value], {
    direction: 'vertical',
    revertOnSpill: true,
    mirrorContainer: tabList.value,
    ignoreInputTextSelection: false,
    slideFactorX: DRAG_THRESHOLD_PX,
    slideFactorY: DRAG_THRESHOLD_PX
  }).on('drop', (el, _target, _source, sibling) => {
    const droppedId = el?.getAttribute('data-id')
    // `sibling` is the row the tab was dropped before; it is null or dragula's
    // mirror element when dropped at the end of the list.
    const nextTabId = sibling ? sibling.getAttribute('data-id') : null
    const isLastTab = !sibling || sibling.classList.contains('gu-mirror')
    if (!droppedId || (sibling && !isLastTab && !nextTabId)) {
      console.error('Tab reorder error: invalid tab IDs')
      return
    }

    editorStore.EXCHANGE_TABS_BY_ID({
      fromId: droppedId,
      toId: isLastTab ? null : nextTabId
    })
  })
})

onBeforeUnmount(() => {
  drake?.destroy()
})
</script>

<style scoped>
.side-bar-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--sideBarTitleColor);
  font-weight: 600;
  font-size: 16px;
  margin: 37px 0 10px 0;
  padding: 0 15px 0 25px;
  flex-shrink: 0;
}

.title > .new-file {
  cursor: pointer;
  color: var(--sideBarIconColor);
}

.title > .new-file:hover {
  color: var(--themeColor);
}

.tab-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  & > li {
    position: relative;
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 15px 0 25px;
    font-size: 14px;
    color: var(--sideBarColor);
    cursor: pointer;
    & > .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 6px;
    }
    & > .close-icon {
      opacity: 0;
      flex-shrink: 0;
    }
    & > .close-icon:hover {
      color: var(--focusColor);
    }
    & > .unsaved-dot {
      display: none;
      width: 6px;
      height: 6px;
      margin-right: 3px;
      border-radius: 50%;
      background: var(--themeColor);
      flex-shrink: 0;
    }
    &:hover {
      background: var(--sideBarItemHoverBgColor);
    }
    &:hover > .close-icon {
      opacity: 1;
    }
  }
  & > li.unsaved:not(:hover) {
    & > .unsaved-dot {
      display: block;
    }
    & > .close-icon {
      display: none;
    }
  }
  & > li.active {
    color: var(--highlightThemeColor);
    background: var(--itemBgColor);
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--themeColor);
    }
  }
}

/* dragula effects */
.gu-mirror {
  position: fixed !important;
  margin: 0 !important;
  z-index: 9999 !important;
  opacity: 0.8;
  cursor: grabbing;
}
.gu-hide {
  display: none !important;
}
.gu-transit {
  opacity: 0.2;
}
</style>
