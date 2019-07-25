<template>
  <div class="search-bar"
    @click.stop="noop"
    v-show="showSearch"
  >
    <section class="search">
      <div class="button-group">
        <el-tooltip class="item"
          effect="dark"
          content="Replacement"
          placement="top"
          :visible-arrow="false"
          :open-delay="1000"
        >
          <button
            class="button"
            v-if="type !== 'replace'"
            @click="typeClick"
          >
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-findreplace"></use>
            </svg>
          </button>
        </el-tooltip>
        <el-tooltip class="item"
          effect="dark"
          content="Case sensitive"
          placement="top"
          :visible-arrow="false"
          :open-delay="1000"
        >
          <button class="button left" @click="caseClick" :class="{ 'active': caseSensitive }">
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-case"></use>
            </svg>
          </button>
        </el-tooltip>
      </div>

      <div class="input-wrapper">
        <input
          type="text"
          v-model="searchValue"
          @keyup="search($event)"
          ref="search"
          placeholder="Search"
        >
        <span class="search-result">{{`${highlightIndex + 1} / ${highlightCount}`}}</span>
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
      <button class="button active left" @click="typeClick">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-findreplace"></use>
        </svg>
      </button>
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
</template>

<script>
import bus from '../bus'
import { mapState } from 'vuex'

export default {
  data () {
    return {
      showSearch: false,
      type: 'search',
      searchValue: '',
      replaceValue: '',
      caseSensitive: false
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
    listenFind () {
      this.showSearch = true
      this.type = 'search'
      this.$nextTick(() => {
        this.$refs.search.focus()
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
        this.emitSearch(true)
      }
    },
    docClick (isSelect) {
      if (!this.showSearch) return
      this.emitSearch()
    },
    emitSearch (selectHighlight = false) {
      this.showSearch = false
      const searchValue = this.searchValue = ''
      this.replaceValue = ''
      bus.$emit('searchValue', searchValue, { selectHighlight })
    },
    caseClick () {
      this.caseSensitive = !this.caseSensitive
    },
    typeClick () {
      this.type = this.type === 'search' ? 'replace' : 'search'
    },
    find (action) {
      bus.$emit('find', action)
    },
    search (event) {
      if (event.key === 'Escape') return
      if (event.key !== 'Enter') {
        const { caseSensitive } = this
        bus.$emit('searchValue', this.searchValue, { caseSensitive })
      } else {
        this.find('next')
      }
    },
    replace (isSingle = true) {
      const { caseSensitive, replaceValue } = this
      bus.$emit('replaceValue', replaceValue, { caseSensitive, isSingle })
    },
    noop () {}
  }
}
</script>

<style scoped>
  .search-bar {
    position: absolute;
    width: 400px;
    padding: 5px;
    top: 0;
    right: 20px;
    box-shadow: 0 4px 8px 0 var(--floatBorderColor);
    border: 1px solid var(--floatBorderColor);
    border-radius: 5px;
    background: var(--floatBgColor);
  }
  .search {
    margin-bottom: 5px;
  }
  .search, .replace {
    height: 30px;
    display: flex;
    padding: 4px 10px 0 10px;
  }
  .search-bar .button {
    outline: none;
    cursor: pointer;
    box-sizing: border-box;
    height: 30px;
    width: 30px;
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
    width: 18px;
    height: 18px;
  }
  .search-bar .button:active {
    opacity: .5;
  }
  .input-wrapper {
    display: flex;
    flex: 1;
    position: relative;
    margin-right: 5px;
    background: var(--floatHoverColor);
    border-radius: 4px;
    overflow: hidden;
  }
  .input-wrapper .search-result {
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: 12px;
    color: var(--sideBarTitleColor);
  }
  .input-wrapper input {
    flex: 1;
    padding: 0 8px;
    height: 30px;
    outline: none;
    border: none;
    box-sizing: border-box;
    font-size: 14px;
    color: var(--editorColor);
    padding: 0 8px;
    background: transparent;
  }
</style>
