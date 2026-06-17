import bus from '../bus'
import notice from '@/services/notification'
import { delay } from '@/util'
import { SpellChecker } from '@/spellchecker'
import { getLanguageName } from '@/spellchecker/languageMap'
import getCommandDescriptionById from './descriptions'
import { t } from '../i18n'

interface SpellcheckerSubcommand {
  id: string
  // getLanguageName() can return null for unknown locales.
  description: string | null
  value: string
}

// Command to switch the spellchecker language
class SpellcheckerLanguageCommand {
  id: string
  description: string
  placeholder: string
  shortcut: string | null
  spellchecker: SpellChecker
  subcommands: SpellcheckerSubcommand[]
  subcommandSelectedIndex: number

  constructor(spellchecker: SpellChecker) {
    this.id = 'spellchecker.switch-language'
    this.description = getCommandDescriptionById('spellchecker.switch-language')
    this.placeholder = t('commandPalette.placeholders.selectLanguage')
    this.shortcut = null

    this.spellchecker = spellchecker

    this.subcommands = []
    this.subcommandSelectedIndex = -1
  }

  run = async(): Promise<void> => {
    const langs = await SpellChecker.getAvailableDictionaries()

    const finalLangs: string[] = langs.length > 0 ? langs : ['en-US']

    this.subcommands = finalLangs.map((lang) => {
      return {
        id: `spellchecker.switch-language-id-${lang}`,
        description: getLanguageName(lang),
        value: lang
      }
    })
    const currentLanguage = this.spellchecker.lang
    this.subcommandSelectedIndex = this.subcommands.findIndex(
      (cmd) => cmd.value === currentLanguage
    )
  }

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(id: string): Promise<void> => {
    const command = this.subcommands.find((cmd) => cmd.id === id)
    if (this.spellchecker.isEnabled) {
      bus.emit('switch-spellchecker-language', command?.value)
    } else {
      notice.notify({
        title: 'Spelling',
        type: 'warning',
        message: 'Cannot change language because spellchecker is disabled.'
      })
    }
  }

  unload = (): void => {
    this.subcommands = []
  }
}

export default SpellcheckerLanguageCommand
