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

| Id             | Description                             |
| -------------- | --------------------------------------- |
| `mtHide`       | Hide Mark Text                          |
| `mtHideOthers` | Hide all other windows except Mark Text |

**Edit menu:**

| Id                    | Description                                     |
|:--------------------- | ----------------------------------------------- |
| `editUndo`            | Undo last operation                             |
| `editRedo`            | Redo last operation                             |
| `editCut`             | Cut selected text                               |
| `editCopy`            | Copy selected text                              |
| `editPaste`           | Paste text                                      |
| `editCopyAsMarkdown`  | Copy selected text as markdown                  |
| `editCopyAsPlaintext` | Copy selected text as plaintext                 |
| `editSelectAll`       | Select all text of the document                 |
| `editDuplicate`       | Duplicate the current paragraph                 |
| `editCreateParagraph` | Create a new paragraph after the current one    |
| `editDeleteParagraph` | Delete current paragraph                        |
| `editFind`            | Find information in the document                |
| `editFindNext`        | Continue the search and find the next match     |
| `editFindPrevious`    | Continue the search and find the previous match |
| `editReplace`         | Replace the information with a replacement      |
| `editAidou`           | Show Aidou dialog                               |

**Paragraph menu:**

| Id                         | Description                              |
| -------------------------- | ---------------------------------------- |
| `paragraphHeading1`        | Set line as heading 1                    |
| `paragraphHeading2`        | Set line as heading 2                    |
| `paragraphHeading3`        | Set line as heading 3                    |
| `paragraphHeading4`        | Set line as heading 4                    |
| `paragraphHeading5`        | Set line as heading 5                    |
| `paragraphHeading6`        | Set line as heading 6                    |
| `paragraphUpgradeHeading`  | Upgrade a heading                        |
| `paragraphDegradeHeading`  | Degrade a heading                        |
| `paragraphTable`           | Insert a table                           |
| `paragraphCodeFence`       | Insert a code block                      |
| `paragraphQuoteBlock`      | Insert a quote block                     |
| `paragraphMathBlock`       | Insert a math block                      |
| `paragraphHtmlBlock`       | Insert a HTML block                      |
| `paragraphOrderList`       | Insert a ordered list                    |
| `paragraphBulletList`      | Insert a unordered list                  |
| `paragraphTaskList`        | Insert a task list                       |
| `paragraphLooseListItem`   | Convert a list item to a loose list item |
| `paragraphParagraph`       | Convert a heading to a paragraph          |
| `paragraphHorizontalLine`  | Add a horizontal line                    |
| `paragraphYAMLFrontMatter` | Insert a YAML frontmatter block          |

**Format menu:**

| Id                  | Description                                 |
| ------------------- | ------------------------------------------- |
| `formatStrong`      | Set the font of the selected text to bold   |
| `formatEmphasis`    | Set the font of the selected text to italic |
| `formatInlineCode`  | Change the selected text to inline code     |
| `formatStrike`      | Strike through the selected text            |
| `formatHyperlink`   | Insert a hyperlink                          |
| `formatImage`       | Insert a image                              |
| `formatClearFormat` | Clear the formatting of the selected text   |

**Window menu:**

| Id                  | Description         |
| ------------------- | ------------------- |
| `windowMinimize`    | Minimize the window |
| `windowCloseWindow` | Close the window    |

**View menu:**

| Id                            | Description                              |
| ----------------------------- | ---------------------------------------- |
| `viewToggleFullScreen`        | Toggle fullscreen mode                   |
| `viewChangeFont`              | Open font dialog                         |
| `viewSourceCodeMode`          | Switch to source code mode               |
| `viewTypewriterMode`          | Enable typewriter mode                   |
| `viewFocusMode`               | Enable focus mode                        |
| `viewToggleSideBar`           | Toggle sidebar                           |
| `viewToggleTabBar`            | Toggle tabbar                            |
| `viewDevToggleDeveloperTools` | Toggle developer tools (debug mode only) |
| `viewDevReload`               | Reload window (debug mode only)          |

