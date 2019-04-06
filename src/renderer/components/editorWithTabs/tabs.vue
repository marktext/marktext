<template>
    <div
      class="editor-tabs"
    >
      <ul class="tabs-container">
        <li
          :title="file.pathname"
          :class="{'active': currentFile.id === file.id, 'unsaved': !file.isSaved }"
          v-for="(file, index) of tabs"
          :key="index"
          @click.stop="selectFile(file)"
        >
          <span>{{ file.filename }}</span>
          <svg class="close-icon icon" aria-hidden="true"
            @click.stop="removeFileInTab(file)"
          >
            <circle id="unsaved-circle-icon" cx="6" cy="6" r="3"></circle>
            <use id="default-close-icon" xlink:href="#icon-close-small"></use>
          </svg>
        </li>
        <li class="new-file">
          <svg class="icon" aria-hidden="true"
            @click.stop="newFile()"
          >
            <use xlink:href="#icon-plus"></use>
          </svg>
        </li>
      </ul>
    </div>
</template>

<script>
  import { mapState } from 'vuex'
  import { tabsMixins } from '../../mixins'

  export default {
    mixins: [tabsMixins],
    computed: {
      ...mapState({
        currentFile: state => state.editor.currentFile,
        tabs: state => state.editor.tabs
      })
    },
    methods: {
      newFile () {
        this.$store.dispatch('NEW_BLANK_FILE')
      }
    }
  }
</script>

<style scoped>
  svg.close-icon #unsaved-circle-icon {
    fill: var(--themeColor);
  }
  .editor-tabs {
    width: 100%;
    height: 35px;
    user-select: none;
    box-shadow: 0px 0px 9px 2px rgba(0, 0, 0, .1);
  }
  .tabs-container {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: row;
    overflow: auto;
    &::-webkit-scrollbar:horizontal {
      display: none;
    }
    & > li {
      position: relative;
      padding: 0 8px;
      color: var(--editorColor50);
      font-size: 12px;
      line-height: 35px;
      height: 35px;
      max-width: 280px;
      background: var(--floatBgColor);
      display: flex;
      align-items: center;
      & > svg {
        opacity: 0;
      }
      &:hover > svg {
        opacity: 1;
      }
      &:hover > svg.close-icon #default-close-icon {
        display: block !important;
      }
      &:hover > svg.close-icon #unsaved-circle-icon {
        display: none !important;
      }
      & > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 3px;
      }
    }
    & > li.unsaved:not(.active) {
      & > svg.close-icon {
        opacity: 1;
      }
      & > svg.close-icon #unsaved-circle-icon {
        display: block;
      }
      & > svg.close-icon #default-close-icon {
        display: none;
      }
    }
    & > li.active {
      background: var(--itemBgColor);
      &:not(:last-child):after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        right: 0;
        height: 2px;
        background: var(--themeColor);
      }
      & > svg {
        opacity: 1;
      }
      & > svg.close-icon #unsaved-circle-icon {
        display: none;
      }
    }

    & > li.new-file {
      width: 35px;
      height: 35px;
      border-right: none;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: space-around;
      cursor: pointer;
    }
  }
</style>
