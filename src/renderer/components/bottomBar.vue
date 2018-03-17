<template>
  <div class="bottom-bar" :class="theme">
    <search
      v-if="!sourceCode"
      :theme="theme"
    ></search>
    <status></status>
  </div>
</template>

<script>
  import Search from './search'
  import Status from './status'

  export default {
    components: {
      Search,
      Status
    },
    props: {
      sourceCode: Boolean,
      theme: String
    }
  }
</script>

<style scoped>
  .bottom-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgb(245, 245, 245);
  }
  /* dark theme */
  .dark {
    background: rgb(43, 43, 43);
  }
</style>