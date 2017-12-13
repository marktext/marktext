<template>
  <div class="title-bar"
    :class="{'active': active}"
  >
    <div class="title">
      <img src="../assets/icons/markdown.svg" v-if="filename">
      {{ filename }}
    </div>
  </div>
</template>

<script>
  export default {
    props: {
      filename: String,
      active: Boolean
    }
  }
</script>

<style scoped>
  .title-bar {
    user-select: none;
    width: 100%;
    height: 22px;
    border-bottom: 1px solid #ccc;
    box-sizing: border-box;
    color: #999;
    background: linear-gradient(180deg, #ffffff, #efefef);
    -webkit-app-region: drag;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
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
    height: 100%;
    line-height: 22px;
    font-size: 12px;
    font-weight: 500px;
    text-align: center;
  }
</style>