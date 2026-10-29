export const commandGroups = ['file', 'edit', 'format', 'paragraph', 'view', 'window'] as const
export type CommandGroup = (typeof commandGroups)[number]

export const commandGroupLabels: Record<CommandGroup, string> = {
  file: 'menu.file.file',
  edit: 'menu.edit.edit',
  format: 'menu.format.format',
  paragraph: 'menu.paragraph.title',
  view: 'menu.view.view',
  window: 'preferences.keybindings.windowAndNavigation'
}

export const getCommandGroup = (id: string): CommandGroup => {
  if (['file.new-window', 'file.close-window', 'file.quit'].includes(id)) return 'window'
  if (id === 'edit.create-paragraph' || id === 'edit.delete-paragraph') return 'paragraph'
  const prefix = id.split('.')[0]
  if (prefix === 'spellchecker') return 'edit'
  return commandGroups.includes(prefix as CommandGroup) ? prefix as CommandGroup : 'window'
}
export const keybindingKey = (id: string): string => `keybinding-${id}`
