<template>
  <div
    class="editor-tabs"
    :style="{'max-width': showSideBar ? `calc(100vw - ${sideBarWidth}px` : '100vw' }"
  >
    <div
      class="scrollable-tabs"
      ref="tabContainer"
    >
      <ul
        class="tabs-container"
        v-drag-and-drop:options="tabDragOptions"
      >
        <li
          :title="file.pathname"
          :class="{'active': currentFile.id === file.id, 'unsaved': !file.isSaved }"
          v-for="file of tabs"
          :key="file.id"
          :data-id="file.id"
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
      </ul>
    </div>
    <div
      class="new-file"
    >
      <svg class="icon" aria-hidden="true"
        @click.stop="newFile()"
      >
        <use xlink:href="#icon-plus"></use>
      </svg>
    </div>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import { tabsMixins } from '../../mixins'

  export default {
    data () {
      return {
        tabDragOptions: {
          dropzoneSelector: 'ul.tabs-container',
          draggableSelector: 'li',
          handlerSelector: null,
          reactivityEnabled: false,
          multipleDropzonesItemsDraggingEnabled: false,
          showDropzoneAreas: true
        }
      }
    },
    mixins: [tabsMixins],
    computed: {
      ...mapState({
        'currentFile': state => state.editor.currentFile,
        'tabs': state => state.editor.tabs,
        'showSideBar': state => state.layout.showSideBar,
        'sideBarWidth': state => state.layout.sideBarWidth
      })
    },
    methods: {
      newFile () {
        this.$store.dispatch('NEW_BLANK_FILE')
      },
      handleTabScroll (event) {
        const tabs = this.$refs.tabContainer
        const newLeft = Math.max(0, Math.min(tabs.scrollLeft + event.deltaY, tabs.scrollWidth ))
        tabs.scrollLeft = newLeft
      }
    },
    mounted () {
      this.$nextTick(() => {
        const tabs = this.$refs.tabContainer
        tabs.addEventListener('wheel', this.handleTabScroll)
      })
    },
    beforeDestroy () {
      const tabs = this.$refs.tabContainer
      tabs.removeEventListener('wheel', this.handleTabScroll)
    }
  }
</script>

<style scoped>
  svg.close-icon #unsaved-circle-icon {
    fill: var(--themeColor);
  }
  .editor-tabs {
    position: relative;
    display: flex;
    flex-direction: row;
    height: 35px;
    user-select: none;
    box-shadow: 0px 0px 9px 2px rgba(0, 0, 0, .1);
    overflow: hidden;
    &:hover > .new-file {
      opacity: 1 !important;
    }
  }
  .scrollable-tabs {
    flex: 0 1 auto;
    height: 35px;
    overflow: hidden;
  }
  .tabs-container {
    min-width: min-content;
    list-style: none;
    margin: 0;
    padding: 0;
    height: 35px;
    position: relative;
    display: flex;
    flex-direction: row;
    z-index: 2;
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
      &[aria-grabbed="true"] {
        color: var(--editorColor30) !important;
      }
      & > svg {
        opacity: 0;
      }
      &:focus {
        outline: none;
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
      z-index: 3;
      &:after {
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
  }
  .editor-tabs > .new-file {
    flex: 0 0 35px;
    width: 35px;
    height: 35px;
    border-right: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-around;
    cursor: pointer;
    color: var(--editorColor50);
    opacity: 0;
    &.always-visible {
      opacity: 1;
    }
  }
</style>
<style>
  .item-dropzone-area {
    position: relative;
    color: var(--editorColor50);
    height: 35px;
    width: 2px;
    background: var(--themeColor);
  }
  .item-dropzone-area:after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%,-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: var(--themeColor);
    z-index: 99;
    animation-name: none;
  }
</style>
