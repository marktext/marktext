import { getFileStateFromData } from '../store/help.js'
import { message } from '../notice'

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
        this.$store.dispatch('REMOVE_FILE_IN_TABS', file)
      } else {
        this.$store.dispatch('CLOSE_SINGLE_FILE', file)
      }
    }
  }
}

export const fileMixins = {
  methods: {
    handleFileClick () {
      const { data, isMarkdown, pathname } = this.file
      if (!isMarkdown || this.currentFile.pathname === pathname) return
      const { isMixed, filename, lineEnding } = data
      const isOpened = this.tabs.filter(file => file.pathname === pathname)[0]

      const fileState = isOpened || getFileStateFromData(data)
      this.$store.dispatch('UPDATE_CURRENT_FILE', fileState)

      if (isMixed && !isOpened) {
        message(`${filename} has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`, 20000)
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
