<template>
  <div class="pref-keybindings">
    <h4>{{ t('preferences.keybindings.title') }}</h4>
    <setting-note class="shortcut-introduction">
      {{ t('preferences.keybindings.description') }}
      <help-link
        class="shortcut-docs"
        href="https://marktext.me/docs/key-bindings"
        :label="t('preferences.keybindings.online')"
      />
    </setting-note>
    <div
      class="shortcut-content"
      :aria-busy="loading"
    >
      <p
        v-if="loadError"
        role="alert"
        class="shortcut-load-error"
      >
        {{ t('preferences.keybindings.loadError') }}
        <el-button @click="keybindings.ensureLoaded()">
          {{ t('preferences.keybindings.reload') }}
        </el-button>
      </p>
      <section
        v-for="group in groups"
        :key="group.id"
        class="shortcut-group"
        :aria-labelledby="`shortcut-group-${group.id}`"
      >
        <h5 :id="`shortcut-group-${group.id}`">
          {{ t(commandGroupLabels[group.id]) }}
        </h5>
        <ul class="shortcut-list">
          <li
            v-for="command in group.commands"
            :key="command.id"
            class="shortcut-row"
          >
            <div class="shortcut-command">
              <el-switch
                :model-value="Boolean(command.accelerator)"
                :aria-label="command.description"
                :disabled="isSaving || loading"
                @change="handleToggle(command, $event)"
              />
              <span
                :id="settingTargetId(keybindingKey(command.id))"
                class="shortcut-name"
              >{{ command.description }}</span>
            </div>
            <div class="shortcut-row-controls">
              <shortcut-recorder
                v-if="selectedShortcutId === command.id"
                :command-name="command.description"
                @commit="onKeybinding(command.id, $event)"
                @cancel="cancelRecording"
              />
              <button
                v-else
                type="button"
                class="shortcut-accelerator"
                :class="{ 'is-unbound': !command.accelerator }"
                :aria-label="t('preferences.keybindings.editShortcut', { name: command.description })"
                :disabled="isSaving || !command.accelerator"
                @click="handleEditClick(command)"
              >
                <kbd v-if="command.accelerator || command.defaultAccelerator">{{ acceleratorToLabel(command.accelerator || command.defaultAccelerator, isMac) }}</kbd>
                <span v-else>{{ t('preferences.keybindings.unbound') }}</span>
              </button>
            </div>
          </li>
        </ul>
      </section>
      <details
        v-if="showDebugTools"
        class="keyboard-debug"
      >
        <summary>{{ t('preferences.keybindings.debugOptions') }}</summary>
        <el-button @click="dumpKeyboardInformation">
          {{ t('preferences.keybindings.dumpKeyboardInfo') }}
        </el-button>
      </details>
    </div>
    <footer class="footer">
      <el-button
        :disabled="loading || isSaving || !hasCustomBindings"
        @click="restoreDefaults"
      >
        {{ t('preferences.keybindings.restoreDefaults') }}
      </el-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import SettingNote from '../common/settingNote.vue'
import ShortcutRecorder from './shortcutRecorder.vue'
import type { UiKeybinding } from './KeybindingConfigurator'
import { useKeybindingsStore } from '@/store/keybindings'
import { commandGroups, commandGroupLabels, getCommandGroup, keybindingKey } from './groups'
import { useRouter } from 'vue-router'
import notice from '@/services/notification'
import { settingTargetId, openSetting } from '../settingLocation'
import { acceleratorToLabel } from '@/util/accelerator'
import { isMac } from '@/util'
import HelpLink from '../common/helpLink.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const keybindings = useKeybindingsStore()
const { commands: keybindingList, hasCustomBindings, saving: isSaving, loading, loadError, conflict } = storeToRefs(keybindings)
const groups = computed(() => commandGroups.map(id => ({
  id,
  commands: keybindingList.value.filter(command => getCommandGroup(command.id) === id)
})).filter(group => group.commands.length > 0))
const router = useRouter()
watch(conflict, (value) => {
  if (!value) return
  notice.notify({
    type: 'warning',
    title: t('preferences.keybindings.shortcutInUse'),
    message: t('preferences.keybindings.shortcutInUseMessage', {
      accelerator: value.accelerator,
      commands: value.commands.map(command => command.description).join(', ')
    }),
    actions: value.commands.map(command => ({
      label: t('preferences.keybindings.viewConflict', { name: command.description }),
      onClick: () => { void openSetting(router, 'keybindings', keybindingKey(command.id)) }
    }))
  })
})
const selectedShortcutId = ref<string | null>(null)
const showDebugTools = Boolean(window.marktext?.env?.debug)
onMounted(() => { void keybindings.ensureLoaded() })

const restoreDefaults = (): void => {
  selectedShortcutId.value = null
  void keybindings.resetAll()
}
const handleEditClick = (entry: UiKeybinding): void => {
  if (!isSaving.value && entry.accelerator) selectedShortcutId.value = entry.id
}
const focusShortcut = (id: string): void => {
  const row = document.getElementById(settingTargetId(keybindingKey(id)))?.closest('li')
  row?.querySelector<HTMLButtonElement>('.shortcut-accelerator')?.focus()
}
const cancelRecording = (restoreFocus = false): void => {
  const id = selectedShortcutId.value
  selectedShortcutId.value = null
  if (restoreFocus && id) {
    void nextTick(() => focusShortcut(id))
  }
}
const handleToggle = (entry: UiKeybinding, enabled: boolean | string | number): void => {
  if (isSaving.value) return
  cancelRecording()
  if (enabled) {
    if (entry.defaultAccelerator) {
      void keybindings.reset(entry.id)
    } else {
      selectedShortcutId.value = entry.id
    }
  } else {
    void keybindings.unbind(entry.id)
  }
}
const onKeybinding = async(id: string, value: string): Promise<void> => {
  cancelRecording()
  await keybindings.change(id, value)
  await nextTick()
  focusShortcut(id)
}
const dumpKeyboardInformation = (): void => {
  window.electron.ipcRenderer.send('mt::keybinding-debug-dump-keyboard-info')
}
</script>

<style scoped>
.pref-keybindings.pref-setting {
  --shortcut-footer-height: 65px;

  container-type: normal;
  margin-bottom: var(--shortcut-footer-height);
  color: var(--editorColor);
}
.shortcut-introduction { margin: 20px 0 28px; }
.shortcut-docs {
  margin-left: 4px;
  vertical-align: -2px;
}
.shortcut-content { container-type: inline-size; }
.shortcut-group + .shortcut-group { margin-top: 28px; }
.shortcut-group h5 {
  margin: 0 0 8px;
  color: var(--editorColor80);
  font-size: 14px;
}
.shortcut-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  border-bottom: 1px solid var(--editorColor10);
  font-size: 14px;
}
.shortcut-row:last-child { border-bottom: none; }
.shortcut-command {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.shortcut-command .el-switch { flex-shrink: 0; }
.shortcut-name {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.shortcut-row-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.shortcut-accelerator {
  min-width: 44px;
  min-height: 36px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--editorColor80);
  cursor: pointer;
  font: inherit;
  text-align: center;
  transition: background-color 120ms ease;
}
.shortcut-accelerator kbd {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font: inherit;
  white-space: nowrap;
}
.shortcut-accelerator.is-unbound { color: var(--editorColor50); }
.shortcut-accelerator:not(:disabled):hover { background: var(--editorColor10); }
.shortcut-accelerator:focus-visible {
  outline: 2px solid var(--themeColor);
  outline-offset: 2px;
}
.shortcut-accelerator:disabled { opacity: 0.5; cursor: default; }
.footer {
  position: fixed;
  left: var(--prefSideBarWidth);
  right: 0;
  bottom: 0;
  z-index: 2;
  box-sizing: border-box;
  height: var(--shortcut-footer-height);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
  padding: 16px 40px;
  background: var(--editorBgColor);
  border-top: 1px solid var(--editorColor10);
}
.keyboard-debug {
  margin-top: 28px;
  font-size: 14px;
}
.keyboard-debug summary { cursor: pointer; margin-bottom: 12px; }
.shortcut-load-error { font-size: 14px; }
@container (max-width: 480px) {
  .shortcut-row { gap: 8px; }
  .shortcut-row-controls { gap: 0; }
  .shortcut-accelerator { min-width: 44px; padding: 6px 10px; }
}
</style>
