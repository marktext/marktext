<template>
  <div class="aidou">
    <el-dialog
      :visible.sync="showAiDou"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="610px"

    >
      <div slot="title" class="search-wrapper">
        <div class="input-wrapper">
          <svg class="icon" aria-hidden="true" @click="search()">
            <use xlink:href="#icon-search"></use>
          </svg>
          <input
            type="text" v-model="query" class="search"
            @keyup="handleInput"
            @input="historyIndex = -1"
            @focus = "showCollection = false"
            ref="search" placeholder="Discover you next dotu..."
          >
          <svg class="icon" aria-hidden="true" @click="getCollection">
            <use xlink:href="#icon-collect"></use>
          </svg>
          <svg class="icon" aria-hidden="true" @click="shuffle">
            <use xlink:href="#icon-shuffle"></use>
          </svg>
        </div>
        <transition name="fade">
          <ul v-if="history.length && !query && !showCollection" class="history">
            <li v-for="(word, index) of history" :key="index" @click="search(word)"
              :class="{'active': index === historyIndex}"
            >
              {{word}}
              <svg class="icon" aria-hidden="true" @click.stop="deleteHistory(word)">
                <use xlink:href="#icon-close"></use>
              </svg>
            </li>
            <div class="clear-history">
              <span @click="clearHistory">Clear History</span>
            </div>
          </ul>
        </transition>
      </div>
      <div class="image-container" ref="emojis">
        <div class="img-wrapper" v-for="(emoji, index) of emojis" :key="index" @click="handleEmojiClick(emoji)">
          <svg
            class="icon"
            :class="{'active': emoji.collected}"
            aria-hidden="true" @click.stop="collect(emoji)"
          >
            <use xlink:href="#icon-collected"></use>
          </svg>
          <img :src="emoji.link" alt="doutu">
        </div>
        <loading v-if="aiLoading"></loading>
      </div>
      <!--  <div slot="footer" class="dialog-footer">
        <el-button @click="showAiDou = false" size="mini">
        </el-button>
      </div> -->
    </el-dialog>
  </div>
</template>

<script>
import bus from '../../bus'
import loading from './loading'
import { mapState } from 'vuex'
import hotWords from './hotWords'
import resource from '../../store/resource'
import { dotuHistory, collection } from '../../util'

export default {
  components: {
    loading
  },
  data () {
    return {
      showCollection: false,
      collection: collection.getItems(),
      historyIndex: -1,
      history: dotuHistory.getItems(),
      showAiDou: false,
      query: '',
      page: 1,
      size: 24,
      bindScroll: false
    }
  },
  created () {
    this.$nextTick(() => {
      bus.$on('aidou', this.handleShowAiDou)
    })
  },
  beforeDestroy () {
    const container = this.$refs.emojis
    if (container) {
      container.removeEventListener('scroll', this.handlerScroll)
    }
  },
  computed: {
    ...mapState({
      aiList: state => state.aidou.aiList,
      aiLoading: state => state.aidou.aiLoading
    }),
    emojis () {
      return this.aiList.map(e => {
        e.collected = this.collection.findIndex(c => c.link === e.link) > -1
        return e
      })
    }
  },
  methods: {
    getCollection () {
      const data = this.collection
      const type = 'collect'
      this.$store.dispatch('AI_LIST', { data, type })
      this.showCollection = true
      this.query = ''
    },
    collect (emoji) {
      if (emoji.collected) {
        emoji.collected = false
        collection.deleteItem(emoji)
      } else {
        emoji.collected = true
        collection.setItem(emoji)
      }
      this.collection = collection.getItems()
    },
    async handleEmojiClick ({ link }) {
      try {
        const base64 = await resource.fetchImgToBase64(link)
        const { url } = await resource.sm(base64)
        bus.$emit('insert-image', url)
        this.showAiDou = false
      } catch (err) {
        // todo handle error
        console.log(err)
      }
    },
    clearHistory () {
      dotuHistory.clear()
      this.history = dotuHistory.getItems()
      this.historyIndex = -1
    },
    deleteHistory (word) {
      dotuHistory.deleteItem(word)
      this.history = dotuHistory.getItems()
      this.historyIndex = -1
    },
    handleInput (event) {
      let historyIndex = this.historyIndex
      switch (event.key) {
        case 'Enter': {
          const query = this.historyIndex !== -1 ? this.history[this.historyIndex] : this.query
          if (!this.aiLoading) {
            this.search(query)
          }
          break
        }
        case 'ArrowUp': {
          historyIndex = historyIndex - 1
          if (historyIndex === -1 || historyIndex === -2) {
            this.historyIndex = this.history.length - 1
          } else {
            this.historyIndex = historyIndex
          }
          break
        }
        case 'ArrowDown': {
          historyIndex = historyIndex + 1
          if (historyIndex >= this.history.length) {
            this.historyIndex = 0
          } else {
            this.historyIndex = historyIndex
          }
          break
        }
      }
    },
    handleShowAiDou () {
      this.showAiDou = true
      if (!this.bindScroll) {
        this.$nextTick(() => {
          const container = this.$refs.emojis
          container.addEventListener('scroll', this.handlerScroll)
          this.bindScroll = true
        })
      }
      this.$nextTick(() => {
        if (this.$refs.search) {
          this.$refs.search.focus()
        }
      })
    },
    handlerScroll (event) {
      const container = this.$refs.emojis
      const { offsetHeight, scrollHeight, scrollTop } = container
      if (scrollHeight - scrollTop - offsetHeight <= 100 && !this.aiLoading) {
        this.loadMore()
      }
    },
    search (word = this.query.trim()) {
      const { size } = this
      const query = this.query = word
      const page = this.page = 1
      const type = 'search'
      const params = { query, size, page }
      if (query) {
        // add query to dotuHistory
        dotuHistory.setItem(query)
        this.history = dotuHistory.getItems()
        this.historyIndex = -1
        this.$store.dispatch('AI_SEARCH', { params, type })
      }
    },
    loadMore () {
      const { query, size, page } = this
      if (query.trim()) {
        const params = { query, size, page: page + 1 }
        this.$store.dispatch('AI_SEARCH', { params, type: 'loadMore' })
      }
    },
    shuffle () {
      const luckWord = hotWords[Math.random() * hotWords.length | 0]
      this.query = luckWord
      this.search()
    }
  }
}
</script>

<style scoped>
  .el-dialog__header {
    margin-bottom: 20px;
  }
  .search-wrapper {
    margin: 0 auto;
    margin-top: 8px;
    z-index: 10000;
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 410px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: auto;
    padding: 5px;
    color: var(--editorColor);
    background: var(--floatBgColor);
    box-shadow: 0 3px 8px 3px var(--floatHoverColor);
    border: 1px solid var(--floatBorderColor);
    border-radius: 3px;
  }
  .input-wrapper {
    display: flex;
    width: 100%;
    border: 1px solid var(--sideBarTextColor);
    border-radius: 14px;
  }
  .search {
    width: 100%;
    height: 30px;
    outline: none;
    border: none;
    font-size: 14px;
    padding: 0 8px;
    margin: 0 10px;
    color: var(--editorColor);
    background: transparent;
  }
  .search-wrapper svg {
    cursor: pointer;
    margin: 0 5px;
    width: 30px;
    height: 30px;
    color: var(--iconColor);
    transition: all .3s ease-in-out;
  }
  .search-wrapper svg:hover {
    color: var(--themeColor);
  }
  ul.history {
    display: flex;
    flex-direction: column;
    list-style: none;
    padding: 8px;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
  }
  ul.history li {
    height: 35px;
    padding: 0 8px;
    line-height: 35px;
    cursor: pointer;
    position: relative;
  }
  ul.history li .icon {
    position: absolute;
    top: 12.5px;
    right: 12px;
    width: 10px;
    height: 10px;
    display: none;
  }
   ul.history .clear-history {
    text-align: center;
  }
  ul.history .clear-history span {
    font-size: 12px;
    color: var(--themeColor);
    text-align: center;
    cursor: pointer;
  }
  ul.history li.active {
    background: var(--floatHoverColor);
  }
  ul.history:hover li {
    background: transparent;
  }
  ul.history li:hover .icon {
    display: block;
  }
  ul.history li:hover {
    background: var(--floatHoverColor);
  }
  .image-container {
    height: 410px;
    overflow: auto;
  }
  .image-container .img-wrapper {
    position: relative;
    overflow: hidden;
    width: 130px;
    height: 130px;
    margin-right: 10px;
    margin-bottom: 10px;
    box-sizing: border-box;
    border-radius: 3px;
    cursor: pointer;
    transition: all .25s ease-in-out;
    display: inline-block;
  }
  .image-container .img-wrapper img {
    width: 100%;
    height: 100%;
  }
  .image-container .img-wrapper > svg {
    position: absolute;
    top: 3px;
    right: 0px;
    width: 20px;
    height: 20px;
    display: none;
  }
  .image-container .img-wrapper > svg.active {
    color: var(--themeColor);
  }
  .image-container .img-wrapper:hover > svg {
    display: block;
  }
  .image-container .img-wrapper:hover {
    transform: scale(1.05);
  }
  .image-container .img-wrapper:nth-of-type(4n) {
    margin-right: 0;
  }
  .dialog-footer {
    text-align: center;
  }
  .fade-enter-active, .fade-leave-active {
    transition: opacity .2s;
  }
  .fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
    opacity: 0;
  }
</style>
