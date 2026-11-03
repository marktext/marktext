# Preferences

Preferences can be changed in the settings window or via `preferences.json` in the [application data directory](APPLICATION_DATA_DIRECTORY.md). Close MarkText before editing the file manually. Validation rules live in `packages/desktop/src/shared/preferences/schema.json`; `src/main/preferences/preferenceFile.ts` combines schema defaults, `packages/desktop/static/preference.json` and recovery defaults from `src/shared/types/preferences.ts`. Language and theme are initialized from the system. The tables below show application initial values; existing saved preferences can override them.

Invalid individual values fall back to defaults. An unreadable, malformed or non-object preference file is preserved and treated as read-only for that run. Unknown keys in a valid file are retained on disk but are not applied as preferences.

#### General

| Key                    | Type    | Default       | Description                                                                                                                       |
| ---------------------- | ------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| defaultOpenMode        | String  | `edit`        | Mode for newly opened existing documents: `edit` or `read`. Available in Preferences → General since 0.23.0.                      |
| openFilesInPreviewMode | Boolean | `true`        | Reuse a preview tab for sidebar files; editing or double-clicking keeps it open. Available in Preferences → General since 0.23.0. |
| autoSave               | Boolean | `false`       | Automatically save the content being edited.                                                                                      |
| autoSaveDelay          | Number  | `5000`        | The delay in milliseconds after a change before a file is saved automatically. Minimum `1000`.                                    |
| titleBarStyle          | String  | `custom`      | The title bar style on Linux and Windows: `custom` or `native`.                                                                   |
| openFilesInNewWindow   | Boolean | `false`       | Open files in a new window.                                                                                                       |
| openFolderInNewWindow  | Boolean | `false`       | Open folder via menu in a new window.                                                                                             |
| zoom                   | Number  | `1.0`         | The zoom level. Between `0.5` and `2.0` inclusive.                                                                                |
| hideScrollbar          | Boolean | `false`       | Whether to hide scrollbars.                                                                                                       |
| wordWrapInToc          | Boolean | `false`       | Whether to enable word wrap in the table of contents.                                                                             |
| tocPosition            | String  | `left`        | Dock the table of contents to the `left` or `right` of the editor.                                                                |
| fileSortBy             | String  | `created`     | Sort files in the opened folder. Optional values: `created`, `modified`, `title`.                                                 |
| fileSortOrder          | String  | `asc`         | Sort order for files in opened folders: `asc` (ascending) or `desc` (descending).                                                 |
| startUpAction          | String  | `restoreAll`  | Startup action: `restoreAll`, `restoreLastWindow`, `openLastFolder`, `folder` or `blank`.                                         |
| defaultDirectoryToOpen | String  | `""`          | The path that should be opened when `startUpAction=folder`.                                                                       |
| language               | String  | System locale | Detected from the system locale on first launch, falling back to `en` when no supported locale matches.                           |
| restoreLayoutState     | Boolean | `true`        | Restore window bounds, pane layout and project-tree folding.                                                                      |
| restoreEditors         | Boolean | `true`        | Restore saved document tabs. Unsaved recovery content is protected independently.                                                 |
| restoreViewState       | Boolean | `true`        | Restore document cursors, selections, scroll positions and heading folding.                                                       |
| openedFilesInSidebar   | Boolean | `true`        | Whether to show the _Opened Files_ subsection inside the sidebar file tree.                                                       |
| autoRevealInSidebar    | Boolean | `true`        | Reveal the active file in the sidebar file tree: expand its folders and scroll the file into view.                                |
| showPandocConvert      | Boolean | `false`       | Show the Pandoc conversion menu.                                                                                                  |

#### Editor

| Key                                | Type    | Default            | Description                                                                                                                                           |
| ---------------------------------- | ------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| editorFontFamily                   | String  | `Open Sans`        | Editor font family.                                                                                                                                   |
| fontSize                           | Number  | `16`               | Font size in pixels. Range `12`–`32`.                                                                                                                 |
| lineHeight                         | Number  | `1.6`              | Line height. Range `1.2`–`2.0`.                                                                                                                       |
| wrapCodeBlocks                     | Boolean | `false`            | Wrap text inside code blocks.                                                                                                                         |
| editorLineWidth                    | String  | `""`               | Maximum editor area width. Empty or a value with a `ch`, `px` or `%` suffix.                                                                          |
| codeFontSize                       | Number  | `14`               | Font size inside code blocks. Range `12`–`28`.                                                                                                        |
| codeFontFamily                     | String  | `DejaVu Sans Mono` | Font family for inline code and code blocks.                                                                                                          |
| codeBlockLineNumbers               | Boolean | `false`            | Show line numbers inside code blocks.                                                                                                                 |
| sourceCodeLineNumbers              | Boolean | `true`             | Show line numbers in source code mode.                                                                                                                |
| trimUnnecessaryCodeBlockEmptyLines | Boolean | `true`             | Trim the beginning and ending empty lines in code blocks.                                                                                             |
| autoPairBracket                    | Boolean | `true`             | Auto-close brackets when editing.                                                                                                                     |
| autoPairMarkdownSyntax             | Boolean | `true`             | Autocomplete markdown syntax.                                                                                                                         |
| autoPairQuote                      | Boolean | `true`             | Auto-close quotes.                                                                                                                                    |
| endOfLine                          | String  | `default`          | Newline character at the end of each line: `default` (OS default), `lf`, or `crlf`.                                                                   |
| defaultEncoding                    | String  | `utf8`             | The default file encoding. See `packages/desktop/src/shared/preferences/schema.json` for the accepted encoding names.                                 |
| autoGuessEncoding                  | Boolean | `true`             | Try to automatically guess the file encoding when opening files.                                                                                      |
| trimTrailingNewline                | Number  | `2`                | Trailing-newline handling: `0` trim all, `1` ensure single newline, `2` auto-detect, `3` disabled.                                                    |
| textDirection                      | String  | `ltr`              | Writing direction: `ltr` or `rtl`.                                                                                                                    |
| hideQuickInsertHint                | Boolean | `false`            | Hide the hint for the quick-insert overlay.                                                                                                           |
| hideLinkPopup                      | Boolean | `false`            | Hide the link popup when the cursor hovers over a link.                                                                                               |
| autoCheck                          | Boolean | `false`            | Whether to automatically check related task items when one is toggled.                                                                                |
| autoNormalizeLineEndings           | Boolean | `false`            | Normalize loaded documents to LF instead of scheduling conversion back to detected non-LF line endings on save. The editor always uses LF internally. |

#### Markdown

| Key                    | Type    | Default                             | Description                                                                                                                                                                                                                                                                 |
| ---------------------- | ------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| githubAlerts           | Boolean | `false`                             | Enable GitHub Alerts, creation/conversion menus, and HTML/PDF rendering. Available in Preferences → Markdown since 0.22.0.                                                                                                                                                  |
| plantumlServer         | String  | `https://www.plantuml.com/plantuml` | PlantUML rendering server. Set an HTTP(S) server URL in Preferences → Markdown. Diagram rendering sends the encoded source to that server.                                                                                                                                  |
| preferLooseListItem    | Boolean | `true`                              | Prefer loose list items when creating lists.                                                                                                                                                                                                                                |
| bulletListMarker       | String  | `-`                                 | Marker for bullet lists. Optional values: `-`, `*`, `+`.                                                                                                                                                                                                                    |
| orderListDelimiter     | String  | `.`                                 | Delimiter for ordered lists. Optional values: `.`, `)`.                                                                                                                                                                                                                     |
| preferHeadingStyle     | String  | `atx`                               | Heading style. Optional values: `atx`, `setext` ([details](https://spec.commonmark.org/0.31.2/#atx-headings)).                                                                                                                                                              |
| tabSize                | Mixed   | `4`                                 | Tab-key indentation: a number of spaces, or `tab` to insert a tab character.                                                                                                                                                                                                |
| listIndentation        | Mixed   | `1`                                 | List indentation. Optional values: `dfm`, `tab`, or a number `1`–`4`.                                                                                                                                                                                                       |
| frontmatterType        | String  | `-`                                 | Frontmatter delimiter: `-` (YAML), `+` (TOML), `;` (JSON), or `{` (JSON).                                                                                                                                                                                                   |
| superSubScript         | Boolean | `false`                             | Enable pandoc's superscript/subscript markdown extension.                                                                                                                                                                                                                   |
| footnote               | Boolean | `false`                             | Enable pandoc's footnote markdown extension.                                                                                                                                                                                                                                |
| texMathDollars         | Boolean | `true`                              | Enable pandoc's [`tex_math_dollars`](https://pandoc.org/MANUAL.html#extension-tex_math_dollars) extension — `$…$` and `$$…$$` math.                                                                                                                                         |
| texMathGfm             | Boolean | `false`                             | Enable pandoc's [`tex_math_gfm`](https://pandoc.org/MANUAL.html#extension-tex_math_gfm) extension — GitHub's ``$`…`$`` and ` ```math ` math. The former `isGitlabCompatibilityEnabled` key is no longer applied; enable this option explicitly.                             |
| texMathSingleBackslash | Boolean | `false`                             | Enable pandoc's [`tex_math_single_backslash`](https://pandoc.org/MANUAL.html#extension-tex_math_single_backslash) extension — `\(…\)` inline and `\[…\]` display math. Off by default, as in pandoc: it precludes escaping `(` and `[`, so `- \[TODO\]` reads as a formula. |
| texMathDoubleBackslash | Boolean | `false`                             | Enable pandoc's [`tex_math_double_backslash`](https://pandoc.org/MANUAL.html#extension-tex_math_double_backslash) extension — `\\(…\\)` inline and `\\[…\\]` display math.                                                                                                  |
| fancyLists             | Boolean | `false`                             | Enable pandoc's [`fancy_lists`](https://pandoc.org/MANUAL.html#extension-fancy_lists) extension — `a.`, `IV.`, `(1)` and `#.` list markers. Pandoc exports then use pandoc's `markdown` reader.                                                                             |
| highlightSyntax        | Boolean | `false`                             | Enable the non-standard `==highlight==` syntax used by Obsidian, Typora and Logseq. Renders as `<mark>` in the editor and in the HTML/PDF exports; `==` stays literal text while off.                                                                                       |
| inlineDiff             | Boolean | `false`                             | Enable GitLab's non-standard [`{+ … +}` / `[- … -]` inline diff](https://docs.gitlab.com/user/markdown/#inline-diff) syntax. Additions render as `<ins>` and deletions as `<del>` in the editor and in the HTML/PDF exports; the tags stay literal text while off.          |
| multilineBlockquote    | Boolean | `false`                             | Enable GitLab's non-standard [`>>>` … `>>>` multiline blockquote](https://docs.gitlab.com/user/markdown/#multiline-blockquote) syntax. The fence is preserved on save and renders as a `<blockquote>` in the HTML/PDF exports; while off the fence stays literal text.      |
| isHtmlEnabled          | Boolean | `true`                              | Enable inline HTML rendering.                                                                                                                                                                                                                                               |
| softNewlineAsSpace     | Boolean | `false`                             | Treat a soft line break (a single bare newline within a paragraph) as a space instead of a line break.                                                                                                                                                                      |
| sequenceTheme          | String  | `hand`                              | Theme for [js-sequence-diagrams](https://bramp.github.io/js-sequence-diagrams/): `hand` or `simple`.                                                                                                                                                                        |
| mermaidLightTheme      | String  | `default`                           | Mermaid theme used with a light application theme. Configurable in Preferences → Markdown.                                                                                                                                                                                  |
| mermaidDarkTheme       | String  | `dark`                              | Mermaid theme used with a dark application theme. Per-diagram configuration can override it; see [Markdown syntax](MARKDOWN_SYNTAX.md#mermaid-themes).                                                                                                                      |

#### Theme

| Key               | Type    | Default           | Description                                                                                 |
| ----------------- | ------- | ----------------- | ------------------------------------------------------------------------------------------- |
| theme             | String  | System light/dark | Initial theme follows the system: `light` or `dark`. See [Themes](THEMES.md) for theme IDs. |
| followSystemTheme | Boolean | `true`            | Follow the system light/dark mode and switch automatically.                                 |
| lightModeTheme    | String  | `light`           | Theme id used when the system is in light mode (only when `followSystemTheme` is `true`).   |
| darkModeTheme     | String  | `dark`            | Theme id used when the system is in dark mode (only when `followSystemTheme` is `true`).    |

#### Spelling

| Key                     | Type    | Default | Description                                                                                                            |
| ----------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| spellcheckerEnabled     | Boolean | `false` | Whether spell checking is enabled.                                                                                     |
| spellcheckerNoUnderline | Boolean | `false` | Don't underline spelling mistakes.                                                                                     |
| spellcheckerLanguage    | String  | `en-US` | Spell-checker language on Linux/Windows; choose from the available dictionaries. macOS uses system language detection. |

#### Image

| Key                          | Type    | Default  | Description                                                                                      |
| ---------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------ |
| imageInsertAction            | String  | `path`   | Default action after inserting a local image: `upload`, `folder`, or `path`.                     |
| imagePreferRelativeDirectory | Boolean | `false`  | Prefer the relative image directory when copying images.                                         |
| imageRelativeDirectoryBase   | String  | `file`   | Where relative images are anchored: `file` (next to the document) or `folder` (project root).    |
| imageRelativeDirectoryName   | String  | `assets` | Folder name (or relative path) used for local image copies. Supports the `${filename}` variable. |

#### Editable via file

These settings are primarily edited in `preferences.json`; exceptions with Preferences controls are noted below.

##### View

The source-code preference below supplies the default for a new layout. Sidebar, tab-bar and outline visibility and dimensions are window layout state, stored separately in `state/application-state.json`. The old `tocVisibility`, `sideBarVisibility`, `tabBarVisibility` and `lastOpenedFolder` preference keys are no longer applied.

| Key                   | Type    | Default | Description                                                        |
| --------------------- | ------- | ------- | ------------------------------------------------------------------ |
| sourceCodeModeEnabled | Boolean | `false` | Initial source-code mode state. Overridden by the menu / shortcut. |

##### Custom CSS

Although marked internal in the schema, `customCss` is editable in Preferences → Theme.

| Key       | Type   | Default | Description                                           |
| --------- | ------ | ------- | ----------------------------------------------------- |
| customCss | String | `""`    | Extra CSS appended after the active theme stylesheet. |

##### File system / Searcher

`treePathExcludePatterns` is validated by the shared preference schema and used by the filesystem watcher.

| Key                     | Type             | Default | Description                                                                      |
| ----------------------- | ---------------- | ------- | -------------------------------------------------------------------------------- |
| treePathExcludePatterns | Array of Strings | `[]`    | Exclude matching paths from the sidebar filesystem watcher.                      |
| searchExclusions        | Array of Strings | `[]`    | Filename glob exclusions for the in-folder search.                               |
| searchMaxFileSize       | String           | `""`    | Maximum file size to search in (e.g. `50K`, `10M`, `2G`). Empty means unlimited. |
| searchIncludeHidden     | Boolean          | `false` | Search hidden files and directories.                                             |
| searchNoIgnore          | Boolean          | `false` | Don't respect ignore files such as `.gitignore`.                                 |
| searchFollowSymlinks    | Boolean          | `true`  | Whether to follow symbolic links.                                                |

##### Watcher

| Key               | Type    | Default | Description                                                                                                 |
| ----------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| watcherUsePolling | Boolean | `false` | Use polling for file changes. This can help on network shares but may increase CPU use on large workspaces. |
