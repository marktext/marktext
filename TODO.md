#### TODO LIST

**Bugs**

- [ ] 当 codeBlock 在 list item 中， item nextSibling 为 null，但是 list 还有nextSibling。这个时候不应该创建行的 block。（严重 bug）
- [ ] codeBlock 在 list item 中时，list style 问题。
- [ ] 在通过 Aganippe 打开文件时，无法通过右键选择 Aganippe。（严重 bug）
- [ ] 在通过 Aganippe 打开文件时，通过右键选择软件，但是打开无内容。（严重 bug）
- [ ] export html: (1) task list 不可点击 （2）code block 太长

**菜单**

- - [x] New... （cmd + N）

  - [x] Open (cmd + O)

  - [ ] Open Recent

  - [ ] Open With Finder

  - [x] Close

  - [x] Save

  - [x] Save As

  - [ ] Rename

  - [ ] Move To

  - [ ] Export(PDF | HTML with style | HTML)

- - [x] Undo

  - [x] Redo

  - [x] Cut

  - [x] Copy

  - [x] Paste

  - [ ] Copy As Markdown

  - [ ] Copy As HTML

  - [ ] Paste As Plain Text

  - [ ] Find | Find And Replace

- - [ ] Heading 1~6

  - [ ] Paragraph

  - [ ] Increase Heading Level

  - [ ] Decrease Heading Level

  - [ ] Table

  - [ ] Code Fences

  - [ ] Quote Block

  - [ ] Order List

  - [ ] Unorder List

  - [ ] Task List

  - [ ] List Indentation (up | down)

  - [ ] Horizontal Line

- - [ ] Strong

  - [ ] Emphasis

  - [ ] Code

  - [ ] Strike

  - [ ] Link

  - [ ] Image

  - [ ] Clear Format

- - [ ] Customize Touch Bar

- - [ ] GitHub | ...

- - [ ] Minimize

  - [ ] Zoom

  - [ ] Current Window

- - [ ] Website

**Website**

// TODO

**Title Bar**

- [x] 字数统计（Words | Paragraphes | Characters | Characters With Space）

**语法实现**

- [x] 段落和换行，两个或两个以上的空格再敲回车，或插入一个\<br/\>

- [x] 标题，支持 atx 形式的标题，在行首插入 1 到 6 个 #，会生成对应的 h1~6 h 标签。在敲回车后再转换成 HTML，但是在编辑标题的时候，显示会加粗。标题支持嵌套其他 markdown 样式。支持嵌套的样式包括加粗、斜体、行内代码、链接、图片。

- [x] 区块引用 Blockquotes，每行前面都加上 > ，支持嵌套区块引用，支持嵌套其他 markdown 语法，比如标题、列表、代码区块。区块引用会生成 blockquote 标签。

- [x] 列表，有序列表和无序列表。无序列表使用 *、+、- 作为列表标记。有序列表使用数字加一个英文句点来标记。列表支持嵌套列表。列表支持嵌套区块引用，但仅限于行首，支持嵌套代码区块，但仅限于行首，支持其他 markdown 语法嵌套。

- [x] 代码区块，代码区块中的 markdown 语法不再被转换。

- [x] 分割线，你可以在一行中使用三个以上的 *、-、_ 来创建分割线。

- [x] 链接，markdown 支持两种形式的链接，行内式、参考式。

- [x] 图片，markdown 支持两种形式的图片，行内式、参考式。

- [x] Markdown 中使用\*、\_ 来表示强调，使用一个用 em 标签，使用两个用 strong 标签，如果\*、\_ 内侧有空白的话，会被当做普通的符号。

- [x] 代码，如果标记一小段代码，可以用反引号标记：\`。如果文字中已经有反引号，那么使用两个反引号。

- [x] 简单链接、自动连接，使用\<\>包裹的链接会被转换为a 标签，还可以自动识别链接。

- [x] 反斜线 \ 可以对如下字符转义：

```
\   反斜线
`   反引号
*   星号
_   底线
{}  花括号
[]  方括号
()  括弧
#   井字号
+   加号
-   减号
.   英文句点
!   惊叹号
```

- [x] [search and add emoji](https://www.webpagefx.com/tools/emoji-cheat-sheet/)

- [ ] 表格支持。
