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
      >{{wordCount.word >= 2 ? `${wordCount.word} Words` : `${wordCount.word} Word`}}</div>
    </div>
    <div 
      class="popup"
      :class="{ 'show-popup': show }"
      @click.stop="noop"
    >
      <div class="pop-item">
        <div class="label">Words</div>
        <div class="value">{{wordCount.word}}</div>
      </div>
      <div class="pop-item">
        <div class="label">Paragraphs</div>
        <div class="value">{{wordCount.paragraph}}</div>
      </div>
      <div class="pop-item">
        <div class="label">Characters</div>
        <div class="value">{{wordCount.character}}</div>
      </div>
      <div class="pop-item">
        <div class="label">All</div>
        <div class="value">{{wordCount.all}}</div>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    data () {
      return {
        show: false
      }
    },
    props: {
      filename: String,
      active: Boolean,
      wordCount: Object
    },
    created () {
      document.addEventListener('click', event => {
        this.show = false
      })
    },
    methods: {
      handleWordClick () {
        this.show = !this.show
      },
      noop () {}
    }
  }
</script>

<style scoped>
  .title-bar {
    -webkit-app-region: drag;
    user-select: none;
    width: 100%;
    height: 22px;
    border-bottom: 1px solid #ccc;
    box-sizing: border-box;
    color: #999;
    background: linear-gradient(180deg, #ffffff, #efefef);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1;
  }
  .active {
    background: linear-gradient(180deg, #efefef, #ccc);
    color: #333;
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
  }
  .word-count {
    font-size: 12px;
    color: #666;
    height: 15px;
    line-height: 15px;
    margin-top: 3px;
    padding: 0 3px;
    border-radius: 2px;
    cursor: pointer;
    transition: all .3s ease-in;
  }
  .word-count:hover {
    background: #bbb;
    color: #000;
  }
  .popup {
    font-size: 12px;
    font-weight: 500;
    width: 150px;
    height: auto;
    padding: 10px;
    background: rgb(239, 239, 239);
    position: absolute;
    top: 35px;
    right: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 6px 0 rgba(0,0,0,.1);
    transition: all .2s ease-out;
    transform-origin: top;
    transform: scale(0);
    opacity: .3;
  }
  .show-popup {
    transform: scale(1);
    opacity: 1;
  }
  .popup::before {
    content: '';
    width: 15px;
    height: 15px;
    background: rgb(239, 239, 239);
    border: 1px solid #ddd;
    display: inline-block;
    position: absolute;
    top: -9px;
    right: 60px;
    border-right: none;
    border-bottom: none;
    transform: rotate(45deg);
  }
  .pop-item {
    display: flex;
  }
  .label {
    width: 75px;
    flex-shrink: 1;
    text-align: right;
    font-weight: 600;
  }
  .value {
    padding-left: 25px;
  }
</style>
