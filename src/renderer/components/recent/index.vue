<template>
    <div
      class="recent-files-projects"
      :class="theme"
      @click="newFile"
    >
    </div>
</template>

<script>
  import { mapState } from 'vuex'

  export default {
    computed: {
      ...mapState({
        'theme': state => state.preferences.theme
      })
    },
    methods: {
      newFile () {
        this.$store.dispatch('NEW_BLANK_FILE')
      }
    }
  }
</script>

<style scoped>
  .recent-files-projects {
    flex: 1;
  }
  .dark.recent-files-projects {
    background: var(--darkBgColor);
    & > div {
      color: var(--baseBorder);
    }
  }
</style>
