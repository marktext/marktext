import { ipcRenderer } from 'electron'
import { delay } from '@/util'
import bus from '../bus'

const crlfDescription = 'Carriage return and line feed (CRLF)'
const lfDescription = 'Line feed (LF)'

class LineEndingCommand {
  constructor (editorState) {
    this.id = 'file.line-ending'
    this.description = 'File: Change Line Ending'
    this.placeholder = 'Select an option'

    this.subcommands = [{
      id: 'file.line-ending-crlf',
      description: crlfDescription,
      value: 'crlf'
    }, {
      id: 'file.line-ending-lf',
      description: lfDescription,
      value: 'lf'
    }]
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async () => {
    const { lineEnding } = this._editorState.currentFile
    if (lineEnding === 'crlf') {
      this.subcommandSelectedIndex = 0
      this.subcommands[0].description = `${crlfDescription} - current`
      this.subcommands[1].description = lfDescription
    } else {
      this.subcommandSelectedIndex = 1
      this.subcommands[0].description = crlfDescription
      this.subcommands[1].description = `${lfDescription} - current`
    }
  }

  execute = async () => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async (_, value) => {
    ipcRenderer.emit('mt::set-line-ending', null, value)
  }

  unload = () => {}
}

export default LineEndingCommand
