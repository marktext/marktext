<template>
    <div
      class="recent-files-projects"
    >
      <div class="button-group">
        <svg :viewBox="ContentIcon.viewBox" aria-hidden="true">
          <use :xlink:href="ContentIcon.url" />
        </svg>
        <a href="javascript:;" @click="newFile">
          New File
        </a>
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
        this.$store.dispatch('NEW_BLANK_FILE')
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
    & .button-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      & svg {
        width: 200px;
        fill: var(--themeColor);
      }
      & a {
        text-decoration: none;
        background: var(--themeColor);
        box-shadow: 0 0 8px 0 var(--selectionColor);
        display: block;
        padding: 4px 10px;
        border-radius: 5px;
        margin-top: 20px;
        color: #fff;
        &:active {
          opacity: .5;
        }
      }
    }
  }
</style>
