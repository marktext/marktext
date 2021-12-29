<template>
    <span :class="className" class="file-icon"></span>
</template>

<script>
import fileIcons from 'muya/lib/ui/fileIcons'

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
      let icon = fileIcons.getClassByName(this.name ? this.name : 'mock.md')
      if (!icon) {
        // Use fallback icon when the icon is unknown.
        icon = fileIcons.getClassByName('mock.md')
      }
      return icon.split(/\s/)
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
