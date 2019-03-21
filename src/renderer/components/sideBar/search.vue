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
        <div class="no-data">
          <svg :viewBox="EmptyIcon.viewBox" aria-hidden="true">
            <use :xlink:href="EmptyIcon.url" />
          </svg>
        </div>
      </div>
    </div>
</template>

<script>
  import { mapGetters } from 'vuex'
  import ListFile from './listFile.vue'
  import EmptyIcon from '@/assets/icons/undraw_empty.svg'

  export default {
    data () {
      this.EmptyIcon = EmptyIcon
      return {
        keyword: '',
        searchResult: []
      }
    },
    components: {
      ListFile
    },
    computed: {
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
    border: 1px solid var(--floatBorderColor);
    background: var(--floatBorderColor);
    border-radius: 15px;
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
    & > svg {
      cursor: pointer;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-right: 10px;
      &:hover {
        color: var(--iconColor);
      }
    }
  }
  .empty,
  .search-result {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    &::-webkit-scrollbar:vertical {
      width: 5px;
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
