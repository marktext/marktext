<template>
  <div
    v-show="showSearch"
    class="search-bar"
    @click.stop="noop"
  >
    <div
      class="left-arrow"
      @click="toggleSearchType"
    >
      <svg
        class="icon"
        aria-hidden="true"
        :class="{ 'arrow-right': type === 'search' }"
      >
        <use xlink:href="#icon-arrowdown" />
      </svg>
    </div>
    <div class="right-controls">
      <section class="search">
        <div
          class="input-wrapper"
          :class="{ error: !!searchErrorMsg }"
        >
          <input
            ref="search"
            v-model="searchValue"
            type="text"
            :placeholder="t('search.searchPlaceholder')"
            @keyup="handleEnterKey"
          >
          <div class="controls">
            <span class="search-result">{{ highlightIndex + 1 }} /
              {{ highlightCount }}
            </span>
            <span
              :title="t('search.caseSensitive')"
              class="is-case-sensitive"
              :class="{ active: isCaseSensitive }"
              @click.stop="toggleCtrl('isCaseSensitive')"
            >
              <FindCaseIcon aria-hidden="true" />
            </span>
            <span
              :title="t('search.wholeWord')"
              class="is-whole-word"
              :class="{ active: isWholeWord }"
              @click.stop="toggleCtrl('isWholeWord')"
            >
              <FindWordIcon aria-hidden="true" />
            </span>
            <span
              :title="t('search.useRegex')"
              class="is-regex"
              :class="{ active: isRegexp }"
              @click.stop="toggleCtrl('isRegexp')"
            >
              <FindRegexIcon aria-hidden="true" />
            </span>
          </div>
          <div
            v-if="searchErrorMsg"
            class="error-msg"
          >
            {{ searchErrorMsg }}
          </div>
        </div>
        <div class="button-group">
          <button
            class="button right"
            @click="find('prev')"
          >
            <svg
              class="icon"
              aria-hidden="true"
            >
              <use xlink:href="#icon-arrow-up" />
            </svg>
          </button>
          <button
            class="button"
            @click="find('next')"
          >
            <svg
              class="icon"
              aria-hidden="true"
            >
              <use xlink:href="#icon-arrowdown" />
            </svg>
          </button>
        </div>
      </section>
      <section
        v-if="type === 'replace'"
        class="replace"
      >
        <div class="input-wrapper replace-input">
          <input
            v-model="replaceValue"
            type="text"
            :placeholder="t('search.replacementPlaceholder')"
          >
        </div>
        <div class="button-group">
          <el-tooltip
            class="item"
            effect="dark"
            :content="t('search.replaceAll')"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button
              class="button right"
              @click="replace(false)"
            >
              <svg
                class="icon"
                aria-hidden="true"
              >
                <use xlink:href="#icon-all-inclusive" />
              </svg>
            </button>
          </el-tooltip>
          <el-tooltip
            class="item"
            effect="dark"
            :content="t('search.replaceSingle')"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button
              class="button"
              @click="replace(true)"
            >
              <svg
                class="icon"
                aria-hidden="true"
              >
                <use xlink:href="#icon-replace" />
              </svg>
            </button>
          </el-tooltip>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import bus from '../../bus'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { debounce } from 'underscore'

const { t } = useI18n()

const editorStore = useEditorStore()

const showSearch = ref(false)
const isCaseSensitive = ref(false)
const isWholeWord = ref(false)
const isRegexp = ref(false)
const type = ref('search')
const searchValue = ref('')
const replaceValue = ref('')
const searchErrorMsg = ref('')
const search = ref(null)

const { currentFile } = storeToRefs(editorStore)
const searchMatches = computed(() => currentFile.value?.searchMatches)

watch(searchValue, () => {
  if (!showSearch.value) return // make sure search box is actually open
  debouncedSearchFn()
})

watch(searchMatches, (newValue, oldValue) => {
  if (!newValue || !oldValue) return
  const { value } = newValue
  if (value !== oldValue.value) {
    searchValue.value = value
  }
})

const highlightIndex = computed(() => {
  if (searchMatches.value) {
    return searchMatches.value.index
  } else {
    return -1
  }
})

const highlightCount = computed(() => {
  if (searchMatches.value) {
    return searchMatches.value.matches.length
  } else {
    return 0
  }
})

onMounted(() => {
  bus.on('find', listenFind)
  bus.on('replace', listenReplace)
  bus.on('findNext', listenFindNext)
  bus.on('findPrev', listenFindPrev)
  document.addEventListener('click', docClick)
  document.addEventListener('keyup', docKeyup)
  bus.on('search-blur', blurSearch)
})

onBeforeUnmount(() => {
  bus.off('find', listenFind)
  bus.off('replace', listenReplace)
  bus.off('findNext', listenFindNext)
  bus.off('findPrev', listenFindPrev)
  document.removeEventListener('click', docClick)
  document.removeEventListener('keyup', docKeyup)
  bus.off('search-blur', blurSearch)
})

const toggleCtrl = (ctrl) => {
  switch (ctrl) {
    case 'isCaseSensitive':
      isCaseSensitive.value = !isCaseSensitive.value
      break
    case 'isWholeWord':
      isWholeWord.value = !isWholeWord.value
      break
    case 'isRegexp':
      isRegexp.value = !isRegexp.value
      break
  }
  searchFn()
}

const listenFind = () => {
  showSearch.value = true
  type.value = 'search'
  nextTick(() => {
    search.value.focus()
    if (searchValue.value) {
      searchFn()
    }
  })
}

const listenReplace = () => {
  showSearch.value = true
  type.value = 'replace'
}

const listenFindNext = () => {
  find('next')
}

const listenFindPrev = () => {
  find('prev')
}

const docKeyup = (event) => {
  if (event.key === 'Escape') {
    emptySearch(true)
  }
}

const docClick = () => {
  if (!showSearch.value) return
  emptySearch(true)
}

const blurSearch = () => {
  emptySearch(true)
}

const emptySearch = (selectHighlight = false) => {
  showSearch.value = false
  searchValue.value = ''
  replaceValue.value = ''
  bus.emit('searchValue', { value: searchValue.value, opt: { selectHighlight } })
}

const toggleSearchType = () => {
  type.value = type.value === 'search' ? 'replace' : 'search'
}

/**
 * Find the previous or next search result.
 * action: prev or next
 */
const find = (action) => {
  bus.emit('find-action', action)
}

const handleEnterKey = (event) => {
  if (event.key === 'Enter') {
    find('next')
  }
}

const searchFn = (event = null) => {
  if (isRegexp.value) {
    // Handle invalid regexp.
    try {
      RegExp(searchValue.value)
      searchErrorMsg.value = ''
    } catch {
      searchErrorMsg.value = t('search.invalidRegex', { pattern: searchValue.value })
      return
    }
    // Handle match empty string, no need to search.
    try {
      const SEARCH_REG = new RegExp(searchValue.value)
      if (searchValue.value && SEARCH_REG.test('')) {
        throw new Error()
      }
      searchErrorMsg.value = ''
    } catch {
      searchErrorMsg.value = t('search.regexMatchEmpty', { pattern: searchValue.value })
      return
    }
  }

  bus.emit('searchValue', {
    value: searchValue.value,
    opt: {
      isCaseSensitive: isCaseSensitive.value,
      isWholeWord: isWholeWord.value,
      isRegexp: isRegexp.value
    }
  })
}

const debouncedSearchFn = debounce(searchFn, 150)

const replace = (isSingle = true) => {
  bus.emit('replaceValue', {
    value: replaceValue.value,
    opt: {
      isSingle,
      isCaseSensitive: isCaseSensitive.value,
      isWholeWord: isWholeWord.value,
      isRegexp: isRegexp.value
    }
  })
}

const noop = () => {}
</script>

<style scoped>
.search-bar {
  position: absolute;
  width: 400px;
  padding: 0;
  top: 0;
  right: 20px;
  border-radius: 3px;
  box-shadow: var(--floatShadow);
  background: var(--floatBgColor);
  display: flex;
  flex-direction: row;
}
.search-bar .left-arrow {
  width: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.search-bar .left-arrow:hover {
  background: var(--floatHoverColor);
}
.search-bar .left-arrow svg {
  height: 12px;
  width: 12px;
}
.search-bar .left-arrow svg.arrow-right {
  transform: rotate(-90deg);
}

.search-bar .right-controls {
  flex: 1;
}
.search,
.replace {
  height: 28px;
  display: flex;
  padding: 4px 10px 0 4px;
  margin-bottom: 5px;
}

.search-bar .button {
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  height: 28px;
  width: 28px;
  text-align: center;
  padding: 5px;
  display: inline-block;
  font-weight: 500;
  color: var(--sideBarIconColor);
  &.left {
    margin-right: 10px;
  }
  &.right {
    margin-left: 10px;
  }
}
.button.active {
  color: var(--themeColor);
}
.search-bar .button > svg {
  width: 16px;
  height: 16px;
}
.search-bar .button:active {
  opacity: 0.5;
}
.input-wrapper {
  display: flex;
  flex: 1;
  position: relative;
  border: 1px solid var(--inputBgColor);
  background: var(--inputBgColor);
  border-radius: 3px;
  overflow: visible;
}
.input-wrapper.error {
  border: 1px solid var(--notificationErrorBg);
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}
.input-wrapper .controls {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 12px;
  display: flex;
  color: var(--sideBarTitleColor);
  & > span.search-result {
    height: 20px;
    margin-right: 5px;
    line-height: 17px;
  }
  & > span:not(.search-result) {
    cursor: pointer;
    width: 20px;
    height: 20px;
    margin-left: 2px;
    margin-right: 2px;
    &:hover {
      color: var(--sideBarIconColor);
    }
    & > svg {
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

.input-wrapper .error-msg {
  position: absolute;
  top: 27px;
  width: calc(100% + 2px);
  height: 28px;
  left: -1px;
  padding: 0 8px;
  box-sizing: border-box;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
  background: var(--notificationErrorBg);
  line-height: 28px;
  color: #ffffff;
  font-size: 14px;
  z-index: 1;
}

.input-wrapper input {
  flex: 1;
  padding: 0 8px;
  height: 26px;
  outline: none;
  border: none;
  box-sizing: border-box;
  font-size: 14px;
  color: var(--editorColor);
  padding: 0 8px;
  background: transparent;
}
</style>
