import { delay } from '@/util'
import bus from '../bus'
import getCommandDescriptionById from './descriptions'
import { t } from '../i18n'

const descriptions = ['Trim all trailing newlines', 'Ensure single newline', 'Disabled']

interface TrailingNewlineSubcommand {
  id: string
  description: string
  value: number
}

// Loose editor-state shape; the actual store is still JS and migrates later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorState = any

class TrailingNewlineCommand {
  id: string
  description: string
  placeholder: string
  subcommands: TrailingNewlineSubcommand[]
  subcommandSelectedIndex: number
  private _editorState: EditorState

  constructor(editorState: EditorState) {
    this.id = 'file.trailing-newline'
    this.description = getCommandDescriptionById('file.trailing-newline')
    this.placeholder = t('commandPalette.placeholders.selectOption')
    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async(): Promise<void> => {
    const { trimTrailingNewline } = this._editorState.currentFile
    let index: number = trimTrailingNewline
    if (index !== 0 && index !== 1) {
      index = 2
    }

    this.subcommands = [
      {
        id: 'file.trailing-newline-trim',
        description: descriptions[0],
        value: 0
      },
      {
        id: 'file.trailing-newline-single',
        description: descriptions[1],
        value: 1
      },
      {
        id: 'file.trailing-newline-disabled',
        description: descriptions[2],
        value: 3
      }
    ]
    this.subcommands[index].description = `${descriptions[index]} - current`
    this.subcommandSelectedIndex = index
  }

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(_: string, value: number): Promise<void> => {
    bus.emit('mt::set-final-newline', value)
  }

  unload = (): void => {}
}

export default TrailingNewlineCommand
