<template>
    <ul class="side-bar-toc">
      <li v-for="(item, index) of toc"
        :key="index"
        :style="{'padding-left': `${(item.lvl - startLvl) * 20}px`}"
        @click="handleClick(item)"
        :class="{ 'active': item.slug === activeIndex }"
      >
        {{ item.content }}
      </li>
    </ul>
</template>

<script>
  import { mapState } from 'vuex'
  import bus from '../../bus'

  export default {
    data () {
      return {
        activeIndex: null
      }
    },
    computed: {
      ...mapState({
        'toc': state => state.editor.toc
      }),
      startLvl () {
        return Math.min(...this.toc.map(h => h.lvl))
      }
    },
    methods: {
      handleClick ({ slug }) {
        this.activeIndex = slug
        bus.$emit('scroll-to-header', slug)
      }
    }
  }
</script>

<style scoped>
  .side-bar-toc {
    height: calc(100% - 35px);
    margin: 0;
    margin-top: 35px;
    padding: 0;
    list-style: none;
    overflow: auto;
    & > li {
      font-size: 14px;
      margin-bottom: 15px;
      cursor: pointer;
    }
    & > li.active {
      color: var(--primary);
    }
  }
</style>
