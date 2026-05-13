<template>
  <div class="pref-container">
    <title-bar v-if="showCustomTitleBar" />
    <side-bar />
    <div
      class="pref-content"
      :class="{ frameless: titleBarStyle === 'custom' || isOsx }"
    >
      <div
        v-if="!showCustomTitleBar"
        class="title-bar"
      />
      <router-view class="pref-setting" />
    </div>
  </div>
</template>

<script setup>
import { computed, watch, onMounted, nextTick } from 'vue'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import TitleBar from '@/prefComponents/common/titlebar'
import SideBar from '@/prefComponents/sideBar'
import { addThemeStyle } from '@/util/theme'
import { DEFAULT_STYLE } from '@/config'
import { isOsx } from '@/util'

// Store
const preferencesStore = usePreferencesStore()

// Computed properties
const { theme, titleBarStyle } = storeToRefs(preferencesStore)

const showCustomTitleBar = computed(() => {
  // Always show the custom title bar on macOS to provide a close button
  if (isOsx) {
    return true
  }
  return titleBarStyle.value === 'custom'
})

// Watchers
watch(theme, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    addThemeStyle(newValue)
  }
})

// Lifecycle
onMounted(() => {
  nextTick(() => {
    const state = global.marktext.initialState || DEFAULT_STYLE
    addThemeStyle(state.theme)

    preferencesStore.ASK_FOR_USER_PREFERENCE()
  })
})
</script>

<style>
.pref-container {
  --prefSideBarWidth: 280px;

  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  background: var(--editorBgColor);

  & h4 {
    margin: 0;
    font-weight: normal;
  }

  & h5 {
    font-weight: normal;
  }

  & .pref-content {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: calc(100vw - var(--prefSideBarWidth));
    & .title-bar {
      width: 100%;
      height: var(--titleBarHeight);
      position: fixed;
      top: 0;
      right: 0;
      -webkit-app-region: drag;
    }
    & .pref-setting {
      padding: 50px 20px;
      padding-top: var(--titleBarHeight);
      flex: 1;
      height: calc(100vh - var(--titleBarHeight));
      overflow: auto;
    }
    & span,
    & div,
    & h1,
    & h2,
    & h3,
    & h4,
    & h5 {
      user-select: none;
    }
  }
  & .pref-content.frameless .pref-setting {
    /* Move the scrollbar below the titlebar */
    margin-top: var(--titleBarHeight);
    padding-top: 0;
  }
}
</style>
