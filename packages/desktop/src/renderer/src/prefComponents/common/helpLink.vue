<template>
  <button
    type="button"
    class="plain-button pref-help-link"
    :aria-label="label"
    @click="openHelp"
  >
    <LinkIcon :size="14" />
  </button>
</template>

<script setup lang="ts">
import LinkIcon from '@/components/icons/LinkIcon.vue'

const props = defineProps<{ href: string; label: string }>()
const openHelp = (): void => {
  window.electron.shell.openExternal(props.href)
}
</script>

<style scoped>
.pref-help-link {
  flex-shrink: 0;
  color: var(--iconColor);
  opacity: 0.7;
}
.pref-help-link:hover,
.pref-help-link:focus-visible {
  color: var(--themeColor);
  opacity: 1;
}
</style>
