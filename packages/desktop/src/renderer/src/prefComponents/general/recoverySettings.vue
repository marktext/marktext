<template>
  <compound
    class="recovery-settings"
  >
    <template #head>
      <h6 class="title">
        {{ t('preferences.general.startup.title') }}
      </h6>
    </template>
    <template #children>
      <cur-select
        id="setting-startUpAction"
        :description="t('preferences.general.startup.action')"
        :value="value.startUpAction"
        :options="actionOptions"
        :disable="busy"
        :on-change="(action) => save({ startUpAction: action as StartupAction })"
      />
      <div
        v-if="value.startUpAction === 'folder'"
        id="setting-defaultDirectoryToOpen"
        class="startup-directory"
      >
        <el-button
          size="small"
          :disabled="busy"
          @click="selectDirectory"
        >
          {{ t('preferences.general.startup.selectFolder') }}
        </el-button>
        <span class="notes">{{ value.defaultDirectoryToOpen }}</span>
      </div>
      <bool
        v-for="key in options"
        :id="`setting-${key}`"
        :key="key"
        :description="t(`preferences.general.startup.${key}`)"
        :notes="preferenceNotes(key)"
        :bool="value[key]"
        :disable="busy"
        :on-change="(checked) => save({ [key]: checked })"
      />
      <p
        v-if="error"
        class="notes"
        role="alert"
      >
        {{ t('preferences.general.startup.failure') }}
      </p>
    </template>
  </compound>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Compound from '../common/compound/index.vue'
import CurSelect from '../common/select/index.vue'
import Bool from '../common/bool/index.vue'
import { useI18n } from 'vue-i18n'
import { preferenceNotes } from '../registry'
import type {
  RecoveryPreferences,
  StartupAction,
  PreferenceUpdateResult,
  UserPreferences
} from '@shared/types/preferences'

const props = defineProps<{
  value: RecoveryPreferences
  update: (patch: Partial<RecoveryPreferences>) => Promise<PreferenceUpdateResult>
  chooseDirectory: () => Promise<string | null>
}>()
const emit = defineEmits<{ persisted: [preferences: UserPreferences] }>()
const actions: StartupAction[] = [
  'restoreAll',
  'restoreLastWindow',
  'openLastFolder',
  'folder',
  'blank'
]
const options = ['restoreLayoutState', 'restoreEditors', 'restoreViewState'] as const
const { t } = useI18n()
const actionLabelKeys: Partial<Record<StartupAction, string>> = {
  folder: 'openDefaultDirectory',
  blank: 'openBlankPage'
}
const actionOptions = computed(() => actions.map(value => ({
  value,
  label: t(`preferences.general.startup.${actionLabelKeys[value] ?? value}`)
})))
const busy = ref(false)
const error = ref(false)
const save = async (patch: Partial<RecoveryPreferences>): Promise<void> => {
  busy.value = true
  error.value = false
  try {
    const result = await props.update(patch)
    if (result.status === 'persisted') emit('persisted', result.preferences)
    else error.value = true
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}
const selectDirectory = async (): Promise<void> => {
  try {
    const directory = await props.chooseDirectory()
    if (directory) await save({ startUpAction: 'folder', defaultDirectoryToOpen: directory })
  } catch {
    error.value = true
  }
}
</script>

<style scoped>
.startup-directory {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
.startup-directory .notes {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
