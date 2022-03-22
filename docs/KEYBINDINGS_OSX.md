# Key Bindings for macOS

MarkText key bindings for macOS. Please see [general key bindings](KEYBINDINGS.md) for information how to use custom key bindings.

## Available menu key bindings

#### MarkText menu

| Id                 | Default                                           | Description                            |
| ------------------ | ------------------------------------------------- | -------------------------------------- |
| `mt.hide`          | <kbd>Command</kbd>+<kbd>H</kbd>                   | Hide MarkText                          |
| `mt.hide-others`   | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>H</kbd> | Hide all other windows except MarkText |
| `file.preferences` | <kbd>Command</kbd>+<kbd>,</kbd>                   | Open settings window                   |
| `file.quit`        | <kbd>Command</kbd>+<kbd>Q</kbd>                   | Quit MarkText                          |

#### File menu

| Id                  | Default                                          | Description                           |
|:------------------- | ------------------------------------------------ | ------------------------------------- |
| `file.new-window`   | <kbd>Command</kbd>+<kbd>N</kbd>                  | New window                            |
| `file.new-tab`      | <kbd>Command</kbd>+<kbd>T</kbd>                  | New tab                               |
| `file.open-file`    | <kbd>Command</kbd>+<kbd>O</kbd>                  | Open markdown file                    |
| `file.open-folder`  | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> | Open folder                           |
| `file.save`         | <kbd>Command</kbd>+<kbd>S</kbd>                  | Save                                  |
| `file.save-as`      | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Save as...                            |
| `file.move-file`    | -                                                | Move current file to another location |
| `file.rename-file`  | -                                                | Rename current file                   |
| `file.print`        | -                                                | Print current tab                     |
| `file.close-tab`    | <kbd>Command</kbd>+<kbd>W</kbd>                  | Close tab                             |
| `file.close-window` | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd> | Close window                          |

#### Edit menu

| Id                        | Default                                           | Description                                     |
|:------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| `edit.undo`               | <kbd>Command</kbd>+<kbd>Z</kbd>                   | Undo last operation                             |
| `edit.redo`               | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>  | Redo last operation                             |
| `edit.cut`                | <kbd>Command</kbd>+<kbd>X</kbd>                   | Cut selected text                               |
| `edit.copy`               | <kbd>Command</kbd>+<kbd>C</kbd>                   | Copy selected text                              |
| `edit.paste`              | <kbd>Command</kbd>+<kbd>V</kbd>                   | Paste text                                      |
| `edit.copy-as-markdown`   | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>  | Copy selected text as markdown                  |
| `edit.copy-as-html`       | -                                                 | Copy selected text as html                      |
| `edit.paste-as-plaintext` | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>  | Copy selected text as plaintext                 |
| `edit.select-all`         | <kbd>Command</kbd>+<kbd>A</kbd>                   | Select all text of the document                 |
| `edit.duplicate`          | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>P</kbd> | Duplicate the current paragraph                 |
| `edit.create-paragraph`   | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd>  | Create a new paragraph after the current one    |
| `edit.delete-paragraph`   | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>  | Delete current paragraph                        |
| `edit.find`               | <kbd>Command</kbd>+<kbd>F</kbd>                   | Find information in the document                |
| `edit.find-next`          | <kbd>Cmd</kbd>+<kbd>G</kbd>                       | Continue the search and find the next match     |
| `edit.find-previous`      | <kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>G</kbd>      | Continue the search and find the previous match |
| `edit.replace`            | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>F</kbd> | Replace the information with a replacement      |
| `edit.find-in-folder`     | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>  | Find files contain the keyword in opend folder  |
| `edit.screenshot`         | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>A</kbd> | Get the screenshot                              |

#### Paragraph menu

| Id                          | Default                                           | Description                              |
| --------------------------- | ------------------------------------------------- | ---------------------------------------- |
| `paragraph.heading-1`       | <kbd>Command</kbd>+<kbd>1</kbd>                   | Set line as heading 1                    |
| `paragraph.heading-2`       | <kbd>Command</kbd>+<kbd>2</kbd>                   | Set line as heading 2                    |
| `paragraph.heading-3`       | <kbd>Command</kbd>+<kbd>3</kbd>                   | Set line as heading 3                    |
| `paragraph.heading-4`       | <kbd>Command</kbd>+<kbd>4</kbd>                   | Set line as heading 4                    |
| `paragraph.heading-5`       | <kbd>Command</kbd>+<kbd>5</kbd>                   | Set line as heading 5                    |
| `paragraph.heading-6`       | <kbd>Command</kbd>+<kbd>6</kbd>                   | Set line as heading 6                    |
| `paragraph.upgrade-heading` | <kbd>Command</kbd>+<kbd>Plus</kbd>                | Upgrade a heading                        |
| `paragraph.degrade-heading` | <kbd>Command</kbd>+<kbd>-</kbd>                   | Degrade a heading                        |
| `paragraph.table`           | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>  | Insert a table                           |
| `paragraph.code-fence`      | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>C</kbd> | Insert a code block                      |
| `paragraph.quote-block`     | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>Q</kbd> | Insert a quote block                     |
| `paragraph.math-formula`    | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>M</kbd> | Insert a math block                      |
| `paragraph.html-block`      | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>J</kbd> | Insert a HTML block                      |
| `paragraph.order-list`      | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>O</kbd> | Insert a ordered list                    |
| `paragraph.bullet-list`     | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>U</kbd> | Insert a unordered list                  |
| `paragraph.task-list`       | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>X</kbd> | Insert a task list                       |
| `paragraph.loose-list-item` | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>L</kbd> | Convert a list item to a loose list item |
| `paragraph.paragraph`       | <kbd>Command</kbd>+<kbd>0</kbd>                   | Convert a heading to a paragraph         |
| `paragraph.horizontal-line` | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>-</kbd> | Add a horizontal line                    |
| `paragraph.front-matter`    | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>Y</kbd> | Insert a YAML frontmatter block          |

#### Format menu

| Id                    | Default                                          | Description                                     |
| --------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `format.strong`       | <kbd>Command</kbd>+<kbd>B</kbd>                  | Set the font of the selected text to bold       |
| `format.emphasis`     | <kbd>Command</kbd>+<kbd>I</kbd>                  | Set the font of the selected text to italic     |
| `format.underline`    | <kbd>Command</kbd>+<kbd>U</kbd>                  | Change the selected text to underline           |
| `format.superscript`  | -                                                | Change the selected text to underline           |
| `format.subscript`    | -                                                | Change the selected text to underline           |
| `format.highlight`    | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> | Highlight the selected text by <mark>tag</mark> |
| `format.inline-code`  | <kbd>Command</kbd>+<kbd>`</kbd>                  | Change the selected text to inline code         |
| `format.inline-math`  | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Change the selected text to inline math         |
| `format.strike`       | <kbd>Command</kbd>+<kbd>D</kbd>                  | Strike through the selected text                |
| `format.hyperlink`    | <kbd>Command</kbd>+<kbd>L</kbd>                  | Insert a hyperlink                              |
| `format.image`        | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> | Insert a image                                  |
| `format.clear-format` | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> | Clear the formatting of the selected text       |

#### Window menu

| Id                            | Default                                         | Description               |
| ----------------------------- | ----------------------------------------------- | ------------------------- |
| `window.minimize`             | <kbd>Command</kbd>+<kbd>M</kbd>                 | Minimize the window       |
| `window.toggle-always-on-top` | -                                               | Toogle always on top mode |
| `window.zoom-in`              | -                                               | Zoom in                   |
| `window.zoom-out`             | -                                               | Zoom out                  |
| `window.toggle-full-screen`   | <kbd>Ctrl</kbd>+<kbd>Command</kbd>+<kbd>F</kbd> | Toggle fullscreen mode    |

#### View menu

| Id                      | Default                                           | Description                              |
| ----------------------- | ------------------------------------------------- | ---------------------------------------- |
| `view.command-palette`  | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>  | Toggle command palette                   |
| `view.source-code-mode` | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>S</kbd> | Switch to source code mode               |
| `view.typewriter-mode`  | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>T</kbd> | Enable typewriter mode                   |
| `view.focus-mode`       | <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd>  | Enable focus mode                        |
| `view.toggle-sidebar`   | <kbd>Command</kbd>+<kbd>J</kbd>                   | Toggle sidebar                           |
| `view.toggle-tabbar`    | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>B</kbd> | Toggle tabbar                            |
| `view.toggle-toc` .     | <kbd>Command</kbd>+<kbd>K</kbd>                   | Toggle table of contents                 |
| `view.toggle-dev-tools` | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>I</kbd> | Toggle developer tools (debug mode only) |
| `view.dev-reload`       | <kbd>Command</kbd>+<kbd>Option</kbd>+<kbd>R</kbd> | Reload window (debug mode only)          |
| `view.reload-images`    | <kbd>Command</kbd>+<kbd>R</kbd>                   | Reload images                            |

## Available key bindings

#### Tabs

| Id                       | Default                                         | Description                  |
| ------------------------ | ----------------------------------------------- | ---------------------------- |
| `tabs.cycle-forward`     | <kbd>Ctrl</kbd>+<kbd>Tab</kbd>                  | Cycle through tabs           |
| `tabs.cycle-backward`    | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> | Cycle backwards through tabs |
| `tabs.switch-to-left`    | <kbd>Command</kbd>+<kbd>PageUp</kbd>            | Switch tab to the left       |
| `tabs.switch-to-right`   | <kbd>Command</kbd>+<kbd>PageDown</kbd>          | Switch tab to the right      |
| `tabs.switch-to-first`   | <kbd>Ctrl</kbd>+<kbd>1</kbd>                    | Switch tab to the 1st        |
| `tabs.switch-to-second`  | <kbd>Ctrl</kbd>+<kbd>2</kbd>                    | Switch tab to the 2nd        |
| `tabs.switch-to-third`   | <kbd>Ctrl</kbd>+<kbd>3</kbd>                    | Switch tab to the 3rd        |
| `tabs.switch-to-fourth`  | <kbd>Ctrl</kbd>+<kbd>4</kbd>                    | Switch tab to the 4th        |
| `tabs.switch-to-fifth`   | <kbd>Ctrl</kbd>+<kbd>5</kbd>                    | Switch tab to the 5th        |
| `tabs.switch-to-sixth`   | <kbd>Ctrl</kbd>+<kbd>6</kbd>                    | Switch tab to the 6th        |
| `tabs.switch-to-seventh` | <kbd>Ctrl</kbd>+<kbd>7</kbd>                    | Switch tab to the 7th        |
| `tabs.switch-to-eighth`  | <kbd>Ctrl</kbd>+<kbd>8</kbd>                    | Switch tab to the 8th        |
| `tabs.switch-to-ninth`   | <kbd>Ctrl</kbd>+<kbd>9</kbd>                    | Switch tab to the 9th        |
| `tabs.switch-to-tenth`   | <kbd>Ctrl</kbd>+<kbd>0</kbd>                    | Switch tab to the 10th       |

#### Misc

| Id                | Default                         | Description            |
| ----------------- | ------------------------------- | ---------------------- |
| `file.quick-open` | <kbd>Command</kbd>+<kbd>P</kbd> | Open quick open dialog |
