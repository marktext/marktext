<template>
    <div class="side-bar-search"
      :class="theme"
    >
      <div class="search-wrapper">
        <input
          type="text" v-model="keyword"
          placeholder="Search in project..."
          @keyup="search"
        >
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-search"></use>
        </svg>
      </div>
      <div class="search-result" v-if="searchResult.length">
        <list-file
          v-for="(file, index) of searchResult"
          :key="index"
          :file="file"
        ></list-file>
      </div>
      <div class="empty" v-else>
        <span>{{ !keyword ? 'Input search keyword' : 'No matched files' }}</span>
      </div>
    </div>
</template>

<script>
  import { mapGetters, mapState } from 'vuex'
  import ListFile from './listFile.vue'

  export default {
    data () {
      return {
        keyword: '',
        searchResult: []
      }
    },
    components: {
      ListFile
    },
    computed: {
      ...mapState({
        'theme': state => state.preferences.theme
      }),
      ...mapGetters(['fileList'])
    },
    methods: {
      search () {
        const { keyword } = this

        if (!keyword) {
          this.searchResult = []
          return
        }
        this.searchResult = this.fileList.filter(f => f.data.markdown.indexOf(keyword) >= 0)
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
    margin: 35px 20px;
    border-radius: 3px;
    height: 30px;
    border: 1px solid var(--lightBorder);
    box-sizing: border-box;
    align-items: center;
    & > input {
      height: 100%;
      flex: 1;
      border: none;
      outline: none;
      padding: 0 8px;
      font-size: 14px;
      width: 50%;
    }
    & > svg {
      cursor: pointer;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-right: 5px;
      &:hover {
        color: var(--brandColor);
      }
    }
  }
  .empty,
  .search-result {
    flex: 1;
    overflow: auto;
    &::-webkit-scrollbar:vertical {
      width: 5px;
    }
  }
  .empty {
    font-size: 14px;
    text-align: center;
  }
  .dark.side-bar-search .search-wrapper {
    background: rgb(54, 55, 49);
    border-color: transparent;
    & > input,
    & > svg {
      background: transparent;
      color: #C0C4CC;
    }
  }
</style>
