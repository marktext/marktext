<template>
  <div class="pref-general">
    <h4 v-if="!embedded">
      {{ t('preferences.general.title') }}
    </h4>
    <compound v-if="show('language')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.language.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-language"
          :description="preferenceLabel('language')"
          :value="language"
          :options="getLanguageOptions()"
          :on-change="(value) => onSelectChange('language', value)"
        />
      </template>
    </compound>
    <compound v-if="show('opening')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.openingMode') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-defaultOpenMode"
          :description="preferenceLabel('defaultOpenMode')"
          :notes="preferenceNotes('defaultOpenMode')"
          :value="defaultOpenMode"
          :options="[
            { label: t('readingMode.edit'), value: 'edit' },
            { label: t('readingMode.title'), value: 'read' }
          ]"
          :on-change="(value) => onSelectChange('defaultOpenMode', value)"
        />
      </template>
    </compound>
    <compound v-if="show('save')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.autoSave.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          id="setting-autoSave"
          :description="preferenceLabel('autoSave')"
          :bool="autoSave"
          :on-change="(value) => onSelectChange('autoSave', value)"
        />
        <range
          id="setting-autoSaveDelay"
          :description="preferenceLabel('autoSaveDelay')"
          :value="autoSaveDelay"
          :min="1000"
          :max="10000"
          unit="ms"
          :step="100"
          :on-change="(value) => onSelectChange('autoSaveDelay', value)"
        />
      </template>
    </compound>

    <compound v-if="show('windowAppearance') || show('windowOpening')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.window.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          v-if="!isMac && show('windowAppearance')"
          id="setting-titleBarStyle"
          :description="preferenceLabel('titleBarStyle')"
          :notes="preferenceNotes('titleBarStyle')"
          :value="titleBarStyle"
          :options="getTitleBarStyleOptions()"
          :on-change="(value) => onSelectChange('titleBarStyle', value)"
        />
        <bool
          v-if="show('windowAppearance')"
          id="setting-hideScrollbar"
          :description="preferenceLabel('hideScrollbar')"
          :bool="hideScrollbar"
          :on-change="(value) => onSelectChange('hideScrollbar', value)"
        />
        <bool
          v-if="show('windowOpening')"
          id="setting-openFilesInNewWindow"
          :description="preferenceLabel('openFilesInNewWindow')"
          :notes="preferenceNotes('openFilesInNewWindow')"
          :bool="openFilesInNewWindow"
          :on-change="(value) => onSelectChange('openFilesInNewWindow', value)"
        />
        <bool
          v-if="show('windowOpening')"
          id="setting-openFolderInNewWindow"
          :description="preferenceLabel('openFolderInNewWindow')"
          :notes="preferenceNotes('openFolderInNewWindow')"
          :bool="openFolderInNewWindow"
          :on-change="(value) => onSelectChange('openFolderInNewWindow', value)"
        />
        <cur-select
          v-if="show('windowAppearance')"
          id="setting-zoom"
          :description="preferenceLabel('zoom')"
          :value="zoom"
          :options="zoomOptions"
          :on-change="(value) => onSelectChange('zoom', value)"
        />
      </template>
    </compound>

    <compound v-if="show('navigation')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.sidebar.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-tocPosition"
          :description="preferenceLabel('tocPosition')"
          :value="tocPosition"
          :options="[
            { label: t('preferences.general.sidebar.tocLeft'), value: 'left' },
            { label: t('preferences.general.sidebar.tocRight'), value: 'right' }
          ]"
          :on-change="(value) => onSelectChange('tocPosition', value)"
        />
        <bool
          id="setting-wordWrapInToc"
          :description="preferenceLabel('wordWrapInToc')"
          :bool="wordWrapInToc"
          :on-change="(value) => onSelectChange('wordWrapInToc', value)"
        />
        <bool
          id="setting-openedFilesInSidebar"
          :description="preferenceLabel('openedFilesInSidebar')"
          :bool="openedFilesInSidebar"
          :on-change="(value) => onSelectChange('openedFilesInSidebar', value)"
        />
        <bool
          id="setting-autoRevealInSidebar"
          :description="preferenceLabel('autoRevealInSidebar')"
          :bool="autoRevealInSidebar"
          :on-change="(value) => onSelectChange('autoRevealInSidebar', value)"
        />
        <bool
          id="setting-openFilesInPreviewMode"
          :description="preferenceLabel('openFilesInPreviewMode')"
          :bool="openFilesInPreviewMode"
          :on-change="(value) => onSelectChange('openFilesInPreviewMode', value)"
        />

        <exclude-patterns
          v-if="recoveryPreferences"
          id="setting-treePathExcludePatterns"
          :value="recoveryPreferences.treePathExcludePatterns"
          :update="updateExcludePatterns"
          @persisted="acceptRecoveryPreferences"
        />

        <cur-select
          id="setting-fileSortBy"
          :description="preferenceLabel('fileSortBy')"
          :value="fileSortBy"
          :options="getFileSortByOptions()"
          :on-change="(value) => onSelectChange('fileSortBy', value)"
        />
        <cur-select
          id="setting-fileSortOrder"
          :description="preferenceLabel('fileSortOrder')"
          :value="fileSortOrder"
          :options="getFileSortOrderOptions(String(fileSortBy))"
          :on-change="(value) => onSelectChange('fileSortOrder', value)"
        />
      </template>
    </compound>

    <recovery-settings
      v-if="show('recovery') && recoveryPreferences"
      :value="recoveryPreferences"
      :update="updateRecoveryPreferences"
      :choose-directory="chooseRecoveryDirectory"
      @persisted="acceptRecoveryPreferences"
    />
    <!-- Keep status readable independently of the disabled conversion switch. -->
    <compound v-if="show('pandoc')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.pandoc.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          id="setting-showPandocConvert"
          :description="preferenceLabel('showPandocConvert')"
          :detailed-description="t('preferences.general.pandoc.detailedDescription')"
          :bool="showPandocConvert"
          :disable="pandocDisabled"
          :on-change="(value) => onSelectChange('showPandocConvert', value)"
        />
        <div class="notes">
          {{ pandocStatus }}
          <el-button
            class="pandoc-recheck"
            size="small"
            :loading="isProbing"
            @click="probePandoc"
          >
            {{ t('preferences.general.pandoc.recheck') }}
          </el-button>
        </div>
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
import { preferenceLabel, preferenceNotes } from '@/prefComponents/registry'

import { computed, onMounted, onUnmounted, ref } from 'vue'
import RecoverySettings from './recoverySettings.vue'
import ExcludePatterns from './excludePatterns.vue'
import type { UserPreferences, RecoveryPreferences } from '@shared/types/preferences'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import Compound from '../common/compound/index.vue'
import Range from '../common/range/index.vue'
import CurSelect from '../common/select/index.vue'
import Bool from '../common/bool/index.vue'
import { pandocSwitchState } from './pandoc'
import type { PandocCommandInfo } from '@shared/types/pandoc'
import { isMac } from '@/util'

import {
  getTitleBarStyleOptions,
  zoomOptions,
  getFileSortByOptions,
  getFileSortOrderOptions,
  getLanguageOptions
} from './config'

const props = withDefaults(defineProps<{ groups?: readonly string[]; embedded?: boolean }>(), {
  groups: () => ['all'],
  embedded: false
})
const show = (group: string): boolean => props.groups.includes('all') || props.groups.includes(group)

const { t } = useI18n()
const preferenceStore = usePreferencesStore()
const recoveryPreferences = ref<UserPreferences | null>(null)
const acceptRecoveryPreferences = (preferences: UserPreferences): void => {
  recoveryPreferences.value = preferences
  preferenceStore.SET_USER_PREFERENCE({ ...preferences })
}
const updateRecoveryPreferences = (patch: Partial<RecoveryPreferences>) => window.electron.ipcRenderer.invoke('mt::preferences::update', patch)
const updateExcludePatterns = (patch: Pick<UserPreferences, 'treePathExcludePatterns'>) => window.electron.ipcRenderer.invoke('mt::preferences::update', patch)
const chooseRecoveryDirectory = () => window.electron.ipcRenderer.invoke('mt::preferences::choose-directory')
let stopRecoveryPreferences: (() => void) | undefined
onUnmounted(() => stopRecoveryPreferences?.())

const {
  defaultOpenMode,
  autoSave,
  autoSaveDelay,
  titleBarStyle,
  openFilesInNewWindow,
  openFolderInNewWindow,
  zoom,
  hideScrollbar,
  wordWrapInToc,
  tocPosition,
  fileSortBy,
  fileSortOrder,
  language,
  openedFilesInSidebar,
  autoRevealInSidebar,
  openFilesInPreviewMode,
  showPandocConvert
} = storeToRefs(preferenceStore)

const pandocProbe = ref<PandocCommandInfo | null>(null)
const isProbing = ref(false)

const pandocSwitch = computed(() => pandocSwitchState(pandocProbe.value, showPandocConvert.value))

const pandocStatus = computed<string>(() => {
  const { note, path } = pandocSwitch.value
  if (!note) return ''
  return path ? t(note, { path }) : t(note)
})

const pandocDisabled = computed<boolean>(() => pandocSwitch.value.disabled)

const probePandoc = async (): Promise<void> => {
  isProbing.value = true
  try {
    pandocProbe.value = await window.electron.ipcRenderer.invoke('mt::pandoc::command')
  } catch {
    // Main answers `{ command: null }` when its own lookup fails; a broken channel reads the same.
    pandocProbe.value = { command: null }
  } finally {
    isProbing.value = false
  }
}

onMounted(async () => {
  if (show('recovery') || show('navigation')) {
    acceptRecoveryPreferences(await window.electron.ipcRenderer.invoke('mt::preferences::get'))
    stopRecoveryPreferences = window.electron.ipcRenderer.on('mt::preferences::changed', (_event, preferences) => acceptRecoveryPreferences(preferences))
  }
  if (show('pandoc')) await probePandoc()
})

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}

</script>

<style scoped>



/* The note line is italic; this button inside it is not. */
.pref-general .pandoc-recheck {
  margin-left: 8px;
  font-style: normal;
}
</style>
