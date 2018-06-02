<template>
  <div
    :title="file.pathname"
    class="side-bar-file"
    :style="{'padding-left': `${depth * 5 + 15}px`, 'opacity': file.isMarkdown ? 1 : 0.75 }"
    @click="handleFileClick()"
    :class="{'current': currentFile.pathname === file.pathname}"
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
  import { getFileStateFromData } from '../../store/help.js'
  import { message } from '../../notice'

  export default {
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
        'currentFile': state => state.editor.currentFile
      })
    },
    methods: {
      handleFileClick () {
        const { data, isMarkdown } = this.file
        if (!isMarkdown) return
        const { isMixed, filename, lineEnding } = data
        const fileState = getFileStateFromData(data)

        this.$store.dispatch('UPDATE_CURRENT_FILE', fileState)

        if (isMixed) {
          message(`${filename} has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`, 20000)
        }
      }
    }
  }
</script>

<style scoped>
  .side-bar-file {
    cursor: default;
    user-select: none;
    height: 25px;
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
</style>
