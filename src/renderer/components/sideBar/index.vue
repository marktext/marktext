<template>
  <div class="side-bar">
    <div class="left-column">
      <ul>
        <li v-for="(icon, index) of sideBarIcons" :key="index">
          <svg class="icon" aria-hidden="true">
            <use :xlink:href="'#' + icon.icon"></use>
          </svg>
        </li>
      </ul>
    </div>
    <div class="right-column">
      <tree
        :project-tree="projectTree"
        :opened-files="openedFiles"
      ></tree>
    </div>
  </div>
</template>

<script>
  import { sideBarIcons } from './help'
  import Tree from './tree.vue'
import { mapState } from 'vuex'

  export default {
    data () {
      this.sideBarIcons = sideBarIcons
      return {
        openedFiles: []
      }
    },
    components: {
      Tree
    },
    computed: {
      ...mapState(['projectTree'])
    }
  }
</script>

<style scoped>
  .side-bar {
    display: flex;
    border-right: 1px solid var(--lightBorder);
    height: calc(100vh - 22px);
    overflow: hidden;
  }
  .left-column {
    height: 100%;
    width: 50px;
    background: var(--lightBorder);
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
</style>
