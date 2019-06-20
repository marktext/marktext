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
    <cur-select
      description="The used font in the editor."
      :value="editorFontFamily"
      :options="editorFontFamilyOptions"
      :onChange="value => onSelectChange('editorFontFamily', value)"
    ></cur-select>
    <range
      description="Line height of editor lines."
      :value="lineHeight"
      :min="1.2"
      :max="2.0"
      :step="0.1"
      :onChange="value => onSelectChange('lineHeight', value)"
    ></range>
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
      description="The default end of line character, if you select default, which will be selected according to your system intelligence."
      :value="endOfLine"
      :options="endOfLineOptions"
      :onChange="value => onSelectChange('endOfLine', value)"
    ></cur-select>
    <cur-select
      description="The writing text direction."
      :value="textDirection"
      :options="textDirectionOptions"
      :onChange="value => onSelectChange('textDirection', value)"
    ></cur-select>
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
    <cur-select
      description="The used code block font in the editor."
      :value="codeFontFamily"
      :options="codeFontFamilyOptions"
      :onChange="value => onSelectChange('codeFontFamily', value)"
    ></cur-select>
    <separator></separator>
    <bool
      description="Hide hint for quickly creating paragraphs."
      :input="hideQuickInsertHint"
      :onChange="value => onSelectChange('hideQuickInsertHint', value)"
    ></bool>
    <separator></separator>
    <text-box
      description="Defines the maximum editor area width. An empty string or suffixes of ch (characters), px (pixels) or % (percentage) are allowed."
      :input="editorLineWidth"
      :regexValidator="/^(?:$|[0-9]+(?:ch|px|%)$)/"
      defaultValue="The default value from the current theme"
      :onChange="value => onSelectChange('editorLineWidth', value)"
    ></text-box>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Range from '../common/range'
import CurSelect from '../common/select'
import Bool from '../common/bool'
import Separator from '../common/separator'
import TextBox from '../common/textBox'
import {
  editorFontFamilyOptions,
  endOfLineOptions,
  textDirectionOptions,
  codeFontFamilyOptions
} from './config'

export default {
  components: {
    Range,
    CurSelect,
    Bool,
    Separator,
    TextBox
  },
  data () {
    this.editorFontFamilyOptions = editorFontFamilyOptions
    this.endOfLineOptions = endOfLineOptions
    this.textDirectionOptions = textDirectionOptions
    this.codeFontFamilyOptions = codeFontFamilyOptions
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
      hideQuickInsertHint: state => state.preferences.hideQuickInsertHint,
      editorLineWidth: state => state.preferences.editorLineWidth
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
      font-weight: 100;
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
