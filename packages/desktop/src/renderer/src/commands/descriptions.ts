import { t } from '../i18n'

const COMMAND_KEY_MAP: Record<string, string> = {
  'view.read-only-mode': 'readingMode.title',
  'mt.hide': 'commands.mt.hide',
  'mt.hide-others': 'commands.mt.hideOthers',

  'file.new-window': 'commands.file.newWindow',
  'file.new-tab': 'commands.file.newTab',
  'file.open-file': 'commands.file.openFile',
  'file.open-folder': 'commands.file.openFolder',
  'file.quick-open': 'commands.file.quickOpen',
  'file.import-file': 'commands.file.importFile',
  'file.reveal-in-sidebar': 'commands.file.revealInSideBar',

  'file.save': 'commands.file.save',
  'file.save-as': 'commands.file.saveAs',
  'file.export-file': 'commands.file.exportFile',
  'file.export-file.pdf': 'commands.file.exportFilePdf',

  'file.move-file': 'commands.file.moveFile',
  'file.rename-file': 'commands.file.renameFile',
  'file.toggle-auto-save': 'commands.file.toggleAutoSave',

  'file.change-encoding': 'commands.file.changeEncoding',
  'file.line-ending': 'commands.file.changeLineEnding',
  'file.trailing-newline': 'commands.file.trailingNewline',
  'file.preferences': 'commands.file.preferences',

  'file.print': 'commands.file.print',
  'file.zoom': 'commands.file.zoom',
  'file.check-update': 'commands.file.checkUpdate',

  'file.close': 'commands.file.closeTab',
  'file.close-tab': 'commands.file.closeTab',
  'file.close-window': 'commands.file.closeWindow',
  'file.quit': 'commands.file.quit',

  'edit.undo': 'commands.edit.undo',
  'edit.redo': 'commands.edit.redo',

  'edit.cut': 'commands.edit.cut',
  'edit.copy': 'commands.edit.copy',
  'edit.paste': 'commands.edit.paste',
  'edit.copy-as-rich': 'commands.edit.copyAsRich',
  'edit.copy-as-html': 'commands.edit.copyAsHtml',
  'edit.paste-as-plaintext': 'commands.edit.pasteAsPlaintext',

  'edit.select-all': 'commands.edit.selectAll',
  'edit.duplicate': 'commands.edit.duplicate',

  'edit.create-paragraph': 'commands.edit.createParagraph',
  'edit.delete-paragraph': 'commands.edit.deleteParagraph',

  'edit.find': 'commands.edit.find',
  'edit.find-next': 'commands.edit.findNext',
  'edit.find-previous': 'commands.edit.findPrevious',
  'edit.replace': 'commands.edit.replace',
  'edit.find-in-folder': 'commands.edit.findInFolder',

  'edit.screenshot': 'commands.edit.screenshot',

  'paragraph.heading-1': 'commands.paragraph.heading1',
  'paragraph.heading-2': 'commands.paragraph.heading2',
  'paragraph.heading-3': 'commands.paragraph.heading3',
  'paragraph.heading-4': 'commands.paragraph.heading4',
  'paragraph.heading-5': 'commands.paragraph.heading5',
  'paragraph.heading-6': 'commands.paragraph.heading6',
  'paragraph.upgrade-heading': 'commands.paragraph.upgradeHeading',
  'paragraph.degrade-heading': 'commands.paragraph.degradeHeading',

  'paragraph.table': 'commands.paragraph.table',
  'paragraph.code-fence': 'commands.paragraph.codeFence',
  'paragraph.quote-block': 'commands.paragraph.quoteBlock',
  'paragraph.math-block': 'commands.paragraph.mathBlock',
  'paragraph.html-block': 'commands.paragraph.htmlBlock',

  'paragraph.order-list': 'commands.paragraph.orderList',
  'paragraph.bullet-list': 'commands.paragraph.bulletList',
  'paragraph.task-list': 'commands.paragraph.taskList',
  'paragraph.loose-list-item': 'commands.paragraph.looseListItem',

  'paragraph.paragraph': 'commands.paragraph.paragraph',
  'paragraph.reset-paragraph': 'commands.paragraph.resetParagraph',

  'paragraph.horizontal-rule': 'commands.paragraph.horizontalRule',
  'paragraph.horizontal-line': 'commands.paragraph.horizontalLine',
  'paragraph.math-formula': 'commands.paragraph.mathFormula',
  'paragraph.front-matter': 'commands.paragraph.frontMatter',

  'format.strong': 'commands.format.strong',
  'format.emphasis': 'commands.format.emphasis',
  'format.underline': 'commands.format.underline',
  'format.strike': 'commands.format.strike',

  'format.highlight': 'commands.format.highlight',
  'format.superscript': 'commands.format.superscript',
  'format.subscript': 'commands.format.subscript',

  'format.inline-code': 'commands.format.inlineCode',
  'format.inline-math': 'commands.format.inlineMath',

  'format.hyperlink': 'commands.format.hyperlink',
  'format.image': 'commands.format.image',

  'format.clear-format': 'commands.format.clearFormat',

  'window.minimize': 'commands.window.minimize',
  'window.close': 'commands.window.close',
  'window.toggle-always-on-top': 'commands.window.toggleAlwaysOnTop',
  'window.toggle-full-screen': 'commands.window.toggleFullScreen',

  'window.zoomIn': 'commands.window.zoomIn',
  'window.zoomOut': 'commands.window.zoomOut',

  'window.change-theme': 'commands.window.changeTheme',

  'view.toggle-sidebar': 'commands.view.toggleSidebar',
  'view.toggle-tabbar': 'commands.view.toggleTabbar',
  'view.toggle-toc': 'commands.view.toggleToc',

  'view.toggle-source-code-mode': 'commands.view.toggleSourceCodeMode',
  'view.source-code-mode': 'commands.view.sourceCodeMode',
  'view.toggle-typewriter-mode': 'commands.view.toggleTypewriterMode',
  'view.typewriter-mode': 'commands.view.typewriterMode',
  'view.toggle-focus-mode': 'commands.view.toggleFocusMode',
  'view.focus-mode': 'commands.view.focusMode',

  'view.command-palette': 'commands.view.commandPalette',
  'view.actual-size': 'commands.view.actualSize',
  'view.text-direction': 'commands.view.textDirection',

  'view.dev-reload': 'commands.view.devReload',
  'view.dev-toggle-developer-tools': 'commands.view.devToggleDeveloperTools',
  'view.toggle-dev-tools': 'commands.view.toggleDevTools',

  'view.reload-images': 'commands.view.reloadImages',

  'tabs.cycleBackward': 'commands.tabs.cycleBackward',
  'tabs.cycleForward': 'commands.tabs.cycleForward',
  'tabs.switchToLeft': 'commands.tabs.switchToLeft',
  'tabs.switchToRight': 'commands.tabs.switchToRight',

  'tabs.switchToFirst': 'commands.tabs.switchToFirst',
  'tabs.switchToSecond': 'commands.tabs.switchToSecond',
  'tabs.switchToThird': 'commands.tabs.switchToThird',
  'tabs.switchToFourth': 'commands.tabs.switchToFourth',
  'tabs.switchToFifth': 'commands.tabs.switchToFifth',
  'tabs.switchToSixth': 'commands.tabs.switchToSixth',
  'tabs.switchToSeventh': 'commands.tabs.switchToSeventh',
  'tabs.switchToEighth': 'commands.tabs.switchToEighth',
  'tabs.switchToNinth': 'commands.tabs.switchToNinth',
  'tabs.switchToTenth': 'commands.tabs.switchToTenth',

  'docs.user-guide': 'commands.docs.userGuide',
  'docs.markdown-syntax': 'commands.docs.markdownSyntax',

  'spellchecker.switch-language': 'commands.spellchecker.switchLanguage'
}

export default (id: string): string => {
  // Resolve descriptions on each call so language changes take effect immediately.
  return id in COMMAND_KEY_MAP ? t(COMMAND_KEY_MAP[id]) : id
}
