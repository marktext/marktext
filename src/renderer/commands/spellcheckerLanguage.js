import bus from '../bus'
import notice from '@/services/notification'
import { delay } from '@/util'
import { SpellChecker } from '@/spellchecker'
import { getLanguageName } from '@/spellchecker/languageMap'

// Command to switch the spellchecker language
class SpellcheckerLanguageCommand {
  constructor (spellchecker) {
    this.id = 'spellchecker.switch-language'
    this.description = 'Spelling: Switch language'
    this.placeholder = 'Select a language to switch to'
    this.shortcut = null

    this.spellchecker = spellchecker

    this.subcommands = []
    this.subcommandSelectedIndex = -1
  }

  run = async () => {
    const langs = await SpellChecker.getAvailableDictionaries()
    this.subcommands = langs.map(lang => {
      return {
        id: `spellchecker.switch-language-id-${lang}`,
        description: getLanguageName(lang),
        value: lang
      }
    })
    const currentLanguage = this.spellchecker.lang
    this.subcommandSelectedIndex = this.subcommands.findIndex(cmd => cmd.value === currentLanguage)
  }

  execute = async () => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.$emit('show-command-palette', this)
  }

  executeSubcommand = async id => {
    const command = this.subcommands.find(cmd => cmd.id === id)
    if (this.spellchecker.isEnabled) {
      bus.$emit('switch-spellchecker-language', command.value)
    } else {
      notice.notify({
        title: 'Spelling',
        type: 'warning',
        message: 'Cannot change language because spellchecker is disabled.'
      })
    }
  }

  unload = () => {
    this.subcommands = []
  }
}

export default SpellcheckerLanguageCommand
