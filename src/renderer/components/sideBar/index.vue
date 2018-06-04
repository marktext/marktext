<template>
  <div
    class="side-bar"
    :class="{ 'opacity' : rightColumn === '' }"
    ref="sideBar"
    :style="{ 'width': `${finalSideBarWidth}px` }"
  >
    <div
      class="left-column"
      v-show="showToolBar"
    >
      <ul>
        <li
          v-for="(icon, index) of sideBarIcons"
          :key="index"
          @click="handleLeftIconClick(icon.name)"
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
  import { sideBarIcons } from './help'
  import Tree from './tree.vue'
  import SideBarSearch from './search.vue'
  import Toc from './toc.vue'
  import { mapState, mapGetters } from 'vuex'

  export default {
    data () {
      this.sideBarIcons = sideBarIcons
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
        'showToolBar': state => state.layout.showToolBar,
        'projectTree': state => state.project.projectTree,
        'sideBarWidth': state => state.project.sideBarWidth,
        'tabs': state => state.editor.tabs
      }),
      ...mapGetters(['fileList']),
      finalSideBarWidth () {
        const { showToolBar, rightColumn, sideBarViewWidth } = this
        let width = sideBarViewWidth
        if (rightColumn === '') width = 50
        if (!showToolBar) width -= 50
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
      }
    }
  }
</script>

<style scoped>
  .side-bar {
    display: flex;
    border-right: 1px solid var(--lightBarColor);
    height: calc(100vh - 22px);
    overflow: hidden;
    position: relative;
  }
  .side-bar.opacity {
    border-right-color: transparent;
  }
  .left-column {
    height: 100%;
    width: 50px;
    background-color: var(--lightBarColor);
  }
  .opacity .left-column {
    background-color: transparent;
  }
  .left-column ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    & > li {
      width: 50px;
      height: 50px;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: space-around;
      align-items: center;
      cursor: pointer;
      &:hover > svg {
        color: var(--brandColor);
      }
      & > svg {
        width: 20px;
        height: 20px;
        color: var(--secondaryColor);
      }
    }
  }
  .right-column {
    flex: 1;
    width: calc(100% - 50px);
  }
  .drag-bar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    width: 5px;
    cursor: col-resize;
  }
</style>
