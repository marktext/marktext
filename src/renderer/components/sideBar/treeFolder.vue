<template>
  <div
    class="side-bar-folder"
  >
    <div
      class="folder-name" @click="folderNameClick"
      :style="{'padding-left': `${depth * 5 + 15}px`}"
      :class="[{ 'active': folder.id === activeItem.id }]"
      :title="folder.pathname"
      ref="folder"
    >
      <svg class="icon" aria-hidden="true">
        <use :xlink:href="`#${folder.isCollapsed ? 'icon-folder-close' : 'icon-folder-open'}`"></use>
      </svg>
      <input
        type="text"
        @click.stop="noop"
        class="rename"
        v-if="renameCache === folder.pathname"
        v-model="newName"
        ref="renameInput"
        @keydown.enter="rename"
      >
      <span v-else class="text-overflow">{{folder.name}}</span>
    </div>
    <div
      class="folder-contents"
      v-if="!folder.isCollapsed"
    >
      <folder
        v-for="(childFolder, index) of folder.folders" :key="index + 'folder'"
        :folder="childFolder"
        :depth="depth + 1"
      ></folder>
      <input
        type="text" v-if="createCache.dirname === folder.pathname"
        class="new-input"
        :style="{'margin-left': `${depth * 5 + 15}px` }"
        ref="input"
        @keydown.enter="handleInputEnter"
        v-model="createName"
      >
      <file
        v-for="(file, index) of folder.files" :key="index + 'file'"
        :file="file"
        :depth="depth + 1"
      ></file>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { showContextMenu } from '../../contextMenu/sideBar'
import bus from '../../bus'
import { createFileOrDirectoryMixins } from '../../mixins'

export default {
  mixins: [createFileOrDirectoryMixins],
  name: 'folder',
  data () {
    return {
      createName: '',
      newName: ''
    }
  },
  props: {
    folder: {
      type: Object,
      required: true
    },
    depth: {
      type: Number,
      required: true
    }
  },
  components: {
    File: () => import('./treeFile.vue')
  },
  computed: {
    ...mapState({
      renameCache: state => state.project.renameCache,
      createCache: state => state.project.createCache,
      activeItem: state => state.project.activeItem,
      clipboard: state => state.project.clipboard
    })
  },
  created () {
    this.$nextTick(() => {
      this.$refs.folder.addEventListener('contextmenu', event => {
        event.preventDefault()
        this.$store.dispatch('CHANGE_ACTIVE_ITEM', this.folder)
        showContextMenu(event, !!this.clipboard)
      })
      bus.$on('SIDEBAR::show-new-input', this.handleInputFocus)
      bus.$on('SIDEBAR::show-rename-input', this.focusRenameInput)
    })
  },
  methods: {
    folderNameClick () {
      this.folder.isCollapsed = !this.folder.isCollapsed
    },
    noop () {},
    focusRenameInput () {
      this.$nextTick(() => {
        if (this.$refs.renameInput) {
          this.$refs.renameInput.focus()
          this.newName = this.folder.name
        }
      })
    },
    rename () {
      const { newName } = this
      if (newName) {
        this.$store.dispatch('RENAME_IN_SIDEBAR', newName)
      }
    }
  }
}
</script>

<style scoped>
  .side-bar-folder {
    & > .folder-name {
      cursor: default;
      user-select: none;
      display: flex;
      align-items: center;
      height: 30px;
      padding-right: 15px;
      & > svg {
        flex-shrink: 0;
        color: var(--sideBarIconColor);
        margin-right: 5px;
      }
      &:hover {
        background: var(--sideBarItemHoverBgColor);
      }
    }
  }
  .new-input, input.rename {
    outline: none;
    height: 22px;
    margin: 5px 0;
    padding: 0 6px;
    color: var(--sideBarColor);
    border: 1px solid var(--floatBorderColor);
    background: var(--floatBorderColor);
    width: 70%;
    border-radius: 3px;
  }
</style>
