<script setup lang="ts">
import { computed } from 'vue'
import fileIcons from '@marktext/file-icons'
import '@marktext/file-icons/build/index.css'

const props = defineProps<{
  name: string
}>()

// The legacy `muya/lib/ui/fileIcons` wrapper added a `getClassByName(name)`
// helper around the raw package's `matchName(name)?.getClass(0, false)`.
// Inline that here so we depend on `@marktext/file-icons` directly.
const getClassByName = (name: string): string | null => {
  const icon = fileIcons.matchName(name)
  return icon ? icon.getClass(0, false) : null
}

const className = computed<string[]>(() => {
  let classNames: string | null | undefined = getClassByName(
    props.name ? props.name : 'mock.md'
  )

  if (!classNames) {
    // Use fallback icon when the icon is unknown.
    classNames = getClassByName('mock.md')
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
