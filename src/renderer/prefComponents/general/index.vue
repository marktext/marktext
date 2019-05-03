<template>
  <div class="pref-general">
    <h4>General</h4>
    <bool-item
      description="Automatically save the content being edited"
      :bool="true"
    ></bool-item>
  </div>
</template>

<script>
import BoolItem from '../common/bool'
export default {
  components: {
    BoolItem
  }
}
</script>

<style scoped>
  .pref-general {
    & h4 {
      text-transform: uppercase;
      margin: 0;
      font-weight: 100;
    }
  }
</style>
