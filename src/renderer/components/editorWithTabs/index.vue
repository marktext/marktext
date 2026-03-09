<template>
    <div
      class="editor-with-tabs"
      :style="{'max-width': showSideBar ? `calc(100vw - ${sideBarWidth}px` : '100vw' }"
    >
      <tabs v-show="showTabBar"></tabs>
      <markdown-toolbar
        v-show="!sourceCode"
        @format="handleInlineFormat"
        @paragraph="handleParagraph"
        @toggle-icon-drawer="toggleIconDrawer"
      ></markdown-toolbar>
      <div class="container">
        <editor
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
          :platform="platform"
        ></editor>
        <source-code
          v-if="sourceCode"
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
        ></source-code>
        <icon-drawer
          v-if="iconDrawerEnabled && !sourceCode"
          :visible="iconDrawerVisible"
          :loading="iconDrawerLoading"
          :icons="iconItems"
          @close="closeIconDrawer"
          @refresh="refreshIconDrawer"
          @insert="insertIcon"
          @add-custom="addCustomIcon"
          @import-local="importLocalIcons"
          @remove="removeIcon"
        ></icon-drawer>
      </div>
      <tab-notifications></tab-notifications>
    </div>
</template>

<script>
import { mapState } from 'vuex'
import bus from '@/bus'
import notice from '@/services/notification'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import MarkdownToolbar from './markdownToolbar.vue'
import IconDrawer from './iconDrawer.vue'

export default {
  props: {
    markdown: {
      type: String,
      required: true
    },
    cursor: {
      validator (value) {
        return typeof value === 'object'
      },
      required: true
    },
    sourceCode: {
      type: Boolean,
      required: true
    },
    showTabBar: {
      type: Boolean,
      required: true
    },
    textDirection: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      required: true
    }
  },
  components: {
    Tabs,
    MarkdownToolbar,
    IconDrawer,
    Editor,
    SourceCode,
    TabNotifications
  },
  computed: {
    ...mapState({
      showSideBar: state => state.layout.showSideBar,
      sideBarWidth: state => state.layout.sideBarWidth,
      iconDrawerVisible: state => state.iconLibrary.drawerVisible,
      iconDrawerLoading: state => state.iconLibrary.loading,
      iconDrawerEnabled: state => state.iconLibrary.drawerEnabled,
      iconItems: state => state.iconLibrary.icons
    })
  },
  methods: {
    executeEditorCommand (eventName, value) {
      setTimeout(() => bus.$emit('editor-focus'), 10)
      setTimeout(() => bus.$emit(eventName, value), 150)
    },
    handleInlineFormat (type) {
      this.executeEditorCommand('format', type)
    },
    handleParagraph (type) {
      this.executeEditorCommand('paragraph', type)
    },
    toggleIconDrawer () {
      this.$store.dispatch('TOGGLE_ICON_DRAWER')
    },
    closeIconDrawer () {
      this.$store.dispatch('CLOSE_ICON_DRAWER')
    },
    async refreshIconDrawer () {
      await this.$store.dispatch('LOAD_ICON_LIBRARY')
    },
    insertIcon (icon) {
      this.$store.dispatch('INSERT_ICON_IN_EDITOR', icon)
    },
    async addCustomIcon () {
      const value = window.prompt('Enter a local icon path, file URL or remote URL:')
      if (!value || !value.trim()) return

      const defaultName = value.split(/[\\/]/).pop() || 'Custom Icon'
      const name = window.prompt('Icon name (optional):', defaultName)
      await this.$store.dispatch('ADD_CUSTOM_ICON', { name, value })
      notice.notify({
        title: 'Icon Drawer',
        type: 'success',
        message: 'Custom icon added successfully.'
      })
      this.$store.dispatch('OPEN_ICON_DRAWER')
    },
    async importLocalIcons () {
      const result = await this.$store.dispatch('IMPORT_LOCAL_ICONS')
      if (!result || result.cancelled) return

      const { imported = 0, skipped = 0 } = result
      notice.notify({
        title: 'Icon Drawer',
        type: 'success',
        message: `Imported ${imported} icon(s). Skipped ${skipped}.`
      })
      this.$store.dispatch('OPEN_ICON_DRAWER')
    },
    async removeIcon (iconId) {
      await this.$store.dispatch('REMOVE_ICON', iconId)
    }
  }
}
</script>

<style scoped>
  .editor-with-tabs {
    position: relative;
    height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;

    overflow: hidden;
    background: var(--editorBgColor);
    & > .container {
      flex: 1;
      overflow: hidden;
      display: flex;
      min-height: 0;
    }
  }
</style>
