<template>
  <div class="search-bar"
    @click.stop="noop"
    v-show="showSearch"
  >
    <div
      class="left-arrow"
      @click="toggleSearchType"
    >
      <svg
        class="icon"
        aria-hidden="true"
        :class="{'arrow-right': type === 'search'}"
      >
        <use xlink:href="#icon-arrowdown"></use>
      </svg>
    </div>
    <div class="right-controls">
      <section class="search">
        <div
          class="input-wrapper"
          :class="{'error': !!searchErrorMsg}"
        >
          <input
            type="text"
            v-model="searchValue"
            @keyup="search($event)"
            ref="search"
            placeholder="Search"
          >
          <div class="controls">
            <span class="search-result">{{`${highlightIndex + 1} / ${highlightCount}`}}</span>
            <span
              title="Case Sensitive"
              class="is-case-sensitive"
              :class="{'active': isCaseSensitive}"
              @click.stop="toggleCtrl('isCaseSensitive')"
            >
              <svg :viewBox="FindCaseIcon.viewBox" aria-hidden="true">
                <use :xlink:href="FindCaseIcon.url" />
              </svg>
            </span>
            <span
              title="Select whole word"
              class="is-whole-word"
              :class="{'active': isWholeWord}"
              @click.stop="toggleCtrl('isWholeWord')"
            >
              <svg :viewBox="FindWordIcon.viewBox" aria-hidden="true">
                <use :xlink:href="FindWordIcon.url" />
              </svg>
            </span>
            <span
              title="Use query as RegEx"
              class="is-regex"
              :class="{'active': isRegexp}"
              @click.stop="toggleCtrl('isRegexp')"
            >
              <svg :viewBox="FindRegexIcon.viewBox" aria-hidden="true">
                <use :xlink:href="FindRegexIcon.url" />
              </svg>
            </span>
          </div>
          <div class="error-msg" v-if="searchErrorMsg">
            {{searchErrorMsg}}
          </div>
        </div>
        <div class="button-group">
          <button class="button right" @click="find('prev')">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-arrow-up"></use>
            </svg>
          </button>
          <button class="button" @click="find('next')">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-arrowdown"></use>
            </svg>
          </button>
        </div>
      </section>
      <section class="replace" v-if="type === 'replace'">
        <div class="input-wrapper replace-input">
          <input type="text" v-model="replaceValue" placeholder="Replacement">
        </div>
        <div class="button-group">
          <el-tooltip class="item"
            effect="dark"
            content="Replace All"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button class="button right" @click="replace(false)">
              <svg class="icon" aria-hidden="true">
                <use xlink:href="#icon-all-inclusive"></use>
              </svg>
            </button>
          </el-tooltip>
          <el-tooltip class="item"
            effect="dark"
            content="Replace Single"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button class="button" @click="replace(true)">
              <svg class="icon" aria-hidden="true">
                <use xlink:href="#icon-replace"></use>
              </svg>
            </button>
          </el-tooltip>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import bus from '../../bus'
import { mapState } from 'vuex'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'

export default {
  data () {
    this.FindCaseIcon = FindCaseIcon
    this.FindWordIcon = FindWordIcon
    this.FindRegexIcon = FindRegexIcon
    return {
      showSearch: false,
      isCaseSensitive: false,
      isWholeWord: false,
      isRegexp: false,
      type: 'search',
      searchValue: '',
      replaceValue: '',
      searchErrorMsg: ''
    }
  },

  watch: {
    searchMatches: function (newValue, oldValue) {
      if (!newValue || !oldValue) return
      const { value } = newValue
      if (value && value !== oldValue.value) {
        this.searchValue = value
      }
    }
  },

  computed: {
    ...mapState({
      searchMatches: state => state.editor.currentFile.searchMatches
    }),
    highlightIndex () {
      if (this.searchMatches) {
        return this.searchMatches.index
      } else {
        return -1
      }
    },
    highlightCount () {
      if (this.searchMatches) {
        return this.searchMatches.matches.length
      } else {
        return 0
      }
    }
  },

  created () {
    bus.$on('find', this.listenFind)
    bus.$on('replace', this.listenReplace)
    bus.$on('findNext', this.listenFindNext)
    bus.$on('findPrev', this.listenFindPrev)
    document.addEventListener('click', this.docClick)
    document.addEventListener('keyup', this.docKeyup)
  },

  beforeDestroy () {
    bus.$off('find', this.listenFind)
    bus.$off('replace', this.listenReplace)
    bus.$off('findNext', this.listenFindNext)
    bus.$off('findPrev', this.listenFindPrev)
    document.removeEventListener('click', this.docClick)
    document.removeEventListener('keyup', this.docKeyup)
  },

  methods: {
    toggleCtrl (ctrl) {
      this[ctrl] = !this[ctrl]
      this.search()
    },

    listenFind () {
      this.showSearch = true
      this.type = 'search'
      this.$nextTick(() => {
        this.$refs.search.focus()
        if (this.searchValue) {
          this.search()
        }
      })
    },

    listenReplace () {
      this.showSearch = true
      this.type = 'replace'
    },

    listenFindNext () {
      this.find('next')
    },

    listenFindPrev () {
      this.find('prev')
    },

    docKeyup (event) {
      if (event.key === 'Escape') {
        this.emptySearch(true)
      }
    },

    docClick () {
      if (!this.showSearch) return
      this.emptySearch()
    },

    emptySearch (selectHighlight = false) {
      this.showSearch = false
      const searchValue = this.searchValue = ''
      this.replaceValue = ''
      bus.$emit('searchValue', searchValue, { selectHighlight })
    },

    toggleSearchType () {
      this.type = this.type === 'search' ? 'replace' : 'search'
    },

    /**
     * Find the previous or next search result.
     * action: prev or next
     */
    find (action) {
      bus.$emit('find-action', action)
    },

    search (event) {
      if (event && event.key === 'Escape') {
        return
      }

      if (event && event.key === 'Enter') {
        return this.find('next')
      }

      const { searchValue, isCaseSensitive, isWholeWord, isRegexp } = this
      if (isRegexp) {
        // Handle invalid regexp.
        try {
          new RegExp(searchValue)
          this.searchErrorMsg = ''
        } catch (err) {
          this.searchErrorMsg = `Invalid regular expression: /${searchValue}/.`
          return
        }
        // Handle match empty string, no need to search.
        try {
          const SEARCH_REG = new RegExp(searchValue)
          if (searchValue && SEARCH_REG.test('')) {
            throw new Error()
          }
          this.searchErrorMsg = ''
        } catch (err) {
          this.searchErrorMsg = `RegExp: /${searchValue}/ match empty string.`
          return
        }
      }
      bus.$emit('searchValue', searchValue, {
        isCaseSensitive,
        isWholeWord,
        isRegexp
      })
    },

    replace (isSingle = true) {
      const { replaceValue, isCaseSensitive, isWholeWord, isRegexp } = this
      bus.$emit('replaceValue', replaceValue, {
        isSingle,
        isCaseSensitive,
        isWholeWord,
        isRegexp
      })
    },

    noop () {}
  }
}
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
  .search, .replace {
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
    opacity: .5;
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
