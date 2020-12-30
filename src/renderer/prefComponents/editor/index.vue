<template>
  <div class="pref-editor">
    <h4>Editor</h4>
    <range
      description="Font size in text editor"
      :value="fontSize"
      :min="12"
      :max="32"
      unit="px"
      :step="1"
      :onChange="value => onSelectChange('fontSize', value)"
    ></range>
    <range
      description="Line height in text editor"
      :value="lineHeight"
      :min="1.2"
      :max="2.0"
      :step="0.1"
      :onChange="value => onSelectChange('lineHeight', value)"
    ></range>
    <font-text-box
      description="Font for text editor"
      :value="editorFontFamily"
      :onChange="value => onSelectChange('editorFontFamily', value)"
    ></font-text-box>
    <separator></separator>
    <range
      description="Font size in code blocks"
      :value="codeFontSize"
      :min="12"
      :max="28"
      unit="px"
      :step="1"
      :onChange="value => onSelectChange('codeFontSize', value)"
    ></range>
    <font-text-box
      description="Font for code blocks"
      :onlyMonospace="true"
      :value="codeFontFamily"
      :onChange="value => onSelectChange('codeFontFamily', value)"
    ></font-text-box>
    <!-- FIXME: Disabled due to #1648. -->
    <bool
      v-show="false"
      description="Show line numbers in code blocks"
      :bool="codeBlockLineNumbers"
      :onChange="value => onSelectChange('codeBlockLineNumbers', value)"
    ></bool>
    <bool
      description="Remove leading and trailing empty lines in code blocks"
      :bool="trimUnnecessaryCodeBlockEmptyLines"
      :onChange="value => onSelectChange('trimUnnecessaryCodeBlockEmptyLines', value)"
    ></bool>
    <separator></separator>
    <bool
      description="Automatically close brackets when writing"
      :bool="autoPairBracket"
      :onChange="value => onSelectChange('autoPairBracket', value)"
    ></bool>
    <bool
      description="Automatically complete markdown syntax"
      :bool="autoPairMarkdownSyntax"
      :onChange="value => onSelectChange('autoPairMarkdownSyntax', value)"
    ></bool>
    <bool
      description="Automatically close quotation marks"
      :bool="autoPairQuote"
      :onChange="value => onSelectChange('autoPairQuote', value)"
    ></bool>
    <separator></separator>
    <cur-select
      description="Line separator type"
      :value="endOfLine"
      :options="endOfLineOptions"
      :onChange="value => onSelectChange('endOfLine', value)"
    ></cur-select>
    <separator></separator>
    <cur-select
      description="Default encoding"
      :value="defaultEncoding"
      :options="defaultEncodingOptions"
      :onChange="value => onSelectChange('defaultEncoding', value)"
    ></cur-select>
    <bool
      description="Automatically detect file encoding"
      :bool="autoGuessEncoding"
      :onChange="value => onSelectChange('autoGuessEncoding', value)"
    ></bool>
    <cur-select
      description="Handling of trailing newline characters"
      :value="trimTrailingNewline"
      :options="trimTrailingNewlineOptions"
      :onChange="value => onSelectChange('trimTrailingNewline', value)"
    ></cur-select>
    <separator></separator>
    <cur-select
      description="Text direction"
      :value="textDirection"
      :options="textDirectionOptions"
      :onChange="value => onSelectChange('textDirection', value)"
    ></cur-select>
    <bool
      description="Hide hint for selecting type of new paragraph"
      :bool="hideQuickInsertHint"
      :onChange="value => onSelectChange('hideQuickInsertHint', value)"
    ></bool>
    <bool
      description="Hide popup when cursor is over link"
      :bool="hideLinkPopup"
      :onChange="value => onSelectChange('hideLinkPopup', value)"
    ></bool>
    <bool
      description="Whether to automatically check any related tasks"
      :bool="autoCheck"
      :onChange="value => onSelectChange('autoCheck', value)"
    ></bool>
    <separator></separator>
    <text-box
      description="Maximum width of text editor. Empty for theme default, otherwise number with unit suffix (`ch`: characters, `px`: pixels, `%`: percentage)"
      :input="editorLineWidth"
      :regexValidator="/^(?:$|[0-9]+(?:ch|px|%)$)/"
      defaultValue="Default value from current theme"
      :onChange="value => onSelectChange('editorLineWidth', value)"
    ></text-box>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import FontTextBox from '../common/fontTextBox'
import Range from '../common/range'
import CurSelect from '../common/select'
import Bool from '../common/bool'
import Separator from '../common/separator'
import TextBox from '../common/textBox'
import {
  endOfLineOptions,
  textDirectionOptions,
  trimTrailingNewlineOptions,
  getDefaultEncodingOptions
} from './config'

export default {
  components: {
    FontTextBox,
    Range,
    CurSelect,
    Bool,
    Separator,
    TextBox
  },
  data () {
    this.endOfLineOptions = endOfLineOptions
    this.textDirectionOptions = textDirectionOptions
    this.trimTrailingNewlineOptions = trimTrailingNewlineOptions
    this.defaultEncodingOptions = getDefaultEncodingOptions()
    return {}
  },
  computed: {
    ...mapState({
      fontSize: state => state.preferences.fontSize,
      editorFontFamily: state => state.preferences.editorFontFamily,
      lineHeight: state => state.preferences.lineHeight,
      autoPairBracket: state => state.preferences.autoPairBracket,
      autoPairMarkdownSyntax: state => state.preferences.autoPairMarkdownSyntax,
      autoPairQuote: state => state.preferences.autoPairQuote,
      endOfLine: state => state.preferences.endOfLine,
      textDirection: state => state.preferences.textDirection,
      codeFontSize: state => state.preferences.codeFontSize,
      codeFontFamily: state => state.preferences.codeFontFamily,
      codeBlockLineNumbers: state => state.preferences.codeBlockLineNumbers,
      trimUnnecessaryCodeBlockEmptyLines: state => state.preferences.trimUnnecessaryCodeBlockEmptyLines,
      hideQuickInsertHint: state => state.preferences.hideQuickInsertHint,
      hideLinkPopup: state => state.preferences.hideLinkPopup,
      autoCheck: state => state.preferences.autoCheck,
      editorLineWidth: state => state.preferences.editorLineWidth,
      defaultEncoding: state => state.preferences.defaultEncoding,
      autoGuessEncoding: state => state.preferences.autoGuessEncoding,
      trimTrailingNewline: state => state.preferences.trimTrailingNewline
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
  .pref-editor {
    & h4 {
      text-transform: uppercase;
      margin: 0;
      font-weight: 400;
    }
    & .image-ctrl {
      font-size: 14px;
      user-select: none;
      margin: 20px 0;
      color: var(--editorColor);
      & label {
        display: block;
        margin: 20px 0;
      }
    }
  }
</style>
