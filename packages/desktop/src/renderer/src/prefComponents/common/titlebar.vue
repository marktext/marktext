<template>
  <div class="title-bar">
    <icon-tooltip
      :content="t('titleBar.close')"
      placement="bottom-end"
    >
      <button
        type="button"
        class="plain-button frameless-titlebar-button frameless-titlebar-close"
        :aria-label="t('titleBar.close')"
        @click.stop="handleCloseClick"
      >
        <span>
          <svg
            width="10"
            height="10"
          >
            <path :d="windowIconClose" />
          </svg>
        </span>
      </button>
    </icon-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { closePath as windowIconClose } from '../../assets/window-controls'
import IconTooltip from '@/components/iconTooltip/index.vue'

const { t } = useI18n()

const handleCloseClick = () => {
  window.electron.windowControl.close()
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
  transition: color 0.4s ease-in-out;
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

.frameless-titlebar-button > span {
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
  fill: #000000;
}

.frameless-titlebar-close:hover svg {
  fill: #ffffff;
}
</style>
