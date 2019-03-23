<template>
    <div
      class="side-bar-list-file"
      @click="handleFileClick"
      :class="[{ 'active': file.pathname === currentFile.pathname }]"
    >
      <div class="title">
        <span class="filename">{{ filename + extension }}</span>
        <span class="birth-time">{{ relativeTime }}</span>
      </div>
      <div class="folder-date">
        <span class="folder">{{parent}}</span>
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
  import dayjs from '@/util/day'

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
        tabs: state => state.editor.tabs,
        currentFile: state => state.editor.currentFile
      }),

      // Return filename without extension.
      filename () {
        return path.basename(this.file.name, path.extname(this.file.name))
      },

      relativeTime () {
        return dayjs(+new Date(this.file.birthTime)).fromNow()
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
    color: var(--sideBarColor);
    font-size: 14px;
    & .title .filename {
      font-size: 15px;
    }
    &:hover {
      background: var(--sideBarItemHoverBgColor);
    }
    &::before {
      content: '';
      position: absolute;
      display: block;
      left: 0;
      background: var(--themeColor);
      width: 2px;
      height: 0;
      top: 50%;
      transform: translateY(-50%);
      transition: all .2s ease;
    }
  }
  .side-bar-list-file.active {
    font-weight: 600;
    .title {
      color: var(--themeColor);
    }
  }
  .side-bar-list-file.active::before {
    height: 100%;
  }
  .title {
    display: flex;
    color: var(--sideBarTitleColor);
    & .filename {
      flex: 1;
    }
    & .birth-time {
      color: var(--sideBarTextColor);
    }
  }
  .folder-date {
    margin-top: 5px;
  }
  .folder-date .folder,
  .content {
    width: 100%;
    margin-top: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--sideBarTextColor);
  }
</style>
