<template>
  <div class="side-bar-toc">
    <div class="title">Table Of Contents</div>
    <el-tree
      v-if="toc.length"
      :data="toc"
      :default-expand-all="true"
      :props="defaultProps"
      @node-click="handleClick"
      :expand-on-click-node="false"
      :indent="10"
    ></el-tree>
    <div class="no-data" v-else>
      <svg aria-hidden="true" :viewBox="EmptyIcon.viewBox">
        <use :xlink:href="EmptyIcon.url"></use>
      </svg>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import bus from '../../bus'
import EmptyIcon from '@/assets/icons/undraw_toc_empty.svg'

export default {
  data () {
    this.EmptyIcon = EmptyIcon
    return {
      defaultProps: {
        children: 'children',
        label: 'label'
      }
    }
  },
  computed: {
    ...mapState({
      toc: state => state.editor.toc
    })
  },
  methods: {
    handleClick ({ slug }) {
      bus.$emit('scroll-to-header', slug)
    }
  }
}
</script>

<style>
  .side-bar-toc {
    height: calc(100% - 35px);
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: auto;
    display: flex;
    flex-direction: column;
    & .title {
      padding: 5px 0;
      color: var(--sideBarTitleColor);
      font-weight: 600px;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    & .el-tree-node {
      margin-top: 8px;
    }
    & .el-tree {
      background: transparent;
      color: var(--sideBarColor);
    }
    & .el-tree-node:focus > .el-tree-node__content {
      background-color: var(--sideBarItemHoverBgColor);
      }
    & .el-tree-node__content:hover {
      background: var(--sideBarItemHoverBgColor);
    }
    & > li {
      font-size: 14px;
      margin-bottom: 15px;
      cursor: pointer;
    }
    & .no-data {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-around;
      padding-bottom: 50px;
      & svg {
        width: 120px;
        fill: var(--themeColor);
      }
    }
  }
</style>
