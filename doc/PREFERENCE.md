## Mark Text Preference

#### General

| Key                  | Type    | Default Value | Description                                                                                                                                                |
| -------------------- | ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| autoSave             | Boolean | ture          | Automatically save the content being edited. option value: true, false                                                                                     |
| autoSaveDelay        | Number  | 3000          | The delay in milliseconds after a changed file is saved automatically? 3000 ~10000                                                                         |
| titleBarStyle        | String  | csd           | The title bar style. the native option will result in a standard gray opaque title bar. `csd` (macOS only), `custom`, `native`                             |
| openFilesInNewWindow | Boolean | false         | true, false                                                                                                                                                |
| aidou                | Boolean | true          | Enable aidou. Optional value: true, false                                                                                                                  |
| fileSortBy           | String  | modified      | Sort files in opened folder by `created` time, modified time and title.                                                                                    |
| startUp              | String  | lastState     | The action after Mark Text startup, open the last edited content, open the specified folder or blank page, optional value: `lasteState`, `folder`, `blank` |
| language             | String  | en            | The language Mark Text use.                                                                                                                                |

#### Editor

| Key                    | Type    | Defaut             | Description                                                                                                                                                           |
| ---------------------- | ------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fontSize               | Number  | 16                 | Font size in pixels. 12 ~ 32                                                                                                                                          |
| editorFontFamily       | String  | Open Sans          | Font Family                                                                                                                                                           |
| lineHeight             | Number  | 1.6                | Line Height                                                                                                                                                           |
| autoPairBracket        | Boolean | true               | Automatically brackets when editing                                                                                                                                   |
| autoPairMarkdownSyntax | Boolean | true               | Autocomplete markdown syntax                                                                                                                                          |
| autoPairQuote          | Boolean | true               | Automatic completion of quotes                                                                                                                                        |
| endOfLine              | String  | default            | The newline character used at the end of each line. The default value is default, which will be selected according to your system intelligence. `lf` `crlf` `default` |
| textDirection          | String  | ltr                | The writing text direction, optional value: `ltr` or `rtl`                                                                                                            |
| codeFontSize           | Number  | 14                 | Font size on code block, the range is 12 ~ 28                                                                                                                         |
| codeFontFamily         | String  | `DejaVu Sans Mono` | Code font family                                                                                                                                                      |
| hideQuickInsertHint    | Boolean | false              | Hide hint for quickly creating paragraphs                                                                                                                             |
| imageDropAction        | String  | folder             | The default behavior after paste or drag the image to Mark Text, upload it to the image cloud (if configured), move to the specified folder, insert the path          |

#### Markdown

| Key                 | Type    | Default | Description                                                                                                                       |
| ------------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| preferLooseListItem | Boolean | true    | The preferred list type.                                                                                                          |
| bulletListMarker    | String  | `-`     | The preferred marker used in bullet list, optional value: `-`, `*` `+`                                                               |
| orderListDelimiter  | String  | `.`     | The preferred delimiter used in order list, optional value: `.` `)`                                                               |
| preferHeadingStyle  | String  | `atx`   | The preferred heading style in Mark Text, optional value `atx` `setext`, [more info](https://spec.commonmark.org/0.29/#atx-headings) |
| tabSize             | Number  | 4       | The number of spaces a tab is equal to                                                                                            |
| listIndentation     | String  | 1       | The list indentation of sub list items or paragraphs, optional value `dfm`, `tab` or number 1~4                                   |

#### Theme

| Key   | Type   | Default | Description                                                    |
| ----- | ------ | ------- | -------------------------------------------------------------- |
| theme | String | light   | `dark` `graphite` `material-dark` `one-dark` `light` `ulysses` |
