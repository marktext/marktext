import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// The notification service renders a DOM toast from a raw HTML template; stub
// it so we can observe `notify` without touching the DOM.
vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import SpellcheckerLanguageCommand from '@/commands/spellcheckerLanguage'
import { SpellChecker } from '@/spellchecker'
import bus from '@/bus'
import notice from '@/services/notification'

// Minimal stand-in for the renderer SpellChecker instance the command reads
// (`lang` and `isEnabled` only).
const makeChecker = (lang: string, isEnabled: boolean): SpellChecker =>
  ({ lang, isEnabled }) as unknown as SpellChecker

describe('SpellcheckerLanguageCommand', () => {
  let emitSpy: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    emitSpy = vi.spyOn(bus, 'emit') as unknown as Mock
  })

  describe('run() — building subcommands from available dictionaries', () => {
    it('builds one subcommand per available dictionary and selects the current lang', async() => {
      vi.spyOn(SpellChecker, 'getAvailableDictionaries').mockResolvedValue([
        'en-US',
        'de-DE',
        'fr-FR'
      ])
      const command = new SpellcheckerLanguageCommand(makeChecker('de-DE', true))

      await command.run()

      expect(command.subcommands).toHaveLength(3)
      expect(command.subcommands.map((c) => c.value)).toEqual(['en-US', 'de-DE', 'fr-FR'])
      expect(command.subcommands[1].id).toBe('spellchecker.switch-language-id-de-DE')
      // de-DE is index 1 in the dictionary list.
      expect(command.subcommandSelectedIndex).toBe(1)
    })

    it('falls back to ["en-US"] when the dictionary list is empty', async() => {
      vi.spyOn(SpellChecker, 'getAvailableDictionaries').mockResolvedValue([])
      const command = new SpellcheckerLanguageCommand(makeChecker('en-US', true))

      await command.run()

      expect(command.subcommands).toHaveLength(1)
      expect(command.subcommands[0].value).toBe('en-US')
      expect(command.subcommandSelectedIndex).toBe(0)
    })

    it('sets subcommandSelectedIndex to -1 when the current lang is not offered', async() => {
      vi.spyOn(SpellChecker, 'getAvailableDictionaries').mockResolvedValue(['en-US', 'fr-FR'])
      const command = new SpellcheckerLanguageCommand(makeChecker('de-DE', true))

      await command.run()

      expect(command.subcommandSelectedIndex).toBe(-1)
    })
  })

  describe('executeSubcommand() — enabled vs disabled', () => {
    it('emits switch-spellchecker-language with the picked value when enabled', async() => {
      vi.spyOn(SpellChecker, 'getAvailableDictionaries').mockResolvedValue(['en-US', 'de-DE'])
      const command = new SpellcheckerLanguageCommand(makeChecker('en-US', true))
      await command.run()

      await command.executeSubcommand('spellchecker.switch-language-id-de-DE')

      expect(emitSpy).toHaveBeenCalledWith('switch-spellchecker-language', 'de-DE')
      expect(notice.notify).not.toHaveBeenCalled()
    })

    it('does NOT emit and notifies a warning when the spellchecker is disabled', async() => {
      vi.spyOn(SpellChecker, 'getAvailableDictionaries').mockResolvedValue(['en-US', 'de-DE'])
      const command = new SpellcheckerLanguageCommand(makeChecker('en-US', false))
      await command.run()

      await command.executeSubcommand('spellchecker.switch-language-id-de-DE')

      expect(emitSpy).not.toHaveBeenCalledWith(
        'switch-spellchecker-language',
        expect.anything()
      )
      expect(notice.notify).toHaveBeenCalledTimes(1)
      expect(notice.notify).toHaveBeenCalledWith({
        title: 'Spelling',
        type: 'warning',
        message: 'Cannot change language because spellchecker is disabled.'
      })
    })
  })
})
