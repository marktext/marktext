import { ipcRenderer } from 'electron'
import { delay } from '@/util'
import bus from '../bus'

class LineEndingCommand {
  constructor (editorState) {
    this.id = 'file.line-ending'
    this.description = 'File: Change Line Ending'

    this.subcommands = [{
      id: 'file.line-ending-crlf',
      description: 'Carriage return and line feed (CRLF)',
      value: 'crlf'
    },
    {
      id: 'file.line-ending-lf',
      description: 'Line feed (LF)',
      value: 'lf'
    }]
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async () => {
    const { lineEnding } = this._editorState.currentFile
    this.subcommandSelectedIndex = lineEnding === 'crlf' ? 0 : 1
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
