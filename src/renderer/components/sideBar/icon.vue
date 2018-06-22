<template>
    <span :class="className" class="file-icon"></span>
</template>

<script>
  import fileIcons from '../../../editor/fileIcons'

  export default {
    props: {
      name: {
        type: String,
        required: true,
        default: 'mock.md'
      }
    },
    computed: {
      className () {
        return fileIcons.getClassWithColor(this.name ? this.name : 'mock.md').split(/\s/)
      }
    }
  }
</script>

<style scoped>
  .file-icon {
    flex-shrink: 0;
    margin-right: 5px;
  }
</style>
