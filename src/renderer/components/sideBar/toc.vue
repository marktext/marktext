<template>
    <ul class="side-bar-toc">
      <li v-for="(item, index) of toc"
        :key="index"
        :style="{'padding-left': `${(item.lvl - startLvl) * 20}px`}"
        @click="handleClick(item)"
        :class="{ 'active': item.i === activeIndex }"
      >
        {{ item.content }}
      </li>
    </ul>
</template>

<script>
  import { mapGetters } from 'vuex'
  import bus from '../../bus'

  export default {
    data () {
      return {
        activeIndex: -1
      }
    },
    computed: {
      ...mapGetters(['toc']),
      startLvl () {
        return Math.min(...this.toc.map(h => h.lvl))
      }
    },
    methods: {
      handleClick (item) {
        this.activeIndex = item.i
        bus.$emit('scroll-to-header', item.slug)
      }
    }
  }
</script>

<style scoped>
  .side-bar-toc {
    margin: 0;
    margin-top: 35px;
    padding: 0;
    list-style: none;
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
