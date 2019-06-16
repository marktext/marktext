<template>
  <div class="pref-markdown">
    <h4>markdown</h4>
    <bool
      description="Preferred loose list item."
      :bool="preferLooseListItem"
      :onChange="value => onSelectChange('preferLooseListItem', value)"
      more="https://spec.commonmark.org/0.29/#loose"
    ></bool>
    <cus-select
      description="The preferred marker used in bullet list."
      :value="bulletListMarker"
      :options="bulletListMarkerOptions"
      :onChange="value => onSelectChange('bulletListMarker', value)"
      more="https://spec.commonmark.org/0.29/#bullet-list-marker"
    ></cus-select>
    <cus-select
      description="The preferred dilimiter used in order list."
      :value="orderListDelimiter"
      :options="orderListDelimiterOptions"
      :onChange="value => onSelectChange('orderListDelimiter', value)"
      more="https://spec.commonmark.org/0.29/#ordered-list"
    ></cus-select>
    <cus-select
      description="The preferred heading style"
      :value="preferHeadingStyle"
      :options="preferHeadingStyleOptions"
      :onChange="value => onSelectChange('preferHeadingStyle', value)"
      :disable="true"
    ></cus-select>
    <cus-select
      description="The number of spaces a tab is equal to."
      :value="tabSize"
      :options="tabSizeOptions"
      :onChange="value => onSelectChange('tabSize', value)"
    ></cus-select>
    <cus-select
      description="The list indentation of sub list items or paragraphs."
      :value="listIndentation"
      :options="listIndentationOptions"
      :onChange="value => onSelectChange('listIndentation', value)"
    ></cus-select>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Bool from '../common/bool'
import CusSelect from '../common/select'
import {
  bulletListMarkerOptions,
  orderListDelimiterOptions,
  preferHeadingStyleOptions,
  tabSizeOptions,
  listIndentationOptions
} from './config'

export default {
  components: {
    Bool,
    CusSelect
  },
  data () {
    this.bulletListMarkerOptions = bulletListMarkerOptions
    this.orderListDelimiterOptions = orderListDelimiterOptions
    this.preferHeadingStyleOptions = preferHeadingStyleOptions
    this.tabSizeOptions = tabSizeOptions
    this.listIndentationOptions = listIndentationOptions
    return {}
  },
  computed: {
    ...mapState({
      preferLooseListItem: state => state.preferences.preferLooseListItem,
      bulletListMarker: state => state.preferences.bulletListMarker,
      orderListDelimiter: state => state.preferences.orderListDelimiter,
      preferHeadingStyle: state => state.preferences.preferHeadingStyle,
      tabSize: state => state.preferences.tabSize,
      listIndentation: state => state.preferences.listIndentation
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
    & h4 {
      text-transform: uppercase;
      margin: 0;
      font-weight: 100;
    }
  }
</style>
