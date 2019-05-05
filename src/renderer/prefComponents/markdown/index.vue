<template>
  <div class="pref-markdown">
    <h4>markdown</h4>
    <bool
      description="Prefer loose list item"
      :bool="true"
      more="https://spec.commonmark.org/0.29/#loose"
    ></bool>
    <cus-select
      description="Bullet list item marker"
      :value="bulletListMarker"
      :options="bulletListMarkerOptions"
    ></cus-select>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Bool from '../common/bool'
import CusSelect from '../common/select'
import { bulletListMarkerOptions } from './config'

export default {
  components: {
    Bool,
    CusSelect
  },
  data () {
    this.bulletListMarkerOptions = bulletListMarkerOptions
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
    // todo
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
