## MarkText Preferences

Preferences can be controlled and modified in the settings window or via the `preferences.json` file in the [application data directory](APPLICATION_DATA_DIRECTORY.md).

#### General

| Key                    | Type    | Default Value | Description                                                                                                                                                |
| ---------------------- | ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| autoSave               | Boolean | false         | Automatically save the content being edited. option value: true, false                                                                                     |
| autoSaveDelay          | Number  | 5000          | The delay in milliseconds after a changed file is saved automatically? 1000 ~10000                                                                         |
| titleBarStyle          | String  | custom        | The title bar style on Linux and Window: `custom` or `native`                                                                                              |
| openFilesInNewWindow   | Boolean | false         | true, false                                                                                                                                                |
| openFolderInNewWindow  | Boolean | false         | true, false                                                                                                                                                |
| zoom                   | Number  | 1.0           | The zoom level. Between 0.5 and 2.0 inclusive.                                                                                              |
| hideScrollbar          | Boolean | false         | Whether to hide scrollbars. Optional value: true, false                                                                                                    |
| wordWrapInToc          | Boolean | false         | Whether to enable word wrap in TOC. Optional value: true, false                                                                                            |
| fileSortBy             | String  | created       | Sort files in opened folder by `created` time, modified time and title.                                                                                    |
| startUpAction          | String  | lastState     | The action after MarkText startup, open the last edited content, open the specified folder or blank page, optional value: `lastState`, `folder`, `blank` |
| defaultDirectoryToOpen | String  | `""`          | The path that should be opened if `startUpAction=folder`.                                                                                                  |
| language               | String  | en            | The language MarkText use.                                                                                                                                |

#### Editor

| Key                                | Type    | Defaut             | Description                                                                                                                                                                   |
| ---------------------------------- | ------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fontSize                           | Number  | 16                 | Font size in pixels. 12 ~ 32                                                                                                                                                   |
| editorFontFamily                   | String  | Open Sans          | Font Family                                                                                                                                                                    |
| lineHeight                         | Number  | 1.6                | Line Height                                                                                                                                                                    |
| autoPairBracket                    | Boolean | true               | Automatically brackets when editing                                                                                                                                            |
| autoPairMarkdownSyntax             | Boolean | true               | Autocomplete markdown syntax                                                                                                                                                   |
| autoPairQuote                      | Boolean | true               | Automatic completion of quotes                                                                                                                                                 |
| endOfLine                          | String  | default            | The newline character used at the end of each line. The default value is default, which selects your operating system's default newline character. `lf` `crlf` `default`         |
| textDirection                      | String  | ltr                | The writing text direction, optional value: `ltr` or `rtl`                                                                                                                     |
| codeFontSize                       | Number  | 14                 | Font size on code block, the range is 12 ~ 28                                                                                                                                  |
| codeFontFamily                     | String  | `DejaVu Sans Mono` | Code font family                                                                                                                                                               |
| trimUnnecessaryCodeBlockEmptyLines | Boolean | true               | Whether to trim the beginning and end empty line in Code block                                                                                                                 |
| hideQuickInsertHint                | Boolean | false              | Hide hint for quickly creating paragraphs                                                                                                                                      |
| imageDropAction                    | String  | folder             | The default behavior after paste or drag the image to MarkText, upload it to the image cloud (if configured), move to the specified folder, insert the path          |
| defaultEncoding                    | String  | `utf8`             | The default file encoding                                                                                                                                                      |
| autoGuessEncoding                  | Boolean | true               | Try to automatically guess the file encoding when opening files                                                                                                                |
| trimTrailingNewline                | Enum    | `2`                | Ensure a single trailing newline or whether trailing newlines should be removed: `0`: trim all trailing newlines, `1`: ensure single newline, `2`: auto detect, `3`: disabled. |
| hideLinkPopup                      | Boolean | false              | It will not show the link popup when hover over the link if set `hideLinkPopup` to true                                                                                        |
| autoCheck                          | Boolean | false              | Whether to automatically check related task. Optional value: true, false                                                                                             |

#### Markdown

| Key                 | Type    | Default | Description                                                                                                                          |
| ------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| preferLooseListItem | Boolean | true    | The preferred list type.                                                                                                             |
| bulletListMarker    | String  | `-`     | The preferred marker used in bullet list, optional value: `-`, `*` `+`                                                               |
| orderListDelimiter  | String  | `.`     | The preferred delimiter used in order list, optional value: `.` `)`                                                                  |
| preferHeadingStyle  | String  | `atx`   | The preferred heading style in MarkText, optional value `atx` `setext`, [more info](https://spec.commonmark.org/0.29/#atx-headings) |
| tabSize             | Number  | 4       | The number of spaces a tab is equal to                                                                                               |
| listIndentation     | String  | 1       | The list indentation of sub list items or paragraphs, optional value `dfm`, `tab` or number 1~4                                      |
| frontmatterType     | String  | `-`     | The frontmatter type: `-` (YAML), `+` (TOML), `;` (JSON) or `{` (JSON)                                                               |
| superSubScript      | Boolean | `false` | Enable pandoc's markdown extension superscript and subscript.                                                                        |
| footnote            | Boolean | `false` | Enable pandoc's footnote markdown extension                                                                                          |
| sequenceTheme       | String  | `hand`  | Change the theme of [js-sequence-diagrams](https://bramp.github.io/js-sequence-diagrams/)                                                                                         |

#### Theme

| Key   | Type   | Default | Description                                                           |
| ----- | ------ | ------- | --------------------------------------------------------------------- |
| theme | String | light   | `dark`, `graphite`, `material-dark`, `one-dark`, `light` or `ulysses` |

#### Editable via file

These entires don't have a settings option and need to be changed manually.

##### View

| Key                           | Type    | Default | Description                                        |
| ----------------------------- | ------- | ------- | -------------------------------------------------- |
| sideBarVisibility<sup>*</sup> | Boolean | false   | Controls the visibility of the sidebar.            |
| tabBarVisibility<sup>*</sup>  | Boolean | false   | Controls the visibility of the tabs.               |
| sourceCodeModeEnabled*        | Boolean | false   | Controls the visibility of the source-code editor. |

\*: These options are default/fallback values that are used if not session is loaded and are overwritten by the menu entries.

##### File system

| Key                  | Type             | Default | Description                                                                                                                                                      |
| -------------------- | ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| searchExclusions     | Array of Strings | `[]`    | The filename exclusions for the file searcher. Default: `'*.markdown', '*.mdown', '*.mkdn', '*.md', '*.mkd', '*.mdwn', '*.mdtxt', '*.mdtext', '*.mdx', '*.text', '*.txt'` |
| searchMaxFileSize    | String           | `""`    | The maximum file size to search in (e.g. 50K or 10MB). Default: unlimited                                                                                        |
| searchIncludeHidden  | Boolean          | false   | Search hidden files and directories                                                                                                                              |
| searchNoIgnore       | Boolean          | false   | Don't respect ignore files such as `.gitignore`.                                                                                                                 |
| searchFollowSymlinks | Boolean          | true    | Whether to follow symbolic links.                                                                                                                                |
| watcherUsePolling    | Boolean          | false   | Whether to use polling to receive file changes. Polling may leads to high CPU utilization.                                                                       |
