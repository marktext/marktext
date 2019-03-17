<template>
    <div
      class="side-bar-list-file"
      @click="handleFileClick"
      :class="[{ 'active': file.pathname === currentFile.pathname }, theme]"
    >
      <div class="title">
        <span class="filename">{{ filename }}</span>
        <span>{{ extension }}</span>
      </div>
      <div class="folder-date">
        <span class="folder">{{parent}}</span>
        <span class="birth-time">{{ new Date(file.birthTime).toLocaleString().split(/\s/)[0] }}</span>
      </div>
      <div class="content">
        {{ file.data.markdown.substring(0, 50) }}
      </div>
    </div>
</template>

<script>
  import path from 'path'
  import { mapState } from 'vuex'
  import { fileMixins } from '../../mixins'
  import { PATH_SEPARATOR } from '../../config'

  export default {
    mixins: [fileMixins],
    props: {
      file: {
        type: Object,
        required: true
      }
    },
    computed: {
      ...mapState({
        theme: state => state.preferences.theme,
        tabs: state => state.editor.tabs,
        currentFile: state => state.editor.currentFile
      }),

      // Return filename without extension.
      filename () {
        return path.basename(this.file.name, path.extname(this.file.name))
      },

      // Return the filename extension or null.
      extension () {
        return path.extname(this.file.name)
      },

      // Return the parent directory with trailing path separator.
      //   NOTE: Parent from "Z:\" is "Z:\" on Windows!
      parent () {
        return path.join(path.dirname(this.file.pathname), PATH_SEPARATOR)
      }
    }
  }
</script>

<style scoped>
  .side-bar-list-file {
    position: relative;
    user-select: none;
    padding: 10px 20px;
    color: var(--secondaryColor);
    font-size: 14px;
    & .title .filename {
      font-size: 15px;
    }
    &:hover {
      background: var(--extraLightBorder);
    }
    &::before {
      content: '';
      position: absolute;
      display: block;
      left: 0;
      background: var(--activeColor);
      width: 2px;
      height: 0;
      top: 50%;
      transform: translateY(-50%);
      transition: all .2s ease;
    }
  }
  .side-bar-list-file.active {
    font-weight: 600;
    color: var(--regularColor);
  }
  .side-bar-list-file.active::before {
    height: 100%;
  }
  .folder-date {
    margin-top: 5px;
    display: flex;
    justify-content: space-between;
  }
  .content {
    width: 100%;
    margin-top: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dark.side-bar-list-file.active {
    color: var(--lightTabColor);
  }
  .dark.side-bar-list-file:hover {
    background: var(--darkHoverColor);
    color: var(--lightTabColor);
  }
</style>
