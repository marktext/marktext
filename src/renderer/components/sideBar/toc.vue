<template>
    <ul class="side-bar-toc">
      <li v-for="(item, index) of toc"
        :key="index"
        :style="{'padding-left': `${(item.lvl - startLvl) * 20}px`}"
        @click="handleClick(item)"
        :class="{ 'active': item === activeItem }"
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
        activeItem: null
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
        console.log(item)
        this.activeItem = item
        bus.$emit('scroll-to-header', item.slug)
      }
    }
  }
</script>

<style scoped>
  ::-webkit-scrollbar:vertical {
    width: 8px;
  }
  .side-bar-toc {
    height: calc(100% - 35px);
    overflow: auto;
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
