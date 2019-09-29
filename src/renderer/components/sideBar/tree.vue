<template>
  <div class="tree-view">
    <div class="title">
      <!-- Placeholder -->
    </div>

    <!-- Opened tabs -->
    <div class="opened-files">
      <div class="title">
        <svg class="icon icon-arrow" :class="{'fold': !showOpenedFiles}" aria-hidden="true" @click.stop="toggleOpenedFiles()">
          <use xlink:href="#icon-arrow"></use>
        </svg>
        <span class="default-cursor text-overflow" @click.stop="toggleOpenedFiles()">Opened files</span>
        <a href="javascript:;" @click.stop="saveAll(false)" title="Save All">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-save-all"></use>
          </svg>
        </a>
        <a href="javascript:;" @click.stop="saveAll(true)" title="Close All">
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#icon-close-all"></use>
          </svg>
        </a>
      </div>
      <div class="opened-files-list" v-show="showOpenedFiles">
        <transition-group name="list">
          <opened-file
            v-for="tab of tabs"
            :key="tab.id"
            :file="tab"
          ></opened-file>
        </transition-group>
      </div>
    </div>

    <!-- Project tree view -->
    <div
      class="project-tree" v-if="projectTree"
    >
      <div class="title">
        <svg class="icon icon-arrow" :class="{'fold': !showDirectories}" aria-hidden="true" @click.stop="toggleDirectories()">
          <use xlink:href="#icon-arrow"></use>
        </svg>
        <span class="default-cursor text-overflow" @click.stop="toggleDirectories()">{{ projectTree.name }}</span>
      </div>
      <div class="tree-wrapper" v-show="showDirectories">
        <folder
          v-for="(folder, index) of projectTree.folders" :key="index + 'folder'"
          :folder="folder"
          :depth="depth"
        ></folder>
        <input
          type="text" class="new-input" v-show="createCache.dirname === projectTree.pathname"
          :style="{'margin-left': `${depth * 5 + 15}px` }"
          ref="input"
          v-model="createName"
          @keydown.enter="handleInputEnter"
        >
        <file
          v-for="(file, index) of projectTree.files" :key="index + 'file'"
          :file="file"
          :depth="depth"
        ></file>
        <div class="empty-project" v-if="projectTree.files.length === 0 && projectTree.folders.length === 0">
          <span>Empty project</span>
          <a href="javascript:;" @click.stop="createFile">Create File</a>
        </div>
      </div>
    </div>
    <div v-else class="open-project">
      <div class="centered-group">
        <svg aria-hidden="true" :viewBox="FolderIcon.viewBox">
          <use :xlink:href="FolderIcon.url"></use>
        </svg>
        <button class="button-primary" @click="openFolder">
          Open Folder
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import Folder from './treeFolder.vue'
import File from './treeFile.vue'
import OpenedFile from './treeOpenedTab.vue'
import { mapState } from 'vuex'
import bus from '../../bus'
import { createFileOrDirectoryMixins } from '../../mixins'
import FolderIcon from '@/assets/icons/undraw_folder.svg'

export default {
  mixins: [createFileOrDirectoryMixins],
  data () {
    this.depth = 0
    this.FolderIcon = FolderIcon
    return {
      showDirectories: true,
      showNewInput: false,
      showOpenedFiles: true,
      createName: ''
    }
  },
  props: {
    projectTree: {
      validator: function (value) {
        return typeof value === 'object'
      },
      required: true
    },
    openedFiles: Array,
    tabs: Array
  },
  components: {
    Folder,
    File,
    OpenedFile
  },
  computed: {
    ...mapState({
      createCache: state => state.project.createCache
    })
  },
  created () {
    this.$nextTick(() => {
      bus.$on('SIDEBAR::show-new-input', this.handleInputFocus)
      // hide rename or create input if needed
      document.addEventListener('click', event => {
        const target = event.target
        if (target.tagName !== 'INPUT') {
          this.$store.dispatch('CHANGE_ACTIVE_ITEM', {})
          this.$store.commit('CREATE_PATH', {})
          this.$store.commit('SET_RENAME_CACHE', null)
        }
      })
      document.addEventListener('contextmenu', event => {
        const target = event.target
        if (target.tagName !== 'INPUT') {
          this.$store.commit('CREATE_PATH', {})
          this.$store.commit('SET_RENAME_CACHE', null)
        }
      })
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          this.$store.commit('CREATE_PATH', {})
          this.$store.commit('SET_RENAME_CACHE', null)
        }
      })
    })
  },
  methods: {
    openFolder () {
      this.$store.dispatch('ASK_FOR_OPEN_PROJECT')
    },
    saveAll (isClose) {
      this.$store.dispatch('ASK_FOR_SAVE_ALL', isClose)
    },
    createFile () {
      this.$store.dispatch('CHANGE_ACTIVE_ITEM', this.projectTree)
      bus.$emit('SIDEBAR::new', 'file')
    },
    toggleOpenedFiles () {
      this.showOpenedFiles = !this.showOpenedFiles
    },
    toggleDirectories () {
      this.showDirectories = !this.showDirectories
    }
  }
}
</script>

<style scoped>
  .list-item {
    display: inline-block;
    margin-right: 10px;
  }

  .list-enter-active, .list-leave-active {
    transition: all .2s;
  }
  .list-enter, .list-leave-to
  /* .list-leave-active for below version 2.1.8 */ {
    opacity: 0;
    transform: translateX(-50px);
  }
  .tree-view {
    font-size: 14px;
    color: var(--sideBarColor);
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .tree-view > .title {
    height: 35px;
    line-height: 35px;
    padding: 0 15px;
    display: flex;
    flex-shrink: 0;
    flex-direction: row-reverse;
  }

  .icon-arrow {
    margin-right: 5px;
    transition: all .25s ease-out;
    transform: rotate(90deg);
    fill: var(--sideBarTextColor);
  }

  .icon-arrow.fold {
    transform: rotate(0);
  }

  .opened-files,
  .project-tree {
    & > .title {
      height: 30px;
      line-height: 30px;
      font-size: 14px;
    }
  }

  .opened-files .title {
    padding-right: 15px;
    display: flex;
    align-items: center;
    & > span {
      flex: 1;
    }
    & > a {
      display: none;
      text-decoration: none;
      color: var(--sideBarColor);
      margin-left: 8px;
    }
  }
  .opened-files div.title:hover > a,
  .opened-files div.title > a:hover {
    display: block;
    &:hover {
      color: var(--highlightThemeColor);
    }
  }
  .opened-files {
    display: flex;
    flex-direction: column;
  }
  .default-cursor {
    cursor: pointer;
  }
  .opened-files .opened-files-list {
    max-height: 200px;
    overflow: auto;
    &::-webkit-scrollbar:vertical {
      width: 8px;
    }
    flex: 1;
  }

  .project-tree {
    display: flex;
    flex-direction: column;
    overflow: auto;
    & > .title {
      padding-right: 15px;
      display: flex;
      align-items: center;
      & > span {
        flex: 1;
        user-select: none;
      }
      & > a {
        pointer-events: auto;
        cursor: pointer;
        margin-left: 8px;
        color: var(--sideBarIconColor);
        opacity: 0;
      }
      & > a:hover {
        color: var(--highlightThemeColor);
      }
      & > a.active {
        color: var(--highlightThemeColor);
      }
    }
    & > .tree-wrapper {
      overflow: auto;
      flex: 1;
      &::-webkit-scrollbar:vertical {
        width: 8px;
      }
    }
    flex: 1;
  }
  .project-tree div.title:hover > a {
    opacity: 1;
  }
  .open-project {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    padding-bottom: 100px;
    & .centered-group {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    & svg {
      width: 120px;
      fill: var(--themeColor);
    }
    & button.button-primary {
      display: block;
      margin-top: 20px;
    }
  }
  .new-input {
    outline: none;
    height: 22px;
    margin: 5px 0;
    padding: 0 6px;
    color: var(--sideBarColor);
    border: 1px solid var(--floatBorderColor);
    background: var(--floatBorderColor);
    width: calc(100% - 45px);
    border-radius: 3px;
  }
  .tree-wrapper {
    position: relative;
  }
  .empty-project {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    padding-top: 40px;
    align-items: center;
    & > a {
      color: var(--highlightThemeColor);
      text-align: center;
      margin-top: 15px;
      text-decoration: none;
    }
  }
  .bold {
    font-weight: 600;
  }
</style>
