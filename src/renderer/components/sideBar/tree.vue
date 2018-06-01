<template>
  <div class="tree-view">
    <div class="title">
      <span>Explorer</span>
      <a
        href="javascript:;"
        :class="{'active': active === 'tree'}"
      >
        <svg class="icon" aria-hidden="true" @click="active = 'tree'">
          <use xlink:href="#icon-tree"></use>
        </svg>       
      </a>
      <a
        href="javascript:;"
        :class="{'active': active === 'list'}"
      >
        <svg class="icon" aria-hidden="true" @click="active = 'list'">
          <use xlink:href="#icon-list"></use>
        </svg>        
      </a>
    </div>
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
      <div class="tree-wrapper" v-show="active === 'tree'">
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
      <div v-show="active === 'list'">
        <list-file
          v-for="(file, index) of fileList"
          :key="index"
          :file="file"
        ></list-file>
      </div>
    </div>
  </div>
</template>

<script>
  import Folder from './folder.vue'
  import File from './file.vue'
  import ListFile from './listFile.vue'

  export default {
    data () {
      this.depth = 0
      return {
        active: 'tree'
      }
    },
    props: {
      projectTree: Object,
      openedFiles: Array
    },
    computed: {
      fileList () {
        const files = []
        const travel = folder => {
          files.push(...folder.files.filter(f => f.isMarkdown))
          for (const childFolder of folder.folders) {
            travel(childFolder)
          }
        }

        travel(this.projectTree)
        return files.sort()
      }
    },
    components: {
      Folder,
      File,
      ListFile
    },
    methods: {
      titleIconClick (active) {
        //
      }
    }
  }
</script>

<style scoped>
  .tree-view {
    font-size: 13px;
    color: var(--regularColor);
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .tree-view > .title {
    height: 35px;
    line-height: 35px;
    padding: 0 15px;
    display: flex;
    & > span {
      flex: 1;
      user-select: none;
    }
    & > a {
      pointer-events: auto;
      cursor: pointer;
      margin-left: 8px;
      color: var(--primaryColor);
    }
    & > a:hover {
      color: var(--brandColor);
    }
    & > a.active {
      color: var(--activeColor);
    }
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
