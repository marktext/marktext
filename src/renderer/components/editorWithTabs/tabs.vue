<template>
    <div class="editor-tabs">
      <ul class="tabs-container">
        <li
          :title="file.pathname"
          :class="{'active': currentFile.pathname === file.pathname, 'unsaved': !file.isSaved }"
          v-for="(file, index) of tabs"
          :key="index"
          @click.stop="selectFile(file)"
        >
          <span>{{ file.filename }}</span>
          <svg class="icon" aria-hidden="true"
            @click.stop="removeFileInTab(file)"
          >
            <use xlink:href="#icon-close-small"></use>
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
    }
  }
</script>

<style scoped>
  .editor-tabs {
    width: 100%;
    height: 35px;
    background: var(--lightBarColor);
    user-select: none;
  }
  .tabs-container {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: row;
    & > li {
      padding: 0 8px;
      color: var(--secondaryColor);
      font-size: 12px;
      line-height: 35px;
      border-right: 1px solid #fff;
      background: var(--lightTabColor);
    }
    & > li.active {
      background: #fff;
    }
  }
</style>
