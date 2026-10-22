# Key Bindings for macOS

MarkText key bindings for macOS. Please see [general key bindings](KEYBINDINGS.md) for information how to use custom key bindings.

Modifier keys use their full macOS names and appear in this order: Control, Option, Shift, Command, followed by the main key.

## Available menu key bindings

#### MarkText menu

| Id                 | Default                                           | Description                            |
| ------------------ | ------------------------------------------------- | -------------------------------------- |
| `mt.hide`          | <kbd>Command</kbd>+<kbd>H</kbd>                   | Hide MarkText                          |
| `mt.hide-others`   | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>H</kbd> | Hide all other windows except MarkText |
| `file.preferences` | <kbd>Command</kbd>+<kbd>,</kbd>                   | Open settings window                   |
| `file.quit`        | <kbd>Command</kbd>+<kbd>Q</kbd>                   | Quit MarkText                          |

#### File menu

| Id                     | Default                                           | Description                           |
| :--------------------- | ------------------------------------------------- | ------------------------------------- |
| `file.new-window`      | <kbd>Command</kbd>+<kbd>N</kbd>                   | New window                            |
| `file.new-tab`         | <kbd>Command</kbd>+<kbd>T</kbd>                   | New tab                               |
| `file.open-file`       | <kbd>Command</kbd>+<kbd>O</kbd>                   | Open markdown file                    |
| `file.open-folder`     | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>O</kbd>  | Open folder                           |
| `file.save`            | <kbd>Command</kbd>+<kbd>S</kbd>                   | Save                                  |
| `file.save-as`         | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>S</kbd>  | Save as...                            |
| `file.export-file.pdf` | <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>E</kbd> | Export file as PDF                    |
| `file.move-file`       | -                                                 | Move current file to another location |
| `file.rename-file`     | -                                                 | Rename current file                   |
| `file.print`           | -                                                 | Print current tab                     |
| `file.close-tab`       | <kbd>Command</kbd>+<kbd>W</kbd>                   | Close tab                             |
| `file.close-window`    | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>W</kbd>  | Close window                          |

#### Edit menu

| Id                        | Default                                           | Description                                     |
| :------------------------ | ------------------------------------------------- | ----------------------------------------------- |
| `edit.undo`               | <kbd>Command</kbd>+<kbd>Z</kbd>                   | Undo last operation                             |
| `edit.redo`               | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>Z</kbd>  | Redo last operation                             |
| `edit.cut`                | <kbd>Command</kbd>+<kbd>X</kbd>                   | Cut selected text                               |
| `edit.copy`               | <kbd>Command</kbd>+<kbd>C</kbd>                   | Copy selected text                              |
| `edit.paste`              | <kbd>Command</kbd>+<kbd>V</kbd>                   | Paste text                                      |
| `edit.copy-as-rich`       | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>C</kbd>  | Copy selected text as markdown                  |
| `edit.copy-as-html`       | -                                                 | Copy selected text as html                      |
| `edit.paste-as-plaintext` | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>V</kbd>  | Paste clipboard contents as plain text          |
| `edit.select-all`         | <kbd>Command</kbd>+<kbd>A</kbd>                   | Select all text of the document                 |
| `edit.duplicate`          | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>D</kbd> | Duplicate the current paragraph                 |
| `edit.create-paragraph`   | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>N</kbd>  | Create a new paragraph after the current one    |
| `edit.delete-paragraph`   | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>D</kbd>  | Delete current paragraph                        |
| `edit.find`               | <kbd>Command</kbd>+<kbd>F</kbd>                   | Find information in the document                |
| `edit.find-next`          | <kbd>Command</kbd>+<kbd>G</kbd>                   | Continue the search and find the next match     |
| `edit.find-previous`      | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>G</kbd>  | Continue the search and find the previous match |
| `edit.replace`            | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>F</kbd> | Replace the information with a replacement      |
| `edit.find-in-folder`     | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>F</kbd>  | Find files contain the keyword in opend folder  |
| `edit.screenshot`         | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>A</kbd> | Get the screenshot                              |

#### Paragraph menu

| Id                          | Default                                           | Description                              |
| --------------------------- | ------------------------------------------------- | ---------------------------------------- |
| `paragraph.heading-1`       | <kbd>Command</kbd>+<kbd>1</kbd>                   | Set line as heading 1                    |
| `paragraph.heading-2`       | <kbd>Command</kbd>+<kbd>2</kbd>                   | Set line as heading 2                    |
| `paragraph.heading-3`       | <kbd>Command</kbd>+<kbd>3</kbd>                   | Set line as heading 3                    |
| `paragraph.heading-4`       | <kbd>Command</kbd>+<kbd>4</kbd>                   | Set line as heading 4                    |
| `paragraph.heading-5`       | <kbd>Command</kbd>+<kbd>5</kbd>                   | Set line as heading 5                    |
| `paragraph.heading-6`       | <kbd>Command</kbd>+<kbd>6</kbd>                   | Set line as heading 6                    |
| `paragraph.upgrade-heading` | <kbd>Command</kbd>+<kbd>=</kbd>                   | Upgrade a heading                        |
| `paragraph.degrade-heading` | <kbd>Command</kbd>+<kbd>-</kbd>                   | Degrade a heading                        |
| `paragraph.table`           | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>T</kbd>  | Insert a table                           |
| `paragraph.code-fence`      | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>C</kbd> | Insert a code block                      |
| `paragraph.quote-block`     | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>Q</kbd> | Insert a quote block                     |
| `paragraph.math-formula`    | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>M</kbd> | Insert a math block                      |
| `paragraph.html-block`      | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>J</kbd> | Insert a HTML block                      |
| `paragraph.order-list`      | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>O</kbd> | Insert a ordered list                    |
| `paragraph.bullet-list`     | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>U</kbd> | Insert a unordered list                  |
| `paragraph.task-list`       | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>X</kbd> | Insert a task list                       |
| `paragraph.loose-list-item` | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>L</kbd> | Convert a list item to a loose list item |
| `paragraph.paragraph`       | <kbd>Command</kbd>+<kbd>0</kbd>                   | Convert a heading to a paragraph         |
| `paragraph.horizontal-line` | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>-</kbd> | Add a horizontal line                    |
| `paragraph.front-matter`    | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>Y</kbd> | Insert a YAML frontmatter block          |

#### Format menu

| Id                    | Default                                          | Description                                     |
| --------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `format.strong`       | <kbd>Command</kbd>+<kbd>B</kbd>                  | Set the font of the selected text to bold       |
| `format.emphasis`     | <kbd>Command</kbd>+<kbd>I</kbd>                  | Set the font of the selected text to italic     |
| `format.underline`    | <kbd>Command</kbd>+<kbd>U</kbd>                  | Change the selected text to underline           |
| `format.superscript`  | -                                                | Set the selected text as superscript            |
| `format.subscript`    | -                                                | Set the selected text as subscript              |
| `format.highlight`    | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>H</kbd> | Highlight the selected text by <mark>tag</mark> |
| `format.inline-code`  | <kbd>Command</kbd>+<kbd>`</kbd>                  | Change the selected text to inline code         |
| `format.inline-math`  | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>M</kbd> | Change the selected text to inline math         |
| `format.strike`       | <kbd>Command</kbd>+<kbd>D</kbd>                  | Strike through the selected text                |
| `format.hyperlink`    | <kbd>Command</kbd>+<kbd>L</kbd>                  | Insert a hyperlink                              |
| `format.image`        | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>I</kbd> | Insert a image                                  |
| `format.clear-format` | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>R</kbd> | Clear the formatting of the selected text       |

#### Window menu

| Id                            | Default                                            | Description               |
| ----------------------------- | -------------------------------------------------- | ------------------------- |
| `window.minimize`             | <kbd>Command</kbd>+<kbd>M</kbd>                    | Minimize the window       |
| `window.toggle-always-on-top` | -                                                  | Toggle always on top mode |
| `window.zoomIn`               | -                                                  | Zoom in                   |
| `window.resetZoom`            | -                                                  | Reset zoom                |
| `window.zoomOut`              | -                                                  | Zoom out                  |
| `window.toggle-full-screen`   | <kbd>Control</kbd>+<kbd>Command</kbd>+<kbd>F</kbd> | Toggle fullscreen mode    |

#### View menu

| Id                      | Default                                            | Description                              |
| ----------------------- | -------------------------------------------------- | ---------------------------------------- |
| `view.command-palette`  | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>P</kbd>   | Toggle command palette                   |
| `view.read-only-mode`   | <kbd>Control</kbd>+<kbd>Command</kbd>+<kbd>R</kbd> | Toggle Reading Mode for the current tab  |
| `view.source-code-mode` | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>S</kbd>  | Switch to source code mode               |
| `view.typewriter-mode`  | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>T</kbd>  | Enable typewriter mode                   |
| `view.focus-mode`       | <kbd>Shift</kbd>+<kbd>Command</kbd>+<kbd>J</kbd>   | Enable focus mode                        |
| `view.toggle-sidebar`   | <kbd>Command</kbd>+<kbd>J</kbd>                    | Toggle sidebar                           |
| `view.toggle-tabbar`    | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>B</kbd>  | Toggle tabbar                            |
| `view.toggle-toc`       | <kbd>Command</kbd>+<kbd>K</kbd>                    | Toggle table of contents                 |
| `view.toggle-dev-tools` | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>I</kbd>  | Toggle developer tools (debug mode only) |
| `view.dev-reload`       | <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>R</kbd>  | Reload window (debug mode only)          |
| `view.reload-images`    | <kbd>Command</kbd>+<kbd>R</kbd>                    | Reload images                            |

## Available key bindings

#### Tabs

| Id                     | Default                                            | Description      |
| ---------------------- | -------------------------------------------------- | ---------------- |
| `tabs.cycleForward`    | <kbd>Control</kbd>+<kbd>Tab</kbd>                  | Next tab         |
| `tabs.cycleBackward`   | <kbd>Control</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> | Previous tab     |
| `tabs.switchToLeft`    | <kbd>Command</kbd>+<kbd>PageUp</kbd>               | Tab to the left  |
| `tabs.switchToRight`   | <kbd>Command</kbd>+<kbd>PageDown</kbd>             | Tab to the right |
| `tabs.switchToFirst`   | <kbd>Control</kbd>+<kbd>1</kbd>                    | Switch to tab 1  |
| `tabs.switchToSecond`  | <kbd>Control</kbd>+<kbd>2</kbd>                    | Switch to tab 2  |
| `tabs.switchToThird`   | <kbd>Control</kbd>+<kbd>3</kbd>                    | Switch to tab 3  |
| `tabs.switchToFourth`  | <kbd>Control</kbd>+<kbd>4</kbd>                    | Switch to tab 4  |
| `tabs.switchToFifth`   | <kbd>Control</kbd>+<kbd>5</kbd>                    | Switch to tab 5  |
| `tabs.switchToSixth`   | <kbd>Control</kbd>+<kbd>6</kbd>                    | Switch to tab 6  |
| `tabs.switchToSeventh` | <kbd>Control</kbd>+<kbd>7</kbd>                    | Switch to tab 7  |
| `tabs.switchToEighth`  | <kbd>Control</kbd>+<kbd>8</kbd>                    | Switch to tab 8  |
| `tabs.switchToNinth`   | <kbd>Control</kbd>+<kbd>9</kbd>                    | Switch to tab 9  |
| `tabs.switchToTenth`   | <kbd>Control</kbd>+<kbd>0</kbd>                    | Switch to tab 10 |

#### Misc

| Id                | Default                         | Description            |
| ----------------- | ------------------------------- | ---------------------- |
| `file.quick-open` | <kbd>Command</kbd>+<kbd>P</kbd> | Open quick open dialog |
