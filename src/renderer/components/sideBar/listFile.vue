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
  import { mapState } from 'vuex'
  import { fileMixins } from '../../mixins'

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
      filename () {
        return this.file.name.split('.')[0]
      },
      extension () {
        return `.${this.file.name.split('.')[1]}`
      },
      parent () {
        return this.file.pathname.match(/(?:^|\/)([^/]+)\/[^/]+\.[^/]+$/)[1] + '/'
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
    font-size: 13px;
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
