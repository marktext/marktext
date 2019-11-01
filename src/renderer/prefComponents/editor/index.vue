<template>
  <div class="pref-editor">
    <h4>Editor</h4>
    <range
      description="The font size of editor text"
      :value="fontSize"
      :min="12"
      :max="32"
      unit="px"
      :step="1"
      :onChange="value => onSelectChange('fontSize', value)"
    ></range>
    <range
      description="Line height of editor lines."
      :value="lineHeight"
      :min="1.2"
      :max="2.0"
      :step="0.1"
      :onChange="value => onSelectChange('lineHeight', value)"
    ></range>
    <font-text-box
      description="The used font in the editor."
      :value="editorFontFamily"
      :onChange="value => onSelectChange('editorFontFamily', value)"
    ></font-text-box>
    <separator></separator>
    <range
      description="The code block font size in editor."
      :value="codeFontSize"
      :min="12"
      :max="28"
      unit="px"
      :step="1"
      :onChange="value => onSelectChange('codeFontSize', value)"
    ></range>
    <font-text-box
      description="The used code block font in the editor."
      :onlyMonospace="true"
      :value="codeFontFamily"
      :onChange="value => onSelectChange('codeFontFamily', value)"
    ></font-text-box>
    <bool
      description="Whether to show the code block line numbers."
      :bool="codeBlockLineNumbers"
      :onChange="value => onSelectChange('codeBlockLineNumbers', value)"
    ></bool>
    <bool
      description="Trim the beginning and ending empty lines in code block when open markdown."
      :bool="trimUnnecessaryCodeBlockEmptyLines"
      :onChange="value => onSelectChange('trimUnnecessaryCodeBlockEmptyLines', value)"
    ></bool>
    <separator></separator>
    <bool
      description="Automatically brackets when editing."
      :bool="autoPairBracket"
      :onChange="value => onSelectChange('autoPairBracket', value)"
    ></bool>
    <bool
      description="Autocomplete markdown syntax"
      :bool="autoPairMarkdownSyntax"
      :onChange="value => onSelectChange('autoPairMarkdownSyntax', value)"
    ></bool>
    <bool
      description="Automatic completion of quotes"
      :bool="autoPairQuote"
      :onChange="value => onSelectChange('autoPairQuote', value)"
    ></bool>
    <separator></separator>
    <cur-select
      description="The default end of line character. If you select default, the ending will be selected according to your system intelligence."
      :value="endOfLine"
      :options="endOfLineOptions"
      :onChange="value => onSelectChange('endOfLine', value)"
    ></cur-select>
    <separator></separator>
    <cur-select
      description="The default file encoding."
      :value="defaultEncoding"
      :options="defaultEncodingOptions"
      :onChange="value => onSelectChange('defaultEncoding', value)"
    ></cur-select>
    <bool
      description="Try to automatically guess the file encoding when opening files."
      :bool="autoGuessEncoding"
      :onChange="value => onSelectChange('autoGuessEncoding', value)"
    ></bool>
    <separator></separator>
    <cur-select
      description="The writing text direction."
      :value="textDirection"
      :options="textDirectionOptions"
      :onChange="value => onSelectChange('textDirection', value)"
    ></cur-select>
    <bool
      description="Hide hint for quickly creating paragraphs."
      :bool="hideQuickInsertHint"
      :onChange="value => onSelectChange('hideQuickInsertHint', value)"
    ></bool>
    <bool
      description="Hide link popup when the cursor is hover on the link."
      :bool="hideLinkPopup"
      :onChange="value => onSelectChange('hideLinkPopup', value)"
    ></bool>
    <separator></separator>
    <text-box
      description="Defines the maximum editor area width. An empty string or suffixes of ch (characters), px (pixels) or % (percentage) are allowed."
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
      editorLineWidth: state => state.preferences.editorLineWidth,
      defaultEncoding: state => state.preferences.defaultEncoding,
      autoGuessEncoding: state => state.preferences.autoGuessEncoding
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
