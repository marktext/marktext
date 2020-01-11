<template>
  <div
    class="marp"
    ref="marp"
  >
    <MarpRenderer :markdown="markdown" :options="options" >
    </MarpRenderer>
  </div>
</template>

<script>
import { MarpRenderer, MarpSlide } from '@marp-team/marp-vue'

const options = {
  inlineSVG: true,
  emoji: {
    shortcode: true,
    unicode: true
  }
}

export default {
  props: {
    markdown: String
  },

  data: () => ({ options }),

  components: { MarpRenderer, MarpSlide }
}
</script>
<style>
  .marp {
    height: calc(100vh - var(--titleBarHeight));
    box-sizing: border-box;
    overflow: auto;
  }
</style>
