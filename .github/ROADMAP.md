### Roadmap of Mark Text

**Optimization and Refactor**

- [ ] Optimize Muya's data structure and split the current block into Block and Delta. Block is a data structure parallel to the DOM, children is a linked list, and the entire Block is a tree. This will better render the block into a DOM. Delta is a data structure corresponding to the Mrkdown text. It supports additions and deletions, and supports Undo and Redo for History. Support collaborative editing.

- [ ] Does not actively trigger the render or partialRender methods, if the block has changes, the responsive render page.

- [ ] Optimize Undo and Redo to reduce memory consumption.

- [ ] Optimize image uploads, image uploads will be a feature of Muya, or plugins. The progress of the image upload is displayed inside the editor.![5bddb70b99b9e](https://i.loli.net/2018/11/03/5bddb70b99b9e.jpg)

- [ ] Move the cursor's action to the Selection class.

- [ ] Rewrite Source Code Mode, also supports inline style, paragraph shortcuts and toolbar operations in Source Code Mode, support search, replace and other functions, add preview interface in Source Code Mode.

- [ ] stability and markdown compatibility (e.g. rebasing marked.js)

**New Features**

- [ ] Rewrite Mark Text Side Bar UI.

- [x] Add More Themes.

- [ ] User settings page, color theme, editor settings, markdown preferences, security settings, etc.

- [x] Different file can be referenced, jumped, and opened via a browser.

- [ ] Print page settings.

- [ ] Support for the selection of different style themes when exporting PDFs and HTML. 

- [ ] Support for more format output and input.

- [ ] When you open the software, the last edited file or folder are automatically opened.

- [ ] Picture management function, uploaded pictures for unified management, image management will probably have these functions, local pictures, uploaded pictures, search pictures and upload.

- [ ] Support slideshow function, we can write Markdown directly, then Markdown will automatically generate slideshows, transition animations, thumbnails, preview playback.

- [ ] Add a paragraph menu. Add paragraphs, delete, copy, and more.

- [ ] Support `charts`, `flowcharts`, `Gantt charts`, etc.

- [ ] When entering mathematical formulas, smart tips, support more mathematical, chemical and other formulas.

- [ ] spell checking.

- [ ] novice tutorial for newbies or new features.

- [ ] More custom markdown syntax, `subscript` and `superscript` etc.

**Mark Text and Muya websites**

- [ ] Editor documentation and start guide.

- [ ] Update the official website, add detailed documents and videos, sponsor advertisements, and so on.

**Internationalization and plug-in**

- [ ] The Google Drive plugin can be used as an official plugin use case, You can use this plugin to open Google Drive folders, write files, and more.

- [ ] Picture cloud service. Used to upload images or files.

- [ ] Internationalization.
