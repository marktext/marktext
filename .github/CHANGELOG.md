### [unreleased]

This update **fixes a XSS security vulnerability** when exporting a document.

**:warning:Breaking Changes:**

- Minimum supported macOS version is 10.10 (Yosemite)
- Remove `lightColor` and `darkColor` in user preference (color change in view menu does not work any, and will remove when add custom theme.)
- We recommand user not use block element in paragraph, please use block element in html block.

*Not Recommand*

```md
foo<section>bar</section>zar
```

*Recommand*

```md
<div>
  foo
  <section>
    bar
  </section>
  zar
</div>
```

**:cactus:Feature**

- Improve exception and error handling
- Support for user-defined titlebar style
- Support to open files in a new tab instead a new window (#574)
- Add inline math to format menu and float box (#649)
- GTK integration (#690)
- Add recently used directories to recently opened files (#643)
- Making images display smaller (#659)
- Open local markdown file when you click on it in another tab (#359)
- Clicking a link should open it in the browser (#425)
- Support maxOS `dark mode`, when you change `mode dark or light` in system, Mark Text will change its theme.
- Add new themes: Ulysses Light, Graphite Light, Material Dark and One Dark.
- Watch file changed in tabs and show a notice(autoSave is `false`) or update the file(autoSave is `true`)
- Support input inline Ruby charactors as raw html (#257)
- Added unsaved tab indicator
- Add front Menu by click the front menu icon (#875)

**:butterfly:Optimization**

- Respect existing image title if no source is specified (#562)
- Separate font and font size for code blocks and source code mode (#373, #467)
- Opened files and opened directories/files can now be folded (#475, #602)
- You can now hide the quick insert hint (#621)
- Adjusted quote inline math color (#592)
- Fix inline math text align (#593)
- Added MIME type to Linux desktop file
- What is the character and number of left-top? (#666)
- Inserting Codeblock should automatically set cursor into language field (#684)
- Upstream: prismjs highlighting issues (#709)
- Improvements for "Open Recent" (#616)
- Make table of contents in sidebar collapsible (#404)
- Hide titlebar control buttons in custom titlebar style
- Corrected hamburger menu offset
- Optimization of inline html displa, now you can nest other inline syntax in inline html(#849)
- Use CmdOrCtrl + C/V to copy rich text to `word`(Windows) or `page`(macOS) (#885)

**:beetle:Bug fix**

- Fix dark preview box background color (#587)
- Use white PDF background color (#583)
- Fix document printing
- Restore default Mark Text style after exporting/printing
- Prevent enter key as language identifier (#569)
- Allow pasting text into the code block language text-box (#553)
- Fixed a crash when opening a directory with an unknown file extension
- Fixed an issue with `Save all` and `Delete all` buttons in the side bar
- Fixed exception when exporting a code block (#591)
- Fixed recommended filename
- Fixed multiple sidebar issues
- Fixed wrong font and theme when opening a directory (#696)
- Switching to another tab will now work in source-code mode too (#606)
- Fixed forced line break in a list is display wrong. (#672)
- Relative images are broken after exporting (#678)
- Unable to paste text in table cell(#670)
- Wrong padding when copy loose list to tight list(#706)
- Display Autocompletion in inline math(#673)
- Unable to export a document when the language identifier is undefined(#591)
- Incorrect rendering of pipe in code block within table(#660)
- Using extended code identifiers breaks code blocks (#697)
- Renderer exception when pasting text with new line(s) into a heading (#671)
- Fatal error when a directory is removed (#661)
- Wrong font and theme when opening file/directory (#696)
- Automatically wrap code block lines when printing or exporting as PDF (#710)
- Can't change tab in source code mode (#606)
- Minor checkbox list bug (#576)
- A hard line break followed by a list doesn't work in preview mode (#708)
- Ctrl + X (#622)
- Exception when removing a code block in a specific case (#568)
- List items are always copied as loose list (#705)
- Runtime bug when insert order list by quick insert (#760)
- Image inside HTML is not loaded (#754)
- No space around copy-pasted links (#752)
- Relative image reference in HTML is broken (#782)
- Selection cannot be cancelled by up / down keys (#630)
- Cannot create table while in typewriter mode (#679)
- Emojis don't work properly (#769)
- Fixed multiple parser issues (update marked.js to v0.6.1)
- Fixed nest math block issue (#586)
- Can't make a comma-separated list of dollar ($) amounts (#740)
- Fixed [...] is displayed in gray and orange (#432)
- Fixed an issue that relative images are not loaded after closing a tab
- Add symbolic link support
- Fixed bug when combine pre list and next list into one when inline update #707
- Fix renderer error when selection in sidebar (#625)
- Fixed list parse error [more info](https://github.com/marktext/marktext/issues/831#issuecomment-477719256)
- Fixed source code mode tab switching
- Fixed source code mode to preview switching
- Mark Text didn't remove highlight when I delete the markdown symbol like * or `. (#893)
- After delete ``` at the beginning to paragraph by backspace, then type other text foo, the color will be strange, if you type 1. bar. error happened. (#892)
- Fix highlight error in code block (#545 #890)

### 0.13.65

**:butterfly:Optimization**

- Show tab bar when opening a new tab
- Use default bold (`CmdOrCtrl+B`) and italics (`CmdOrCtrl+I`) key binding (#346)
- Don't show save dialog for an empty document (#422)
- Sidebar and tab redesign
- Calculate artifact checksum after uploading (#566)
- Use `CmdOrCltr+Enter` to add table row bellow.

**:beetle:Bug fix**

- fix: #451 empty list item error
- fix: #522 paste bug when paste into empty line
- fix: #521
- fix: #534
- fix: #535 Application menu is not updated when switching windows
- fix #216 and #311 key binding issues on Linux and Windows
- fix #546 paste issue in table
- fix: Blank document was always encoded as `LF`
- fix: #541

### 0.13.50

**:cactus:Feature**

- (#421) Add experiment function RTL support (#439)
- feat: #487 Show filename while hovering over marktext file on dock
- feat: export files in file menu
- feat: drag to import
- feat: quick insert paragraph
- feat: inline format float box
- feat: import files: TEX\ WIKI\ DOCX etc
- feat: portable Windows application (#369)
- feat: support search and replace in code block
- feat: support GFM diff in code block
- feat: suppoet quick input html in html block, eg: input div, press `tab` will auto input \<div\><\/div>

**:butterfly:Optimization**

- Update linux documentation and remove snappy build (#381)
- Update Japanese Document Latest Release Update.
- add alfred workflow into readme (#394)
- French translation of README.md (#398)
- optimization: add gauss blur effect when open a modal (#407)
- Improvement math preview styles (#419) (#424)
- Turkish language translation for README.md (#427)
- Improvement: #414 Add functional bracket auto-completion (#428)
- feature: vscode debug config support (#446)
- Exclude hard-line-break from printing. (#454)
- export styled HTML with heading id's (#460)
- opti: #485 Open Project command. Maybe rename to Open folder
- Added Spanish translation (#499)
- feat: add tooltip to editor
- opti: #429 Support DataURL images (#480)
- opti: rewrite image picker
- opti: notify the user about the deletion url of the uploaded image
- rewrite code block, html block, math block, front matter

**:beetle:Bug fix**

- fix download url in docs. (#379)
- fix: #371 wrong paste behavior
- fix: #380 wrong action of list shortcut
- bugfix: inline math style error in list item (#405)
- bugfix: #406 relative image path not display (#411)
- bugfix: #400 (#410)
- fix: wrong mouse click position #416 (#423)
- fix: title bar resizing in north direction (#455)
- fix: #441 #451 empty list item has no paragraph (#456)
- fix: task list item centering (#457)
- fix: #402 table of contents sidebar scroll bug (#461)
- fix: recommend filename can be empty (#462)
- Formatting cleanups (#463)
- Arrow key up/down navigation in a table (#470)
- fix: #481 add missing dot to parser markdown files only (#483)
- fix: YAML frontmatter duplicates a new line on each opening of the file #494
- fix(#431): broken math expression
- fix(#434): no need to auto pair in math block
- fix(#450) style error when render inline math
- fix: #399 #476 #490 math render with style miss
- fix: #393

### 0.12.25

**:cactus:Feature**

**:butterfly:Optimization**

- optimization: #361 easy sidebar toggle (#368)

**:beetle:Bug fix**

- fix: #348 do not export tabs and sidebar when export PDF
- bugfix: #360 No page breaks in PDF export
- bugfix: #167 #357 #344
- fix: #343 Inconsistent color scheme in source code mode (#363)

### 0.12.20

**:cactus:Feature**

- feature: file list in side bar: tree view and list view. #71
- feature: search in project in side bar.
- feature: table of content of the current edit file.
- feature: copy table from Number(MacOs App)
- feature: new file, new directory, copy, cut, paste, rename, remove to trash in side bar.
- feature: save all the opened files and close all the opened files.
- feature: Support reference link. #297
- feature: Support reference image.
- feature: copy table in context menu (#331)
- feature: feedback via twitter
- feature: can use delete key now, #301

**:butterfly:Optimization**

- optimization: rewirte table picker use popper
- optimization: add animation to checkbox when clicked
- Bundle desktop files and resources (#336)
- Rewrite notification (#337)

**:beetle:Bug fix**

- fix: can not copy full link #312
- fix: can not export table markdown #313
- bugfix: #328 source code mode shortcut not work (#332)
- bugfix: copy paste title delete text #321 (#333)
- fix: text cursor skip lines in paragraph #330

### 0.11.42

**:cactus:Feature**

- feature: add editorFont setting in user preference. (#175) - Anderson
- feature: line break, support event and import and export markdown - Jocs
- feature: unindent list item - Jocs
- feature: Support for CRLF and LF line endings
- feature: Click filename to `rename` or `save` in title bar(**macOS ONLY**).
- feature: Support YAML Front Matter
- feature: Support `setext` heading but the default heading style is `atx`
- feature: User list item marker setting in preference file.
- feature: Select text from selected table (cell) only if you press Ctrl+A
- feature: Support Multiple lines math #242
- feature: Support context menu: `copy`, `cut`, `paste`, `insert paragraph`, `edit table rows and columns` #169

**:butterfly:Optimization**

- ATX headings strictly follow the GFM Spec #177 - Jocs
- no need to auto pair when * is to open a list item - Jocs
- optimization: add sticky to block html tag - Jocs
- Add Japanese readme (#191) - Neetshin
- Disable update menu for snap and not supported packages (#196) - Felix Häusler
- Check whether window size is larger than screen size (#192) - Felix Häusler
- Add fallback editor font family (#209) - Felix Häusler
- Use `partialRender` instead of `render` when render the file, this will speed up the render phase.
- optimization: reduce the width of scroll bar in float box.
- Smaller scrollbars and hover color (#245)
- update electron to v2.0.2 [SECURITY]
- Add support for tab indentation (#125)

**:beetle:Bug fix**

- fix: #94 history error
- fix: #213 style error when render math
- fix: the error 'Cannot read property 'forEach' of undefined' (#178) - 鸿则
- fix: Change Source Code Mode Accelerator (#180) - Mice
- fix: #153 Double space between tasklist checkbox and text - Jocs
- fix: #198 navigation in table
- fix: #190 Delete user settings on uninstall (NSIS) (#203) - Felix Häusler
- fix: html block style error when active - Jocs
- fix: PDF Export is contacted by LaTeX hightlight #194
- fix: Table inside a list is not supported #202
- fix: Cannot open file when window is started maximized or in full-screen mode #217
- fix: #243 (#260)
- fix: #232 (#259)
- fix: #251
- fix: #248 dark background disappears when export PDF (#252)
- fix: #231 cut not work in code block
- fix: #274 can not selection codes in code block when the cursor is outside of code block.
- fix: frameless window drag
- fix: #79 detect image type by mime type

### 0.10.21

**:notebook_with_decorative_cover:​Note**

You need uninstall the old version of Mark Text before install version 0.10.21, because we changed the AppId when build.

**:cactus:Feature**

- block html #110
- raw html #110
- you can now indent list items with tab key
- auto pair `markdown syntax`, `quote`, `bracket`
- ability to insert an empty line between elements #33
- recently used documents on Linux and Windows (#139)

**:butterfly:Optimization**

- Update third-party packages to the latest version
- Use HTTPS instead of HTTP (#158)
- Add Polish readme (#154)
- Optimization: sanitize html to avoid XSS attack #127 (#132)

**:beetle:Bug fix**

- fix: update outdated preferences on startup #100
- fix: reset modification indicator after successfully saved changes
- fix: disable tab focus
- fix: strong and em parse error #116
- fix horizontal line style #120
- fix user preferences #122
- fix: style error when export PDF/HTML with hr @Jocs
- fix UTF-8 BOM encoding
- fix: #162 support php language
- fix: #152 emoji error
- fix: #149 can not delete code block content

### 0.9.25

**:cactus:Feature**

- display and inline math support #36
- Image path auto complement #96
- Feature: Toggle loose list item in paragraph menu #103
- Add loose and tight list compatibility #74

**:butterfly:Optimization**

- adjust lineHeight and fontSize in typewriter mode
- optimization of output unstylish html @fxha
-  Use 'fuzzaldrin' to filter language when insert code block
- Optimization: Obey the GFM and optimization of thematic break update. - Jocs
- Optimization: More than six # characters is not a heading So we don't need to highlight `#` - Jocs
- Optimization: A closing sequence of # characters is optional when write ATX heading - Jocs
- Optimization: watch image path change and rebuild the cache - Jocs
- Update: update vue and snabbdom to the latest version - Jocs
- Optimization: Use 'fuzzaldrin' to filter language when insert code block - Jocs
- Update travis-ci (#92) - Felix Häusler

**:beetle:Bug fix**

- fix: #81
- fix: #55
- fix: #63
- fix: crash on first launch due missing directory (#78, #90, #93)
- fix: #101
- Bugfix: #112 - Jocs
- Bugfix: can not empty the content in source code mode #105 - Jocs
- Bugfix: #107
- fix: #88 (#108) - Felix Häusler
- Allow exiting full screen with maximize button on windows (#109) - Felix Häusler
- Bugfix: Caret can not move right when it's at the end of math format. #101 - Jocs


### 0.8.12

**:cactus:Feature**

- Add user preferences in `Mark Text menu`, the shoutcut is `CmdorCtrl + ,`, you can set the default `theme` and `autoSave`.
- Add `autoSave` to `file menu`, the default value is in `preferences.md` which you can open in `Mark Text menu`. #45
- Add drag and drop to open Markdown file with Mark Text @fxha
- User setting: fontSize, lineHeight, color in realtime mode.
- Move your file to other folder @DXXL
- Rename filename

**:butterfly:Optimization**

- Theme can be saved in user preferences now #16
- Custom About dialog @fxha

**:beetle:Bug fix**

- fix: prevent open image or file directly when drag and drop over Mark Text #42
- fix: set theme to all the open window not just the active one.
- fix: set correct application menu offset on windows #44
- fix: Missing preferences menu in Linux and Windows. @fxha

### 0.7.17

**Features**

1. Check for updates..., and auto update when update available.(Still need signature...:cry:)

2. Insert Image: ( In edit menu )

   - absolute path

   - relative path

   - Upload Image to cloud

3. Add file icons to languages when create code block or change language in code block.

**Bug fix**

1. It's hard to focus the input in code fence.

2. When input the language in code block, click the language item will not cause hide the float box.

3. other bugs in code block.

4. Windows user can not use open with feature.

5. The menu disapear in Linux sysyem.

6. Fix the bug that the language highlight disapear when open markdown file with code block

7. remove the symbol in output styled html. #41

8. escape the raw Markdown when open the markdown file. #37

**Optimization**

1. allow user to change install directory on windows.

2. Show notification when output HTML and PDF successfully.

3. update css-tree to latest version.

4. Add lineWrapping is true to codeMirror config

### 0.6.14

**Features**

- Add **dark** theme and **light** theme in both realtime preview mode and source code mode.

- Insert `doutu` into the document, use CMD + / to open the panel.

**Optimization**

- Customize the scroll bar background color and thumb color.

- Add collection of doutu.

- Add History search word of doutu.

**Bug fix**

- Fix bug when search key in code block will cause the search input lose focus.

- Fix the bug the editor will lose cursor after input Chinese.

### 0.5.2

**Features**

- Add Typewriter Mode, The current line will always in the center of the document. If you change the current line, it will be auto scroll to the new line.

- Add Focus Mode, the current paragraph's will be focused.

- Add Dark theme, Light theme.

**Optimization**

- Optimize the display of path name and file name in title bar.

- Eidtor will auto scroll to the highlight word when click Find Prev or Find Next.

**Bug fix**

- Set back the cursor when mode change between source code mode and normal mode

### 0.4.0

**Feature**

- Search value in document, Use **FIND PREV** and **FIND NEXT** to selection previous one or next one.

  Add animation of highlight word.

  Auto focus the search input when open search panel.

  close the search panel will auto selection the last highlight word by ESC button.

- Replace value

  Replace All

  Replace one and auto highlight the next word.

**Bug fix**

- fix the bug that click at the edge of code block will caused the code block does not be focused.

**Optimization**

- Optimize the display of word count in title bar. we also delete the background color of title bar to make it more concise.

- Customize the style of checkbox in Task List Item.

- Change the display of Insert Table dialog.

### 0.3.0

**Features**

- Export PDF

**Bug fix**

- fix the bug that editor can only print the first page.
