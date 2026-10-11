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
      <div class="toolbar">
        <el-input
          v-model="searchQuery"
          class="search"
          clearable
          :placeholder="t('preferences.keybindings.search')"
          :aria-label="t('preferences.keybindings.search')"
        >
          <template #prefix>
            <Search />
          </template>
        </el-input>
        <div class="actions">
          <el-button
            size="medium"
            :class="{ 'is-dirty': isDirty }"
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
        </div>
      </div>
      <separator />
      <div class="table-wrapper">
        <el-table
          :data="filteredKeybindingList"
          height="100%"
          style="width: 100%"
        >
          <el-table-column
            prop="description"
            :label="t('preferences.keybindings.table.description')"
            min-width="220"
          />
          <el-table-column
            :label="t('preferences.keybindings.table.keyCombination')"
            min-width="160"
          >
            <template #default="scope">
              {{ formatAcceleratorDisplay(scope.row.accelerator) }}
            </template>
          </el-table-column>
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
      </div>
    </section>
    <section
      v-if="showDebugTools"
      class="keyboard-debug"
    >
      <separator />
      <div class="debug-row">
        <strong>{{ t('preferences.keybindings.debugOptions') }}:</strong>
        <el-button
          size="medium"
          @click="dumpKeyboardInformation"
        >
          {{ t('preferences.keybindings.dumpKeyboardInfo') }}
        </el-button>
      </div>
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
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import Separator from '../common/separator/index.vue'
import KeyInputDialog from './key-input-dialog.vue'
import KeybindingConfigurator from './KeybindingConfigurator'
import type { UiKeybinding } from './KeybindingConfigurator'
import { getCommandSearchTerms } from '@/commands/descriptions'
import { formatAcceleratorDisplay } from '@/util/accelerator'
import notice from '@/services/notification'
import { Edit, RefreshRight, Delete, Search } from '@element-plus/icons-vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const showDebugTools = ref<boolean>(false)
const keybindingConfigurator = ref<KeybindingConfigurator | null>(null)
const selectedShortcutId = ref<string | null>(null)
const keybindingList = ref<UiKeybinding[]>([])
const searchQuery = ref<string>('')

// The configurator flips `isDirty` on every edit and clears it once a save
// succeeds, so it drives the Save button's "unsaved changes" highlight.
const isDirty = computed<boolean>(() => keybindingConfigurator.value?.isDirty ?? false)

// Filter against the accelerator as displayed (e.g. `Command+Shift+W`, so typing
// `shift` works) and every language the command can be named in — the current UI
// language, English, and the raw id (see getCommandSearchTerms).
const filteredKeybindingList = computed<UiKeybinding[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return keybindingList.value
  }
  return keybindingList.value.filter(
    ({ id, accelerator }) =>
      formatAcceleratorDisplay(accelerator).toLowerCase().includes(query) ||
      getCommandSearchTerms(id).some((term) => term.toLowerCase().includes(query))
  )
})

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
  /* This element is the settings window's scroll container itself (the
     `router-view` host styles it — see pages/preference.vue). Lay it out as a
     column that fits that height, so the table can take the leftover space and
     scroll its own body under a fixed header instead of scrolling the whole
     page. `border-box` keeps the panel's padding inside that height. */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  & .keyboard-debug,
  & .keybindings {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
    & .link {
      cursor: pointer;
    }
  }
  & .keybindings {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    /* The panel owns the bottom spacing now, so keep only the gap above. */
    margin-bottom: 0;
  }
  & .keybindings > div.table-wrapper {
    flex: 1;
    min-height: 0;
  }
  /* Must be declared after the shared `margin: 20px 0` above — equal specificity,
     so source order decides, and the shared rule would otherwise drop the pin. */
  & .keyboard-debug {
    margin-top: auto;
    padding-top: 20px;
  }
  & .keybindings > div.text {
    margin-bottom: 10px;
  }
  & .keyboard-debug .debug-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  & .keybindings > div.toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 10px;
  }
  & .keybindings > div.toolbar .search {
    max-width: 260px;
  }
  & .keybindings > div.toolbar .actions {
    display: flex;
    align-items: center;
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
/* The settings frame gives every panel 50px of bottom padding (see
   pages/preference.vue). This panel owns its own vertical rhythm and hands all
   spare height to the table, so reclaim that padding. The duplicated class is
   deliberate: it lifts specificity above the frame's
   `.pref-container .pref-content .pref-setting` rule. */
.pref-container .pref-content .pref-setting.pref-keybindings {
  padding-bottom: 16px;
}

/* Search box. Element Plus paints .el-input__wrapper with its own light fill
   and inset ring, and a global `input.el-input__inner` rule paints
   `--inputBgColor` plus a border inside it — together that reads as a filled
   box on every dark theme. Match the app's themed text inputs instead (see
   prefComponents/common/textBox): transparent fill, a border drawn from the
   theme, and a theme-coloured focus ring. */
.pref-keybindings .toolbar .el-input__wrapper {
  background: transparent;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--editorColor10) inset;
}
.pref-keybindings .toolbar .el-input__wrapper:hover {
  box-shadow: 0 0 0 1px var(--editorColor30) inset;
}
.pref-keybindings .toolbar .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px var(--themeColor) inset;
}
.pref-keybindings .toolbar .el-input__inner {
  /* The global `input.el-input__inner` rule (assets/styles/index.css) paints
     `--inputBgColor` and a 1px border *inside* the wrapper; clear both so only
     the themed ring below remains visible. */
  background: transparent;
  border: none;
  color: var(--editorColor);
}
.pref-keybindings .toolbar .el-input__inner::placeholder {
  color: var(--editorColor30);
}
.pref-keybindings .toolbar .el-input__prefix,
.pref-keybindings .toolbar .el-input__suffix {
  color: var(--iconColor);
}

/* Unsaved changes: the app styles every `.el-button` neutrally, so flag the
   pending edit with the theme accent rather than Element Plus's own primary
   colour (which this app never themes). Border + text only, so the label keeps
   its normal contrast against the button background. */
.pref-keybindings .toolbar .actions .el-button.is-dirty {
  color: var(--themeColor);
  border-color: var(--themeColor);
  font-weight: 600;
}
.pref-keybindings .toolbar .actions .el-button.is-dirty:hover,
.pref-keybindings .toolbar .actions .el-button.is-dirty:focus,
.pref-keybindings .toolbar .actions .el-button.is-dirty:active {
  color: var(--themeColor);
  border-color: var(--themeColor);
}

/* Both separators sit under a block that already carries its own bottom margin,
   so drop their top margin to keep the gap above the line from stacking. Use the
   mid-tier `--editorColor07`: `--editorColor04` was near-invisible on dark themes,
   while `--editorColor10` reads too heavy for a hairline. */
.pref-keybindings .keybindings > .pref-separator,
.pref-keybindings .keyboard-debug > .pref-separator {
  margin-top: 0;
  background: var(--editorColor07);
}

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
/* The panel draws no table chrome. Element Plus paints hairlines through these
   pseudo-elements (and a right rule on the last column); make them transparent
   rather than dropping the overrides, which would fall back to EP's own light
   border colour and show a line on every dark theme. */
.pref-keybindings .el-table th.el-table__cell.is-leaf:last-child,
.pref-keybindings .el-table th:last-child,
.pref-keybindings .el-table td:last-child {
  border-right: none;
}
.pref-keybindings .el-table--border::after,
.pref-keybindings .el-table--group::after,
.pref-keybindings .el-table::before,
.pref-keybindings .el-table__inner-wrapper::before,
.pref-keybindings .el-table__fixed-right::before,
.pref-keybindings .el-table__fixed::before {
  background: transparent;
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
</style>
