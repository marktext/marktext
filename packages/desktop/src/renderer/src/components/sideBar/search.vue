<template>
  <div class="side-bar-search">
    <div class="search-header">
      <icon-tooltip :content="t('sideBar.search.backToFiles')">
        <button
          type="button"
          class="plain-button back-button"
          :aria-label="t('sideBar.search.backToFiles')"
          @click="emit('back')"
        >
          <el-icon
            :size="18"
            aria-hidden="true"
          >
            <BackIcon />
          </el-icon>
        </button>
      </icon-tooltip>
      <div class="search-wrapper">
        <input
          ref="searchEl"
          v-model="keyword"
          type="text"
          class="search-input"
          :placeholder="t('sideBar.search.searchInFolder')"
          @keydown="handleSearchKeydown"
          @keyup="handleSearchKeyup"
        >
        <div class="controls">
          <icon-tooltip :content="t('search.caseSensitive')">
            <button
              type="button"
              class="plain-button is-case-sensitive"
              :class="{ active: isCaseSensitive }"
              :aria-label="t('search.caseSensitive')"
              :aria-pressed="isCaseSensitive"
              @click.stop="caseSensitiveClicked()"
            >
              <FindCaseIcon aria-hidden="true" />
            </button>
          </icon-tooltip>
          <icon-tooltip :content="t('search.wholeWord')">
            <button
              type="button"
              class="plain-button is-whole-word"
              :class="{ active: isWholeWord }"
              :aria-label="t('search.wholeWord')"
              :aria-pressed="isWholeWord"
              @click.stop="wholeWordClicked()"
            >
              <FindWordIcon aria-hidden="true" />
            </button>
          </icon-tooltip>
          <icon-tooltip :content="t('search.useRegex')">
            <button
              type="button"
              class="plain-button is-regex"
              :class="{ active: isRegexp }"
              :aria-label="t('search.useRegex')"
              :aria-pressed="isRegexp"
              @click.stop="regexpClicked()"
            >
              <FindRegexIcon aria-hidden="true" />
            </button>
          </icon-tooltip>
        </div>
      </div>
    </div>

    <div
      v-if="showNoFolderOpenedMessage"
      class="search-message-section"
    >
      <span>{{ t('sideBar.search.noFolderOpen') }}</span>
    </div>
    <div
      v-if="showNoResultFoundMessage"
      class="search-message-section"
    >
      {{ t('sideBar.search.noResultsFound') }}
    </div>
    <div
      v-if="searchErrorString"
      class="search-message-section"
    >
      {{ searchErrorString }}
    </div>

    <div
      v-show="showSearchCancelArea"
      class="cancel-area"
    >
      <el-button
        type="primary"
        size="mini"
        @click="cancelSearcher"
      >
        {{ t('sideBar.search.cancel') }} <VideoPause />
      </el-button>
    </div>
    <div
      v-if="searchResult.length"
      class="search-result-info"
    >
      {{ searchResultInfo }}
    </div>
    <div
      v-if="searchResult.length"
      class="search-result"
    >
      <search-result-item
        v-for="(item, index) of searchResult"
        :key="index"
        :search-result="item"
      />
    </div>
    <div
      v-else
      class="empty"
    >
      <div class="no-data">
        <el-button
          v-if="showNoFolderOpenedMessage"
          text
          bg
          type="primary"
          @click="openFolder"
        >
          {{ t('sideBar.search.openFolder') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import bus from '../../bus'
import log from 'electron-log'
import SearchResultItem from './searchResultItem.vue'
import RipgrepDirectorySearcher from '../../node/ripgrepSearcher'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'
import { Back as BackIcon, VideoPause } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import IconTooltip from '@/components/iconTooltip/index.vue'
import type { SearchResult } from './types'

const emit = defineEmits<{ back: [restoreFocus?: boolean] }>()

const { t } = useI18n()
const layoutStore = useLayoutStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

let searcherCancelCallback: (() => void) | null = null
const ripgrepDirectorySearcher = new RipgrepDirectorySearcher()

const keyword = ref('')
const searchResult = ref<SearchResult[]>([])
const searcherRunning = ref(false)
const showSearchCancelArea = ref(false)
const searchErrorString = ref('')
const isCaseSensitive = ref(false)
const isWholeWord = ref(false)
const isRegexp = ref(false)
const searchEl = ref<HTMLInputElement | null>(null)

const { showSideBar } = storeToRefs(layoutStore)
const { currentFile } = storeToRefs(editorStore)
const { projectTree } = storeToRefs(projectStore)
const {
  searchExclusions,
  searchMaxFileSize,
  searchIncludeHidden,
  searchNoIgnore,
  searchFollowSymlinks
} = storeToRefs(preferencesStore)

const searchMatches = computed(() => currentFile.value?.searchMatches)

const searchResultInfo = computed(() => {
  const fileCount = searchResult.value.length
  const matchCount = searchResult.value.reduce((acc, item) => {
    return acc + item.matches.length
  }, 0)

  return t('search.searchResultInfo', { matchCount, fileCount })
})

const showNoFolderOpenedMessage = computed(() => {
  return !projectTree.value || !projectTree.value.pathname
})

const showNoResultFoundMessage = computed(() => {
  return (
    searchResult.value.length === 0 && searcherRunning.value === false && keyword.value.length > 0
  )
})

const handleSearchKeydown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  event.stopPropagation()
  emit('back', false)
}

const handleSearchKeyup = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape') search()
}

const search = (): void => {
  if (showNoFolderOpenedMessage.value || !projectTree.value) {
    return
  }

  const { pathname: rootDirectoryPath } = projectTree.value

  if (searcherRunning.value && searcherCancelCallback) {
    searcherCancelCallback()
  }

  searchErrorString.value = ''
  searcherCancelCallback = null

  if (!keyword.value) {
    searchResult.value = []
    searcherRunning.value = false
    return
  }

  let canceled = false
  searcherRunning.value = true
  startShowSearchCancelAreaTimer()

  const newSearchResult: SearchResult[] = []
  // Keep a handle on the cancellable thenable separately from the chained
  // `.then().catch()` (which is a plain `Promise<void>` and loses `cancel`).
  const cancellable = ripgrepDirectorySearcher.search([rootDirectoryPath], keyword.value, {
    didMatch: (res: unknown) => {
      if (canceled) return
      newSearchResult.push(res as SearchResult)
    },
    didSearchPaths: (numPathsFound: unknown) => {
      if (!canceled && typeof numPathsFound === 'number' && numPathsFound > 100) {
        canceled = true
        cancellable.cancel()
        searchErrorString.value = t('search.searchLimited', { count: 100 })
      }
    },

    isCaseSensitive: isCaseSensitive.value,
    isWholeWord: isWholeWord.value,
    isRegexp: isRegexp.value,

    exclusions: searchExclusions.value,
    maxFileSize: searchMaxFileSize.value || null,
    includeHidden: searchIncludeHidden.value,
    noIgnore: searchNoIgnore.value,
    followSymlinks: searchFollowSymlinks.value,

    inclusions: window.fileUtils.MARKDOWN_INCLUSIONS
  })

  cancellable
    .then(() => {
      searchResult.value = newSearchResult
      searcherRunning.value = false
      searcherCancelCallback = null
      stopShowSearchCancelAreaTimer()
    })
    .catch((err) => {
      canceled = true
      cancellable.cancel()
      log.error('Error while searching in directory:', err)
      searchResult.value = []
      searcherRunning.value = false
      searcherCancelCallback = null
      stopShowSearchCancelAreaTimer()
    })

  searcherCancelCallback = cancellable.cancel.bind(cancellable)
}

const handleFindInFolder = (executeSearch: boolean | unknown = true): void => {
  nextTick(() => {
    if (searchEl.value) {
      searchEl.value.focus()
      // `searchMatches.value` may carry a `selectedText` populated elsewhere
      // (legacy contract from CodeMirror / find-in-page). Narrow defensively.
      const selectedText = (searchMatches.value as { selectedText?: string } | undefined)
        ?.selectedText
      if (selectedText) {
        keyword.value = selectedText
        if (executeSearch) {
          search()
        }
      }
    }
  })
}

const openFolder = (): void => {
  projectStore.ASK_FOR_OPEN_PROJECT()
}

const caseSensitiveClicked = (): void => {
  isCaseSensitive.value = !isCaseSensitive.value
  search()
}

const wholeWordClicked = (): void => {
  isWholeWord.value = !isWholeWord.value
  search()
}

const regexpClicked = (): void => {
  isRegexp.value = !isRegexp.value
  search()
}

let searchCancelTimer: ReturnType<typeof setTimeout> | null = null
const startShowSearchCancelAreaTimer = (): void => {
  if (searchCancelTimer) {
    clearTimeout(searchCancelTimer)
    searchCancelTimer = null
  }
  searchCancelTimer = setTimeout(() => {
    showSearchCancelArea.value = true
  }, 500)
}

const stopShowSearchCancelAreaTimer = (): void => {
  if (searchCancelTimer) {
    clearTimeout(searchCancelTimer)
    searchCancelTimer = null
  }
  showSearchCancelArea.value = false
}

const cancelSearcher = (): void => {
  if (searcherRunning.value && searcherCancelCallback) {
    searcherCancelCallback()
  }
}

watch(showSideBar, (value, oldValue) => {
  if (value && !oldValue) {
    handleFindInFolder(false)
  } else {
    bus.emit('search-blur')
  }
})

onMounted(() => {
  handleFindInFolder()
  bus.on('findInFolder', handleFindInFolder)
})
onUnmounted(() => {
  bus.off('findInFolder', handleFindInFolder)
  cancelSearcher()
  stopShowSearchCancelAreaTimer()
})
</script>

<style scoped>
.side-bar-search {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.search-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 4px 8px 10px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}
.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 28px;
  border-radius: 4px;
  color: var(--sideBarIconColor);
}
.back-button:hover {
  background: var(--sideBarItemHoverBgColor);
}
.search-wrapper {
  display: flex;
  margin: 0;
  flex: 1;
  min-width: 0;
  padding: 0 6px;
  border-radius: 4px;
  height: 28px;
  border: 1px solid var(--floatBorderColor);
  background: var(--inputBgColor);
  box-sizing: border-box;
  align-items: center;
  & > input {
    color: var(--sideBarColor);
    background: transparent;
    height: 100%;
    flex: 1;
    border: none;
    outline: none;
    padding: 0;
    font-size: 13px;
    min-width: 0;
    width: 0;
  }
  & > .controls {
    display: flex;
    flex-shrink: 0;
    & > button {
      width: 20px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      &:hover {
        color: var(--sideBarIconColor);
      }
      & > svg {
        width: 14px;
        height: 14px;
        fill: var(--sideBarIconColor);
        &:hover {
          fill: var(--highlightThemeColor);
        }
      }
      &.active svg {
        fill: var(--highlightThemeColor);
      }
    }
  }

}
.cancel-area {
  text-align: center;
  margin-bottom: 16px;
}
.search-message-section {
  overflow-wrap: break-word;
}
.search-result-info,
.search-message-section {
  padding-left: 15px;
  margin-bottom: 5px;
  font-size: 12px;
  color: var(--sideBarColor);
}
.empty,
.search-result {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  &::-webkit-scrollbar:vertical {
    width: 8px;
  }
}
.empty {
  font-size: 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding-bottom: 100px;
  & .no-data {
    display: flex;
    align-items: center;
    flex-direction: column;
  }
  & .no-data .el-button {
    margin-top: 20px;
  }
  & .no-data .el-button.is-text.is-has-bg {
    background-color: var(--buttonPrimaryBgColor);
    color: var(--buttonPrimaryFontColor);
    border-color: transparent;
  }
  & .no-data .el-button.is-text.is-has-bg:hover,
  & .no-data .el-button.is-text.is-has-bg:focus {
    background-color: var(--buttonPrimaryBgColorHover);
    color: var(--buttonPrimaryFontColorHover);
  }
}
</style>
