<script setup lang="ts">
import { computed } from 'vue'
import '@marktext/file-icons/build/index.css'
import { getFileIconClasses } from './fileIconClass'

const props = defineProps<{
  name: string
}>()

const className = computed<string[]>(() => getFileIconClasses(props.name))
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
