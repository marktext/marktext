<template>
  <div
    :title="file.pathname"
    class="side-bar-file"
    :style="{'padding-left': `${depth * 5 + 15}px`, 'opacity': file.isMarkdown ? 1 : 0.75 }"
    @click="handleFileClick()"
    :class="{'current': currentFile.pathname === file.pathname, 'active': file.id === activeId }"
    ref="file"
  >
    <file-icon
      :name="file.name"
    ></file-icon>
    <span>{{ file.name }}</span>
  </div>
</template>

<script>
  import FileIcon from './icon.vue'
  import { mapState } from 'vuex'
  import { fileMixins } from '../../mixins'
  import { showContextMenu } from '../../contextMenu/sideBar'

  export default {
    mixins: [fileMixins],
    name: 'file',
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
        'activeId': state => state.project.activeId,
        'clipboard': state => state.project.clipboard,
        'currentFile': state => state.editor.currentFile,
        'tabs': state => state.editor.tabs
      })
    },
    created () {
      this.$nextTick(() => {
        this.$refs.file.addEventListener('contextmenu', event => {
          event.preventDefault()
          this.$store.dispatch('CHANGE_ACTIVE_ID', this.file.id)
          showContextMenu(event, !!this.clipboard)
        })
      })
    }
  }
</script>

<style scoped>
  .side-bar-file {
    cursor: default;
    user-select: none;
    height: 28px;
    border-left: 3px solid transparent;
    box-sizing: border-box;
    padding-right: 15px;
    &:hover {
      background: var(--extraLightBorder);
    }
  }
  .side-bar-file.current {
    color: var(--brandColor);
    border-left-color: var(--brandColor);
  }
  .side-bar-file.active {
    background: var(--lightBorder);
  }
</style>
