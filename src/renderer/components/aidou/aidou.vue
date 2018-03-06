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
        <svg class="icon" aria-hidden="true" @click="shuffle">
          <use xlink:href="#icon-shuffle"></use>
        </svg>
        <input type="text" v-model="query" class="search" @keyup.13="search" ref="search">
        <svg class="icon" aria-hidden="true" @click="search">
          <use xlink:href="#icon-search"></use>
        </svg>
      </div>
      <div class="image-container" ref="emojis">
        <div class="img-wrapper" v-for="(emoji, index) of aiList" :key="index" @click="handleEmojiClick(emoji)">
          <img :src="emoji.link" alt="" >
        </div>
        <loading v-if="aiLoading"></loading>
      </div>
      <!--  <div slot="footer" class="dialog-footer">
        <el-button @click="showAiDou = false" size="mini">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-close"></use>
          </svg>
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

  export default {
    components: {
      loading
    },
    data () {
      return {
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
      search () {
        const { query, size } = this
        const page = this.page = 1
        const type = 'search'
        const params = { query, size, page }
        this.$store.dispatch('AI_SEARCH', { params, type })
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
  .search-wrapper {
    max-width: 410px;
    margin: 0 auto;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 5px;
    background: #fff;
    box-shadow: 0 3px 8px rgba(0,0,0,.1);
    border: 1px solid #eee;
    border-radius: 3px;
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
</style>