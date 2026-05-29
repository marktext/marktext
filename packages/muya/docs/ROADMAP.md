### MUYA

**2023 version 1.0.0 released**

Optimization:

Support TypeScript

- [x] Convert JS code to TS code.**(P0)**
- [ ] Complete all missing types(no any) and support strict mode for TS compilation(eslint --fix and no error).**(P0)**

Better Code Design

- [x] Patch the latest marked to muya.**(P0)**
- [x] Remove use axios and XMLHttpRequest etc
- [x] Use constructor mixin to replace property mixin
- [x] diagram: sequence and flowchart are deprecated
- [x] Optimization of turndown service for better paste
- [ ] Optimization of markdownToHtml UI style, remove unused codes
- [ ] Use DI?
- [ ] Use TSX to replace snabbdom(The ecology is better and easier to read)?

Compatibility

- [x] Compatible with Firefox.**(P0)**
- [ ] Safari.**(P0)**
- [ ] Edge.**(P0)**

Documents
- [ ] Website(docs, demo)**(P0)**
- [ ] Documents.**(P0)**
- [ ] Comments

CI and CD
- [x] Optimization of build process，replace webpack with vite and build using rollup
- [x] Speed up the development process and replace webpack with vite
- [ ] Add and publish Github Action, modify the version number of the package.json, automatically tag and publish the new version to npm after merging or push to master

Test
- [ ] Unit test(P1)
- [ ] e2e test(Optional)

**June 2020**

**Goal: Support the basic version of three blocks**

- [x] Inline styles supported by GFM and Commonmark Spec
- [x] Inline pictures (local pictures are not supported) and picture editing menu
- [x] atx and setext headers
- [x] Quote block
- [x] Horizontal dividing line
- [x] Support inline style format method and toolbox
- [x] Various event processing backspace, delete, arrow, tab, enter, input, etc.
- [x] Selection and deletion of multiple paragraphs
- [x] Paragraph drag and drop
- [x] Ordinary paragraph

**July 2020**

**Goal: more blocks, support input and output**

- [x] Copy and paste in lines and paragraphs
- [x] Select multiple paragraphs to copy and paste
- [x] Ordered list
- [x] Bullet list
- [x] Task list
- [x] Drag and drop the list and put finished item to the end automatically.
- [x] Code block
- [x] html block
- [x] table block
- [x] Handle history function
- [x] Input and output to other file type(markdown and html)

**August 2020**

**Goal: Full-featured version, the plugin supports more functions**

- [x] Math formula block
- [x] mermaid
- [x] ~~flowchart~~
- [x] ~~sequence~~
- [ ] footnote
- [x] front matter
- [x] Superscripts, subscripts, mathematical formulas, etc.
- [x] Pre-paragraph menu
- [x] Quick insert menu
