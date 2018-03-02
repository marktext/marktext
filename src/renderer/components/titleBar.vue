<template>
  <div class="title-bar"
    :class="{ 'active': active }"
  >
    <div class="title">
      <span v-for="(path, index) of paths" :key="index">
        {{ path }}
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-arrow-right"></use>
        </svg>
      </span>
      <span>{{ filename }}</span>
    </div>
    <div class="right-toolbar">
      <div 
        class="word-count"
        @click.stop="handleWordClick"
      >{{ `${HASH[show]} ${wordCount[show]}` }}</div>
    </div>
  </div>
</template>

<script>
  export default {
    data () {
      this.HASH = {
        'word': 'W',
        'character': 'C',
        'paragraph': 'P',
        'all': 'A'
      }
      return {
        show: 'word'
      }
    },
    props: {
      filename: String,
      pathname: String,
      active: Boolean,
      wordCount: Object
    },
    computed: {
      paths () {
        const pathnameToken = this.pathname.split('/').filter(i => i)
        return pathnameToken.slice(0, pathnameToken.length - 1).slice(-3)
      }
    },
    methods: {
      handleWordClick () {
        const ITEMS = ['word', 'paragraph', 'character', 'all']
        const len = ITEMS.length
        let index = ITEMS.indexOf(this.show)
        index += 1
        if (index >= len) index = 0
        this.show = ITEMS[index]
      }
    }
  }
</script>

<style scoped>
  .title-bar {
    background: rgb(252, 252, 252);
    -webkit-app-region: drag;
    user-select: none;
    width: 100%;
    height: 22px;
    box-sizing: border-box;
    color: #F2F6FC;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1;
    transition: color .4s ease-in-out;
  }
  .active {
    color: #DCDFE6;
  }
  img {
    height: 90%;
    margin-top: 1px;
    vertical-align: top;
  }
  .title {
    padding: 0 100px;
    height: 100%;
    line-height: 22px;
    font-size: 12px;
    font-weight: 500;
    text-align: center;
    transition: all .25s ease-in-out;
  }
  .title:hover {
    color: #606266;
  }
  .right-toolbar {
    padding: 0 10px;
    height: 100%;
    position: absolute;
    top: 0;
    right: 0;
    width: 100px;
    display: flex;
    flex-direction: row-reverse;
  }
  .word-count {
    cursor: pointer;
    font-size: 12px;
    color: #F2F6FC;
    height: 15px;
    line-height: 15px;
    margin-top: 4px;
    padding: 1px 5px;
    border-radius: 1px;
    transition: all .25s ease-in-out;
  }
  .active .word-count {
    color: #DCDFE6;
  }
  .word-count:hover {
    background: #F2F6FC;
    color: #606266;
  }
</style>
