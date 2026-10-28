import { t } from '@/i18n'
import { commandLabelKey } from '@/commands/descriptions'
import { englishText } from '../registry'
import { commandGroupLabels, getCommandGroup, keybindingKey } from '../keybindings/groups'
import type { UiKeybinding } from '../keybindings/KeybindingConfigurator'
import type { SearchEntry } from './config'

export const getKeybindingSearchContent = (commands: UiKeybinding[]): SearchEntry[] =>
  commands.map(command => {
    const group = getCommandGroup(command.id)
    return {
      key: keybindingKey(command.id),
      category: `${t('preferences.categories.keybindings')} › ${t(commandGroupLabels[group])}`,
      categoryEn: `Keybindings ${group}`,
      preference: command.description,
      preferenceEn: englishText(commandLabelKey(command.id)),
      routeCategory: 'keybindings',
      description: command.description,
      enum: undefined,
      keywords: [command.id, command.accelerator],
      accelerator: command.accelerator,
      kind: 'keybinding' as const
    }
  })
