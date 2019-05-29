import { ipcRenderer } from 'electron'
import { getFileStateFromData } from '../store/help.js'

export const tabsMixins = {
  methods: {
    selectFile (file) {
      if (file.id !== this.currentFile.id) {
        this.$store.dispatch('UPDATE_CURRENT_FILE', file)
      }
    },
    removeFileInTab (file) {
      const { isSaved } = file
      if (isSaved) {
        this.$store.dispatch('FORCE_CLOSE_TAB', file)
      } else {
        this.$store.dispatch('CLOSE_UNSAVED_TAB', file)
      }
    }
  }
}

export const fileMixins = {
  methods: {
    handleFileClick () {
      // HACK: Please see #1034 and #1035
      const { data, isMarkdown, pathname } = this.file
      if (!isMarkdown || this.currentFile.pathname === pathname) return
      const { isMixedLineEndings, filename, lineEnding } = data
      const isOpened = this.tabs.find(file => file.pathname === pathname)

      const fileState = isOpened || getFileStateFromData(data)
      this.$store.dispatch('UPDATE_CURRENT_FILE', fileState)

      // HACK: notify main process. Main process should notify the browser window.
      ipcRenderer.send('AGANI::window-add-file-path', pathname)
      ipcRenderer.send('mt::add-recently-used-document', pathname)

      if (isMixedLineEndings && !isOpened) {
        this.$notify({
          title: 'Line Ending',
          message: `${filename} has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`,
          type: 'primary',
          time: 20000,
          showConfirm: false
        })
      }
    }
  }
}

export const createFileOrDirectoryMixins = {
  methods: {
    handleInputFocus () {
      this.$nextTick(() => {
        if (this.$refs.input) {
          this.$refs.input.focus()
          this.createName = ''
          if (this.folder) {
            this.folder.isCollapsed = false
          }
        }
      })
    },
    handleInputEnter () {
      const { createName } = this
      this.$store.dispatch('CREATE_FILE_DIRECTORY', createName)
    }
  }
}
