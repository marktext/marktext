# Key Bindings

All key bindings can be overwritten with the `keybindings.json` file. The file is located in the [application data directory](APPLICATION_DATA_DIRECTORY.md). Each entry consists of a `id`/`accelerator` pair in JSON format.

Here is an example:

```json
{
  "file.save": "CmdOrCtrl+Shift+S",
  "file.save-as": "CmdOrCtrl+S"
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

| Id                 | Default                                        | Description                             |
| ------------------ | ---------------------------------------------- | --------------------------------------- |
| `mt.hide`          | <kbd>Command</kbd>+<kbd>H</kbd>                | Hide Mark Text                          |
| `mt.hide-others`   | <kbd>Command</kbd>+<kbd>Alt</kbd>+<kbd>H</kbd> | Hide all other windows except Mark Text |
| `file.preferences` | <kbd>Command</kbd>+<kbd>,</kbd>                | Open settings window                    |
| `file.quit`        | <kbd>Command</kbd>+<kbd>Q</kbd>                | Quit Mark Text                          |

**File menu:**

| Id                  | Default                                            | Description                               |
|:------------------- | -------------------------------------------------- | ----------------------------------------- |
| `file.new-file`     | <kbd>CmdOrCtrl</kbd>+<kbd>N</kbd>                  | New file                                  |
| `file.new-tab`      | <kbd>CmdOrCtrl</kbd>+<kbd>T</kbd>                  | New tab                                   |
| `file.open-file`    | <kbd>CmdOrCtrl</kbd>+<kbd>O</kbd>                  | Open markdown file                        |
| `file.open-folder`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> | Open folder                               |
| `file.save`         | <kbd>CmdOrCtrl</kbd>+<kbd>S</kbd>                  | Save                                      |
| `file.save-as`      | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Save as...                                |
| `file.print`        | -                                                  | Print current tab                         |
| `file.preferences`  | <kbd>Ctrl</kbd>+<kbd>,</kbd>                       | Open settings window (Linux/Windows only) |
| `file.close-tab`    | <kbd>CmdOrCtrl</kbd>+<kbd>W</kbd>                  | Close tab                                 |
| `file.close-window` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd> | Close window                              |
| `file.quit`         | <kbd>CmdOrCtrl</kbd>+<kbd>Q</kbd>                  | Quit Mark Text (Linux/Windows only)       |

**Edit menu:**

| Id                       | Default                                            | Description                                                                                                |
|:------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `edit.undo`              | <kbd>CmdOrCtrl</kbd>+<kbd>Z</kbd>                  | Undo last operation                                                                                        |
| `edit.redo`              | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Redo last operation                                                                                        |
| `edit.cut`               | <kbd>CmdOrCtrl</kbd>+<kbd>X</kbd>                  | Cut selected text                                                                                          |
| `edit.copy`              | <kbd>CmdOrCtrl</kbd>+<kbd>C</kbd>                  | Copy selected text                                                                                         |
| `edit.paste`             | <kbd>CmdOrCtrl</kbd>+<kbd>V</kbd>                  | Paste text                                                                                                 |
| `edit.copy-as-markdown`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> | Copy selected text as markdown                                                                             |
| `edit.copy-as-plaintext` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | Copy selected text as plaintext                                                                            |
| `edit.select-all`        | <kbd>CmdOrCtrl</kbd>+<kbd>A</kbd>                  | Select all text of the document                                                                            |
| `edit.duplicate`         | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd>   | Duplicate the current paragraph                                                                            |
| `edit.create-paragraph`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> | Create a new paragraph after the current one                                                               |
| `edit.delete-paragraph`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> | Delete current paragraph                                                                                   |
| `edit.find`              | <kbd>CmdOrCtrl</kbd>+<kbd>F</kbd>                  | Find information in the document                                                                           |
| `edit.find-next`         | <kbd>F3</kbd>                                      | Continue the search and find the next match (or <kbd>Cmd</kbd>+<kbd>G</kbd> on macOS)                      |
| `edit.find-previous`     | <kbd>Shift</kbd>+<kbd>F3</kbd>                     | Continue the search and find the previous match (or <kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>G</kbd> on macOS) |
| `edit.replace`           | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd>   | Replace the information with a replacement                                                                 |
| `edit.find-in-folder`    | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> | Find files contain the keyword in opend folder                                                             |
| `edit.aidou`             | <kbd>CmdOrCtrl</kbd>+<kbd>/</kbd>                  | Show Aidou dialog                                                                                          |
| `edit.screenshot`        | <kbd>Command</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd>     | Get the screenshot (macOS only)                                                                            |

**Paragraph menu:**

| Id                          | Default                                            | Description                                       |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `paragraph.heading-1`       | <kbd>CmdOrCtrl</kbd>+<kbd>1</kbd>                  | Set line as heading 1                             |
| `paragraph.heading-2`       | <kbd>CmdOrCtrl</kbd>+<kbd>2</kbd>                  | Set line as heading 2                             |
| `paragraph.heading-3`       | <kbd>CmdOrCtrl</kbd>+<kbd>3</kbd>                  | Set line as heading 3                             |
| `paragraph.heading-4`       | <kbd>CmdOrCtrl</kbd>+<kbd>4</kbd>                  | Set line as heading 4                             |
| `paragraph.heading-5`       | <kbd>CmdOrCtrl</kbd>+<kbd>5</kbd>                  | Set line as heading 5                             |
| `paragraph.heading-6`       | <kbd>CmdOrCtrl</kbd>+<kbd>6</kbd>                  | Set line as heading 6                             |
| `paragraph.upgrade-heading` | <kbd>CmdOrCtrl</kbd>+<kbd>=</kbd>                  | Upgrade a heading                                 |
| `paragraph.degrade-heading` | <kbd>CmdOrCtrl</kbd>+<kbd>-</kbd>                  | Degrade a heading                                 |
| `paragraph.table`           | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> | Insert a table                                    |
| `paragraph.code-fence`      | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd>   | Insert a code block                               |
| `paragraph.quote-block`     | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>Q</kbd>   | Insert a quote block                              |
| `paragraph.math-formula`    | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>   | Insert a math block                               |
| `paragraph.html-block`      | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>J/H</kbd> | Insert a HTML block (`J` on macOS, `H` otherwise) |
| `paragraph.order-list`      | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>O</kbd>   | Insert a ordered list                             |
| `paragraph.bullet-list`     | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd>   | Insert a unordered list                           |
| `paragraph.task-list`       | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>X</kbd>   | Insert a task list                                |
| `paragraph.loose-list-item` | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>L</kbd>   | Convert a list item to a loose list item          |
| `paragraph.paragraph`       | <kbd>CmdOrCtrl</kbd>+<kbd>0</kbd>                  | Convert a heading to a paragraph                  |
| `paragraph.horizontal-line` | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>-</kbd>   | Add a horizontal line                             |
| `paragraph.front-matter`    | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>Y</kbd>   | Insert a YAML frontmatter block                   |

**Format menu:**

| Id                    | Default                                            | Description                                 |
| --------------------- | -------------------------------------------------- | ------------------------------------------- |
| `format.strong`       | <kbd>CmdOrCtrl</kbd>+<kbd>B</kbd>                  | Set the font of the selected text to bold   |
| `format.emphasis`     | <kbd>CmdOrCtrl</kbd>+<kbd>I</kbd>                  | Set the font of the selected text to italic |
| `format.underline`    | <kbd>CmdOrCtrl</kbd>+<kbd>U</kbd>                  | Change the selected text to underline       |
| `format.highlight`    | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> | Highlight the selected text by <mark> tag   |
| `format.inline-code`  | <kbd>CmdOrCtrl</kbd>+<kbd>`</kbd>                  | Change the selected text to inline code     |
| `format.inline-math`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Change the selected text to inline math     |
| `format.strike`       | <kbd>CmdOrCtrl</kbd>+<kbd>D</kbd>                  | Strike through the selected text            |
| `format.hyperlink`    | <kbd>CmdOrCtrl</kbd>+<kbd>L</kbd>                  | Insert a hyperlink                          |
| `format.image`        | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> | Insert a image                              |
| `format.clear-format` | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> | Clear the formatting of the selected text   |

**Window menu:**

| Id                          | Default                           | Description                                                                          |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `window.minimize`           | <kbd>CmdOrCtrl</kbd>+<kbd>M</kbd> | Minimize the window                                                                  |
| `window.toggle-full-screen` | <kbd>F11</kbd>                    | Toggle fullscreen mode (or <kbd>Ctrl</kbd>+<kbd>Command</kbd>+<kbd>F</kbd> on macOS) |

**View menu:**

| Id                            | Default                                            | Description                              |
| ----------------------- | -------------------------------------------------- | ---------------------------------------- |
| `view.command-palette`  | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Toggle command palette                   |
| `view.source-code-mode` | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd>   | Switch to source code mode               |
| `view.typewriter-mode`  | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>   | Enable typewriter mode                   |
| `view.focus-mode`       | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd> | Enable focus mode                        |
| `view.toggle-sidebar`   | <kbd>CmdOrCtrl</kbd>+<kbd>J</kbd>                  | Toggle sidebar                           |
| `view.toggle-tabbar`    | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>   | Toggle tabbar                            |
| `view.toggle-toc` .     | <kbd>CmdOrCtrl</kbd>+<kbd>K</kbd>                  | Toggle table of contents                 |
| `view.toggle-dev-tools` | <kbd>CmdOrCtrl</kbd>+<kbd>Alt</kbd>+<kbd>I</kbd>   | Toggle developer tools (debug mode only) |
| `view.dev-reload`       | <kbd>CmdOrCtrl</kbd>+<kbd>R</kbd>                  | Reload window (debug mode only)          |

**Misc**

| Id                       | Default                                              | Description                  |
| ------------------------ | ---------------------------------------------------- | ---------------------------- |
| `tabs.cycle-forward`     | <kbd>CmdOrCtrl</kbd>+<kbd>Tab</kbd>                  | Cycle through tabs           |
| `tabs.cycle-backward`    | <kbd>CmdOrCtrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> | Cycle backwards through tabs |
| `tabs.switch-to-left`    | <kbd>CmdOrCtrl</kbd>+<kbd>PageUp</kbd>               | Switch tab to the left       |
| `tabs.switch-to-right`   | <kbd>CmdOrCtrl</kbd>+<kbd>PageDown</kbd>             | Switch tab to the right      |
| `tabs.switch-to-first`   | <kbd>Alt</kbd>+<kbd>1</kbd>                          | Switch tab to the 1st        |
| `tabs.switch-to-second`  | <kbd>Alt</kbd>+<kbd>2</kbd>                          | Switch tab to the 2nd        |
| `tabs.switch-to-third`   | <kbd>Alt</kbd>+<kbd>3</kbd>                          | Switch tab to the 3rd        |
| `tabs.switch-to-fourth`  | <kbd>Alt</kbd>+<kbd>4</kbd>                          | Switch tab to the 4th        |
| `tabs.switch-to-fifth`   | <kbd>Alt</kbd>+<kbd>5</kbd>                          | Switch tab to the 5th        |
| `tabs.switch-to-sixth`   | <kbd>Alt</kbd>+<kbd>6</kbd>                          | Switch tab to the 6th        |
| `tabs.switch-to-seventh` | <kbd>Alt</kbd>+<kbd>7</kbd>                          | Switch tab to the 7th        |
| `tabs.switch-to-eighth`  | <kbd>Alt</kbd>+<kbd>8</kbd>                          | Switch tab to the 8th        |
| `tabs.switch-to-ninth`   | <kbd>Alt</kbd>+<kbd>9</kbd>                          | Switch tab to the 9th        |
| `tabs.switch-to-tenth`   | <kbd>Alt</kbd>+<kbd>0</kbd>                          | Switch tab to the 10th       |
| `file.quick-open`        | <kbd>CmdOrCtrl</kbd>+<kbd>P</kbd>                    | Open quick open dialog       |
