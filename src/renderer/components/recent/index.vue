<template>
    <div
      class="recent-files-projects"
      :class="theme"
    >
      <h1>Mark Text</h1>
      <div>Make you fall in love with writing</div>
    </div>
</template>

<script>
  import { mapState } from 'vuex'

  export default {
    computed: {
      ...mapState({
        'theme': state => state.preferences.theme
      })
    }
  }
</script>

<style scoped>
  .recent-files-projects {
    flex: 1;
    & h1 {
      text-align: center;
      font-weight: 100;
      font-size: 4rem;
      margin-top: 200px;
      font-family: monospace;
      color: var(--primaryColor);
      border-bottom: none;
    }
    & > div {
      font-size: 2rem;
      font-family: cursive;
      text-align: center;
      color: var(--regularColor);
    }
  }
  .dark.recent-files-projects {
    background: var(--darkBgColor);
    & > h1 {
      color: var(--baseBorder);
    }
    & > div {
      color: var(--placeholerColor);
    }
  }
</style>
