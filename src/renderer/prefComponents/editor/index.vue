<template>
  <div class="pref-editor">
    <h4>Editor</h4>
    <range
      description="Font size in editor"
      :value="fontSize"
      :min="12"
      :max="20"
      unit="px"
      :step="1"
      :onChange="value => onSelectChange('fontSize', value)"
    ></range>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Range from '../common/range'
export default {
  components: {
    Range
  },
  computed: {
    ...mapState({
      fontSize: state => state.preferences.fontSize,
      editorFontFamile: state => state.preferences.editorFontFamile,
      lineHeight: state => state.preferences.lineHeight,
      autoPairBracket: state => state.preferences.autoPairBracket,
      autoPairMarkdownSyntax: state => state.preferences.autoPairMarkdownSyntax,
      autoPairQuote: state => state.preferences.autoPairQuote,
      endOfLine: state => state.preferences.endOfLine,
      textDirection: state => state.preferences.textDirection,
      codeFontSize: state => state.preferences.codeFontSize,
      codeFontFamily: state => state.preferences.codeFontFamily,
      hideQuickInsertHint: state => state.preferences.hideQuickInsertHint,
      imageDropAction: state => state.preferences.imageDropAction
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
  }
</style>
