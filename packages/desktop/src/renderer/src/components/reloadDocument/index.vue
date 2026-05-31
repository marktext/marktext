<template>
  <div class="reload-document-dialog">
    <el-dialog
      v-model="showReloadDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="420px"
    >
      <template #header>
        <div class="dialog-title">
          {{ t('dialog.reloadDocumentTitle') }}
        </div>
      </template>
      <div class="body">
        {{ t('dialog.reloadDocumentMessage') }}
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancel">
            {{ t('dialog.cancel') }}
          </el-button>
          <el-button
            type="primary"
            :loading="isReloading"
            @click="reload"
          >
            {{ t('dialog.reload') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import { useEditorStore } from '@/store/editor'

const { t } = useI18n()
const editorStore = useEditorStore()
const showReloadDialog = ref(false)
const isReloading = ref(false)

const showDialog = () => {
  if (editorStore.currentFile?.pathname) {
    showReloadDialog.value = true
  }
}

const cancel = () => {
  showReloadDialog.value = false
}

const reload = async () => {
  if (isReloading.value) return

  isReloading.value = true
  try {
    await editorStore.RELOAD_CURRENT_FILE()
    showReloadDialog.value = false
  } finally {
    isReloading.value = false
  }
}

onMounted(() => {
  bus.on('showReloadDocumentDialog', showDialog)
})

onBeforeUnmount(() => {
  bus.off('showReloadDocumentDialog', showDialog)
})
</script>

<style scoped>
.reload-document-dialog .body {
  color: var(--editorColor);
  line-height: 1.6;
  padding: 0 4px;
}

.reload-document-dialog .dialog-footer {
  text-align: right;
}
</style>
