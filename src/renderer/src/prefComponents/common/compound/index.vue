<template>
  <section class="pref-compound-item">
    <div class="pref-compound-head">
      <slot name="head" />
    </div>
    <div class="pref-compound-body">
      <slot name="children" />
    </div>
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  notes?: string
}>()
</script>

<style>
.pref-compound-item {
  font-size: 14px;
  user-select: none;
  margin: 32px 0;
  color: var(--editorColor);

  & .pref-compound-head h6.title {
    padding-bottom: 6px;
  }

  & .pref-compound-body {
    padding: 0;
    margin-top: -4px;
  }

  & .description {
    margin-bottom: 10px;
    & i {
      cursor: pointer;
      opacity: 0.7;
      color: var(--iconColor);
    }
    & i:hover {
      color: var(--themeColor);
    }
  }
}
</style>
