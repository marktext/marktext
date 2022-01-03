<template>
  <div class="title-bar">
    <div class="frameless-titlebar-button frameless-titlebar-close" @click.stop="handleCloseClick">
      <div>
        <svg width="10" height="10">
          <path :d="windowIconClose" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script>
import { getCurrentWindow } from '@electron/remote'
import { closePath } from '../../assets/window-controls.js'

export default {
  data () {
    this.windowIconClose = closePath
    return {}
  },
  methods: {
    handleCloseClick () {
      getCurrentWindow().close()
    }
  }
}
</script>

<style scoped>
  .title-bar {
    -webkit-app-region: drag;
    user-select: none;
    background: transparent;
    height: var(--titleBarHeight);
    box-sizing: border-box;
    color: var(--editorColor50);
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    z-index: 2;
    transition: color .4s ease-in-out;
    cursor: default;
  }

  .frameless-titlebar-button {
    position: absolute;
    display: block;
    top: 0;
    right: 0;
    width: 46px;
    height: var(--titleBarHeight);
    -webkit-app-region: no-drag;
  }

  .frameless-titlebar-button > div {
    position: absolute;
    display: inline-flex;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
  }

  .frameless-titlebar-close:hover {
    background-color: rgb(228, 79, 79);
  }

  .frameless-titlebar-button svg {
    fill: #000000
  }

  .frameless-titlebar-close:hover svg {
    fill: #ffffff
  }
</style>
