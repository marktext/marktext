<template>
  <div class="pref-container">
    <side-bar></side-bar>
    <div class="pref-content">
      <div class="title-bar"></div>
      <router-view class="pref-setting"></router-view>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import SideBar from '@/prefComponents/sideBar'
import { addThemeStyle } from '@/util/theme'
import { DEFAULT_STYLE } from '@/config'

export default {
  components: {
    SideBar
  },
  computed: {
    ...mapState({
      'theme': state => state.preferences.theme
    })
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
    })
  }
}
</script>

<style scoped>
.pref-container {
  width: 100vw;
  height: 100vh;
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
  }
}
</style>
