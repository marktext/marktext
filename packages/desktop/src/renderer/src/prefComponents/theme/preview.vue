<template>
  <span
    class="theme-preview"
    :style="themePreviewStyle(name)"
    aria-hidden="true"
  >
    <strong>Aa</strong>
    <span><span class="preview-link">Markdown</span> · Aa</span>
    <code>**Aa**</code>
  </span>
</template>

<script setup lang="ts">
import { themePreviewStyle } from './previews'
defineProps<{ name: string }>()
</script>

<style scoped>
.theme-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 18px;
  border-radius: 5px;
  font-size: 13px;
  text-align: left;
  min-width: 0;
}
.theme-preview strong {
  font-size: 24px;
}
.preview-link { color: var(--preview-link); }
.theme-preview code {
  background: var(--preview-code);
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
