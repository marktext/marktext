const enDefaults = {
  'menu.marktext': 'MarkText',
  'menu.marktext.about': 'About MarkText',
  'menu.marktext.checkUpdates': 'Check for updates...',
  'menu.marktext.preferences': 'Preferences',
  'menu.marktext.services': 'Services',
  'menu.marktext.hide': 'Hide MarkText',
  'menu.marktext.hideOthers': 'Hide Others',
  'menu.marktext.showAll': 'Show All',
  'menu.marktext.quit': 'Quit MarkText',

  'menu.file': '&File',
  'menu.file.newTab': 'New Tab',
  'menu.file.newWindow': 'New Window',
  'menu.file.openFile': 'Open File...',
  'menu.file.openFolder': 'Open Folder...',
  'menu.file.openRecent': 'Open Recent',
  'menu.file.clearRecentlyUsed': 'Clear Recently Used',
  'menu.file.save': 'Save',
  'menu.file.saveAs': 'Save As...',
  'menu.file.autoSave': 'Auto Save',
  'menu.file.moveTo': 'Move To...',
  'menu.file.rename': 'Rename...',
  'menu.file.import': 'Import...',
  'menu.file.export': 'Export',
  'menu.file.exportHTML': 'HTML',
  'menu.file.exportPDF': 'PDF',
  'menu.file.print': 'Print',
  'menu.file.preferences': 'Preferences...',
  'menu.file.closeTab': 'Close Tab',
  'menu.file.closeWindow': 'Close Window',
  'menu.file.quit': 'Quit',

  'menu.edit': '&Edit',
  'menu.edit.undo': 'Undo',
  'menu.edit.redo': 'Redo',
  'menu.edit.cut': 'Cut',
  'menu.edit.copy': 'Copy',
  'menu.edit.paste': 'Paste',
  'menu.edit.copyAsMarkdown': 'Copy as Markdown',
  'menu.edit.copyAsHTML': 'Copy as HTML',
  'menu.edit.pasteAsPlainText': 'Paste as Plain Text',
  'menu.edit.selectAll': 'Select All',
  'menu.edit.duplicate': 'Duplicate',
  'menu.edit.createParagraph': 'Create Paragraph',
  'menu.edit.deleteParagraph': 'Delete Paragraph',
  'menu.edit.find': 'Find',
  'menu.edit.findNext': 'Find Next',
  'menu.edit.findPrevious': 'Find Previous',
  'menu.edit.replace': 'Replace',
  'menu.edit.findInFolder': 'Find in Folder',
  'menu.edit.screenshot': 'Screenshot',
  'menu.edit.lineEnding': 'Line Ending',
  'menu.edit.crlf': 'Carriage return and line feed (CRLF)',
  'menu.edit.lf': 'Line feed (LF)',

  'menu.paragraph': '&Paragraph',
  'menu.paragraph.heading1': 'Heading 1',
  'menu.paragraph.heading2': 'Heading 2',
  'menu.paragraph.heading3': 'Heading 3',
  'menu.paragraph.heading4': 'Heading 4',
  'menu.paragraph.heading5': 'Heading 5',
  'menu.paragraph.heading6': 'Heading 6',
  'menu.paragraph.promoteHeading': 'Promote Heading',
  'menu.paragraph.demoteHeading': 'Demote Heading',
  'menu.paragraph.table': 'Table',
  'menu.paragraph.codeFences': 'Code Fences',
  'menu.paragraph.quoteBlock': 'Quote Block',
  'menu.paragraph.mathBlock': 'Math Block',
  'menu.paragraph.htmlBlock': 'Html Block',
  'menu.paragraph.orderedList': 'Ordered List',
  'menu.paragraph.bulletList': 'Bullet List',
  'menu.paragraph.taskList': 'Task List',
  'menu.paragraph.looseListItem': 'Loose List Item',
  'menu.paragraph.paragraph': 'Paragraph',
  'menu.paragraph.horizontalRule': 'Horizontal Rule',
  'menu.paragraph.frontMatter': 'Front Matter',

  'menu.format': 'F&ormat',
  'menu.format.bold': 'Bold',
  'menu.format.italic': 'Italic',
  'menu.format.underline': 'Underline',
  'menu.format.superscript': 'Superscript',
  'menu.format.subscript': 'Subscript',
  'menu.format.highlight': 'Highlight',
  'menu.format.inlineCode': 'Inline Code',
  'menu.format.inlineMath': 'Inline Math',
  'menu.format.strikethrough': 'Strikethrough',
  'menu.format.hyperlink': 'Hyperlink',
  'menu.format.image': 'Image',
  'menu.format.clearFormatting': 'Clear Formatting',

  'menu.view': '&View',
  'menu.view.commandPalette': 'Command Palette...',
  'menu.view.sourceCodeMode': 'Source Code Mode',
  'menu.view.typewriterMode': 'Typewriter Mode',
  'menu.view.focusMode': 'Focus Mode',
  'menu.view.showSidebar': 'Show Sidebar',
  'menu.view.showTabBar': 'Show Tab Bar',
  'menu.view.toggleTOC': 'Toggle Table of Contents',
  'menu.view.reloadImages': 'Reload Images',
  'menu.view.showDevTools': 'Show Developer Tools',
  'menu.view.reloadWindow': 'Reload window',

  'menu.window': '&Window',
  'menu.window.minimize': 'Minimize',
  'menu.window.alwaysOnTop': 'Always on Top',
  'menu.window.zoomIn': 'Zoom In',
  'menu.window.zoomOut': 'Zoom Out',
  'menu.window.fullScreen': 'Show in Full Screen',
  'menu.window.bringAllToFront': 'Bring All to Front',

  'menu.theme': '&Theme',
  'menu.theme.cadmiumLight': 'Cadmium Light',
  'menu.theme.dark': 'Dark',
  'menu.theme.graphiteLight': 'Graphite Light',
  'menu.theme.materialDark': 'Material Dark',
  'menu.theme.oneDark': 'One Dark',
  'menu.theme.ulyssesLight': 'Ulysses Light',

  'menu.help': '&Help',
  'menu.help.quickStart': 'Quick Start...',
  'menu.help.markdownReference': 'Markdown Reference...',
  'menu.help.changelog': 'Changelog...',
  'menu.help.donate': 'Donate via Open Collective...',
  'menu.help.feedbackTwitter': 'Feedback via Twitter...',
  'menu.help.reportIssue': 'Report Issue or Request Feature...',
  'menu.help.website': 'Website...',
  'menu.help.watchOnGitHub': 'Watch on GitHub...',
  'menu.help.followOnGitHub': 'Follow us on Github...',
  'menu.help.followOnTwitter': 'Follow us on Twitter...',
  'menu.help.license': 'License...',
  'menu.help.checkUpdates': 'Check for updates...',
  'menu.help.aboutMarkText': 'About MarkText...',

  'menu.dock.open': 'Open...',
  'menu.dock.clearRecent': 'Clear Recent',

  'contextMenu.editor.cut': 'Cut',
  'contextMenu.editor.copy': 'Copy',
  'contextMenu.editor.paste': 'Paste',
  'contextMenu.editor.copyAsMarkdown': 'Copy As Markdown',
  'contextMenu.editor.copyAsHtml': 'Copy As Html',
  'contextMenu.editor.pasteAsPlainText': 'Paste as Plain Text',
  'contextMenu.editor.insertParagraphBefore': 'Insert Paragraph Before',
  'contextMenu.editor.insertParagraphAfter': 'Insert Paragraph After',
  'contextMenu.editor.before': 'before',
  'contextMenu.editor.after': 'after',
  'contextMenu.editor.changeLanguage': 'Change Language...',
  'contextMenu.editor.addToDictionary': 'Add to Dictionary',
  'contextMenu.editor.errorAddToDict': 'Error while adding "{word}" to dictionary.',
  'contextMenu.editor.editDictionary': 'Edit Dictionary...',
  'contextMenu.editor.spelling': 'spelling',

  'editor.untitled': 'Untitled',
  'editor.quickInsertHint': 'Type @ to insert',

  'dialog.save': 'Save',
  'dialog.cancel': 'Cancel',
  'dialog.dontSave': "Don't save",
  'dialog.file': 'file',
  'dialog.files': 'files',
  'dialog.unsavedChanges': 'Do you want to save the changes you made to {count} {filesWord}?\n\n{fileList}',
  'dialog.unsavedChangesDetail': "Your changes will be lost if you don't save them.",

  'dialog.close': 'Close',
  'dialog.keepOpen': 'Keep It Open',
  'dialog.saveFailure': 'Failure while saving files',
  'dialog.replace': 'Replace',
  'dialog.fileExists': 'The file "{filename}" already exists. Do you want to replace it?'
}

let localeData = null

function t (key) {
  if (localeData && localeData[key]) {
    return localeData[key]
  }
  return enDefaults[key] || key
}

export function setLocale (data) {
  if (data) {
    localeData = data
  }
}

export function translate (key, replacements) {
  let result = t(key)
  if (replacements) {
    Object.keys(replacements).forEach(k => {
      result = result.replace(`{${k}}`, replacements[k])
    })
  }
  return result
}

export { t }
