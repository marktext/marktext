<template>
  <div class="pref-container">
    <title-bar v-if="showCustomTitleBar"></title-bar>
    <side-bar></side-bar>
    <div
      class="pref-content"
      :class="{ 'frameless': titleBarStyle === 'custom' || isOsx }"
    >
      <div class="title-bar" v-if="!showCustomTitleBar"></div>
      <router-view class="pref-setting"></router-view>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import TitleBar from '@/prefComponents/common/titlebar'
import SideBar from '@/prefComponents/sideBar'
import { loadingPageMixins } from '@/mixins'
import { addThemeStyle } from '@/util/theme'
import { DEFAULT_STYLE } from '@/config'
import { isOsx } from '@/util'

export default {
  data () {
    this.isOsx = isOsx
    return {}
  },
  mixins: [loadingPageMixins],
  components: {
    TitleBar,
    SideBar
  },
  computed: {
    ...mapState({
      theme: state => state.preferences.theme,
      titleBarStyle: state => state.preferences.titleBarStyle
    }),
    showCustomTitleBar () {
      return this.titleBarStyle === 'custom' && !this.isOsx
    }
  },
  watch: {
    theme: function (value, oldValue) {
      if (value !== oldValue) {
        addThemeStyle(value)
      }
    }
  },
  created () {
    this.$nextTick(() => {
      const state = global.marktext.initialState || DEFAULT_STYLE
      addThemeStyle(state.theme)

      this.$store.dispatch('ASK_FOR_USER_PREFERENCE')
      this.hideLoadingPage()
    })
  }
}
</script>

<style scoped>
.pref-container {
  --prefSideBarWidth: 320px;

  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  background: var(--editorBgColor);
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
    & span, & div,
    & h1, & h2, & h3, & h4, & h5 {
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
