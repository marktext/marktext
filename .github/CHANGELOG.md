### 0.10.4

**:cactus:Feature**

- block html #110
- raw html #110
- you can now indent list items with tab key

**:butterfly:Optimization**


**:beetle:Bug fix**

- fix: update outdated preferences on startup #100
- fix: reset modification indicator after successfully saved changes
- fix: disable tab focus

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
