<template>
  <div class="title-bar"
    :class="{'active': active}"
  >
    <div class="title">
      <img src="../assets/icons/markdown.svg" v-if="filename">
      {{ filename }}
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
      active: Boolean,
      wordCount: Object
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
    -webkit-app-region: drag;
    user-select: none;
    width: 100%;
    height: 22px;
    box-sizing: border-box;
    color: #C0C4CC;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1;
    transition: color .4s ease-in;
  }
  .active {
    color: #909399;
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
    color: #C0C4CC;
    height: 15px;
    line-height: 15px;
    margin-top: 4px;
    padding: 1px 5px;
    border-radius: 1px;
    transition: all .3s ease-in;
  }
  .word-count:hover {
    background: #F2F6FC;
    color: #606266;
  }
</style>
