// Key bindings for Windows.

// NOTE: Avoid `Ctrl+Alt` and `AltGr` shortcuts on Windows because these are used to produce alternative characters.
//       Unlike Linux, `Ctrl+Alt` is an alias to `AltGr` on Windows and will produce alternative characters too.
//       We'll should try bind no keys to `Alt` "modifiers" because there are only a few key bindings available.

export default new Map([
  // MarkText menu on macOS only
  ['mt.hide', ''],
  ['mt.hide-others', ''],

  // File menu
  ['file.new-window', 'Ctrl+N'],
  ['file.new-tab', 'Ctrl+T'],
  ['file.open-file', 'Ctrl+O'],
  ['file.open-folder', 'Ctrl+Shift+O'],
  ['file.save', 'Ctrl+S'],
  ['file.save-as', 'Ctrl+Shift+S'],
  ['file.move-file', ''],
  ['file.rename-file', ''],
  ['file.print', ''],
  ['file.preferences', 'Ctrl+,'],
  ['file.close-tab', 'Ctrl+W'],
  ['file.close-window', 'Ctrl+Shift+W'],
  ['file.quit', 'Ctrl+Q'],

  // Edit menu
  ['edit.undo', 'Ctrl+Z'],
  ['edit.redo', 'Ctrl+Shift+Z'],
  ['edit.cut', 'Ctrl+X'],
  ['edit.copy', 'Ctrl+C'],
  ['edit.paste', 'Ctrl+V'],
  ['edit.copy-as-markdown', 'Ctrl+Shift+C'],
  ['edit.copy-as-html', ''],
  ['edit.paste-as-plaintext', 'Ctrl+Shift+V'],
  ['edit.select-all', 'Ctrl+A'],
  ['edit.duplicate', 'Ctrl+Alt+D'],
  ['edit.create-paragraph', 'Ctrl+Shift+N'],
  ['edit.delete-paragraph', 'Ctrl+Shift+D'],
  ['edit.find', 'Ctrl+F'],
  ['edit.find-next', 'F3'],
  ['edit.find-previous', 'Shift+F3'],
  ['edit.replace', 'Ctrl+R'],
  ['edit.find-in-folder', 'Ctrl+Shift+F'],
  ['edit.screenshot', ''], // macOS only

  // Paragraph menu
  // NOTE: We cannot set a default value for heading size because `Ctrl+Alt` is an alias
  //       to `AltGr` on Windows and `Ctrl+Shift+1` is mapped to the underlying character.
  ['paragraph.heading-1', ''],
  ['paragraph.heading-2', ''],
  ['paragraph.heading-3', ''],
  ['paragraph.heading-4', ''],
  ['paragraph.heading-5', ''],
  ['paragraph.heading-6', ''],
  ['paragraph.upgrade-heading', 'Ctrl+Plus'],
  ['paragraph.degrade-heading', 'Ctrl+-'],
  ['paragraph.table', 'Ctrl+Shift+T'],
  ['paragraph.code-fence', 'Ctrl+Shift+K'],
  ['paragraph.quote-block', 'Ctrl+Shift+Q'],
  ['paragraph.math-formula', 'Ctrl+Alt+N'],
  ['paragraph.html-block', 'Ctrl+Alt+H'],
  ['paragraph.order-list', 'Ctrl+G'],
  ['paragraph.bullet-list', 'Ctrl+H'],
  ['paragraph.task-list', 'Ctrl+Alt+X'],
  ['paragraph.loose-list-item', 'Ctrl+Alt+L'],
  ['paragraph.paragraph', 'Ctrl+Shift+0'],
  ['paragraph.horizontal-line', 'Ctrl+Shift+U'],
  ['paragraph.front-matter', 'Ctrl+Alt+Y'],

  // Format menu
  ['format.strong', 'Ctrl+B'],
  ['format.emphasis', 'Ctrl+I'],
  ['format.underline', 'Ctrl+U'],
  ['format.superscript', ''],
  ['format.subscript', ''],
  ['format.highlight', 'Ctrl+Shift+H'],
  ['format.inline-code', 'Ctrl+`'],
  ['format.inline-math', 'Ctrl+Shift+M'],
  ['format.strike', 'Ctrl+D'],
  ['format.hyperlink', 'Ctrl+L'],
  ['format.image', 'Ctrl+Shift+I'],
  ['format.clear-format', 'Ctrl+Shift+R'],

  // Window menu
  ['window.minimize', 'Ctrl+M'],
  ['window.toggle-always-on-top', ''],
  ['window.zoom-in', ''],
  ['window.zoom-out', ''],
  ['window.toggle-full-screen', 'F11'],

  // View menu
  ['view.command-palette', 'Ctrl+Shift+P'],
  ['view.source-code-mode', 'Ctrl+E'],
  ['view.typewriter-mode', 'Ctrl+Shift+G'],
  ['view.focus-mode', 'Ctrl+Shift+J'],
  ['view.toggle-sidebar', 'Ctrl+J'],
  ['view.toggle-toc', 'Ctrl+K'],
  ['view.toggle-tabbar', 'Ctrl+Shift+B'],
  ['view.toggle-dev-tools', 'Ctrl+Alt+I'],
  ['view.dev-reload', 'Ctrl+F5'],
  ['view.reload-images', 'F5'],

  // ======== Not included in application menu ========================
  ['tabs.cycle-forward', 'Ctrl+Tab'],
  ['tabs.cycle-backward', 'Ctrl+Shift+Tab'],
  ['tabs.switch-to-left', 'Ctrl+PageUp'],
  ['tabs.switch-to-right', 'Ctrl+PageDown'],
  ['tabs.switch-to-first', 'Ctrl+1'],
  ['tabs.switch-to-second', 'Ctrl+2'],
  ['tabs.switch-to-third', 'Ctrl+3'],
  ['tabs.switch-to-fourth', 'Ctrl+4'],
  ['tabs.switch-to-fifth', 'Ctrl+5'],
  ['tabs.switch-to-sixth', 'Ctrl+6'],
  ['tabs.switch-to-seventh', 'Ctrl+7'],
  ['tabs.switch-to-eighth', 'Ctrl+8'],
  ['tabs.switch-to-ninth', 'Ctrl+9'],
  ['tabs.switch-to-tenth', 'Ctrl+0'],
  ['file.quick-open', 'Ctrl+P']
])
