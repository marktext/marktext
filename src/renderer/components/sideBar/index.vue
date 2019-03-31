<template>
  <div
    v-show="showSideBar"
    class="side-bar"
    ref="sideBar"
    :style="{ 'width': `${finalSideBarWidth}px` }"
  >
    <div class="title-bar-bg"></div>
    <div class="left-column">
      <ul>
        <li
          v-for="(icon, index) of sideBarIcons"
          :key="index"
          @click="handleLeftIconClick(icon.name)"
          :class="{ 'active': icon.name === rightColumn }"
        >
          <svg class="icon" aria-hidden="true">
            <use :xlink:href="'#' + icon.icon"></use>
          </svg>
        </li>
      </ul>
      <ul class="bottom">
        <li
          v-for="(icon, index) of sideBarBottomIcons"
          :key="index"
          @click="handleLeftBottomClick(icon.name)"
        >
          <svg class="icon" aria-hidden="true">
            <use :xlink:href="'#' + icon.icon"></use>
          </svg>
        </li>
      </ul>
    </div>
    <div class="right-column" v-show="rightColumn">
      <tree
        :project-tree="projectTree"
        :file-list="fileList"
        :opened-files="openedFiles"
        :tabs="tabs"
        v-if="rightColumn === 'files'"
      ></tree>
      <side-bar-search
        v-else-if="rightColumn === 'search'"
      ></side-bar-search>
      <toc
        v-else-if="rightColumn === 'toc'"
      ></toc>
    </div>
    <div class="drag-bar" ref="dragBar"></div>
  </div>
</template>

<script>
  import { sideBarIcons, sideBarBottomIcons } from './help'
  import bus from '../../bus'
  import Tree from './tree.vue'
  import SideBarSearch from './search.vue'
  import Toc from './toc.vue'
  import { mapState, mapGetters } from 'vuex'

  export default {
    data () {
      this.sideBarIcons = sideBarIcons
      this.sideBarBottomIcons = sideBarBottomIcons
      return {
        openedFiles: [],
        sideBarViewWidth: 280
      }
    },
    components: {
      Tree,
      SideBarSearch,
      Toc
    },
    computed: {
      ...mapState({
        'rightColumn': state => state.layout.rightColumn,
        'showSideBar': state => state.layout.showSideBar,
        'projectTree': state => state.project.projectTree,
        'sideBarWidth': state => state.project.sideBarWidth,
        'tabs': state => state.editor.tabs
      }),
      ...mapGetters(['fileList']),
      finalSideBarWidth () {
        const { showSideBar, rightColumn, sideBarViewWidth } = this
        let width = sideBarViewWidth
        if (rightColumn === '') width = 45
        if (!showSideBar) width -= 45
        return width
      }
    },
    created () {
      this.$nextTick(() => {
        const dragBar = this.$refs.dragBar
        let startX = 0
        let sideBarWidth = +this.sideBarWidth
        let startWidth = sideBarWidth

        this.sideBarViewWidth = sideBarWidth

        const mouseUpHandler = event => {
          document.removeEventListener('mousemove', mouseMoveHandler, false)
          document.removeEventListener('mouseup', mouseUpHandler, false)
          this.$store.dispatch('CHANGE_SIDE_BAR_WIDTH', sideBarWidth)
        }

        const mouseMoveHandler = event => {
          const offset = event.clientX - startX
          sideBarWidth = startWidth + offset
          this.sideBarViewWidth = sideBarWidth
        }

        const mouseDownHandler = event => {
          startX = event.clientX
          startWidth = +this.sideBarWidth
          document.addEventListener('mousemove', mouseMoveHandler, false)
          document.addEventListener('mouseup', mouseUpHandler, false)
        }

        dragBar.addEventListener('mousedown', mouseDownHandler, false)
      })
    },
    methods: {
      handleLeftIconClick (name) {
        if (this.rightColumn === name) {
          this.$store.commit('SET_LAYOUT', { rightColumn: '' })
        } else {
          this.$store.commit('SET_LAYOUT', { rightColumn: name })
          this.sideBarViewWidth = +this.sideBarWidth
        }
      },
      handleLeftBottomClick (name) {
        if (name === 'twitter') {
          bus.$emit('tweetDialog')
        }
      }
    }
  }
</script>

<style scoped>
  .side-bar {
    display: flex;
    height: 100vh;
    position: relative;
    color: var(--sideBarColor);
    user-select: none;
  }
  .side-bar {
    background: var(--sideBarBgColor);
    border-right: 1px solid var(--itemBgColor);
  }

  .left-column {
    height: 100%;
    width: 45px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 40px;
    box-sizing: border-box;
    & > ul {
      opacity: 1;
    }
  }

  .left-column ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    & > li {
      width: 45px;
      height: 45px;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: space-around;
      align-items: center;
      cursor: pointer;
      & > svg {
        width: 18px;
        height: 18px;
        opacity: 1;
        color: var(--iconColor);
        transition: transform .25s ease-in-out;
      }
      &:hover > svg {
        color: var(--themeColor);
      }
      &.active > svg {
        color: var(--themeColor);
      }
    }
  }

  .side-bar:hover .left-column ul li svg {
    opacity: 1;
  }
  .right-column {
    flex: 1;
    width: calc(100% - 50px);
    overflow: hidden;
  }
  .drag-bar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    width: 8px;
    cursor: col-resize;
    &:hover {
      border-right: 2px solid var(--sideBarTextColor);
    }
  }
</style>
