<template>
  <div class="pref-markdown">
    <h4>{{ $t('pref.markdown.title') }}</h4>
    <compound>
      <template #head>
        <h6 class="title">{{ $t('pref.markdown.lists') }}</h6>
      </template>
      <template #children>
        <bool
          :description="$t('pref.markdown.preferLooseListItems')"
          :bool="preferLooseListItem"
          :onChange="value => onSelectChange('preferLooseListItem', value)"
          more="https://spec.commonmark.org/0.29/#loose"
        ></bool>
        <cur-select
          :description="$t('pref.markdown.bulletListMarker')"
          :value="bulletListMarker"
          :options="bulletListMarkerOptions"
          :onChange="value => onSelectChange('bulletListMarker', value)"
          more="https://spec.commonmark.org/0.29/#bullet-list-marker"
        ></cur-select>
        <cur-select
          :description="$t('pref.markdown.orderListDelimiter')"
          :value="orderListDelimiter"
          :options="orderListDelimiterOptions"
          :onChange="value => onSelectChange('orderListDelimiter', value)"
          more="https://spec.commonmark.org/0.29/#ordered-list"
        ></cur-select>
        <cur-select
          :description="$t('pref.markdown.listIndentation')"
          :value="listIndentation"
          :options="listIndentationOptions"
          :onChange="value => onSelectChange('listIndentation', value)"
        ></cur-select>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">{{ $t('pref.markdown.markdownExtensions') }}</h6>
      </template>
      <template #children>
        <cur-select
          :description="$t('pref.markdown.frontMatterFormat')"
          :value="frontmatterType"
          :options="frontmatterTypeOptions"
          :onChange="value => onSelectChange('frontmatterType', value)"
        ></cur-select>
        <bool
          :description="$t('pref.markdown.enableSuperscript')"
          :bool="superSubScript"
          :onChange="value => onSelectChange('superSubScript', value)"
          more="https://pandoc.org/MANUAL.html#superscripts-and-subscripts"
        ></bool>
        <bool
          :description="$t('pref.markdown.enableFootnotes')"
          :notes="$t('pref.general.requiresRestart')"
          :bool="footnote"
          :onChange="value => onSelectChange('footnote', value)"
          more="https://pandoc.org/MANUAL.html#footnotes"
        ></bool>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">{{ $t('pref.markdown.compatibility') }}</h6>
      </template>
      <template #children>
        <bool
          :description="$t('pref.markdown.enableHTML')"
          :bool="isHtmlEnabled"
          :onChange="value => onSelectChange('isHtmlEnabled', value)"
        ></bool>
        <bool
          :description="$t('pref.markdown.enableGitLab')"
          :bool="isGitlabCompatibilityEnabled"
          :onChange="value => onSelectChange('isGitlabCompatibilityEnabled', value)"
        ></bool>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">{{ $t('pref.markdown.diagrams') }}</h6>
      </template>
      <template #children>
        <cur-select
          :description="$t('pref.markdown.sequenceTheme')"
          :value="sequenceTheme"
          :options="sequenceThemeOptions"
          :onChange="value => onSelectChange('sequenceTheme', value)"
          more="https://bramp.github.io/js-sequence-diagrams/"
        ></cur-select>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">{{ $t('pref.markdown.misc') }}</h6>
      </template>
      <template #children>
        <cur-select
          :description="$t('pref.markdown.preferHeadingStyle')"
          :value="preferHeadingStyle"
          :options="preferHeadingStyleOptions"
          :onChange="value => onSelectChange('preferHeadingStyle', value)"
          :disable="true"
        ></cur-select>
      </template>
    </compound>
  </div>
</template>

<script>
import Compound from '../common/compound'
import Separator from '../common/separator'
import { mapState } from 'vuex'
import Bool from '../common/bool'
import CurSelect from '../common/select'
import {
  bulletListMarkerOptions,
  orderListDelimiterOptions,
  preferHeadingStyleOptions,
  listIndentationOptions,
  frontmatterTypeOptions,
  sequenceThemeOptions
} from './config'

export default {
  components: {
    Compound,
    Separator,
    Bool,
    CurSelect
  },
  data () {
    return {}
  },
  computed: {
    bulletListMarkerOptions () {
      return bulletListMarkerOptions(this.$t.bind(this))
    },
    orderListDelimiterOptions () {
      return orderListDelimiterOptions(this.$t.bind(this))
    },
    preferHeadingStyleOptions () {
      return preferHeadingStyleOptions(this.$t.bind(this))
    },
    listIndentationOptions () {
      return listIndentationOptions(this.$t.bind(this))
    },
    frontmatterTypeOptions () {
      return frontmatterTypeOptions(this.$t.bind(this))
    },
    sequenceThemeOptions () {
      return sequenceThemeOptions(this.$t.bind(this))
    },
    ...mapState({
      preferLooseListItem: state => state.preferences.preferLooseListItem,
      bulletListMarker: state => state.preferences.bulletListMarker,
      orderListDelimiter: state => state.preferences.orderListDelimiter,
      preferHeadingStyle: state => state.preferences.preferHeadingStyle,
      listIndentation: state => state.preferences.listIndentation,
      frontmatterType: state => state.preferences.frontmatterType,
      superSubScript: state => state.preferences.superSubScript,
      footnote: state => state.preferences.footnote,
      isHtmlEnabled: state => state.preferences.isHtmlEnabled,
      isGitlabCompatibilityEnabled: state => state.preferences.isGitlabCompatibilityEnabled,
      sequenceTheme: state => state.preferences.sequenceTheme
    })
  },
  methods: {
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
}
</script>

<style scoped>
  .pref-markdown {
  }
</style>
