<template>
  <div class="pref-editor">
    <h4>{{ t('preferences.editor.title') }}</h4>
    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.textEditor.title') }}
        </h6>
      </template>
      <template #children>
        <range
          :description="t('preferences.editor.textEditor.fontSize')"
          :value="fontSize"
          :min="12"
          :max="32"
          unit="px"
          :step="1"
          :on-change="(value) => onSelectChange('fontSize', value)"
        />
        <range
          :description="t('preferences.editor.textEditor.lineHeight')"
          :value="lineHeight"
          :min="1.2"
          :max="2.0"
          :step="0.1"
          :on-change="(value) => onSelectChange('lineHeight', value)"
        />
        <font-text-box
          :description="t('preferences.editor.textEditor.fontFamily')"
          :value="editorFontFamily"
          :on-change="(value) => onSelectChange('editorFontFamily', value)"
        />
        <text-box
          :description="t('preferences.editor.textEditor.maxWidth')"
          :notes="t('preferences.editor.textEditor.maxWidthNotes')"
          :input="editorLineWidth"
          :regex-validator="/^(?:$|[0-9]+(?:ch|px|%)$)/"
          :on-change="(value) => onSelectChange('editorLineWidth', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.codeBlock.title') }}
        </h6>
      </template>
      <template #children>
        <range
          :description="t('preferences.editor.codeBlock.fontSize')"
          :value="codeFontSize"
          :min="12"
          :max="28"
          unit="px"
          :step="1"
          :on-change="(value) => onSelectChange('codeFontSize', value)"
        />
        <font-text-box
          :description="t('preferences.editor.codeBlock.fontFamily')"
          :only-monospace="true"
          :value="codeFontFamily"
          :on-change="(value) => onSelectChange('codeFontFamily', value)"
        />
        <!-- FIXME: Disabled due to #1648. -->
        <bool
          v-show="false"
          :description="t('preferences.editor.codeBlock.showLineNumbers')"
          :bool="codeBlockLineNumbers"
          :on-change="(value) => onSelectChange('codeBlockLineNumbers', value)"
        />
        <bool
          :description="t('preferences.editor.codeBlock.removeEmptyLines')"
          :bool="trimUnnecessaryCodeBlockEmptyLines"
          :on-change="(value) => onSelectChange('trimUnnecessaryCodeBlockEmptyLines', value)"
        />
        <bool
          :description="t('preferences.editor.misc.wrapCodeBlocks')"
          :bool="wrapCodeBlocks"
          :on-change="(value) => onSelectChange('wrapCodeBlocks', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.writingBehavior.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.editor.writingBehavior.autoCloseBrackets')"
          :bool="autoPairBracket"
          :on-change="(value) => onSelectChange('autoPairBracket', value)"
        />
        <bool
          :description="t('preferences.editor.writingBehavior.autoCompleteMarkdown')"
          :bool="autoPairMarkdownSyntax"
          :on-change="(value) => onSelectChange('autoPairMarkdownSyntax', value)"
        />
        <bool
          :description="t('preferences.editor.writingBehavior.autoCloseQuotes')"
          :bool="autoPairQuote"
          :on-change="(value) => onSelectChange('autoPairQuote', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.fileRepresentation.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          :description="t('preferences.editor.fileRepresentation.tabWidth')"
          :value="tabSize"
          :options="tabSizeOptions"
          :on-change="(value) => onSelectChange('tabSize', value)"
        />
        <cur-select
          :description="t('preferences.editor.fileRepresentation.lineSeparator')"
          :value="endOfLine"
          :options="getEndOfLineOptions()"
          :on-change="(value) => onSelectChange('endOfLine', value)"
        />
        <cur-select
          :description="t('preferences.editor.fileRepresentation.defaultEncoding')"
          :value="defaultEncoding"
          :options="defaultEncodingOptions"
          :on-change="(value) => onSelectChange('defaultEncoding', value)"
        />
        <bool
          :description="t('preferences.editor.fileRepresentation.autoDetectEncoding')"
          :bool="autoGuessEncoding"
          :on-change="(value) => onSelectChange('autoGuessEncoding', value)"
        />
        <bool
          :description="t('preferences.editor.misc.autoNormalizeLineEndings')"
          :bool="autoNormalizeLineEndings"
          :on-change="(value) => onSelectChange('autoNormalizeLineEndings', value)"
        />
        <cur-select
          :description="t('preferences.editor.fileRepresentation.trailingNewlines.title')"
          :value="trimTrailingNewline"
          :options="getTrimTrailingNewlineOptions()"
          :on-change="(value) => onSelectChange('trimTrailingNewline', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.editor.misc.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          :description="t('preferences.editor.misc.textDirection.title')"
          :value="textDirection"
          :options="getTextDirectionOptions()"
          :on-change="(value) => onSelectChange('textDirection', value)"
        />
        <bool
          :description="t('preferences.editor.misc.hideQuickInsertHint')"
          :bool="hideQuickInsertHint"
          :on-change="(value) => onSelectChange('hideQuickInsertHint', value)"
        />
        <bool
          :description="t('preferences.editor.misc.hideLinkPopup')"
          :bool="hideLinkPopup"
          :on-change="(value) => onSelectChange('hideLinkPopup', value)"
        />
        <bool
          :description="t('preferences.editor.misc.autoCheck')"
          :bool="autoCheck"
          :on-change="(value) => onSelectChange('autoCheck', value)"
        />
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
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
  tabSizeOptions,
  getEndOfLineOptions,
  getTextDirectionOptions,
  getTrimTrailingNewlineOptions,
  getDefaultEncodingOptions
} from './config'

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
