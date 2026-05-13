<template>
  <div class="search-result-item">
    <div
      class="search-result"
      :title="searchResult.filePath"
    >
      <svg
        class="icon icon-arrow"
        :class="{ fold: !showSearchMatches }"
        aria-hidden="true"
        @click.stop="toggleSearchMatches()"
      >
        <use xlink:href="#icon-arrow" />
      </svg>
      <div
        class="file-info"
        @click.stop="toggleSearchMatches()"
      >
        <div class="title">
          <span class="filename">
            <span class="name">{{ filename }}</span><span class="extension">{{ extension }}</span>
          </span>
          <span class="match-count">{{ matchCount }}</span>
        </div>
        <!-- <div class="folder-path">
            <span>{{ dirname }}</span>
          </div> -->
      </div>
    </div>
    <div
      v-if="showSearchMatches"
      class="matches"
    >
      <ul>
        <li
          v-for="(searchMatch, index) of getMatches"
          :key="index"
          class="text-overflow"
          :title="searchMatch.lineText"
          @click="handleSearchResultClick(searchMatch)"
        >
          <!-- <span class="line-number">{{ searchMatch.range[0][0] }}</span> -->
          <span>{{
            ellipsisText(searchMatch.lineText.substring(0, searchMatch.range[0][1]))
          }}</span>
          <span class="highlight">{{
            searchMatch.lineText.substring(searchMatch.range[0][1], searchMatch.range[1][1])
          }}</span>
          <span>{{ searchMatch.lineText.substring(searchMatch.range[1][1]) }}</span>
        </li>
      </ul>
      <div v-if="!allMatchesShown">
        <div
          class="button tiny"
          @click="handleShowMoreMatches"
        >
          {{ t('sideBar.search.showMoreMatches') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'
import bus from '../../bus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  searchResult: {
    type: Object,
    required: true
  }
})

const editorStore = useEditorStore()

const showSearchMatches = ref(props.searchResult.matches.length <= 20)
const allMatchesShown = ref(props.searchResult.matches.length <= 10)
const shownMatches = ref(10)

const { tabs, currentFile } = storeToRefs(editorStore)

const getMatches = computed(() => {
  if (props.searchResult.matches.length === 0 || allMatchesShown.value) {
    return props.searchResult.matches
  }
  return props.searchResult.matches.slice(0, shownMatches.value)
})

const filename = computed(() => {
  return window.path.basename(
    props.searchResult.filePath,
    window.path.extname(props.searchResult.filePath)
  )
})

const matchCount = computed(() => {
  return props.searchResult.matches.length
})

const extension = computed(() => {
  return window.path.extname(props.searchResult.filePath)
})

const toggleSearchMatches = () => {
  showSearchMatches.value = !showSearchMatches.value
}

const handleShowMoreMatches = (event) => {
  shownMatches.value += 15
  if (event.ctrlKey || event.metaKey || shownMatches.value >= props.searchResult.matches.length) {
    allMatchesShown.value = true
  }
}

const ellipsisText = (text) => {
  const len = text.length
  const MAX_PRETEXT_LEN = 6
  return len > MAX_PRETEXT_LEN ? `...${text.substring(len - MAX_PRETEXT_LEN)}` : text
}

const handleSearchResultClick = (searchMatch) => {
  const { range } = searchMatch
  const { filePath } = props.searchResult

  const openedTab = tabs.value.find((file) =>
    window.fileUtils.isSamePathSync(file.pathname, filePath)
  )
  const cursor = {
    isCollapsed: range[0][0] !== range[1][0],
    anchor: {
      line: range[0][0],
      ch: range[0][1]
    },
    focus: {
      line: range[1][0],
      ch: range[1][1]
    }
  }

  if (openedTab) {
    openedTab.cursor = cursor
    if (currentFile.value !== openedTab) {
      editorStore.UPDATE_CURRENT_FILE(openedTab)
    } else {
      const { id, markdown, history } = currentFile.value
      bus.emit('file-changed', {
        id,
        markdown,
        cursor: currentFile.value.cursor,
        renderCursor: true,
        history
      })
    }
  } else {
    window.electron.ipcRenderer.send('mt::open-file', filePath, {
      cursor
    })
  }
}
</script>

<style scoped>
.search-result-item {
  position: relative;
  user-select: none;
  padding: 0 10px 8px 10px;
  color: var(--sideBarColor);
  font-size: 14px;
}
.search-result-item > .search-result {
  display: flex;
  align-items: center;
}
.search-result-item > .search-result > svg:first-child {
  margin-right: 3px;
}
.search-result-item > .search-result > .file-info {
  flex: 1;
  overflow: hidden;
}
.search-result-item .title .filename {
  font-size: 14px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  padding-right: 8px;
}
.search-result-item .matches ul {
  padding-left: 0;
  list-style-type: none;
}
.search-result-item .matches ul li {
  display: block;
  padding: 2px 16px;
  padding-right: 0;
  cursor: pointer;
  /* Hide space between inline spans */
  font-size: 0;
}
.search-result-item .matches ul li .highlight {
  background: var(--highlightColor);
  line-height: 16px;
  height: 16px;
  display: inline-block;
  color: var(--sideBarTextColor);
  border-radius: 1px;
}
.search-result-item .matches ul li:hover {
  background: var(--sideBarItemHoverBgColor);
}
.search-result-item .matches ul li span {
  font-size: 13px;
  white-space: pre;
}
.search-result-item .matches .button {
  width: 130px;
  margin: 0 auto;
  text-align: center;
}
.search-result-item.active {
  font-weight: 600;
}
.search-result-item.active .title {
  color: var(--themeColor);
}
.search-result-item.active::before {
  height: 100%;
}
.title {
  display: flex;
  color: var(--sideBarTextColor);
}
.title .filename {
  flex: 1;
}
.title .filename .name {
  font-weight: 600;
}
.title .filename .extension {
  color: var(--sideBarTextColor);
  font-size: 12px;
}
.title .match-count {
  display: inline-block;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  flex-shrink: 0;
  background: var(--itemBgColor);
  color: var(--sideBarTextColor);
}

.folder-path {
  font-size: 12px;
}

.folder-path > span,
.matches {
  width: 100%;
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sideBarTextColor);
}

.icon-arrow {
  transition: all 0.25s ease-out;
  transform: rotate(90deg);
  fill: var(--sideBarTextColor);
}
.icon-arrow.fold {
  transform: rotate(0);
}
</style>
