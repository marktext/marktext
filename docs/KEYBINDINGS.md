# Key Bindings

All key bindings can be overwritten with the `keybindings.json` file. The file is located in the [application data directory](APPLICATION_DATA_DIRECTORY.md). Each entry consists of a `id`/`accelerator` pair in JSON format.

Here is an example:

```json
{
  "fileSave": "CmdOrCtrl+Shift+S",
  "fileSaveAs": "CmdOrCtrl+S"
}
```

## Available modifiers

- `CmdOrCtrl`
- `Cmd` on macOS
- `Ctrl`
- `Alt`/`AltGr` or `Option` on macOS
- `Shift`
- `Super` on Linux and Windows

## Available keys

- `0-9`, `A-Z`, `F1-F24` and punctuations
- `Plus`, `Space`, `Tab`, `Backspace`, `Delete`, `Insert`, `Return/Enter`, `Esc`, `Home`, `End` and `PrintScreen`
- `Up`, `Down`, `Left` and `Right`
- `PageUp` and `PageDown`
- Empty string `""` to unset a accelerator

## Available id's

**Mark Text menu (macOS only):**

| Id                | Default                                        | Description                             |
| ----------------- | ---------------------------------------------- | --------------------------------------- |
| `mtHide`          | <kbd>Command</kbd>+<kbd>H</kbd>                | Hide Mark Text                          |
| `mtHideOthers`    | <kbd>Command</kbd>+<kbd>Alt</kbd>+<kbd>H</kbd> | Hide all other windows except Mark Text |
| `filePreferences` | <kbd>Command</kbd>+<kbd>,</kbd>                | Open settings window                    |
| `fileQuit`        | <kbd>Command</kbd>+<kbd>Q</kbd>                | Quit Mark Text                          |

**File menu:**

| Id                | Default                                            | Description                               |
|:----------------- | -------------------------------------------------- | ----------------------------------------- |
| `fileNewFile`     | <kbd>CmdOrCtrl</kbd>+<kbd>N</kbd>                  | New file                                  |
| `fileNewTab`      | <kbd>CmdOrCtrl</kbd>+<kbd>T</kbd>                  | New tab                                   |
| `fileOpenFile`    | <kbd>CmdOrCtrl</kbd>+<kbd>O</kbd>                  | Open markdown file                        |
| `fileOpenFolder`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> | Open folder                               |
| `fileSave`        | <kbd>CmdOrCtrl</kbd>+<kbd>S</kbd>                  | Save                                      |
| `fileSaveAs`      | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Save as...                                |
| `filePrint`       | <kbd>Ctrl</kbd>+<kbd>P</kbd>                       | Print current tab                         |
| `filePreferences` | <kbd>Ctrl</kbd>+<kbd>,</kbd>                       | Open settings window (Linux/Windows only) |
| `fileCloseTab`    | <kbd>CmdOrCtrl</kbd>+<kbd>W</kbd>                  | Close tab                                 |
| `fileCloseWindow` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd> | Close window                              |
| `fileQuit`        | <kbd>CmdOrCtrl</kbd>+<kbd>Q</kbd>                  | Quit Mark Text (Linux/Windows only)       |

**Edit menu:**

| Id                    | Default                                            | Description                                     |
|:--------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `editUndo`            | <kbd>CmdOrCtrl</kbd>+<kbd>Z</kbd>                  | Undo last operation                             |
| `editRedo`            | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Redo last operation                             |
| `editCut`             | <kbd>CmdOrCtrl</kbd>+<kbd>X</kbd>                  | Cut selected text                               |
| `editCopy`            | <kbd>CmdOrCtrl</kbd>+<kbd>C</kbd>                  | Copy selected text                              |
| `editPaste`           | <kbd>CmdOrCtrl</kbd>+<kbd>V</kbd>                  | Paste text                                      |
| `editCopyAsMarkdown`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> | Copy selected text as markdown                  |
| `editCopyAsPlaintext` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | Copy selected text as plaintext                 |
| `editSelectAll`       | <kbd>CmdOrCtrl</kbd>+<kbd>A</kbd>                  | Select all text of the document                 |
| `editDuplicate`       | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Duplicate the current paragraph                 |
| `editCreateParagraph` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> | Create a new paragraph after the current one    |
| `editDeleteParagraph` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> | Delete current paragraph                        |
| `editFind`            | <kbd>CmdOrCtrl</kbd>+<kbd>F</kbd>                  | Find information in the document                |
| `editFindNext`        | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd>   | Continue the search and find the next match     |
| `editFindPrevious`    | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> | Continue the search and find the previous match |
| `editReplace`         | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd>   | Replace the information with a replacement      |
| `editAidou`           | <kbd>CmdOrCtrl</kbd>+<kbd>/</kbd>                  | Show Aidou dialog                               |
| `editScreenshot`      | <kbd>Command</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd>     | Get the screenshot (macOS only)                 |

**Paragraph menu:**

| Id                         | Default                                            | Description                                       |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `paragraphHeading1`        | <kbd>CmdOrCtrl</kbd>+<kbd>1</kbd>                  | Set line as heading 1                             |
| `paragraphHeading2`        | <kbd>CmdOrCtrl</kbd>+<kbd>2</kbd>                  | Set line as heading 2                             |
| `paragraphHeading3`        | <kbd>CmdOrCtrl</kbd>+<kbd>3</kbd>                  | Set line as heading 3                             |
| `paragraphHeading4`        | <kbd>CmdOrCtrl</kbd>+<kbd>4</kbd>                  | Set line as heading 4                             |
| `paragraphHeading5`        | <kbd>CmdOrCtrl</kbd>+<kbd>5</kbd>                  | Set line as heading 5                             |
| `paragraphHeading6`        | <kbd>CmdOrCtrl</kbd>+<kbd>6</kbd>                  | Set line as heading 6                             |
| `paragraphUpgradeHeading`  | <kbd>CmdOrCtrl</kbd>+<kbd>=</kbd>                  | Upgrade a heading                                 |
| `paragraphDegradeHeading`  | <kbd>CmdOrCtrl</kbd>+<kbd>-</kbd>                  | Degrade a heading                                 |
| `paragraphTable`           | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> | Insert a table                                    |
| `paragraphCodeFence`       | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd>   | Insert a code block                               |
| `paragraphQuoteBlock`      | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>Q</kbd>   | Insert a quote block                              |
| `paragraphMathBlock`       | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>   | Insert a math block                               |
| `paragraphHtmlBlock`       | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>J/H</kbd> | Insert a HTML block (`J` on macOS, `H` otherwise) |
| `paragraphOrderList`       | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>O</kbd>   | Insert a ordered list                             |
| `paragraphBulletList`      | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd>   | Insert a unordered list                           |
| `paragraphTaskList`        | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>X</kbd>   | Insert a task list                                |
| `paragraphLooseListItem`   | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>L</kbd>   | Convert a list item to a loose list item          |
| `paragraphParagraph`       | <kbd>CmdOrCtrl</kbd>+<kbd>0</kbd>                  | Convert a heading to a paragraph                  |
| `paragraphHorizontalLine`  | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>-</kbd>   | Add a horizontal line                             |
| `paragraphYAMLFrontMatter` | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>Y</kbd>   | Insert a YAML frontmatter block                   |

**Format menu:**

| Id                  | Default                                            | Description                                 |
| ------------------- | -------------------------------------------------- | ------------------------------------------- |
| `formatStrong`      | <kbd>CmdOrCtrl</kbd>+<kbd>B</kbd>                  | Set the font of the selected text to bold   |
| `formatEmphasis`    | <kbd>CmdOrCtrl</kbd>+<kbd>I</kbd>                  | Set the font of the selected text to italic |
| `formatUnderline`   | <kbd>CmdOrCtrl</kbd>+<kbd>U</kbd>                  | Change the selected text to underline       |
| `formatInlineCode`  | <kbd>CmdOrCtrl</kbd>+<kbd>`</kbd>                  | Change the selected text to inline code     |
| `formatInlineMath`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Change the selected text to inline math     |
| `formatStrike`      | <kbd>CmdOrCtrl</kbd>+<kbd>D</kbd>                  | Strike through the selected text            |
| `formatHyperlink`   | <kbd>CmdOrCtrl</kbd>+<kbd>L</kbd>                  | Insert a hyperlink                          |
| `formatImage`       | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> | Insert a image                              |
| `formatClearFormat` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> | Clear the formatting of the selected text   |

**Window menu:**

| Id               | Default                           | Description         |
| ---------------- | --------------------------------- | ------------------- |
| `windowMinimize` | <kbd>CmdOrCtrl</kbd>+<kbd>M</kbd> | Minimize the window |

**View menu:**

| Id                            | Default                                            | Description                                                                          |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `viewToggleFullScreen`        | <kbd>F11</kbd>                                     | Toggle fullscreen mode (or <kbd>Ctrl</kbd>+<kbd>Command</kbd>+<kbd>F</kbd> on macOS) |
| `viewSourceCodeMode`          | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd>   | Switch to source code mode                                                           |
| `viewTypewriterMode`          | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>   | Enable typewriter mode                                                               |
| `viewFocusMode`               | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> | Enable focus mode                                                                    |
| `viewToggleSideBar`           | <kbd>CmdOrCtrl</kbd>+<kbd>J</kbd>                  | Toggle sidebar                                                                       |
| `viewToggleTabBar`            | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>   | Toggle tabbar                                                                        |
| `viewDevToggleDeveloperTools` | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>I</kbd>   | Toggle developer tools (debug mode only)                                             |
| `viewDevReload`               | <kbd>CmdOrCtrl</kbd>+<kbd>R</kbd>                  | Reload window (debug mode only)                                                      |

**Misc**

| Id                  | Default                                              | Description                  |
| ------------------- | ---------------------------------------------------- | ---------------------------- |
| `tabsCycleForward`  | <kbd>CmdOrCtrl</kbd>+<kbd>Tab</kbd>                  | Cycle through tabs           |
| `tabsCycleBackward` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> | Cycle backwards through tabs |
| `tabsSwitchToLeft`  | <kbd>CmdOrCtrl</kbd>+<kbd>PageUp</kbd>               | Switch tab to the left       |
| `tabsSwitchToRight` | <kbd>CmdOrCtrl</kbd>+<kbd>PageDown</kbd>             | Switch tab to the right      |
