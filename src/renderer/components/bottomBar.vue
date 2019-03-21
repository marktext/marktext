<template>
  <div class="bottom-bar">
    <search
      v-if="!sourceCode"
    ></search>
  </div>
</template>

<script>
  import Search from './search'

  export default {
    components: {
      Search
    },
    props: {
      sourceCode: Boolean
    }
  }
</script>

<style scoped>
  .bottom-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--itemBgColor);
  }
</style>