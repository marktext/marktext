<template>
    <div
      class="recent-files-projects"
      @click="newFile"
    >
    </div>
</template>

<script>
  export default {
    methods: {
      newFile () {
        this.$store.dispatch('NEW_BLANK_FILE')
      }
    }
  }
</script>

<style scoped>
  .recent-files-projects {
    background: var(--editorBgColor);
    flex: 1;
  }
</style>
