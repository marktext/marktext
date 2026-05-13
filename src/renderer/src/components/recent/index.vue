<template>
  <div class="recent-files-projects">
    <div class="centered-group">
      {{ t('recent.noTabsOpen') }}
      <button
        class="button-primary"
        @click="newFile"
      >
        {{ t('recent.newFile') }}
      </button>
    </div>
  </div>
</template>

<script setup>
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
    & button.button-primary {
      display: block;
      margin-top: 20px;
    }
  }
}
</style>
