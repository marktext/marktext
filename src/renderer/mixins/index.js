import { ipcRenderer } from 'electron'
import { isSamePathSync } from 'common/filesystem/paths'
import bus from '../bus'

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

export const loadingPageMixins = {
  methods: {
    hideLoadingPage () {
      const loadingPage = document.querySelector('#loading-page')
      if (loadingPage) {
        loadingPage.remove()
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
      const cursor = {
        isCollapsed: range[0][0] !== range[1][0],
        anchor: {
          line: range[0][0],
          ch: range[0][1]
        },
        focus: {
          line: range[1][0],
          ch: range[1][1]
        }
      }

      if (openedTab) {
        openedTab.cursor = cursor
        if (this.currentFile !== openedTab) {
          this.$store.dispatch('UPDATE_CURRENT_FILE', openedTab)
        } else {
          const { id, markdown, cursor, history } = this.currentFile
          bus.$emit('file-changed', { id, markdown, cursor, renderCursor: true, history })
        }
      } else {
        ipcRenderer.send('mt::open-file', filePath, {
          cursor
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
