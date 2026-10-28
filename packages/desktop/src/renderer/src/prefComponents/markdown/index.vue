<template>
  <div class="pref-markdown">
    <h4>{{ t('preferences.markdown.title') }}</h4>
    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.markdown.lists.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          id="setting-preferLooseListItem"
          :description="preferenceLabel('preferLooseListItem')"
          :bool="preferLooseListItem"
          :on-change="(value) => onSelectChange('preferLooseListItem', value)"
          more="https://spec.commonmark.org/0.29/#loose"
        />
        <cur-select
          id="setting-bulletListMarker"
          :description="preferenceLabel('bulletListMarker')"
          :value="bulletListMarker"
          :options="bulletListMarkerOptions"
          :on-change="(value) => onSelectChange('bulletListMarker', value)"
          more="https://spec.commonmark.org/0.29/#bullet-list-marker"
        />
        <cur-select
          id="setting-orderListDelimiter"
          :description="preferenceLabel('orderListDelimiter')"
          :value="orderListDelimiter"
          :options="orderListDelimiterOptions"
          :on-change="(value) => onSelectChange('orderListDelimiter', value)"
          more="https://spec.commonmark.org/0.29/#ordered-list"
        />
        <cur-select
          id="setting-listIndentation"
          :description="preferenceLabel('listIndentation')"
          :value="listIndentation"
          :options="getListIndentationOptions()"
          :on-change="(value) => onSelectChange('listIndentation', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.markdown.extensions.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-frontmatterType"
          :description="preferenceLabel('frontmatterType')"
          :value="frontmatterType"
          :options="getFrontmatterTypeOptions()"
          :on-change="(value) => onSelectChange('frontmatterType', value)"
        />
        <bool
          id="setting-superSubScript"
          :description="preferenceLabel('superSubScript')"
          :bool="superSubScript"
          :on-change="(value) => onSelectChange('superSubScript', value)"
          more="https://pandoc.org/MANUAL.html#superscripts-and-subscripts"
        />
        <bool
          id="setting-footnote"
          :description="preferenceLabel('footnote')"
          :bool="footnote"
          :on-change="(value) => onSelectChange('footnote', value)"
          more="https://pandoc.org/MANUAL.html#footnotes"
        />
        <bool
          id="setting-texMathDollars"
          :description="preferenceLabel('texMathDollars')"
          :bool="texMathDollars"
          :on-change="(value) => onSelectChange('texMathDollars', value)"
          more="https://pandoc.org/MANUAL.html#extension-tex_math_dollars"
        />
        <bool
          id="setting-texMathGfm"
          :description="preferenceLabel('texMathGfm')"
          :bool="texMathGfm"
          :on-change="(value) => onSelectChange('texMathGfm', value)"
          more="https://pandoc.org/MANUAL.html#extension-tex_math_gfm"
        />
        <bool
          id="setting-texMathSingleBackslash"
          :description="preferenceLabel('texMathSingleBackslash')"
          :bool="texMathSingleBackslash"
          :on-change="(value) => onSelectChange('texMathSingleBackslash', value)"
          more="https://pandoc.org/MANUAL.html#extension-tex_math_single_backslash"
        />
        <bool
          id="setting-texMathDoubleBackslash"
          :description="preferenceLabel('texMathDoubleBackslash')"
          :bool="texMathDoubleBackslash"
          :on-change="(value) => onSelectChange('texMathDoubleBackslash', value)"
          more="https://pandoc.org/MANUAL.html#extension-tex_math_double_backslash"
        />
        <bool
          id="setting-fancyLists"
          :description="preferenceLabel('fancyLists')"
          :bool="fancyLists"
          :on-change="(value) => onSelectChange('fancyLists', value)"
          more="https://pandoc.org/MANUAL.html#extension-fancy_lists"
        />
        <bool
          id="setting-highlightSyntax"
          :description="preferenceLabel('highlightSyntax')"
          :bool="highlightSyntax"
          :on-change="(value) => onSelectChange('highlightSyntax', value)"
          more="https://www.markdownguide.org/extended-syntax/#highlight"
        />
        <bool
          id="setting-inlineDiff"
          :description="preferenceLabel('inlineDiff')"
          :bool="inlineDiff"
          :on-change="(value) => onSelectChange('inlineDiff', value)"
          more="https://docs.gitlab.com/user/markdown/#inline-diff"
        />
        <bool
          id="setting-githubAlerts"
          :description="preferenceLabel('githubAlerts')"
          :bool="githubAlerts"
          :on-change="(value) => onSelectChange('githubAlerts', value)"
          more="https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts"
        />
        <bool
          id="setting-multilineBlockquote"
          :description="preferenceLabel('multilineBlockquote')"
          :bool="multilineBlockquote"
          :on-change="(value) => onSelectChange('multilineBlockquote', value)"
          more="https://docs.gitlab.com/user/markdown/#multiline-blockquote"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.markdown.compatibility.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          id="setting-isHtmlEnabled"
          :description="preferenceLabel('isHtmlEnabled')"
          :bool="isHtmlEnabled"
          :on-change="(value) => onSelectChange('isHtmlEnabled', value)"
        />
        <bool
          id="setting-softNewlineAsSpace"
          :description="preferenceLabel('softNewlineAsSpace')"
          :bool="softNewlineAsSpace"
          :on-change="(value) => onSelectChange('softNewlineAsSpace', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.markdown.diagrams.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-mermaidLightTheme"
          :description="preferenceLabel('mermaidLightTheme')"
          :value="mermaidLightTheme"
          :options="getMermaidThemeOptions()"
          :on-change="(value) => onSelectChange('mermaidLightTheme', value)"
          more="https://mermaid.js.org/config/theming.html"
        />
        <cur-select
          id="setting-mermaidDarkTheme"
          :description="preferenceLabel('mermaidDarkTheme')"
          :value="mermaidDarkTheme"
          :options="getMermaidThemeOptions()"
          :on-change="(value) => onSelectChange('mermaidDarkTheme', value)"
          more="https://mermaid.js.org/config/theming.html"
        />
        <cur-select
          id="setting-sequenceTheme"
          :description="preferenceLabel('sequenceTheme')"
          :value="sequenceTheme"
          :options="getSequenceThemeOptions()"
          :on-change="(value) => onSelectChange('sequenceTheme', value)"
          more="https://bramp.github.io/js-sequence-diagrams/"
        />
        <text-box
          id="setting-plantumlServer"
          :description="preferenceLabel('plantumlServer')"
          :input="plantumlServer"
          :on-change="(value) => onSelectChange('plantumlServer', value)"
          :default-value="'https://www.plantuml.com/plantuml'"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.markdown.misc.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          id="setting-preferHeadingStyle"
          :description="preferenceLabel('preferHeadingStyle')"
          :value="preferHeadingStyle"
          :options="getPreferHeadingStyleOptions()"
          :on-change="(value) => onSelectChange('preferHeadingStyle', value)"
          :disable="true"
        />
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
import { preferenceLabel, preferenceNotes } from '@/prefComponents/registry'

import { useI18n } from 'vue-i18n'
import Compound from '../common/compound/index.vue'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import Bool from '../common/bool/index.vue'
import CurSelect from '../common/select/index.vue'
import TextBox from '../common/textBox/index.vue'
import {
  bulletListMarkerOptions,
  orderListDelimiterOptions,
  getPreferHeadingStyleOptions,
  getListIndentationOptions,
  getFrontmatterTypeOptions,
  getMermaidThemeOptions,
  getSequenceThemeOptions
} from './config'
import { storeToRefs } from 'pinia'

const { t } = useI18n()

const preferenceStore = usePreferencesStore()

const {
  preferLooseListItem,
  bulletListMarker,
  orderListDelimiter,
  preferHeadingStyle,
  listIndentation,
  frontmatterType,
  superSubScript,
  footnote,
  texMathDollars,
  texMathGfm,
  texMathSingleBackslash,
  texMathDoubleBackslash,
  fancyLists,
  highlightSyntax,
  inlineDiff,
  multilineBlockquote,
  githubAlerts,
  isHtmlEnabled,
  softNewlineAsSpace,
  mermaidLightTheme,
  mermaidDarkTheme,
  sequenceTheme,
  plantumlServer
} = storeToRefs(preferenceStore)

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<script lang="ts">
export default {
  name: 'Markdown'
}
</script>

<style scoped>
.pref-markdown {
}
</style>
