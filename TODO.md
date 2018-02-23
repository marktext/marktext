#### TODO LIST

**Bugs**

- [ ] 当 codeBlock 在 list item 中， item nextSibling 为 null，但是 list 还有nextSibling。这个时候不应该创建行的 block。（严重 bug）
- [ ] export html: (3) keyframe 和 font-face 以及 bar-top 的样式都可以删除。(4) 打包后的应用 axios 获取样式有问题。(优化)
- [ ] table: 如果 table 在 selection 后面，那么删除cell 的时候，会把整个 row 删除了。（小 bug)
- [ ] 编辑大文件时，编辑一会后，页面变卡顿（严重 bug）
- [ ] 在编辑中文，然后按 enter 时，不应该进行换行操作。
- [ ] 复制黏贴到 GitHub 的 issue 中不是直接的 markdown 格式。
