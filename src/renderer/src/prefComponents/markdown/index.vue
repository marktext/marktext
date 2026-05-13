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
          :description="t('preferences.markdown.lists.preferLooseListItem')"
          :bool="preferLooseListItem"
          :on-change="(value) => onSelectChange('preferLooseListItem', value)"
          more="https://spec.commonmark.org/0.29/#loose"
        />
        <cur-select
          :description="t('preferences.markdown.lists.bulletListMarker')"
          :value="bulletListMarker"
          :options="bulletListMarkerOptions"
          :on-change="(value) => onSelectChange('bulletListMarker', value)"
          more="https://spec.commonmark.org/0.29/#bullet-list-marker"
        />
        <cur-select
          :description="t('preferences.markdown.lists.orderListDelimiter')"
          :value="orderListDelimiter"
          :options="orderListDelimiterOptions"
          :on-change="(value) => onSelectChange('orderListDelimiter', value)"
          more="https://spec.commonmark.org/0.29/#ordered-list"
        />
        <cur-select
          :description="t('preferences.markdown.lists.listIndentation.title')"
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
          :description="t('preferences.markdown.extensions.frontmatterType.title')"
          :value="frontmatterType"
          :options="getFrontmatterTypeOptions()"
          :on-change="(value) => onSelectChange('frontmatterType', value)"
        />
        <bool
          :description="t('preferences.markdown.extensions.superSubScript')"
          :bool="superSubScript"
          :on-change="(value) => onSelectChange('superSubScript', value)"
          more="https://pandoc.org/MANUAL.html#superscripts-and-subscripts"
        />
        <bool
          :description="t('preferences.markdown.extensions.footnote')"
          :notes="t('preferences.markdown.extensions.footnoteNotes')"
          :bool="footnote"
          :on-change="(value) => onSelectChange('footnote', value)"
          more="https://pandoc.org/MANUAL.html#footnotes"
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
          :description="t('preferences.markdown.compatibility.enableHtml')"
          :bool="isHtmlEnabled"
          :on-change="(value) => onSelectChange('isHtmlEnabled', value)"
        />
        <bool
          :description="t('preferences.markdown.compatibility.enableGitlab')"
          :bool="isGitlabCompatibilityEnabled"
          :on-change="(value) => onSelectChange('isGitlabCompatibilityEnabled', value)"
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
          :description="t('preferences.markdown.diagrams.sequenceTheme.title')"
          :value="sequenceTheme"
          :options="getSequenceThemeOptions()"
          :on-change="(value) => onSelectChange('sequenceTheme', value)"
          more="https://bramp.github.io/js-sequence-diagrams/"
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
          :description="t('preferences.markdown.misc.preferHeadingStyle.title')"
          :value="preferHeadingStyle"
          :options="getPreferHeadingStyleOptions()"
          :on-change="(value) => onSelectChange('preferHeadingStyle', value)"
          :disable="true"
        />
      </template>
    </compound>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import Compound from '../common/compound'
import { usePreferencesStore } from '@/store/preferences'
import Bool from '../common/bool'
import CurSelect from '../common/select'
import {
  bulletListMarkerOptions,
  orderListDelimiterOptions,
  getPreferHeadingStyleOptions,
  getListIndentationOptions,
  getFrontmatterTypeOptions,
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
  isHtmlEnabled,
  isGitlabCompatibilityEnabled,
  sequenceTheme
} = storeToRefs(preferenceStore)

const onSelectChange = (type, value) => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<script>
export default {
  name: 'Markdown'
}
</script>

<style scoped>
.pref-markdown {
}
</style>
