<template>
  <div
    :title="file.pathname"
    class="side-bar-file"
    :style="{'padding-left': `${depth * 5 + 15}px`, 'opacity': file.isMarkdown ? 1 : 0.75 }"
    @click="handleFileClick()"
    :class="{'current': currentFile.pathname === file.pathname, 'active': file.id === activeItem.id }"
    ref="file"
  >
    <file-icon
      :name="file.name"
    ></file-icon>
    <input
      type="text"
      @click.stop="noop"
      class="rename"
      v-if="renameCache === file.pathname"
      v-model="newName"
      ref="renameInput"
      @keydown.enter="rename"
    >
    <span v-else>{{ file.name }}</span>
  </div>
</template>

<script>
  import FileIcon from './icon.vue'
  import { mapState } from 'vuex'
  import { fileMixins } from '../../mixins'
  import { showContextMenu } from '../../contextMenu/sideBar'
  import bus from '../../bus'

  export default {
    mixins: [fileMixins],
    name: 'file',
    data () {
      return {
        newName: ''
      }
    },
    props: {
      file: {
        type: Object,
        required: true
      },
      depth: {
        type: Number,
        required: true
      }
    },
    components: {
      FileIcon
    },
    computed: {
      ...mapState({
        'renameCache': state => state.project.renameCache,
        'activeItem': state => state.project.activeItem,
        'clipboard': state => state.project.clipboard,
        'currentFile': state => state.editor.currentFile,
        'tabs': state => state.editor.tabs
      })
    },
    created () {
      this.$nextTick(() => {
        this.$refs.file.addEventListener('contextmenu', event => {
          event.preventDefault()
          this.$store.dispatch('CHANGE_ACTIVE_ITEM', this.file)
          showContextMenu(event, !!this.clipboard)
        })

        bus.$on('SIDEBAR::show-rename-input', this.focusRenameInput)
      })
    },
    methods: {
      noop () {},
      focusRenameInput () {
        this.$nextTick(() => {
          if (this.$refs.renameInput) {
            this.$refs.renameInput.focus()
            this.newName = this.file.name
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
  .side-bar-file {
    display: flex;
    align-items: center;
    cursor: default;
    user-select: none;
    height: 30px;
    border-left: 3px solid transparent;
    box-sizing: border-box;
    padding-right: 15px;
    &:hover {
      background: var(--extraLightBorder);
    }
  }
  .side-bar-file.current {
    color: var(--activeColor);
    border-left-color: var(--activeColor);
  }
  .side-bar-file.active {
    background: var(--lightBorder);
  }
  input.rename {
    height: 18px;
    outline: none;
    margin: 5px 0;
  }
</style>
