<template>
  <div class="tree-view">
    <div class="title">Resource Manager</div>
    <!-- opened files -->
    <div class="opened-files">
      <div class="title">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-arrow"></use>
        </svg>
        <span>Opened files</span>
      </div>
    </div>
    <!-- project tree view -->
    <div class="project-tree">
      <div class="title">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-arrow"></use>
        </svg>
        <span>{{ projectTree.name }}</span>
      </div>
      <div class="tree-wrapper">
        <folder
          v-for="(folder, index) of projectTree.folders" :key="index + 'folder'"
          :folder="folder"
          :depth="depth"
        ></folder>
        <file
          v-for="(file, index) of projectTree.files" :key="index + 'file'"
          :file="file"
          :depth="depth"
        ></file>
      </div>
    </div>
  </div>
</template>

<script>
  import Folder from './folder.vue'
  import File from './file.vue'
  export default {
    data () {
      this.depth = 0
      return {}
    },
    props: {
      projectTree: Object,
      openedFiles: Array
    },
    components: {
      Folder,
      File
    }
  }
</script>

<style scoped>
  .tree-view {
    font-size: 13px;
    color: var(--secondaryColor);
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .tree-view > .title {
    height: 35px;
    line-height: 35px;
    padding: 0 15px;
  }

  .opened-files,
  .project-tree {
    & > .title {
      height: 25px;
      background: var(--lighterBorder);
      line-height: 25px;
    }
  }

  .project-tree {
    display: flex;
    flex-direction: column;
    & > .tree-wrapper {
      overflow: auto;
      flex: 1;
      &::-webkit-scrollbar:vertical {
        width: 5px;
      }
    }
    flex: 1;
  }
</style>
