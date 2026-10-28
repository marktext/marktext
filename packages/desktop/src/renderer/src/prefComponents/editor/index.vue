<template>
  <div class="pref-editor">
    <h4 v-if="!embedded">
      {{ t('preferences.editor.title') }}
    </h4>
    <compound v-if="show('typography')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.textEditor.title') }}
        </h6>
      </template>
      <template #children>
        <range
          id="setting-fontSize"
          :description="preferenceLabel('fontSize')"
          :value="fontSize"
          :min="12"
          :max="32"
          unit="px"
          :step="1"
          :on-change="(value) => onSelectChange('fontSize', value)"
        />
        <range
          id="setting-lineHeight"
          :description="preferenceLabel('lineHeight')"
          :value="lineHeight"
          :min="1.2"
          :max="2.0"
          :step="0.1"
          :on-change="(value) => onSelectChange('lineHeight', value)"
        />
        <font-text-box
          id="setting-editorFontFamily"
          :description="preferenceLabel('editorFontFamily')"
          :value="editorFontFamily"
          :on-change="(value) => onSelectChange('editorFontFamily', value)"
        />
        <font-text-box
          id="setting-codeFontFamily"
          :description="preferenceLabel('codeFontFamily')"
          :notes="preferenceNotes('codeFontFamily')"
          :only-monospace="true"
          :value="codeFontFamily"
          :on-change="(value) => onSelectChange('codeFontFamily', value)"
        />
        <text-box
          id="setting-editorLineWidth"
          :description="preferenceLabel('editorLineWidth')"
          :notes="preferenceNotes('editorLineWidth')"
          :input="editorLineWidth"
          default-value="800px / 80ch / 60%"
          :regex-validator="/^(?:$|[0-9]+(?:ch|px|%)$)/"
          :error-message="t('preferences.editor.textEditor.maxWidthInvalid')"
          :on-change="(value) => onSelectChange('editorLineWidth', value)"
        />
      </template>
    </compound>

    <compound v-if="show('code') || show('typography')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.codeBlock.title') }}
        </h6>
      </template>
      <template #children>
        <range
          v-if="show('typography')"
          id="setting-codeFontSize"
          :description="preferenceLabel('codeFontSize')"
          :value="codeFontSize"
          :min="12"
          :max="28"
          unit="px"
          :step="1"
          :on-change="(value) => onSelectChange('codeFontSize', value)"
        />
        <bool
          v-if="show('code')"
          id="setting-codeBlockLineNumbers"
          :description="preferenceLabel('codeBlockLineNumbers')"
          :bool="codeBlockLineNumbers"
          :on-change="(value) => onSelectChange('codeBlockLineNumbers', value)"
        />
        <bool
          v-if="show('code')"
          id="setting-trimUnnecessaryCodeBlockEmptyLines"
          :description="preferenceLabel('trimUnnecessaryCodeBlockEmptyLines')"
          :bool="trimUnnecessaryCodeBlockEmptyLines"
          :on-change="(value) => onSelectChange('trimUnnecessaryCodeBlockEmptyLines', value)"
        />
        <bool
          v-if="show('code')"
          id="setting-wrapCodeBlocks"
          :description="preferenceLabel('wrapCodeBlocks')"
          :bool="wrapCodeBlocks"
          :on-change="(value) => onSelectChange('wrapCodeBlocks', value)"
        />
      </template>
    </compound>

    <compound v-if="show('writing')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.writingBehavior.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          id="setting-autoPairBracket"
          :description="preferenceLabel('autoPairBracket')"
          :bool="autoPairBracket"
          :on-change="(value) => onSelectChange('autoPairBracket', value)"
        />
        <bool
          id="setting-autoPairMarkdownSyntax"
          :description="preferenceLabel('autoPairMarkdownSyntax')"
          :notes="preferenceNotes('autoPairMarkdownSyntax')"
          :bool="autoPairMarkdownSyntax"
          :on-change="(value) => onSelectChange('autoPairMarkdownSyntax', value)"
        />
        <bool
          id="setting-autoPairQuote"
          :description="preferenceLabel('autoPairQuote')"
          :bool="autoPairQuote"
          :on-change="(value) => onSelectChange('autoPairQuote', value)"
        />
        <cur-select
          id="setting-tabSize"
          :description="preferenceLabel('tabSize')"
          :notes="preferenceNotes('tabSize')"
          :value="tabSize"
          :options="getTabSizeOptions()"
          :on-change="(value) => onSelectChange('tabSize', value)"
        />
      </template>
    </compound>

    <compound v-if="show('files')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.fileRepresentation.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-endOfLine"
          :description="preferenceLabel('endOfLine')"
          :notes="preferenceNotes('endOfLine')"
          :value="endOfLine"
          :options="getEndOfLineOptions()"
          :on-change="(value) => onSelectChange('endOfLine', value)"
        />
        <cur-select
          id="setting-defaultEncoding"
          :description="preferenceLabel('defaultEncoding')"
          :value="defaultEncoding"
          :options="defaultEncodingOptions"
          :on-change="(value) => onSelectChange('defaultEncoding', value)"
        />
        <bool
          id="setting-autoGuessEncoding"
          :description="preferenceLabel('autoGuessEncoding')"
          :bool="autoGuessEncoding"
          :on-change="(value) => onSelectChange('autoGuessEncoding', value)"
        />
        <bool
          id="setting-autoNormalizeLineEndings"
          :description="preferenceLabel('autoNormalizeLineEndings')"
          :bool="autoNormalizeLineEndings"
          :on-change="(value) => onSelectChange('autoNormalizeLineEndings', value)"
        />
        <cur-select
          id="setting-trimTrailingNewline"
          :description="preferenceLabel('trimTrailingNewline')"
          :value="trimTrailingNewline"
          :options="getTrimTrailingNewlineOptions()"
          :on-change="(value) => onSelectChange('trimTrailingNewline', value)"
        />
      </template>
    </compound>

    <compound v-if="show('writing')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.misc.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-textDirection"
          :description="preferenceLabel('textDirection')"
          :value="textDirection"
          :options="getTextDirectionOptions()"
          :on-change="(value) => onSelectChange('textDirection', value)"
        />
        <bool
          id="setting-hideQuickInsertHint"
          :description="preferenceLabel('hideQuickInsertHint')"
          :bool="hideQuickInsertHint"
          :on-change="(value) => onSelectChange('hideQuickInsertHint', value)"
        />
        <bool
          id="setting-hideLinkPopup"
          :description="preferenceLabel('hideLinkPopup')"
          :bool="hideLinkPopup"
          :on-change="(value) => onSelectChange('hideLinkPopup', value)"
        />
        <bool
          id="setting-autoCheck"
          :description="preferenceLabel('autoCheck')"
          :notes="preferenceNotes('autoCheck')"
          :bool="autoCheck"
          :on-change="(value) => onSelectChange('autoCheck', value)"
        />
        <bool
          id="setting-sourceCodeLineNumbers"
          :description="preferenceLabel('sourceCodeLineNumbers')"
          :bool="sourceCodeLineNumbers"
          :on-change="(value) => onSelectChange('sourceCodeLineNumbers', value)"
        />
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
import { preferenceLabel, preferenceNotes } from '@/prefComponents/registry'

import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import Compound from '../common/compound/index.vue'
import FontTextBox from '../common/fontTextBox/index.vue'
import Range from '../common/range/index.vue'
import CurSelect from '../common/select/index.vue'
import Bool from '../common/bool/index.vue'
import TextBox from '../common/textBox/index.vue'
import {
  getTabSizeOptions,
  getEndOfLineOptions,
  getTextDirectionOptions,
  getTrimTrailingNewlineOptions,
  getDefaultEncodingOptions
} from './config'

const props = withDefaults(defineProps<{ groups?: readonly string[]; embedded?: boolean }>(), {
  groups: () => ['all'],
  embedded: false
})
const show = (group: string): boolean => props.groups.includes('all') || props.groups.includes(group)

const { t } = useI18n()
const preferenceStore = usePreferencesStore()

const defaultEncodingOptions = getDefaultEncodingOptions()

const {
  fontSize,
  editorFontFamily,
  lineHeight,
  autoPairBracket,
  autoPairMarkdownSyntax,
  autoPairQuote,
  tabSize,
  endOfLine,
  textDirection,
  codeFontSize,
  codeFontFamily,
  codeBlockLineNumbers,
  trimUnnecessaryCodeBlockEmptyLines,
  hideQuickInsertHint,
  hideLinkPopup,
  autoCheck,
  sourceCodeLineNumbers,
  autoNormalizeLineEndings,
  wrapCodeBlocks,
  editorLineWidth,
  defaultEncoding,
  autoGuessEncoding,
  trimTrailingNewline
} = storeToRefs(preferenceStore)

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<style scoped>
.pref-editor .image-ctrl {
  font-size: 14px;
  user-select: none;
  margin: 20px 0;
  color: var(--editorColor);
}

.pref-editor .image-ctrl label {
  display: block;
  margin: 20px 0;
}
</style>
