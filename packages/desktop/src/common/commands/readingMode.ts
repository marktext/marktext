const editingCommands = new Set([
  'file.save',
  'file.save-as',
  'file.change-encoding',
  'file.line-ending',
  'file.trailing-newline',
  'edit.undo',
  'edit.redo',
  'edit.cut',
  'edit.paste',
  'edit.paste-as-plaintext',
  'edit.duplicate',
  'edit.create-paragraph',
  'edit.delete-paragraph',
  'edit.find',
  'edit.find-next',
  'edit.find-previous',
  'edit.replace',
  'edit.screenshot',
  'view.source-code-mode',
  'view.focus-mode',
  'view.typewriter-mode'
])

export const isReadingCommandAllowed = (id: string): boolean =>
  !editingCommands.has(id) &&
  !id.startsWith('format.') &&
  !id.startsWith('paragraph.') &&
  !id.startsWith('file.line-ending-') &&
  !id.startsWith('file.trailing-newline-')
