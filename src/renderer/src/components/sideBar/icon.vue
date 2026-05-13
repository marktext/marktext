<script setup>
import { computed } from 'vue'
import fileIcons from 'muya/lib/ui/fileIcons'

const props = defineProps({
  name: {
    type: String,
    required: true
  }
})

const className = computed(() => {
  let classNames = fileIcons.getClassByName(props.name ? props.name : 'mock.md')

  if (!classNames) {
    // Use fallback icon when the icon is unknown.
    classNames = fileIcons.getClassByName('mock.md')
  }
  return classNames.split(/\s/)
})
</script>

<template>
  <span
    :class="className"
    class="file-icon"
  />
</template>

<style scoped>
.file-icon {
  flex-shrink: 0;
  margin-right: 5px;
}
</style>
