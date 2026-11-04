<template>
  <div class="pref-container">
    <title-bar v-if="showCustomTitleBar" />
    <side-bar />
    <div
      class="pref-content"
      :class="{ frameless: isWindowFrameless || isMac }"
    >
      <div
        v-if="!showCustomTitleBar"
        class="title-bar"
      />
      <router-view class="pref-setting" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, nextTick } from 'vue'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import TitleBar from '@/prefComponents/common/titlebar.vue'
import SideBar from '@/prefComponents/sideBar/index.vue'
import { addThemeStyle } from '@/util/theme'
import { useSettingLocation } from '@/prefComponents/settingLocation'
import { DEFAULT_STYLE } from '@/config'
import { isMac } from '@/util'

useSettingLocation()
const preferencesStore = usePreferencesStore()

const { theme } = storeToRefs(preferencesStore)

// The main process sets the window frame when it creates the window, so a title bar style
// that the user changes here applies only to windows opened later. We decide from the style
// the window opened with; otherwise a switch to the native style hides our close button on a
// window that has no frame, and the user cannot close it.
const isWindowFrameless = window.marktext?.initialState?.titleBarStyle !== 'native'
// On macOS we always show the custom title bar for its close button.
const showCustomTitleBar = isMac || isWindowFrameless

watch(theme, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    addThemeStyle(newValue)
  }
})

onMounted(() => {
  nextTick(() => {
    const state = window.marktext?.initialState ?? DEFAULT_STYLE
    addThemeStyle(state.theme ?? DEFAULT_STYLE.theme)

    preferencesStore.ASK_FOR_USER_PREFERENCE()
  })
})
</script>

<style>
.pref-container {
  --prefSideBarWidth: 220px;

  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  background: var(--editorBgColor);

  & h1,
  & h2,
  & h3,
  & h4,
  & h5,
  & h6 {
    color: var(--editorColor);
    font-weight: 500;
    line-height: 1.4;
  }

  & h4 {
    margin: 0;
    font-size: 18px;
  }

  & h5 {
    font-size: 15px;
  }

  & h6 {
    font-size: 15px;
  }

  & .notes {
    display: block;
    margin: 8px 0 0;
    font-style: italic;
    font-size: 12px;
    color: var(--editorColor80);
    /* A Windows path is one unbreakable token, so without this it widens `.pref-content`. */
    overflow-wrap: anywhere;
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
      container-type: inline-size;
      padding: 50px 40px;
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
    & h5,
    & h6 {
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

<style>
.is-search-target {
  animation: preference-location 1.8s ease-out;
  outline-offset: 5px;
}
@keyframes preference-location {
  from { outline: 2px solid var(--themeColor); }
  to { outline: 2px solid transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .is-search-target { animation-duration: 0.1s; }
}
</style>
