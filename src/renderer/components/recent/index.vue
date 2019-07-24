<template>
    <div
      class="recent-files-projects"
    >
      <div class="centered-group">
        <svg :viewBox="ContentIcon.viewBox" aria-hidden="true">
          <use :xlink:href="ContentIcon.url" />
        </svg>
        <button class="button-primary" @click="newFile">
          New File
        </button>
      </div>
    </div>
</template>

<script>
import ContentIcon from '@/assets/icons/undraw_content.svg'

export default {
  data () {
    this.ContentIcon = ContentIcon
    return {}
  },
  methods: {
    newFile () {
      this.$store.dispatch('NEW_UNTITLED_TAB', {})
    }
  }
}
</script>

<style scoped>
  .recent-files-projects {
    background: var(--editorBgColor);
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-around;
    & .centered-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      & svg {
        width: 200px;
        fill: var(--themeColor);
      }
      & button.button-primary {
        display: block;
        margin-top: 20px;
      }
    }
  }
</style>
