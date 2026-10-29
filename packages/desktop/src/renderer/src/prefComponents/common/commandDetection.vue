<template>
  <div
    class="command-detection"
    :data-state="state"
    :aria-busy="checking"
  >
    <setting-note
      role="status"
      aria-live="polite"
    >
      {{ checking ? t('preferences.commandDetection.checking') : message }}
    </setting-note>
    <el-button
      :loading="checking"
      :disabled="checking"
      @click="$emit('check')"
    >
      {{ t('preferences.commandDetection.recheck') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingNote from './settingNote.vue'
import type { CommandDetectionState } from './types'

const props = defineProps<{ state: CommandDetectionState; message: string }>()
defineEmits<{ check: [] }>()
const { t } = useI18n()
const checking = computed(() => props.state === 'checking')
</script>

<style scoped>
.command-detection {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.command-detection :deep(.notes) { margin: 0; }
.command-detection .el-button { font-style: normal; }
.command-detection[data-state='failed'] :deep(.notes) { color: var(--deleteColor); }
</style>
