# Settings

## Options

### Editor

- **fontSize**: The editor font size.
- **editorFontFamily**: The editor font family name.
- **codeFontSize**: The code block font size.
- **codeFontFamily**: The code block font family name.
- **lineHeight**: The line height of the editor.
- **tabSize**: The number of spaces a tab is equal to.
- **listIndentation**: The list indentation of sub list items or paragraphs (`"dfm"`, `"tab"` or number `1-4`)
  - `dfm`: Each subsequent paragraph in a list item must be indented by either 4 spaces or one tab, we are using 4 spaces (used by Bitbucket and Daring Fireball Markdown Spec).
  - `number`: Dynamic indent subsequent paragraphs by the given number (1-4) plus list marker width (default).
- **autoPairBracket**: If `true` the editor automatically closes brackets.
- **autoPairMarkdownSyntax**: If `true` the editor automatically closes inline markdown like `*` or `_`.
- **autoPairQuote**:  If `true` the editor automatically closes quotes (`'` and `"`).
- **hideQuickInsertHint**: If `true` the editor hides the quick insert hint.
- **preferLooseListItem**: The preferred list style. If `true` a loose list is preferred otherwise a tight list.
- **bulletListMarker**: The preferred list item bullet (`+`,`-` or `*`).

### Files

- **autoSave**: Automatically saves the file after editing.
- **endOfLine**: The default end of line character (`lf`, `crlf` or `default`).

### Window

- **theme**: Specifies the theme (`dark`, `graphite`, `material-dark`, `one-dark`, `light` or `ulysses`).
- **textDirection**: The editor text direction (`ltr` or `rtl`).
- **openFilesInNewWindow**: If `true` files should opened in a new window.
- **titleBarStyle**: Specifies the title bar (`csd` (macOS only), `custom` or `native`).

### Misc

- **aidou**: Show aidou menu entry.

### Deprecated

- **lightColor**
- **darkColor**
