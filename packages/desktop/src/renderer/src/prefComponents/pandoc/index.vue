<template>
  <div class="pref-pandoc">
    <h4>{{ t('preferences.pandoc.title') }}</h4>

    <div class="pref-row">
      <div class="pref-row__label">
        {{ t('preferences.pandoc.path.label') }}
      </div>
      <div class="pref-row__control">
        <el-input
          class="path-input"
          :model-value="pandocPath"
          :placeholder="t('preferences.pandoc.path.placeholder')"
          size="small"
          clearable
          @update:model-value="setPath"
        />
        <el-button
          size="small"
          :loading="checking"
          @click="checkPandoc"
        >
          {{ t('preferences.pandoc.path.check') }}
        </el-button>
        <el-button
          size="small"
          @click="pickPath('executable')"
        >
          {{ t('preferences.pandoc.path.browse') }}
        </el-button>
      </div>
    </div>

    <div
      v-if="checkResult"
      class="pref-row"
    >
      <div class="pref-row__label" />
      <div class="pref-row__control">
        <span
          class="check-result"
          :class="checkResult.ok ? 'is-ok' : 'is-error'"
        >
          {{ checkResultText }}
        </span>
      </div>
    </div>

    <h6 class="section-title">
      {{ t('preferences.pandoc.export.title') }}
    </h6>

    <div
      v-if="menuFormatOptions.length > 0"
      class="pref-row"
    >
      <div class="pref-row__label">
        {{ t('preferences.pandoc.defaultFormat') }}
      </div>
      <div class="pref-row__control">
        <el-select
          :model-value="selectedDefaultFormat"
          class="format-select"
          @change="setDefaultFormat"
        >
          <el-option
            v-for="option in menuFormatOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
    </div>

    <div class="pref-row pref-row--top">
      <div class="pref-row__label">
        {{ t('preferences.pandoc.export.formats') }}
      </div>
      <div class="pref-row__control">
        <check-list
          :value="pandocExportFormats"
          :options="allFormatOptions"
          :on-change="onFormatsChange"
        />
      </div>
    </div>

    <p class="notes">
      {{ t('preferences.pandoc.export.formatsNotes') }}
    </p>

    <div class="pref-row">
      <div class="pref-row__label">
        {{ t('preferences.pandoc.location.label') }}
      </div>
      <div class="pref-row__control">
        <el-radio-group
          :model-value="pandocExportLocation"
          @change="setExportLocation"
        >
          <el-radio-button
            v-for="location in locations"
            :key="location"
            :value="location"
          >
            {{ t(`preferences.pandoc.location.${location}`) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div
      v-if="pandocExportLocation === 'folder'"
      class="pref-row"
    >
      <div class="pref-row__label" />
      <div class="pref-row__control">
        <el-input
          class="path-input"
          :model-value="pandocExportFolder"
          :placeholder="t('preferences.pandoc.location.folderPlaceholder')"
          size="small"
          clearable
          @update:model-value="setExportFolder"
        />
        <el-button
          size="small"
          @click="pickPath('folder')"
        >
          {{ t('preferences.pandoc.location.pickFolder') }}
        </el-button>
      </div>
    </div>

    <div class="pref-row">
      <div class="pref-row__label">
        {{ t('preferences.pandoc.options.label') }}
      </div>
      <div class="pref-row__control">
        <el-checkbox
          v-for="option in optionFlags"
          :key="option.key"
          :model-value="option.value"
          @update:model-value="onOptionChange(option.key, $event)"
        >
          {{ t(`preferences.pandoc.options.${option.label}`) }}
        </el-checkbox>
      </div>
    </div>

    <div class="pref-row">
      <div class="pref-row__label">
        {{ t('preferences.pandoc.referenceDoc.label') }}
      </div>
      <div class="pref-row__control">
        <el-input
          class="path-input"
          :model-value="pandocReferenceDoc"
          :placeholder="t('preferences.pandoc.referenceDoc.placeholder')"
          size="small"
          clearable
          @update:model-value="setReferenceDoc"
        />
        <el-button
          size="small"
          @click="pickPath('reference-doc')"
        >
          {{ t('preferences.pandoc.referenceDoc.browse') }}
        </el-button>
        <el-button
          size="small"
          :disabled="!pandocReferenceDoc"
          @click="clearReferenceDoc"
        >
          {{ t('preferences.pandoc.referenceDoc.clear') }}
        </el-button>
      </div>
    </div>

    <p class="notes">
      {{ t('preferences.pandoc.referenceDoc.notes') }}
    </p>

    <p class="notes">
      {{ t('preferences.pandoc.requirement.text') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import CheckList from '../common/checkList/index.vue'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import {
  PANDOC_EXPORT_FORMATS,
  PANDOC_EXPORT_LOCATIONS,
  getPandocDefaultFormat,
  getPandocExportFormats
} from '@shared/pandoc'
import type { PandocCheckResult } from '@shared/pandoc'
import type { PandocPickerKind } from '@shared/types/ipc'

const { t } = useI18n()

const preferenceStore = usePreferencesStore()

const {
  pandocPath,
  pandocDefaultFormat,
  pandocExportFormats,
  pandocExportLocation,
  pandocExportFolder,
  pandocStandalone,
  pandocToc,
  pandocNumberSections,
  pandocReferenceDoc
} = storeToRefs(preferenceStore)

const locations = PANDOC_EXPORT_LOCATIONS

const checking = ref(false)
const checkResult = ref<PandocCheckResult | null>(null)

/** Boolean export options the page renders as checkboxes. */
type PandocOptionKey = 'pandocStandalone' | 'pandocToc' | 'pandocNumberSections'

interface PandocOptionFlag {
  /** Leaf under `preferences.pandoc.options` in the locale files. */
  label: string
  /** Preference the checkbox writes to. */
  key: PandocOptionKey
  value: boolean
}

const checkResultText = computed(() => {
  const result = checkResult.value
  if (!result) {
    return ''
  }
  return result.ok
    ? t('preferences.pandoc.path.ok', { version: result.version })
    : t('preferences.pandoc.path.failed', { error: result.error })
})

/**
 * The check list always shows *every* format, ticked or not. Feeding it the
 * ticked formats instead would make an unticked one vanish from the page the
 * moment it was unticked, with no way to tick it again.
 */
const allFormatOptions = PANDOC_EXPORT_FORMATS.map((format) => ({
  label: format.label,
  value: format.id
}))

/**
 * Only the ticked formats — what the export menu can actually offer, and
 * therefore the only sensible choices for a default.
 */
const menuFormatOptions = computed(() =>
  getPandocExportFormats(pandocExportFormats.value).map((format) => ({
    label: format.label,
    value: format.id
  }))
)

/**
 * The stored default, or what the export would fall back to — displaying the
 * fallback tells the user which format a click would use right now.
 */
const selectedDefaultFormat = computed(
  () =>
    getPandocDefaultFormat(
      getPandocExportFormats(pandocExportFormats.value),
      pandocDefaultFormat.value
    )?.id ?? ''
)

const optionFlags = computed<PandocOptionFlag[]>(() => [
  { label: 'standalone', key: 'pandocStandalone', value: pandocStandalone.value },
  { label: 'toc', key: 'pandocToc', value: pandocToc.value },
  { label: 'numberSections', key: 'pandocNumberSections', value: pandocNumberSections.value }
])

const update = (key: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type: key, value })
}

// One named handler per control instead of an inline arrow: an arrow written in
// the template has no signature for the compiler to infer from, so each of its
// parameters reads as `any`. `unknown` is what the store takes — the control
// that emitted the value is the only thing that knows its own type.
const setPath = (value: unknown): void => update('pandocPath', value)
const setDefaultFormat = (value: unknown): void => update('pandocDefaultFormat', value)
const setExportLocation = (value: unknown): void => update('pandocExportLocation', value)
const setExportFolder = (value: unknown): void => update('pandocExportFolder', value)
const setReferenceDoc = (value: unknown): void => update('pandocReferenceDoc', value)
const clearReferenceDoc = (): void => update('pandocReferenceDoc', '')

const onOptionChange = (key: PandocOptionKey, value: unknown): void => update(key, value)

/**
 * Unchecking the format that is currently the default would leave the setting
 * pointing outside the menu, so the default follows the remaining formats.
 *
 * Unticking everything keeps the stored default as it was, so re-ticking a
 * format restores the user's earlier choice instead of silently rewriting it.
 */
const onFormatsChange = (value: string[]): void => {
  update('pandocExportFormats', value)
  if (value.length > 0 && !value.includes(pandocDefaultFormat.value)) {
    update('pandocDefaultFormat', value[0])
  }
}

const checkPandoc = async (): Promise<void> => {
  checking.value = true
  try {
    checkResult.value = await window.pandoc.check(pandocPath.value ?? '')
  } finally {
    checking.value = false
  }
}

const pickPath = async (kind: PandocPickerKind): Promise<void> => {
  const current =
    kind === 'folder'
      ? pandocExportFolder.value
      : kind === 'reference-doc'
        ? pandocReferenceDoc.value
        : pandocPath.value
  const picked = await window.pandoc.pickPath(kind, current || undefined)
  if (!picked) {
    // Cancelled — leave whatever was there alone.
    return
  }
  if (kind === 'folder') {
    update('pandocExportFolder', picked)
  } else if (kind === 'reference-doc') {
    update('pandocReferenceDoc', picked)
  } else {
    update('pandocPath', picked)
    // A freshly picked binary is worth verifying straight away, so the user
    // sees whether it works without having to press "check" themselves.
    checkResult.value = await window.pandoc.check(picked)
  }
}
</script>

<script lang="ts">
export default {
  name: 'Pandoc'
}
</script>

<style scoped>
.pref-pandoc {
  font-size: 14px;
  user-select: none;
  color: var(--editorColor);

  & .section-title {
    padding-bottom: 6px;
    margin-top: 28px;
  }

  & .pref-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 12px 0;

    &.pref-row--top {
      align-items: flex-start;
    }
  }

  & .pref-row__label {
    flex: none;
    width: 96px;
    line-height: 30px;
    color: var(--editorColor);
  }

  & .pref-row__control {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  & .path-input {
    max-width: 360px;
  }

  & .format-select {
    width: 240px;
  }

  & .check-result {
    font-size: 12px;
    word-break: break-all;

    &.is-ok {
      color: var(--themeColor);
    }

    &.is-error {
      color: #f56c6c;
    }
  }

  & .notes {
    margin: 4px 0 0 108px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--editorColor50);
  }
}
</style>
