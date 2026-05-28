import { delay } from '@/util'
import bus from '../bus'
import getCommandDescriptionById from './descriptions'
import { t } from '../i18n'

const crlfDescription = 'Carriage return and line feed (CRLF)'
const lfDescription = 'Line feed (LF)'

interface LineEndingSubcommand {
  id: string
  description: string
  value: 'crlf' | 'lf'
}

// Loose editor-state shape; the actual store is still JS and migrates later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorState = any

class LineEndingCommand {
  id: string
  description: string
  placeholder: string
  subcommands: LineEndingSubcommand[]
  subcommandSelectedIndex: number
  private _editorState: EditorState

  constructor(editorState: EditorState) {
    this.id = 'file.line-ending'
    this.description = getCommandDescriptionById('file.line-ending')
    this.placeholder = t('commandPalette.placeholders.selectOption')

    this.subcommands = [
      {
        id: 'file.line-ending-crlf',
        description: crlfDescription,
        value: 'crlf'
      },
      {
        id: 'file.line-ending-lf',
        description: lfDescription,
        value: 'lf'
      }
    ]
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async(): Promise<void> => {
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

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(_: string, value: 'crlf' | 'lf'): Promise<void> => {
    bus.emit('mt::set-line-ending', value)
  }

  unload = (): void => {}
}

export default LineEndingCommand
