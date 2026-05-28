<script setup lang="ts">
import { computed } from 'vue'
import fileIcons from 'muya/lib/ui/fileIcons'

const props = defineProps<{
  name: string
}>()

const className = computed<string[]>(() => {
  let classNames: string | null | undefined = fileIcons.getClassByName(
    props.name ? props.name : 'mock.md'
  )

  if (!classNames) {
    // Use fallback icon when the icon is unknown.
    classNames = fileIcons.getClassByName('mock.md')
  }
  return (classNames ?? '').split(/\s/)
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
