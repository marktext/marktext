import { ipcRenderer } from 'electron'
import { isSamePathSync } from '../util/fileSystem'

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
    handleSearchResultClick (searchMatch) {
      const { range } = searchMatch
      const { filePath } = this.searchResult

      const openedTab = this.tabs.find(file => isSamePathSync(file.pathname, filePath))
      if (openedTab) {
        // TODO(search): Set cursor range. Currently muya has no support for doing so.

        if (this.currentFile !== openedTab) {
          this.$store.dispatch('UPDATE_CURRENT_FILE', openedTab)
        }
      } else {
        ipcRenderer.send('mt::open-file', filePath, {
          range: {
            isMultiline: range[0][0] !== range[1][0],
            start: {
              line: range[0][0],
              offset: range[0][1]
            },
            end: {
              line: range[1][0],
              offset: range[1][1]
            }
          }
        })
      }
    },
    handleFileClick () {
      const { isMarkdown, pathname } = this.file
      if (!isMarkdown) return
      const openedTab = this.tabs.find(file => isSamePathSync(file.pathname, pathname))
      if (openedTab) {
        if (this.currentFile === openedTab) {
          return
        }
        this.$store.dispatch('UPDATE_CURRENT_FILE', openedTab)
      } else {
        ipcRenderer.send('mt::open-file', pathname, {})
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
