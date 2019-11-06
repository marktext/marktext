import { ipcRenderer } from 'electron'
import { ENCODING_NAME_MAP, getEncodingName } from 'common/encoding'
import { delay } from '@/util'
import bus from '../bus'

class FileEncodingCommand {
  constructor (editorState) {
    this.id = 'file.change-encoding'
    this.description = 'File: Change Encoding'
    this.placeholder = 'Select an option'

    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async () => {
    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Load encoding from current tab to highlight it.
    const encodingObj = this._getCurrentEncoding()
    const { encoding, isBom } = encodingObj

    // NOTE: We support UTF-BOM encodings but don't allow to set them.
    if (isBom) {
      this.subcommandSelectedIndex = 0
      this.subcommands.push({
        id: `${encoding}-bom`,
        description: `${getEncodingName(encodingObj)} - current`
      })
    }

    let i = 0
    for (const [key, value] of Object.entries(ENCODING_NAME_MAP)) {
      const isTabEncoding = !isBom && key === encoding
      const item = {
        id: key,
        description: isTabEncoding ? `${value} - current` : value
      }
      if (isTabEncoding) {
        // Highlight current encoding and set it as first entry.
        this.subcommandSelectedIndex = i
        this.subcommands.unshift(item)
      } else {
        this.subcommands.push(item)
      }
      ++i
    }
  }

  execute = async () => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async id => {
    // NOTE: We support UTF-BOM encodings but don't allow to set them.
    if (!id.endsWith('-bom')) {
      ipcRenderer.emit('mt::set-file-encoding', null, id)
    }
  }

  unload = () => {
    this.subcommands = []
  }

  _getCurrentEncoding = () => {
    const { _editorState } = this
    const { currentFile } = _editorState
    if (currentFile) {
      return currentFile.encoding
    }
    return {}
  }
}

export default FileEncodingCommand
