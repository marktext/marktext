<template>
  <fieldset
    class="recovery-settings"
    :disabled="busy"
  >
    <legend>{{ t('title') }}</legend>
    <label>
      {{ t('action') }}
      <select
        :value="value.startUpAction"
        @change="selectAction"
      >
        <option
          v-for="action in actions"
          :key="action"
          :value="action"
        >{{ t(action) }}</option>
      </select>
    </label>
    <div class="directory">
      <button
        type="button"
        @click="selectDirectory"
      >
        {{ t('choose') }}
      </button>
      <span>{{ value.defaultDirectoryToOpen }}</span>
    </div>
    <label
      v-for="key in options"
      :key="key"
    >
      <input
        type="checkbox"
        :checked="value[key]"
        @change="toggle(key, $event)"
      >
      {{ t(key) }}
    </label>
    <p>{{ t('defaults') }}</p>
    <p
      v-if="error"
      role="alert"
    >
      {{ t('failure') }}
    </p>
  </fieldset>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  RecoveryPreferences,
  StartupAction,
  PreferenceUpdateResult,
  UserPreferences
} from '@shared/types/applicationState'

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
const en = {
  title: 'Startup',
  action: 'On startup',
  restoreAll: 'Restore all windows',
  restoreLastWindow: 'Restore the last active window',
  openLastFolder: 'Open the last workspace',
  folder: 'Open the selected folder',
  blank: 'New blank document',
  choose: 'Choose folder',
  restoreLayoutState: 'Restore window layout',
  restoreEditors: 'Restore opened files',
  restoreViewState: 'Restore reading positions and selections',
  defaults:
    'Outline position and source mode are defaults for new layouts. Existing windows keep their own layout.',
  failure: 'The settings could not be saved. Your previous settings are still in use.'
}
const zh = {
  title: '启动',
  action: '启动时',
  restoreAll: '恢复全部窗口',
  restoreLastWindow: '恢复最后活动的窗口',
  openLastFolder: '打开上次工作区',
  folder: '打开指定文件夹',
  blank: '新建空白文档',
  choose: '选择文件夹',
  restoreLayoutState: '恢复窗口布局',
  restoreEditors: '恢复已打开的文件',
  restoreViewState: '恢复阅读位置和选区',
  defaults: '大纲位置与源码模式是新布局的默认偏好，已有窗口保留各自的布局。',
  failure: '设置未能保存，仍使用之前的设置。'
}
const { t } = useI18n({
  useScope: 'local',
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zh, 'zh-TW': zh }
})
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
const selectAction = async (event: Event): Promise<void> => {
  const input = event.target as HTMLSelectElement
  const action = input.value as StartupAction
  input.value = props.value.startUpAction
  await save({ startUpAction: action })
}
const toggle = async (key: (typeof options)[number], event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const checked = input.checked
  input.checked = props.value[key]
  await save({ [key]: checked })
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
.recovery-settings {
  border: 0;
  padding: 0;
}
label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0;
}
select {
  margin-left: 8px;
}
.directory {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow-wrap: anywhere;
}
p {
  font-size: 13px;
}
[role='alert'] {
  color: var(--editorColor);
  font-weight: bold;
}
</style>
