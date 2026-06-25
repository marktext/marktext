<template>
  <div class="pref-keybindings">
    <h4>{{ t('preferences.keybindings.title') }}</h4>
    <section class="keybindings">
      <div class="text">
        {{ t('preferences.keybindings.description') }}
        <a
          class="link"
          :title="t('preferences.keybindings.online')"
          :aria-label="t('preferences.keybindings.online')"
          @click="openKeybindingDocs"
        ><LinkIcon
          :size="14"
          class="link-icon"
        /></a>.
      </div>
      <el-table
        :data="keybindingList"
        style="width: 100%"
      >
        <el-table-column
          prop="description"
          :label="t('preferences.keybindings.table.description')"
          min-width="220"
        />
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
            <el-button
              type="text"
              size="small"
              :title="t('preferences.keybindings.table.edit')"
              @click="handleEditClick(scope.$index, scope.row)"
            >
              <Edit
                width="14"
                height="14"
              />
            </el-button>
            <el-button
              type="text"
              size="small"
              :title="t('preferences.keybindings.table.reset')"
              @click="handleResetClick(scope.$index, scope.row)"
            >
              <RefreshRight
                width="14"
                height="14"
              />
            </el-button>
            <el-button
              type="text"
              size="small"
              :title="t('preferences.keybindings.table.unbind')"
              @click="handleUnbindClick(scope.$index, scope.row)"
            >
              <Delete
                width="14"
                height="14"
              />
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
    <section class="footer">
      <separator />
      <el-button
        size="medium"
        @click="saveKeybindings"
      >
        {{ t('preferences.keybindings.save') }}
      </el-button>
      <el-button
        size="medium"
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
import log from 'electron-log'
import { setKeyboardLayout } from '@hfelix/electron-localshortcut'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Separator from '../common/separator/index.vue'
import KeyInputDialog from './key-input-dialog.vue'
import KeybindingConfigurator from './KeybindingConfigurator'
import type { UiKeybinding } from './KeybindingConfigurator'
import notice from '@/services/notification'
import { Edit, RefreshRight, Delete } from '@element-plus/icons-vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const showDebugTools = ref<boolean>(false)
const keybindingConfigurator = ref<KeybindingConfigurator | null>(null)
const selectedShortcutId = ref<string | null>(null)
const keybindingList = ref<UiKeybinding[]>([])

// Function to rebuild the keybinding list
const rebuildKeybindingList = (): void => {
  if (keybindingConfigurator.value) {
    keybindingList.value = keybindingConfigurator.value.rebuildKeybindingList()
  }
}

// Listen for language changes to rebuild the keybinding list
watch(locale, () => {
  rebuildKeybindingList()
})

onMounted(() => {
  window.electron.ipcRenderer
    .invoke('mt::keybinding-get-keyboard-info')
    .then(({ layout, keymap }) => {
      // Update the key mapper to prevent problems on non-US keyboards.
      setKeyboardLayout(layout, keymap)
    })
    .catch((error) => log.error('Error while loading keyboard information for settings:', error))

  window.electron.ipcRenderer
    .invoke('mt::keybinding-get-pref-keybindings')
    .then(({ defaultKeybindings, userKeybindings }) => {
      const configurator = new KeybindingConfigurator(defaultKeybindings, userKeybindings)
      keybindingConfigurator.value = configurator
      keybindingList.value = configurator.getKeybindings()
    })
    .catch((error) => log.error('Error while loading keyboard information for settings:', error))

  // Show keyboard debugging tools which has been moved from CLI because we
  // need an active window on Windows.
  showDebugTools.value = Boolean(window.marktext?.env?.debug)
})

onUnmounted(() => {
  keybindingList.value = []
  keybindingConfigurator.value = null
})

const openKeybindingDocs = (): void => {
  window.electron.shell.openExternal(
    'https://marktext.me/docs/key-bindings'
  )
}

const saveKeybindings = (): void => {
  if (keybindingConfigurator.value && keybindingList.value.length > 0) {
    keybindingConfigurator.value
      .save()
      .then((success) => {
        if (!success) {
          notice.notify({
            title: t('preferences.keybindings.failedToSave'),
            type: 'error',
            message: t('preferences.keybindings.saveError')
          })
        }
      })
      .catch((error) => log.error(error))
  }
}

const restoreDefaults = (): void => {
  if (!keybindingConfigurator.value) return
  keybindingConfigurator.value
    .resetAll()
    .then((success) => {
      if (!success) {
        notice.notify({
          title: t('preferences.keybindings.failedToSave'),
          type: 'error',
          message: t('preferences.keybindings.saveError')
        })
      }
    })
    .catch((error) => log.error(error))
}

const handleEditClick = (index: number, entry: UiKeybinding | undefined): void => {
  if (index >= 0 && entry) {
    selectedShortcutId.value = entry.id
  }
}

const handleResetClick = (_index: number, entry: UiKeybinding): void => {
  if (!keybindingConfigurator.value) return
  const { id } = entry
  const success = keybindingConfigurator.value.resetToDefault(id)
  if (!success) {
    handleDuplicateShortcut(id, keybindingConfigurator.value.getDefaultAccelerator(id) ?? '')
  }
}

const handleUnbindClick = (_index: number, entry: UiKeybinding): void => {
  keybindingConfigurator.value?.unbind(entry.id)
}

const onKeybinding = (value: string | null): void => {
  const selectedId = selectedShortcutId.value
  if (value && selectedId && keybindingConfigurator.value) {
    const success = keybindingConfigurator.value.change(selectedId, value)
    if (!success) {
      handleDuplicateShortcut(selectedId, value)
    }
  }
  selectedShortcutId.value = null
}

const handleDuplicateShortcut = (_id: string, accelerator: string): void => {
  notice.notify({
    title: t('preferences.keybindings.shortcutInUse'),
    type: 'warning',
    message: t('preferences.keybindings.shortcutInUseMessage', { accelerator })
  })
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
.el-table button {
  padding: 2px 2px;
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
