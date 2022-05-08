# Key Bindings for Linux

MarkText key bindings for Linux. Please see [general key bindings](KEYBINDINGS.md) for information how to use custom key bindings.

## Available menu key bindings

#### File menu

| Id                  | Default                                       | Description                           |
|:------------------- | --------------------------------------------- | ------------------------------------- |
| `file.new-window`   | <kbd>Ctrl</kbd>+<kbd>N</kbd>                  | New window                            |
| `file.new-tab`      | <kbd>Ctrl</kbd>+<kbd>T</kbd>                  | New tab                               |
| `file.open-file`    | <kbd>Ctrl</kbd>+<kbd>O</kbd>                  | Open markdown file                    |
| `file.open-folder`  | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> | Open folder                           |
| `file.save`         | <kbd>Ctrl</kbd>+<kbd>S</kbd>                  | Save                                  |
| `file.save-as`      | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Save as...                            |
| `file.move-file`    | -                                             | Move current file to another location |
| `file.rename-file`  | -                                             | Rename current file                   |
| `file.print`        | -                                             | Print current tab                     |
| `file.preferences`  | <kbd>Ctrl</kbd>+<kbd>,</kbd>                  | Open settings window                  |
| `file.close-tab`    | <kbd>Ctrl</kbd>+<kbd>W</kbd>                  | Close tab                             |
| `file.close-window` | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>W</kbd> | Close window                          |
| `file.quit`         | <kbd>Ctrl</kbd>+<kbd>Q</kbd>                  | Quit MarkText                         |

#### Edit menu

| Id                        | Default                                       | Description                                     |
|:------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `edit.undo`               | <kbd>Ctrl</kbd>+<kbd>Z</kbd>                  | Undo last operation                             |
| `edit.redo`               | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Redo last operation                             |
| `edit.cut`                | <kbd>Ctrl</kbd>+<kbd>X</kbd>                  | Cut selected text                               |
| `edit.copy`               | <kbd>Ctrl</kbd>+<kbd>C</kbd>                  | Copy selected text                              |
| `edit.paste`              | <kbd>Ctrl</kbd>+<kbd>V</kbd>                  | Paste text                                      |
| `edit.copy-as-markdown`   | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> | Copy selected text as markdown                  |
| `edit.copy-as-html`       | -                                             | Copy selected text as html                      |
| `edit.paste-as-plaintext` | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | Copy selected text as plaintext                 |
| `edit.select-all`         | <kbd>Ctrl</kbd>+<kbd>A</kbd>                  | Select all text of the document                 |
| `edit.duplicate`          | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> | Duplicate the current paragraph                 |
| `edit.create-paragraph`   | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> | Create a new paragraph after the current one    |
| `edit.delete-paragraph`   | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> | Delete current paragraph                        |
| `edit.find`               | <kbd>Ctrl</kbd>+<kbd>F</kbd>                  | Find information in the document                |
| `edit.find-next`          | <kbd>F3</kbd>                                 | Continue the search and find the next match     |
| `edit.find-previous`      | <kbd>Shift</kbd>+<kbd>F3</kbd>                | Continue the search and find the previous match |
| `edit.replace`            | <kbd>Ctrl</kbd>+<kbd>R</kbd>                  | Replace the information with a replacement      |
| `edit.find-in-folder`     | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> | Find files contain the keyword in opend folder  |

#### Paragraph menu

| Id                          | Default                                       | Description                              |
| --------------------------- | --------------------------------------------- | ---------------------------------------- |
| `paragraph.heading-1`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd> | Set line as heading 1                    |
| `paragraph.heading-2`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>2</kbd> | Set line as heading 2                    |
| `paragraph.heading-3`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>3</kbd> | Set line as heading 3                    |
| `paragraph.heading-4`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd> | Set line as heading 4                    |
| `paragraph.heading-5`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd> | Set line as heading 5                    |
| `paragraph.heading-6`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>6</kbd> | Set line as heading 6                    |
| `paragraph.upgrade-heading` | <kbd>Ctrl</kbd>+<kbd>Plus</kbd>               | Upgrade a heading                        |
| `paragraph.degrade-heading` | <kbd>Ctrl</kbd>+<kbd>-</kbd>                  | Degrade a heading                        |
| `paragraph.table`           | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> | Insert a table                           |
| `paragraph.code-fence`      | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> | Insert a code block                      |
| `paragraph.quote-block`     | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd> | Insert a quote block                     |
| `paragraph.math-formula`    | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>   | Insert a math block                      |
| `paragraph.html-block`      | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>H</kbd>   | Insert a HTML block                      |
| `paragraph.order-list`      | <kbd>Ctrl</kbd>+<kbd>G</kbd>                  | Insert a ordered list                    |
| `paragraph.bullet-list`     | <kbd>Ctrl</kbd>+<kbd>H</kbd>                  | Insert a unordered list                  |
| `paragraph.task-list`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> | Insert a task list                       |
| `paragraph.loose-list-item` | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> | Convert a list item to a loose list item |
| `paragraph.paragraph`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd> | Convert a heading to a paragraph         |
| `paragraph.horizontal-line` | <kbd>Ctrl</kbd>+<kbd>\_</kbd>                 | Add a horizontal line                    |
| `paragraph.front-matter`    | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd> | Insert a YAML frontmatter block          |

#### Format menu

| Id                    | Default                                       | Description                                     |
| --------------------- | --------------------------------------------- | ----------------------------------------------- |
| `format.strong`       | <kbd>Ctrl</kbd>+<kbd>B</kbd>                  | Set the font of the selected text to bold       |
| `format.emphasis`     | <kbd>Ctrl</kbd>+<kbd>I</kbd>                  | Set the font of the selected text to italic     |
| `format.underline`    | <kbd>Ctrl</kbd>+<kbd>U</kbd>                  | Change the selected text to underline           |
| `format.superscript`  | -                                             | Change the selected text to underline           |
| `format.subscript`    | -                                             | Change the selected text to underline           |
| `format.highlight`    | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> | Highlight the selected text by <mark>tag</mark> |
| `format.inline-code`  | <kbd>Ctrl</kbd>+<kbd>Y</kbd>                  | Change the selected text to inline code         |
| `format.inline-math`  | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Change the selected text to inline math         |
| `format.strike`       | <kbd>Ctrl</kbd>+<kbd>D</kbd>                  | Strike through the selected text                |
| `format.hyperlink`    | <kbd>Ctrl</kbd>+<kbd>L</kbd>                  | Insert a hyperlink                              |
| `format.image`        | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> | Insert a image                                  |
| `format.clear-format` | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> | Clear the formatting of the selected text       |

#### Window menu

| Id                            | Default                      | Description               |
| ----------------------------- | ---------------------------- | ------------------------- |
| `window.minimize`             | <kbd>Ctrl</kbd>+<kbd>M</kbd> | Minimize the window       |
| `window.toggle-always-on-top` | -                            | Toogle always on top mode |
| `window.zoom-in`              | -                            | Zoom in                   |
| `window.zoom-out`             | -                            | Zoom out                  |
| `window.toggle-full-screen`   | <kbd>F11</kbd>               | Toggle fullscreen mode    |

#### View menu

| Id                      | Default                                       | Description                              |
| ----------------------- | --------------------------------------------- | ---------------------------------------- |
| `view.command-palette`  | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Toggle command palette                   |
| `view.source-code-mode` | <kbd>Ctrl</kbd>+<kbd>E</kbd>                  | Switch to source code mode               |
| `view.typewriter-mode`  | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> | Enable typewriter mode                   |
| `view.focus-mode`       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd> | Enable focus mode                        |
| `view.toggle-sidebar`   | <kbd>Ctrl</kbd>+<kbd>J</kbd>                  | Toggle sidebar                           |
| `view.toggle-tabbar`    | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> | Toggle tabbar                            |
| `view.toggle-toc` .     | <kbd>Ctrl</kbd>+<kbd>K</kbd>                  | Toggle table of contents                 |
| `view.toggle-dev-tools` | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>I</kbd>   | Toggle developer tools (debug mode only) |
| `view.dev-reload`       | <kbd>Ctrl</kbd>+<kbd>F5</kbd>                 | Reload window (debug mode only)          |
| `view.reload-images`    | <kbd>F5</kbd>                                 | Reload images                            |

## Available key bindings

#### Tabs

| Id                       | Default                                         | Description                  |
| ------------------------ | ----------------------------------------------- | ---------------------------- |
| `tabs.cycle-forward`     | <kbd>Ctrl</kbd>+<kbd>Tab</kbd>                  | Cycle through tabs           |
| `tabs.cycle-backward`    | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> | Cycle backwards through tabs |
| `tabs.switch-to-left`    | <kbd>Ctrl</kbd>+<kbd>PageUp</kbd>               | Switch tab to the left       |
| `tabs.switch-to-right`   | <kbd>Ctrl</kbd>+<kbd>PageDown</kbd>             | Switch tab to the right      |
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

| Id                | Default                      | Description            |
| ----------------- | ---------------------------- | ---------------------- |
| `file.quick-open` | <kbd>Ctrl</kbd>+<kbd>P</kbd> | Show quick open dialog |
