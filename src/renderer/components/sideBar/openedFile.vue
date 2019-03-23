<template>
    <div
      class="opened-file"
      :title="file.pathname"
      @click="selectFile(file)"
      :class="[{'active': currentFile.id === file.id, 'unsaved': !file.isSaved }]"
    >
      <svg class="icon" aria-hidden="true"
        @click.stop="removeFileInTab(file)"
      >
        <use xlink:href="#icon-close-small"></use>
      </svg>
      <span class="name">{{ file.filename }}</span>
    </div>
</template>

<script>
  import { mapState } from 'vuex'
  import { tabsMixins } from '../../mixins'

  export default {
    mixins: [tabsMixins],
    props: {
      file: {
        type: Object,
        required: true
      }
    },
    computed: {
      ...mapState({
        'currentFile': state => state.editor.currentFile
      })
    }
  }
</script>

<style scoped>
  .opened-file {
    display: flex;
    user-select: none;
    height: 28px;
    line-height: 28px;
    padding-left: 30px;
    position: relative;
    color: var(--sideBarColor);
    & > svg {
      display: none;
      width: 10px;
      height: 10px;
      position: absolute;
      top: 9px;
      left: 10px;
    }
    &:hover > svg {
      display: inline-block;
    }
    &:hover {
      background: var(--sideBarItemHoverBgColor);
    }
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .opened-file.active {
    color: var(--themeColor);
  }
  .unsaved.opened-file::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--themeColor);
    position: absolute;
    top: 11px;
    left: 12px;
  }
  .unsaved.opened-file:hover::before {
    content: none;
  }
</style>
