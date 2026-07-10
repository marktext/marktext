<template>
  <div class="recent-files-projects">
    <div class="centered-group">
      {{ t('recent.noTabsOpen') }}
      <el-button
        text
        bg
        type="primary"
        @click="newFile"
      >
        {{ t('recent.newFile') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditorStore } from '@/store/editor'
import { t } from '../../i18n'

const editorStore = useEditorStore()

const newFile = () => {
  editorStore.NEW_UNTITLED_TAB({})
}
</script>

<style scoped>
.recent-files-projects {
  background: var(--editorBgColor);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  & .centered-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--editorColor);
    & .el-button {
      margin-top: 20px;
    }
    & .el-button.is-text.is-has-bg {
      background-color: var(--buttonPrimaryBgColor);
      color: var(--buttonPrimaryFontColor);
      border-color: transparent;
    }
    & .el-button.is-text.is-has-bg:hover,
    & .el-button.is-text.is-has-bg:focus {
      background-color: var(--buttonPrimaryBgColorHover);
      color: var(--buttonPrimaryFontColorHover);
    }
  }
}
</style>
