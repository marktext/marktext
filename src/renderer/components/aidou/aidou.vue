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
          <svg class="icon" aria-hidden="true" @click="shuffle">
            <use xlink:href="#icon-shuffle"></use>
          </svg>
          <input
            type="text" v-model="query" class="search"
            @keyup="handleInput"
            @input="historyIndex = -1"
            ref="search" placeholder="Discover you next dotu..."
          >
          <svg class="icon" aria-hidden="true" @click="search()">
            <use xlink:href="#icon-search"></use>
          </svg>          
        </div>
        <transition name="fade">
          <ul v-if="history.length && !query" class="history">
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
        <div class="img-wrapper" v-for="(emoji, index) of aiList" :key="index" @click="handleEmojiClick(emoji)">
          <img :src="emoji.link" alt="" >
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
  import loading from './loading.vue'
  import { mapState } from 'vuex'
  import hotWords from './hotWords'
  import resource from '../../store/resource'
  import { dotuHistory } from '../../util'

  export default {
    components: {
      loading
    },
    data () {
      return {
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
      container.removeEventListener('scroll', this.handlerScroll)
    },
    computed: {
      ...mapState([
        'aiLoading', 'aiList'
      ])
    },
    methods: {
      async handleEmojiClick ({ link }) {
        try {
          const base64 = await resource.fetchImgToBase64(link)
          const { url } = await resource.sm(base64)
          this.$emit('select', url)
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
          case 'Enter':
            const query = this.historyIndex !== -1 ? this.history[this.historyIndex] : this.query
            this.search(query)
            break
          case 'ArrowUp':
            historyIndex = historyIndex - 1
            if (historyIndex === -1 || historyIndex === -2) {
              this.historyIndex = this.history.length - 1
            } else {
              this.historyIndex = historyIndex
            }
            break
          case 'ArrowDown':
            historyIndex = historyIndex + 1
            if (historyIndex >= this.history.length) {
              this.historyIndex = 0
            } else {
              this.historyIndex = historyIndex
            }
            break
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
          this.$refs.search.focus()
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
        const params = { query, size, page: page + 1 }
        this.$store.dispatch('AI_SEARCH', { params, type: 'loadMore' })
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
    z-index: 10000;
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 410px;
    margin: 0 auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: auto;
    padding: 5px;
    background: #fff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, .1);
    border: 1px solid #eeeeee;
    border-radius: 3px;
  }
  .input-wrapper {
    display: flex;
    width: 100%;
  }
  .search {
    width: 100%;
    height: 30px;
    outline: none;
    border: none;
    font-size: 14px;
    padding: 0 8px;
    margin: 0 10px;
    color: #606266;
  }
  .search-wrapper svg {
    cursor: pointer;
    margin: 0 5px;
    width: 30px;
    height: 30px;
    color: #606266;
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
    color: #C0C4CC;
    text-align: center;
    cursor: pointer;
  }
  ul.history li.active {
    background: #EBEEF5;
  }
  ul.history:hover li {
    background: #fff;
  }
  ul.history li:hover .icon {
    display: block;
  }
  ul.history li:hover {
    background: #EBEEF5;
  }
  .image-container {
    height: 410px;
    overflow: auto;
  }
  .image-container .img-wrapper {
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