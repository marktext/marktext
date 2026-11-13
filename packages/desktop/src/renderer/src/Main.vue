<script setup lang="ts">
import { watch } from 'vue'
import { usePreferencesStore } from './store/preferences'
import { installInstantWheelScrolling } from './util/instantWheelScrolling'

const preferences = usePreferencesStore()

watch(() => preferences.smoothScrolling, (enabled, _previous, onCleanup) => {
  if (enabled) return
  onCleanup(installInstantWheelScrolling(document))
}, { immediate: true })
</script>

<template>
  <div id="app">
    <router-view />
  </div>
</template>
