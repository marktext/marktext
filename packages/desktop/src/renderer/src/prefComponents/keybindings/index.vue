<template>
  <div class="pref-keybindings">
    <h4>{{ t('preferences.keybindings.title') }}</h4>
    <p
      v-if="loadError"
      role="alert"
    >
      {{ t('preferences.keybindings.loadError') }}
      <el-button @click="keybindings.ensureLoaded()">
        {{ t('preferences.keybindings.reload') }}
      </el-button>
    </p>
    <section
      class="keybindings"
      :aria-busy="loading"
    >
      <div class="text">
        {{ t('preferences.keybindings.description') }}
        <icon-tooltip :content="t('preferences.keybindings.online')">
          <button
            type="button"
            class="plain-button link"
            :aria-label="t('preferences.keybindings.online')"
            @click="openKeybindingDocs"
          >
            <LinkIcon
              :size="14"
              class="link-icon"
            />
          </button>
        </icon-tooltip>.
      </div>
      <section
        v-for="group in groups"
        :key="group.id"
        class="shortcut-group"
        :aria-labelledby="`shortcut-group-${group.id}`"
      >
        <h5 :id="`shortcut-group-${group.id}`">
          {{ t(commandGroupLabels[group.id]) }}
        </h5>
        <el-table
          :data="group.commands"
          row-key="id"
          style="width: 100%"
        >
          <el-table-column
            prop="description"
            :label="t('preferences.keybindings.table.description')"
            min-width="220"
          >
            <template #default="scope">
              <span :id="settingTargetId(keybindingKey(scope.row.id))">{{ scope.row.description }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="accelerator"
            :label="t('preferences.keybindings.table.keyCombination')"
            min-width="160"
          />
          <el-table-column
            :label="t('preferences.keybindings.table.options')"
            min-width="90"
          >
            <template #default="scope">
              <icon-tooltip :content="t('preferences.keybindings.table.edit')">
                <el-button
                  type="text"
                  size="small"
                  :aria-label="t('preferences.keybindings.table.edit')"
                  :disabled="isSaving"
                  @click="handleEditClick(scope.$index, scope.row)"
                >
                  <Edit
                    width="14"
                    height="14"
                  />
                </el-button>
              </icon-tooltip>
              <icon-tooltip :content="t('preferences.keybindings.table.reset')">
                <el-button
                  type="text"
                  size="small"
                  :aria-label="t('preferences.keybindings.table.reset')"
                  :disabled="isSaving"
                  @click="handleResetClick(scope.$index, scope.row)"
                >
                  <RefreshRight
                    width="14"
                    height="14"
                  />
                </el-button>
              </icon-tooltip>
              <icon-tooltip :content="t('preferences.keybindings.table.unbind')">
                <el-button
                  type="text"
                  size="small"
                  :aria-label="t('preferences.keybindings.table.unbind')"
                  :disabled="isSaving"
                  @click="handleUnbindClick(scope.$index, scope.row)"
                >
                  <Delete
                    width="14"
                    height="14"
                  />
                </el-button>
              </icon-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </section>
    <section class="footer">
      <separator />
      <el-button
        size="medium"
        :disabled="isSaving"
        @click="restoreDefaults"
      >
        {{ t('preferences.keybindings.restoreDefaults') }}
      </el-button>
    </section>
    <section
      v-if="showDebugTools"
      class="keyboard-debug"
    >
      <separator />
      <div>
        <strong>{{ t('preferences.keybindings.debugOptions') }}:</strong>
      </div>
      <el-button
        size="medium"
        @click="dumpKeyboardInformation"
      >
        {{ t('preferences.keybindings.dumpKeyboardInfo') }}
      </el-button>
    </section>
    <key-input-dialog
      :show-with-id="selectedShortcutId"
      :on-commit="onKeybinding"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Separator from '../common/separator/index.vue'
import KeyInputDialog from './key-input-dialog.vue'
import type { UiKeybinding } from './KeybindingConfigurator'
import { useKeybindingsStore } from '@/store/keybindings'
import { commandGroups, commandGroupLabels, getCommandGroup, keybindingKey } from './groups'
import { useRouter } from 'vue-router'
import notice from '@/services/notification'
import { settingTargetId, openSetting } from '../settingLocation'
import { Edit, RefreshRight, Delete } from '@element-plus/icons-vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import IconTooltip from '@/components/iconTooltip/index.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const keybindings = useKeybindingsStore()
const { commands: keybindingList, saving: isSaving, loading, loadError, conflict } = storeToRefs(keybindings)
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

const openKeybindingDocs = (): void => {
  window.electron.shell.openExternal('https://marktext.me/docs/key-bindings')
}
const restoreDefaults = (): void => { void keybindings.resetAll() }
const handleEditClick = (_index: number, entry: UiKeybinding): void => {
  if (!isSaving.value) selectedShortcutId.value = entry.id
}
const handleResetClick = (_index: number, entry: UiKeybinding): void => { void keybindings.reset(entry.id) }
const handleUnbindClick = (_index: number, entry: UiKeybinding): void => { void keybindings.unbind(entry.id) }
const onKeybinding = (value: string | null): void => {
  const id = selectedShortcutId.value
  selectedShortcutId.value = null
  if (id && value) void keybindings.change(id, value)
}
const dumpKeyboardInformation = (): void => {
  window.electron.ipcRenderer.send('mt::keybinding-debug-dump-keyboard-info')
}
</script>

<style scoped>
.pref-keybindings {
  & .keyboard-debug,
  & .keybindings {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
    & .link {
      cursor: pointer;
    }
  }
  & .keybindings > div.text {
    margin-bottom: 10px;
  }
  & .link {
    color: var(--themeColor);
    cursor: pointer;
    & .link-icon {
      margin-left: 2px;
      vertical-align: -2px;
      opacity: 0.7;
      color: var(--iconColor);
    }
    & .link-icon:hover {
      color: var(--themeColor);
    }
  }
  & button.el-button {
    font-size: 13px;
  }
}
.el-table,
.el-table__expanded-cell {
  background: var(--editorBgColor);
}
/* 24px is the minimum target size in WCAG 2.5.8; the rows put three of these
   buttons 4px apart, too close for the spacing exception. */
.el-table button {
  min-width: 24px;
  min-height: 24px;
  padding: 5px;
  margin: 4px 0px;
  color: var(--themeColor);
  background: none;
  border: none;
}
.el-table button:not(:last-child) {
  margin-right: 4px;
}
.el-table button:hover,
.el-table button:active {
  opacity: 0.9;
  background: none;
}
</style>
<style>
.pref-keybindings .el-table table {
  margin: 0;
  border: none;
}
.pref-keybindings .el-table th,
.pref-keybindings .el-table tr {
  background: var(--editorBgColor) !important;
}
/* Element Plus colours table text with its own --el-text-color-regular grey,
   which the app never themes — so the list rendered as low-contrast grey on
   every theme (≈2.3:1 on dark themes, well below WCAG AA). Use the theme's own
   editor text colour so the bindings stay readable everywhere (#3937). */
.pref-keybindings .el-table,
.pref-keybindings .el-table th.el-table__cell,
.pref-keybindings .el-table td.el-table__cell {
  color: var(--editorColor);
}
.pref-keybindings .el-table th.el-table__cell.is-leaf,
.pref-keybindings .el-table th,
.pref-keybindings .el-table td {
  border: none;
}
.pref-keybindings .el-table th.el-table__cell.is-leaf:last-child,
.pref-keybindings .el-table th:last-child,
.pref-keybindings .el-table td:last-child {
  border-right: 1px solid var(--tableBorderColor);
}
.pref-keybindings .el-table--border::after,
.pref-keybindings .el-table--group::after,
.pref-keybindings .el-table::before,
.pref-keybindings .el-table__fixed-right::before,
.pref-keybindings .el-table__fixed::before {
  background: var(--tableBorderColor);
}
/* Element Plus paints the hovered row via --el-table-row-hover-bg-color, which
   defaults to the light --el-fill-color-light — a near-white bar that hides the
   theme-coloured text on dark themes. Point it at the theme's own selection
   colour so hovered rows stay readable on every theme (follow-up to #3937). */
.pref-keybindings .el-table {
  --el-table-row-hover-bg-color: var(--selectionColor);
}
.pref-keybindings .el-table .el-table__cell {
  padding: 2px 0;
  margin: 0;
}
.pref-keybindings .el-table,
.pref-keybindings .el-table .el-table__inner-wrapper,
.pref-keybindings .el-table .el-table__body-wrapper,
.pref-keybindings .el-table .el-scrollbar,
.pref-keybindings .el-table .el-scrollbar__wrap,
.pref-keybindings .el-table .el-scrollbar__view {
  height: auto !important;
  max-height: none !important;
}
.pref-keybindings .el-table .el-scrollbar__wrap {
  overflow: visible !important;
}
.pref-keybindings .el-table .el-scrollbar__bar {
  display: none !important;
}
</style>
