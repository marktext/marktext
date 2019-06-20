<template>
    <div
      class="side-bar-search"
    >
      <div class="search-wrapper">
        <input
          type="text" v-model="keyword"
          placeholder="Search in folder..."
          @keyup.enter="search"
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
      <div class="search-error" v-show="searchErrorString">
        <span>An error occurred: {{ searchErrorString }}</span>
      </div>
      <div
        class="cancel-area"
        v-show="searcherRunning"
      >
        <el-button
          type="primary"
          size="mini"
          @click="cancelSearcher"
        >
          Cancel <i class="el-icon-video-pause"></i>
        </el-button>
      </div>
      <div class="search-result" v-if="searchResult.length">
        <search-result-item
          v-for="(searchResult, index) of searchResult"
          :key="index"
          :searchResult="searchResult"
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
        'projectTree': state => state.project.projectTree,
        'searchExclusions': state => state.preferences.searchExclusions,
        'searchMaxFileSize': state => state.preferences.searchMaxFileSize,
        'searchIncludeHidden': state => state.preferences.searchIncludeHidden,
        'searchNoIgnore': state => state.preferences.searchNoIgnore,
        'searchFollowSymlinks': state => state.preferences.searchFollowSymlinks
      })
    },
    methods: {
      search () {
        // No root directory is opened.
        if (!this.projectTree || !this.projectTree.pathname) {
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

        this.searchResult = []
        this.searchErrorString = ''
        this.searcherCancelCallback = null

        if (!keyword) {
          this.searcherRunning = false
          return
        }

        let canceled = false
        this.searcherRunning = true

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

            this.searchResult.push(searchResult)
          },
          didSearchPaths: numPathsFound => {
            // More than 100 files with (multiple) matches were found.
            if (!canceled && numPathsFound > 100) {
              canceled = true
              promises.cancel()
              this.searchErrorString = 'Search was canceled because more than 100 files were found.'
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
          inclusions: [ '*.markdown', '*.mdown', '*.mkdn', '*.md', '*.mkd', '*.mdwn', '*.mdtxt', '*.mdtext', '*.text', '*.txt' ]
        })
        .then(() => {
          this.searcherRunning = false
          this.searcherCancelCallback = null
        })
        .catch(err => {
          canceled = true
          if (promises.cancel) {
            promises.cancel()
          }
          this.searcherRunning = false
          this.searcherCancelCallback = null

          this.searchErrorString = err.message
          log.error(err)
        })

        this.searcherCancelCallback = () => {
          canceled = true
          if (promises.cancel) {
            promises.cancel()
          }
        }
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
    margin: 35px 15px 20px 15px;
    padding: 0 6px;
    border-radius: 15px;
    height: 30px;
    border: 1px solid var(--floatBorderColor);
    background: var(--floatBorderColor);
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
  .search-error {
    overflow-wrap: break-word;
    & > span {
      display: block;
      font-size: 14px;
    }
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
