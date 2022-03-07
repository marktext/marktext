## 0.17.1

- Added experimental native support for Apple M1 (see #2983 if you have issues).

**:butterfly:Optimization**

- Improved behavior of inline markdown character auto pairing.

**:beetle:Bug fix**

- Fixed crash at startup when a key binding was unset.
- Fixed paste handler for images.
- Fixed deletion behavior of a selected image.

## 0.17.0

Mark Text is now MarkText! We'd like to thank all contributors and users that have been using MarkText and worked on this release.

**:warning:Breaking Changes:**

- Changed multiple default key bindings.
- Changed key binding handling: all key bindings are now mapped to the corresponding US key bindings. E.g. `Ctrl+Shift+7` on a German keyboard will now produce `Ctrl+/` because `Shift+7` is equivalent to `/`.
- Image uploader: SM.MS was removed, GitHub uploader is deprecated and will be replaced by PicGo in our next release.

**:cactus:Feature**

- Added support for image path variables.
- Added command-line image uploader and reworked settings.
- Added regular expression group replacement to searcher.
- Added PlantUML diagram support.
- Added support for chemical equations in math mode.
- Added automatic call to search for find-in-file when the pane is opened.
- Open local non-markdown files in default application.
- Added support to use all menu entries for key binding.
- Added window zoom via default mouse event.
- Zoom level is now restored on startup.
- Added PicGo to upload images.
- Ability to invalidate image cache on demand.
- Added settings page to configure key bindings.

**:butterfly:Optimization**

- Improved inline markdown autocomplete support.
- Improved preference design.
- Relative image paths are now converted to forward slashes on Windows for better compatibility.
- Center sidebar image when no search results are available.
- Updated emoji database.
- Improved sidebar file handling UX by providing more error messages.

**:beetle:Bug fix**

- Fixed an issue with code block cursor positioning.
- Fixed invalid mermaid diagram representation when exporting as PDF.
- Fixed rendering issue with LaTeX formulas
- Fixed an issue that may caused editor flickering while pressing `Enter`.
- Fixed Table of Contents sidebar display issue.
- Fixed editor overflow when the sidbar is open.
- Fixed a crash that occurred due to a bug in the markdown footnote parser.
- Fixed issue with shortcuts that included `Alt`.
- Fixed multiple issues on non-US keyboards.
- Normalized source-code editor cursor.
- Fixed preference scaling issue and added missing scrollbar.
- Fixed a rendering issue when multiple elements were selected via keyboard.
- Fixed preference migrations were always executed on start-up.
- Fixed scrolling and search match positing with high DPI scaling.
- Fixed slow startup on Windows due to a blocking call.
- Fixed an issue that caused the paste handler to insert only HTML content because if HTML rendering was disabled.
- Fixed file rename with editor dialog.
- Fixed URL open handler when clicking a link in the editor.
- Fixed an issue that prevented to unindent a list item.
- Fixed multiple XSS issues on language selector and data input.
- Fixed a bug that HTML was rendered in preview mode even it was disabled in settings.
- HTML character encoding is now supported in code blocks.

## 0.16.3

**:warning:Breaking Changes:**

- Disabled rendering of MathML elements.

**:cactus:Feature**

- Added support for SPARQL and Turtle languages (@vemonet).
- Added support for forward navigation in table cells with `Shift+Tab` (@evan-cohen).
- Added support for negative zoom.
- Adjusted footnote inline code font size.
- Added shortcut to toggle table of contents panel (@zmen).
- Added settings option to disable HTML rendering.
- Added support for a relative image directory.
- Added support to include table of contents in exported document.

**:butterfly:Optimization**

- Improved color of word counter in graphite light theme (@bmvisoky).
- Improved UX of font selection.

**:beetle:Bug fix**

- Fixed XSS security vulnerability when parsing MathML submitted by @0xBADCA7.
- Fixed an issue that URLs with trailing slashes are not recognized (@sweetliquid).
- Fixed closing tabs with mouse-middle click (@mnxn).
- Fixed an exception when selecting a table cell with `Ctrl+A` (@AmauriAires).
- Fixed quick open searcher (@munckymagik).
- Fixed code highlighting in a special case (@zmen).
- Fixed an issue with shaking in typewriter mode (@MrHeer).
- Fixed spell checker config schema violation on Windows and allowed BCP-47 language codes.
- Fixed behavior when a single table cell is selected.
- Fixed an issue that symbolic files could not be opened.
- Fixed blank window when opening a second window with `--new-window`.

## 0.16.2

**:warning:Breaking Changes:**

- Toggle focus mode shortcut is now `Ctrl+Shift+J`.

**:cactus:Feature**

- Added shortcut to switch tabs `Alt-#<num>` (@MrHeer).
- Added GitLab math block support.
- Support setting text direction via comand palette (@Pajn).

**:butterfly:Optimization**

- Scale headings according editor font size.
- Increased indentation for sidebar tree view (@BeatLink).
- Updated user-interface strings (@brainchild0, @Rexogamer).

**:beetle:Bug fix**

- Fixed image export issues on Windows.
- Fixed an issue that multiple empty shortcuts were not allowed.
- Fixed image path autocomplete.
- Fixed an issue that the max width of editor tabs was not rendererd correctly (@aimproxy).
- Fixed Hunspell dictionary downloader on Windows.
- Fixed an issue with Hunspell spell checker on Windows.
- Fixed ASCII (ISO-8859-1) encoding in settings validator.
- Fixed footnote exception when exporting document.
- Fixed cryptic characters when exporting document as PDF on macOS (@gSpera).
- Fixed unnecessary character sanitation when setting clipboard data.
- Fixed sup- and superscript export issue.

## 0.16.1

- Fix: Settings page, editor settings are messed up

## 0.16.0

**:warning:Breaking Changes:**

- Temporary disabled hardware acceleration (GPU) on Linux with Wayland due to rendering issues with the frameless window.

**:cactus:Feature**

- Added experimental spellchecker (#1424)
- Allow custom fonts in settings via font family picker (#1107)
- Allow cycle through tabs via shortcuts (#1124)
- Allow to close tabs by mouse middle click (#1266)
- Added export and print options (#1511)
- Added Windows jump list entries (#1503)
- Added file encoding support (#1438)
- Added support for TOML and JSON front matter (#1402)
- Added menu for tabs by @kenyx89 (#1434)
- Feat: Support inline image and small image (#1094)
- Feature: github uploader can customize branch (#1328)
- Search image by unsplash (#1333)
- Feature: resize image and toggle inline and block image (#1335)
- Feature: parse page title when paste a link (#1344)
- Feature: add link tools: unlink and jump (#1357)
- Feature: support GFM auto link and auto link extension (#1421)
- Support RegExp search and replace in file edit. (#1422)
- Feature: support markdown extension superscript and subscript (#1531)
- Feature: CTRL/CMD+SHIFT+F opens sidebar and focuses on "search in folder" (#1311)
- Feature: add highlight menu item (#1532)
- Support footnote (#193, #1568)

**:butterfly:Optimization**

- Added loading animation during startup
- Added alt accelerator on Linux and Windows (#1254)
- Added per-tab notifications for file changes
- Optimized package size and startup time
- Prevent parse a url as link (#1301)
- Add loading page when init app (#1303)
- Search input now searches on keypress @Illyism (#1306)
- Search shows open folder warning, no results text and errors @Illyism (#1312)
- Reordered font settings to show editor and source-code font settings at the top. (#1204)
- Add whether to trim the beginning and end empty line of code block, add setting option, the default value is trim the empty line. (#1378)
- Optimization of code block (#1445)
- Optimization of table block (#1456)
- Add tooltip to format tool bar (#1516)

**:beetle:Bug fix**

- Fixed recommend title exception when heading contains spaces only (#1281)
- Fixed main process exception (#1284)
- Fixed application freeze when using PageDown/PageUp in special cases (#655)
- Fixed HTML paste handler (#1271)
- Fixed save all tab order (#1349)
- Fixed additional page that may was added due to padding (#1480)
- Fixed recently directories (#1486)
- Fixed invalid screen area on Windows (#1474)
- Fixed UTF-BOM file loading issue (#1438)
- Fixed multiple potential issues with menu entries (#1437)
- Fixed display issues with long text in source-code editor (#1427)
- Fixed issue that `keybindings.json` was not respected (#1406)
- Fixed settings checkbox width by @mdogadailo (#1471)
- Fixed line transformer and tooltip arrow style by @mdogadailo (#1441, #1443)
- Fixed HTML `pre` tag style in preview editor by @mdogadailo (#1441, #1443)
- Fixed vega-lite render error (#1295)
- Fixed correct url when there are pair brackets in link url or image src (#1308)
- Fixed update paragraph menu item `task list` error (#1331)
- Fixed #1299 add system emoji fallback fonts (#1348)
- Numbered list styles change when exporting PDF (#1145)
- Fixed error with text input (#1324)
- Fixed delete unintended content when <> exists (#1336, #1366)
- Fixed new check list items are already checked (#1267)
- Fixed the last empty line in code block disappear (#1265)
- Fixed linked images are not rendered (#1297)
- Fixed checkbox text not aligned with box (#1135)
- Fixed XSS security vulnerability when parsing inline HTML (#1390)
- Exception when deleting code block identifier (#1231)
- Fixed sidebar overflow due to opened files (#1391)
- Fixed sometimes the table of contents is not cleared after the document is closed (#1249)
- GitHub image uploader cannot be set as default uploader (#1247)
- Fixed Side bar show `html` and `pdf` files when add new `html`, `pdf` files to opened folder (#1401)
- Fixed image is missing if change to source code mode (#1337)
- Fix: #1061 no need to auto pair in inline code (#1423)
- Fix: #1218 backspace error in table cell (#1425)
- Fixed unable to open markdown file by command line (#1429)
- Fix: #1418 Set file watch option usePolling to true on macOS (#1430)
- Fix the download section anchor @heytitle (#1440)
- Fix: wrap long lines and a little bit of padding for pre element (#1470)
- Regression: math block edit and preview box (#982)
- Cannot reach first line of code block (#1460)
- Failure when writing HTML in preview editor (#1464)
- Backspace key error when cursor at the beginning of header (#1509)
- Fix some grammar or spelling errors (#1524)
- Content is still editable when dialog is shown (#1489)
- Fixed error: Cannot read property 'webContents' of undefined (#1508)
- Document can't be exported when inline formulas are in other blocks than paragraph (#1522)
- Wrong task-list item alignment (#1540)

## 0.15.1

v0.15.1 is an unplanned release to fix a XSS security vulnerability.

**:beetle:Bug fix**

- **Fixed a XSS security vulnerability when parsing inline HTML (#1390)**
- Fixed portable mode detection if current working directory don't match the application directory (#1382)
- Fixed exception in main process due to file watcher (#1284)
- Added emoji fallback fonts for macOS and Windows too (#1299)
- Fixed RegEx for recommend title (#1128)

## 0.15.0

**:warning:Breaking Changes:**

- `preference.md` is deprecated and no longer supported. Please use the GUI.
- Removed portable Windows executable. NSIS installer can now be used to install per-user (without administrator privileges) or machine wide.
- Added portable zip archive for both x86 and x64 Windows.
- Changed `viewToggleFullScreen` and `windowCloseWindow` key bindings to `windowToggleFullScreen` and `fileCloseWindow`.
- Removed `viewChangeFont` key binding.
- MarkText is now single-instance application on Linux and Windows too.

**:cactus:Feature**

- feat: add underline format (#946)
- Added GUI settings (#1028)
- The cursor jump to the end of format or to the next brackets when press `tab`(#976)
- Tab drag & drop inside the window
- add tab scrolling and drag&drop (#953)
- Support to replace the root folder in a window
- Second-instance files and directories via command-line are opened in the best window
- MarkText can use a default directory that is automatically opened during startup (#711)
- New CLI flags: `--disable-gpu`, `-n,--new-window` and `--user-data-dir`
- Find in files use ripgrep as searcher.
- You can know automatically save your document after a predefined intervall.
- feat: support prism language alias (#1031)
- Allow to set editor line width ~~and window zoom~~ (disabled due #1225) (#1092)
- feat: add click delete url to clipboard when upload image to SMMS (#1173)

**:butterfly:Optimization**

- optimization of cursor, and fix some cursor related issues (#963)
- Rewrite `select all` when press `CtrlOrCmd + A` (#937)
- Set the cursor at the end of `#` in header when press arrow down to jump to the next paragraph.(#978)
- Improved startup time
- Replace empty untitled tabs (#830)
- Editor window is shown immediately while loading
- Adjust titlebar title when using native window to not show a duplicate title
- Added `Noto Color Emoji` as default emoji fallback font on Linux to display emojis properly.
- feat: add two event focus and blur of muya (#1039)
- opti: add katex css only when there is math fomular in export html (#1038)
- Refactor inline image to support paste/drop image (#1028)
- opti: insert last paragraph when the last block is table, code block or no-empty paragraph (#1069)
- Opti: update TOC if needed (#1088)
- feat: scroll to cursor when switch between tabs (#1089)
- add: auto save with delay (#1093)
- Opt-in uploader services and add legal notices (#1113)
- Add ripgrep as find in files backend (#1086)

**:beetle:Bug fix**

- Fixed some CommonMark failed examples and add test cases (#943)
- fix: #921 reference link render error (#947)
- fix: #926 summary element can not be click (#948)
- fix: #870 list parse error (#964)
- Fixed some bugs after press `backspace` (#934, #938)
- Changed `inline math` vertical align to `top` (#977)
- Prevent to open the same file twice, instead select the existing tab (#878)
- Fixed some minor filesystem watcher issues
- Fixed rename filesystem watcher bug which lead to multiple issues because the parent directory was watched after deleting a file on Linux using `rename`
- Fixed incorrect file content after a watched file was edited externally (#1043)
- fix: toc content vanish bug (#1021)
- fix paragraph turn into list bug (#1025)
- fix: #1018 paste error when the lastblock is html block (#1042)
- fix: parse inline syntax error (#1072)
- fix: insert image by image uploader, but can not copy and paste, because it is render the local url (#1070)
- Fix: #1045 can not select all content in source code mode (#1085)
- fix: TOC level error (#1087)
- fix watcher out of range exception (#1095)
- Opti: image icon style (#1098)
- delete image triggers muya change (#1125)

**:warning:Breaking Development Changes:**

- Environment variable `MARKTEXT_IS_OFFICIAL_RELEASE` is now `MARKTEXT_IS_STABLE`
- Renamed npm script `build:dir` to `build:bin`

### 0.14.0

This update **fixes a XSS security vulnerability** when exporting a document.

**:warning:Breaking Changes:**

- Minimum supported macOS version is 10.10 (Yosemite)
- Remove `lightColor` and `darkColor` in user preference (color change in view menu does not work any, and will remove when add custom theme.)
- We recommend user not use block element in paragraph, please use block element in html block.

*Not Recommended*

```md
foo<section>bar</section>zar
```

*Recommended*

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
- Support maxOS `dark mode`, when you change `mode dark or light` in system, MarkText will change its theme.
- Add new themes: Ulysses Light, Graphite Light, Material Dark and One Dark.
- Watch file changed in tabs and show a notice(autoSave is `false`) or update the file(autoSave is `true`)
- Support input inline Ruby charactors as raw html (#257)
- Added unsaved tab indicator
- Add front Menu by click the front menu icon (#875)
- Support diagram: [flowchart](https://github.com/adrai/flowchart.js), [vega-lite](https://github.com/vega/vega-lite), [mermaid](https://github.com/knsv/mermaid), [sequence](https://github.com/bramp/js-sequence-diagrams) (#914)
- Support create indent code block in preview mode.(#920)

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
- Restore default MarkText style after exporting/printing
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
- MarkText didn't remove highlight when I delete the markdown symbol like * or `. (#893)
- After delete ``` at the beginning to paragraph by backspace, then type other text foo, the color will be strange, if you type 1. bar. error happened. (#892)
- Fix highlight error in code block (#545 #890)
- Fix files sorting in folder (#438)

### 0.13.65

**:butterfly:Optimization**

- Show tab bar when opening a new tab
- Use default bold (`CmdOrCtrl+B`) and italics (`CmdOrCtrl+I`) key binding (#346)
- Don't show save dialog for an empty document (#422)
- Sidebar and tab redesign
- Calculate artifact checksum after uploading (#566)
- Use `CmdOrCltr+Enter` to add table row below.

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

You need uninstall the old version of MarkText before install version 0.10.21, because we changed the AppId when build.

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

- Add user preferences in `MarkText menu`, the shoutcut is `CmdorCtrl + ,`, you can set the default `theme` and `autoSave`.
- Add `autoSave` to `file menu`, the default value is in `preferences.md` which you can open in `MarkText menu`. #45
- Add drag and drop to open Markdown file with MarkText @fxha
- User setting: fontSize, lineHeight, color in realtime mode.
- Move your file to other folder @DXXL
- Rename filename

**:butterfly:Optimization**

- Theme can be saved in user preferences now #16
- Custom About dialog @fxha

**:beetle:Bug fix**

- fix: prevent open image or file directly when drag and drop over MarkText #42
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
