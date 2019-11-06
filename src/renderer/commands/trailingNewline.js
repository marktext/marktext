import { ipcRenderer } from 'electron'
import { delay } from '@/util'
import bus from '../bus'

const descriptions = [
  'Trim all trailing newlines',
  'Ensure single newline',
  'Disabled'
]

class TrailingNewlineCommand {
  constructor (editorState) {
    this.id = 'file.trailing-newline'
    this.description = 'File: Trailing Newline'
    this.placeholder = 'Select an option'

    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async () => {
    const { trimTrailingNewline } = this._editorState.currentFile
    let index = trimTrailingNewline
    if (index !== 0 && index !== 1) {
      index = 2
    }

    this.subcommands = [{
      id: 'file.trailing-newline-trim',
      description: descriptions[0],
      value: 0
    }, {
      id: 'file.trailing-newline-single',
      description: descriptions[1],
      value: 1
    }, {
      id: 'file.trailing-newline-disabled',
      description: descriptions[2],
      value: 3
    }]
    this.subcommands[index].description = `${descriptions[index]} - current`
    this.subcommandSelectedIndex = index
  }

  execute = async () => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async (_, value) => {
    ipcRenderer.emit('mt::set-final-newline', null, value)
  }

  unload = () => {}
}

export default TrailingNewlineCommand
