<template>
    <div
      class="side-bar-search"
    >
      <div class="search-wrapper">
        <input
          type="text" v-model="keyword"
          placeholder="Search in folder..."
          @keyup="search"
        >
        <div class="controls">
          <span
            title="Case Sensitive"
            class="is-case-sensitive"
            :class="{'active': isCaseSensitive}"
            @click.stop="caseSensitiveClicked()"
          >
            <svg :viewBox="FindCaseIcon.viewBox" aria-hidden="true">
              <use :xlink:href="FindCaseIcon.url" />
            </svg>
          </span>
          <span
            title="Select whole word"
            class="is-whole-word"
            :class="{'active': isWholeWord}"
            @click.stop="wholeWordClicked()"
          >
            <svg :viewBox="FindWordIcon.viewBox" aria-hidden="true">
              <use :xlink:href="FindWordIcon.url" />
            </svg>
          </span>
          <span
            title="Use query as RegEx"
            class="is-regex"
            :class="{'active': isRegexp}"
            @click.stop="regexpClicked()"
          >
            <svg :viewBox="FindRegexIcon.viewBox" aria-hidden="true">
              <use :xlink:href="FindRegexIcon.url" />
            </svg>
          </span>
        </div>
      </div>

      <div class="search-message-section" v-if="showNoFolderOpenedMessage">
        <div>You have not opened a folder.</div>
        <a href="javascript:;" @click="openFolder">Open Folder</a>
      </div>
      <div class="search-message-section" v-if="showNoResultFoundMessage">No results found.</div>
      <div class="search-message-section" v-if="searchErrorString">{{ searchErrorString }}</div>

      <div
        class="cancel-area"
        v-show="showSearchCancelArea"
      >
        <el-button
          type="primary"
          size="mini"
          @click="cancelSearcher"
        >
          Cancel <i class="el-icon-video-pause"></i>
        </el-button>
      </div>
      <div v-if="searchResult.length" class="search-result-info">{{searchResultInfo}}</div>
      <div class="search-result" v-if="searchResult.length">
        <search-result-item
          v-for="(item, index) of searchResult"
          :key="index"
          :searchResult="item"
        ></search-result-item>
      </div>
      <div class="empty" v-else>
        <div class="no-data">
          <svg :viewBox="EmptyIcon.viewBox" aria-hidden="true">
            <use :xlink:href="EmptyIcon.url" />
          </svg>
        </div>
      </div>
    </div>
</template>

<script>
import { mapState } from 'vuex'
import log from 'electron-log'
import SearchResultItem from './searchResultItem.vue'
import RipgrepDirectorySearcher from '../../node/ripgrepSearcher'
import EmptyIcon from '@/assets/icons/undraw_empty.svg'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'

export default {
  data () {
    this.lastKeyword = ''
    this.lastSearchTime = new Date()
    this.keyUpTimer = null
    this.searcherCancelCallback = null
    this.ripgrepDirectorySearcher = new RipgrepDirectorySearcher()
    this.EmptyIcon = EmptyIcon
    this.FindCaseIcon = FindCaseIcon
    this.FindWordIcon = FindWordIcon
    this.FindRegexIcon = FindRegexIcon
    return {
      keyword: '',
      searchResult: [],
      searcherRunning: false,
      showSearchCancelArea: false,
      searchErrorString: '',

      isCaseSensitive: false,
      isWholeWord: false,
      isRegexp: false
    }
  },
  components: {
    SearchResultItem
  },
  computed: {
    ...mapState({
      projectTree: state => state.project.projectTree,
      searchExclusions: state => state.preferences.searchExclusions,
      searchMaxFileSize: state => state.preferences.searchMaxFileSize,
      searchIncludeHidden: state => state.preferences.searchIncludeHidden,
      searchNoIgnore: state => state.preferences.searchNoIgnore,
      searchFollowSymlinks: state => state.preferences.searchFollowSymlinks
    }),
    searchResultInfo () {
      const fileCount = this.searchResult.length
      const matchCount = this.searchResult.reduce((acc, item) => {
        return acc + item.matches.length
      }, 0)

      return `${matchCount} ${matchCount > 1 ? 'matches' : 'match'} in ${fileCount} ${fileCount > 1 ? 'files' : 'file'}`
    },
    showNoFolderOpenedMessage () {
      return !this.projectTree || !this.projectTree.pathname
    },
    showNoResultFoundMessage () {
      return this.searchResult.length === 0 && this.searcherRunning === false && this.keyword.length > 0
    }
  },
  methods: {
    search () {
      // No root directory is opened.
      if (this.showNoFolderOpenedMessage) {
        return
      }

      const { pathname: rootDirectoryPath } = this.projectTree
      const {
        keyword,
        searcherRunning,
        searcherCancelCallback,
        isCaseSensitive,
        isWholeWord,
        isRegexp,
        ripgrepDirectorySearcher
      } = this

      if (searcherRunning && searcherCancelCallback) {
        searcherCancelCallback()
      }

      this.searchErrorString = ''
      this.searcherCancelCallback = null

      if (!keyword) {
        this.searchResult = []
        this.searcherRunning = false
        return
      }

      let canceled = false
      this.searcherRunning = true
      this.startShowSearchCancelAreaTimer()

      const newSearchResult = []
      const promises = ripgrepDirectorySearcher.search([rootDirectoryPath], keyword, {
        didMatch: searchResult => {
          if (canceled) return

          // filePath: "<file>"
          // matches: Array(1)
          // 0:
          //   leadingContextLines: []
          //   lineText: "foo-test"
          //   matchText: "foo"
          //   range: Array(2)
          //     0: (2) [0, 0]
          //     1: (2) [0, 3]
          //   length: 2
          //   trailingContextLines: []

          newSearchResult.push(searchResult)
        },
        didSearchPaths: numPathsFound => {
          // More than 100 files with (multiple) matches were found.
          if (!canceled && numPathsFound > 100) {
            canceled = true
            if (promises.cancel) {
              promises.cancel()
            }
            this.searchErrorString = 'Search was limited to 100 files.'
          }
        },

        // UI options
        isCaseSensitive,
        isWholeWord,
        isRegexp,

        // Options loaded from settings
        exclusions: this.searchExclusions,
        maxFileSize: this.searchMaxFileSize || null,
        includeHidden: this.searchIncludeHidden,
        noIgnore: this.searchNoIgnore,
        followSymlinks: this.searchFollowSymlinks,

        // Only search markdown files
        inclusions: ['*.markdown', '*.mdown', '*.mkdn', '*.md', '*.mkd', '*.mdwn', '*.mdtxt', '*.mdtext', '*.text', '*.txt']
      })
        .then(() => {
          this.searchResult = newSearchResult
          this.searcherRunning = false
          this.searcherCancelCallback = null
          this.stopShowSearchCancelAreaTimer()
        })
        .catch(err => {
          canceled = true
          if (promises.cancel) {
            promises.cancel()
          }
          this.searcherRunning = false
          this.searcherCancelCallback = null
          this.stopShowSearchCancelAreaTimer()

          this.searchErrorString = err.message
          log.error(err)
        })

      this.searcherCancelCallback = () => {
        this.stopShowSearchCancelAreaTimer()
        canceled = true
        if (promises.cancel) {
          promises.cancel()
        }
      }
    },
    /**
     * Slightly delay showing the "cancel search" button so we don't
     * see it after every keypress, but only when a search query is lagging.
     */
    startShowSearchCancelAreaTimer () {
      this.stopShowSearchCancelAreaTimer()

      const SHOW_SEARCH_CANCEL_DELAY_MS = 5000
      this.showSearchCancelAreaTimer = window.setTimeout(() => {
        this.showSearchCancelArea = true
      }, SHOW_SEARCH_CANCEL_DELAY_MS)
    },
    stopShowSearchCancelAreaTimer () {
      this.showSearchCancelArea = false
      if (!this.showSearchCancelAreaTimer) {
        return
      }
      window.clearTimeout(this.showSearchCancelAreaTimer)
      this.showSearchCancelAreaTimer = null
    },
    cancelSearcher () {
      const { searcherCancelCallback } = this
      if (searcherCancelCallback) {
        searcherCancelCallback()
        this.searcherCancelCallback = null
      }
    },
    caseSensitiveClicked () {
      this.isCaseSensitive = !this.isCaseSensitive
      this.search()
    },
    wholeWordClicked () {
      this.isWholeWord = !this.isWholeWord
      this.search()
    },
    regexpClicked () {
      this.isRegexp = !this.isRegexp
      this.search()
    },
    openFolder () {
      this.$store.dispatch('ASK_FOR_OPEN_PROJECT')
    }
  }
}
</script>

<style scoped>
  .side-bar-search {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .search-wrapper {
    display: flex;
    margin: 35px 15px 10px 15px;
    padding: 0 6px;
    border-radius: 15px;
    height: 30px;
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
      padding: 0 8px;
      font-size: 14px;
      width: 50%;
    }
    & > .controls {
      display: flex;
      flex-shrink: 0;
      margin-top: 3px;
      & > span {
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

    & > svg {
      cursor: pointer;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-right: 10px;
      &:hover {
        color: var(--sideBarIconColor);
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
    & .no-data svg {
      fill: var(--themeColor);
      width: 120px;
    }
  }
</style>
