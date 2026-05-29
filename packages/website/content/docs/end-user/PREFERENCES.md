## MarkText Preferences

Preferences can be controlled and modified in the settings window or via the `preferences.json` file in the [application data directory](APPLICATION_DATA_DIRECTORY.md). The authoritative list of keys, defaults, and accepted values lives in `src/main/preferences/schema.json` — the tables below mirror that schema.

#### General

| Key                    | Type    | Default       | Description                                                                                                                |
| ---------------------- | ------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| autoSave               | Boolean | `false`       | Automatically save the content being edited.                                                                               |
| autoSaveDelay          | Number  | `5000`        | The delay in milliseconds after a change before a file is saved automatically. Minimum `1000`.                             |
| titleBarStyle          | String  | `custom`      | The title bar style on Linux and Windows: `custom` or `native`.                                                            |
| openFilesInNewWindow   | Boolean | `false`       | Open files in a new window.                                                                                                |
| openFolderInNewWindow  | Boolean | `false`       | Open folder via menu in a new window.                                                                                      |
| zoom                   | Number  | `1.0`         | The zoom level. Between `0.5` and `2.0` inclusive.                                                                         |
| hideScrollbar          | Boolean | `false`       | Whether to hide scrollbars.                                                                                                |
| wordWrapInToc          | Boolean | `false`       | Whether to enable word wrap in the table of contents.                                                                      |
| fileSortBy             | String  | `modified`    | Sort files in the opened folder. Optional values: `created`, `modified`, `title`.                                          |
| fileSortOrder          | String  | `asc`         | Sort order for files in opened folders: `asc` (ascending) or `desc` (descending).                                          |
| startUpAction          | String  | `restoreAll`  | The action when MarkText launches. Optional values: `folder`, `openLastFolder`, `blank`, `restoreAll`.                     |
| defaultDirectoryToOpen | String  | `""`          | The path that should be opened when `startUpAction=folder`.                                                                |
| language               | String  | `en`          | The display language MarkText uses.                                                                                        |
| restoreLayoutState     | Boolean | `true`        | Restore the previous editor state (open tabs, layout) on startup.                                                          |
| openedFilesInSidebar   | Boolean | `true`        | Whether to show the *Opened Files* subsection inside the sidebar file tree.                                                |

#### Editor

| Key                                | Type    | Default            | Description                                                                                                                                                                          |
| ---------------------------------- | ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| editorFontFamily                   | String  | `Open Sans`        | Editor font family.                                                                                                                                                                  |
| fontSize                           | Number  | `16`               | Font size in pixels. Range `12`–`32`.                                                                                                                                                |
| lineHeight                         | Number  | `1.6`              | Line height. Range `1.2`–`2.0`.                                                                                                                                                      |
| wrapCodeBlocks                     | Boolean | `true`             | Wrap text inside code blocks.                                                                                                                                                        |
| editorLineWidth                    | String  | `""`               | Maximum editor area width. Empty or a value with a `ch`, `px` or `%` suffix.                                                                                                         |
| codeFontSize                       | Number  | `14`               | Font size inside code blocks. Range `12`–`28`.                                                                                                                                       |
| codeFontFamily                     | String  | `DejaVu Sans Mono` | Code-block font family.                                                                                                                                                              |
| codeBlockLineNumbers               | Boolean | `true`             | Show line numbers inside code blocks.                                                                                                                                                |
| trimUnnecessaryCodeBlockEmptyLines | Boolean | `true`             | Trim the beginning and ending empty lines in code blocks.                                                                                                                            |
| autoPairBracket                    | Boolean | `true`             | Auto-close brackets when editing.                                                                                                                                                    |
| autoPairMarkdownSyntax             | Boolean | `true`             | Autocomplete markdown syntax.                                                                                                                                                        |
| autoPairQuote                      | Boolean | `true`             | Auto-close quotes.                                                                                                                                                                   |
| endOfLine                          | String  | `default`          | Newline character at the end of each line: `default` (OS default), `lf`, or `crlf`.                                                                                                  |
| defaultEncoding                    | String  | `utf8`             | The default file encoding. See `src/main/preferences/schema.json` for the full enum (35 encodings).                                                                                  |
| autoGuessEncoding                  | Boolean | `true`             | Try to automatically guess the file encoding when opening files.                                                                                                                     |
| trimTrailingNewline                | Number  | `2`                | Trailing-newline handling: `0` trim all, `1` ensure single newline, `2` auto-detect, `3` disabled.                                                                                   |
| textDirection                      | String  | `ltr`              | Writing direction: `ltr` or `rtl`.                                                                                                                                                   |
| hideQuickInsertHint                | Boolean | `false`            | Hide the hint for the quick-insert overlay.                                                                                                                                          |
| hideLinkPopup                      | Boolean | `false`            | Hide the link popup when the cursor hovers over a link.                                                                                                                              |
| autoCheck                          | Boolean | `false`            | Whether to automatically check related task items when one is toggled.                                                                                                               |
| autoNormalizeLineEndings           | Boolean | `false`            | Automatically normalize line endings when opening files. When disabled, files are opened as-is.                                                                                      |

#### Markdown

| Key                          | Type    | Default | Description                                                                                                                          |
| ---------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| preferLooseListItem          | Boolean | `true`  | The preferred list type.                                                                                                             |
| bulletListMarker             | String  | `-`     | Marker for bullet lists. Optional values: `-`, `*`, `+`.                                                                             |
| orderListDelimiter           | String  | `.`     | Delimiter for ordered lists. Optional values: `.`, `)`.                                                                              |
| preferHeadingStyle           | String  | `atx`   | Heading style. Optional values: `atx`, `setext` ([details](https://spec.commonmark.org/0.31.2/#atx-headings)).                       |
| tabSize                      | Number  | `4`     | Number of spaces a tab equals.                                                                                                       |
| listIndentation              | Mixed   | `1`     | List indentation. Optional values: `dfm`, `tab`, or a number `1`–`4`.                                                                |
| frontmatterType              | String  | `-`     | Frontmatter delimiter: `-` (YAML), `+` (TOML), `;` (JSON), or `{` (JSON).                                                            |
| superSubScript               | Boolean | `false` | Enable pandoc's superscript/subscript markdown extension.                                                                            |
| footnote                     | Boolean | `false` | Enable pandoc's footnote markdown extension.                                                                                         |
| isHtmlEnabled                | Boolean | `true`  | Enable inline HTML rendering.                                                                                                        |
| isGitlabCompatibilityEnabled | Boolean | `false` | Enable GitLab compatibility mode.                                                                                                    |
| sequenceTheme                | String  | `hand`  | Theme for [js-sequence-diagrams](https://bramp.github.io/js-sequence-diagrams/): `hand` or `simple`.                                 |

#### Theme

| Key               | Type    | Default | Description                                                                                                                  |
| ----------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| theme             | String  | `light` | The current theme id. See [Themes](THEMES.md) for the full list.                                                             |
| followSystemTheme | Boolean | `false` | Follow the system light/dark mode and switch automatically.                                                                  |
| lightModeTheme    | String  | `light` | Theme id used when the system is in light mode (only when `followSystemTheme` is `true`).                                    |
| darkModeTheme     | String  | `dark`  | Theme id used when the system is in dark mode (only when `followSystemTheme` is `true`).                                     |

#### Spelling

| Key                    | Type    | Default | Description                                                                  |
| ---------------------- | ------- | ------- | ---------------------------------------------------------------------------- |
| spellcheckerEnabled    | Boolean | `false` | Whether spell checking is enabled.                                           |
| spellcheckerNoUnderline | Boolean | `false` | Don't underline spelling mistakes.                                          |
| spellcheckerLanguage   | String  | `en-US` | The spell-checker language (BCP-47, e.g. `en-US`, `de-DE`, `zh-CN`).         |

#### Image

| Key                          | Type    | Default  | Description                                                                                                  |
| ---------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| imageInsertAction            | String  | `path`   | Default action after inserting a local image: `upload`, `folder`, or `path`.                                 |
| imagePreferRelativeDirectory | Boolean | `false`  | Prefer the relative image directory when copying images.                                                     |
| imageRelativeDirectoryBase   | String  | `file`   | Where relative images are anchored: `file` (next to the document) or `folder` (project root).                |
| imageRelativeDirectoryName   | String  | `assets` | Folder name (or relative path) used for local image copies. Supports the `${filename}` variable.             |

#### Editable via file

These entries are marked `--internal` in the schema. They have no UI control and must be edited directly in `preferences.json`.

##### View

| Key                   | Type    | Default | Description                                                              |
| --------------------- | ------- | ------- | ------------------------------------------------------------------------ |
| sideBarVisibility     | Boolean | `false` | Initial visibility of the sidebar. Overridden by the menu / shortcut.    |
| tabBarVisibility      | Boolean | `false` | Initial visibility of the tab bar. Overridden by the menu / shortcut.    |
| sourceCodeModeEnabled | Boolean | `false` | Initial source-code mode state. Overridden by the menu / shortcut.       |

##### General (internal)

| Key              | Type   | Default | Description                                                          |
| ---------------- | ------ | ------- | -------------------------------------------------------------------- |
| lastOpenedFolder | String | `""`    | The last folder opened in MarkText (used for session restore).       |

##### Custom CSS

| Key       | Type   | Default | Description                                            |
| --------- | ------ | ------- | ------------------------------------------------------ |
| customCss | String | `""`    | Extra CSS appended after the active theme stylesheet.  |

##### File system / Searcher

| Key                  | Type             | Default | Description                                                                                                                                                              |
| -------------------- | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| searchExclusions     | Array of Strings | `[]`    | Filename glob exclusions for the in-folder search.                                                                                                                       |
| searchMaxFileSize    | String           | `""`    | Maximum file size to search in (e.g. `50K`, `10M`, `2G`). Empty means unlimited.                                                                                         |
| searchIncludeHidden  | Boolean          | `false` | Search hidden files and directories.                                                                                                                                     |
| searchNoIgnore       | Boolean          | `false` | Don't respect ignore files such as `.gitignore`.                                                                                                                         |
| searchFollowSymlinks | Boolean          | `true`  | Whether to follow symbolic links.                                                                                                                                        |

##### Watcher

| Key               | Type    | Default | Description                                                                                                            |
| ----------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| watcherUsePolling | Boolean | `false` | Use polling to receive file changes. Necessary for network shares; may cause high CPU utilization on large workspaces. |
