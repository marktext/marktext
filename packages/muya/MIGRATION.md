# marktext 老 muya → @muyajs/core 新 muya 迁移追踪表

调研方案在 `/Users/ransixi/.claude/plans/glimmering-hatching-lightning.md`。
本表登记 P0~P3 共 ~80+ 条 commit 的迁移状态。

状态字段：
- `pending` — 待评估
- `verified-not-applicable` — 已验证新架构下 bug 不存在 / 无意义
- `test-only` — bug 复现失败，仅添加防御性回归测试
- `fixed` — 已实施修复 + 测试
- `skipped` — 决定不做（如纯 marktext 应用层）

PR 分组对应方案第三节的 5 个系列 + 后续 PR-6 测试合规：
- **PR-1a** 安全 + 已确认 crash（非 XSS） ✅
- **PR-1b** XSS 四联（独立 PR 便于安全审计） ✅
- **PR-2** Parser 合规性（含 footnote 测试基线）
- **PR-3** 编辑 / 光标 / IME
- **PR-4** Clipboard / 富文本
- **PR-5** P3 体验特性（按需）
- **PR-6** 测试合规：选择性迁 marktext muya 测试 + 接 CommonMark/GFM spec（PR-2~4 落地后做）

---

## P0 — 安全 / 数据损坏 / crash

| Hash | 范畴 | 说明 | PR | 状态 |
|---|---|---|---|---|
| 9884342f | table | normalizeTable 行单元数 > 表头 crash | PR-1a | `fixed`（含 3 个回归测试） |
| 9ffc5b1b | heading | 空 heading slug crash | PR-1a | `verified-not-applicable`（新仓无 slugger） |
| bca2ed62 | image | loadImageAsync 失败永久缓存 | PR-1a | `fixed`（含 3 个回归测试） |
| 36e825c2 | image | getImageInfo 空 firstChild | PR-1a | `verified-not-applicable`（新仓 getImageInfo 不读 firstChild） |
| fed1dac4 | xss | HTML 表格粘贴 XSS | PR-1b | `verified-not-applicable`（`utils/paste.ts` 已 `sanitize` 经 DOMPurify；anchor title 改用 `textContent` 比老版更安全） |
| 0dd09cc6 | xss | code lang + 超链接 XSS | PR-1b | `partial-fixed`：超链接路径 `sanitizeHyperlink` + `htmlTag` `isValidAttribute` 已就位；**langInputContent 残留 XSS 此 PR 实修** + 3 测试 |
| c959d185 | xss | Mermaid XSS | PR-1b | `verified-not-applicable`（`markdownToHtml.ts` + `diagramPreview.ts` 都已 `securityLevel:'strict'`，mermaid innerHTML 走 `sanitize`） |
| dc54c7b6 | xss | 代码块未 escape HTML | PR-1b | `verified-not-applicable`（`escapeHTML` 已用含 `&` 的 5 字符版本，codeBlockContent 已 escape）+ 4 个防御测试 |
| c47795e4 | xss | XSS + Electron（部分电子相关跳过） | PR-1b | `skipped`（Electron-only） |
| 0baf2e9e / 7de33f11 | xss | #1390 XSS | PR-13 | `verified-not-applicable`：marktext fix 给 inline html renderer 加 `BLOCK_TYPE6.includes(tag) \|\| !sanitize('<' + tag + '>') ? 'span' : tag` 降级，并把 `data-align` 入白名单。新仓 `inlineRenderer/renderer/htmlTag.ts:80-82` 已完整保留该降级链路 + `:110` `isValidAttribute(tag, attr, val)` 属性级过滤；`config/index.ts:401` `EXPORT_DOMPURIFY_CONFIG.ADD_ATTR: ['data-align']` 保留 data-align 白名单（PREVIEW 走 ALLOW_DATA_ATTR:false 因为预览从 state 重派生 data-align）。**新增 16 个防御测试**（`utils/__tests__/dompurifyXss.spec.ts`）：embed/object/iframe 降级触发、span/code/mark 不降级、href/onclick/onerror 属性过滤、data-align ADD_ATTR + 实际 sanitize 保留 |
| sanitizeHyperlink 防御 | xss | 锁住 `javascript:/vbscript:/data:` 阻断 | PR-1b | `test-only`（8 个防御测试） |
| 6293d408 | table-ctrl | 老 tableBlockCtrl 删行/列后光标修复 (#572) | PR-7b | `fixed`：`Table.removeRow/removeColumn` 现返回相邻 cell 的 firstChild，`tableRowColumMenu.selectItem` 拿到 cursorBlock 后 `setCursor(0, 0)`。**新增 8 个回归测试**覆盖中间删/末尾删/整表删/越界 4 个分支 |
| f99addd2 | table-ctrl | selectedTableCells 清理 (#1900) | PR-7b | `verified-not-applicable`：新仓无 `selectedTableCells` 全局状态（grep 0 hit）；跨 cell 选区在 `editor/index.ts:93` 由 `isSelectionInSameBlock` 守卫早 return，不会进入 marktext 旧那条"删整 column 后引用悬空"的代码路径 |
| 0a3fda63 + 2754e393 + 4b362e52 | architecture | post-refactor 修复合集（已拆条） | PR-13 | `skipped`（已拆 11 子条目登记到下方 "post-refactor 拆条" 节；三个原 hash 不单独迁移） |
| post-refactor: EventCenter listener 在 `destroy` 不清理 | event leak | `EventCenter.unsubscribeAll()` 缺位 | PR-17 | `fixed`：`event/index.ts` 新增 `unsubscribeAll() { this.listeners = {}; }`，`muya.ts destroy()` 在 `detachAllDomEvents()` 之后调用，pub/sub 闭包随实例释放，宿主页面可 GC Muya/plugins/DOM。**新增 2 个回归测试**：unsubscribeAll 清空已订阅；不影响后续订阅 |
| post-refactor: `EventCenter.emit` once-listener 迭代变更 | event correctness | `forEach` 内 `this.off` 跳元素 | PR-17 | `fixed`：`event/index.ts emit()` 改为 `eventListener.slice().forEach(...)` snapshot 迭代，once-listener 在回调里 `off` 只改原数组、不再令前进中的索引塌缩。**新增 3 个回归测试**：早 once-listener 移除自身后仍触发相邻 listener；多 once 单 emit 全清；once/regular 混合 — regular 多 emit 保留、once 单次后移除 |
| post-refactor: selection `document.querySelector` vs `this.doc` | iframe/multi-doc | marktext 改用 `this.doc.querySelector` | PR-13 | `verified-not-applicable`：marktext 改动是为 electron-vite 后的多文档场景；新仓没有 `this.doc` 字段也无 iframe/shadow-DOM 多 document 基建（`selection/index.ts:559`/`format.ts:441`/`loadImageAsync.ts:30,77`/`markdownToHtml.ts:116` 一致使用 `document.*`），结构上不假设多 document |
| post-refactor: selection/dom.js `traverseUp` / `findOutMostParagraph` | selection | 老 contentState 辅助 | PR-13 | `verified-not-applicable`：新仓 `selection/dom.ts` 无这两个辅助（grep 0 hit），整套 contentState ctrl 已被 OT/JSON-state 替代 |
| post-refactor: `history.undo()` 在 index 0 崩 | history | 访问 stack[-1] | PR-13 | `verified-not-applicable`：新仓 `history/index.ts:77 _change` 早期 `if (this._stack[source].length === 0) return;`，redo/undo 都走同一 `_change`，无 stack[-1] 风险 |
| post-refactor: `MutationObserver` 未 disconnect | leak | inputCtrl observer 泄漏 | PR-13 | `verified-not-applicable`：新仓全代码 0 `MutationObserver`（grep 0 hit），无 `inputCtrl`，结构上不存在 |
| post-refactor: `historyTimer` 未取消 | leak | 定时器在 destroy 后 fire | PR-13 | `verified-not-applicable`：新仓 `history/index.ts` 用 `_lastRecorded` 时间戳比较，无 setTimeout/Interval（grep 0 hit） |
| post-refactor: `renderCodeBlockTimer` 模块级状态 | leak/race | module-level 计时器跨实例 | PR-13 | `verified-not-applicable`：新仓 grep 0 hit `renderCodeBlockTimer`；code-block 渲染走 Prism 同步路径，无延迟渲染计时器 |
| post-refactor: `Muya.destroy()` 在无 plugins 时崩 | crash | 缺少 optional chain | PR-13 | `verified-not-applicable`：新仓 `muya.ts:145-146 destroy()` 已 `if (this.ui) this.ui.hideAllFloatTools();` 守卫；`_uiPlugins` 容器在 `init()` 前就初始化为 `{}` |
| post-refactor: 应用层 IPC / preferences / autosave / editor.vue | app-layer | electron-vite/preload/main/renderer | — | `skipped`：marktext renderer/main 应用层（electron.vite.config.js / src/main/* / src/preload/* / src/renderer/*），非 muya 内核范围 |
| post-refactor: docs (`ARCHITECTURE.md`, `BUILD.md`, `package.json` main） | docs | marktext 仓库文档 | — | `skipped`：marktext 仓库 docs / build 配置变更，不进 muya v0.x 包 |

## P1 — Parser / 渲染正确性

| Hash | 范畴 | 说明 | PR | 状态 |
|---|---|---|---|---|
| 1ecc3601 | parser | footnote 解析 + 510 行测试基线 | PR-2a | `fixed`（marked v16 block 扩展 + 12 个回归测试；3 个 negative 用例 marked 自带 `def` 规则替代 paragraph fallback） |
| 23435ce6 | parser | 任务列表缩进 | PR-2a | `test-only`（marked v16 内置 list tokenizer 不共用旧 fork 的缩进 bug；2 个防御测试锁定嵌套） |
| 57cd04c5 | parser | CommonMark example 475 + 353/387/520/521 等 | PR-2a | `fixed`（canOpenEmphasis 阻断 mid-run `_`；link/reference_link 加 lowerPriority；5 个 CM spec 用例） |
| ad5ddbf9 | parser | GFM example 558（link/image title 支持） | PR-2a | `test-only`（`parseSrcAndTitle` 已就位；4 个回归测试锁定 link/image title） |
| 372fe02f | parser | list 解析 #870（task + bullet 混排拆分） | PR-2a | `test-only`（`compatibleTaskList` 已就位；1 个回归测试） |
| 8891287b | parser | paragraph → list 转换 | PR-7a | `verified-not-applicable`：marktext fix 是 `updateCtrl.updateParagraphToList` 的 line-splitting 旧逻辑（无 marker 时 listItemLines 为空 → text 丢失）。新仓 `replaceBlockByLabel({label:'bullet-list', text})` 直接 `state.children[0].children[0].text = text` 整段保留，无 LIST_ITEM_REG 分行。**新增 6 个回归测试**锁住 contract |
| 270d33f6 | parser | list item lexer/parser（CM 264/265 不同 marker 拆表） | PR-2a | `test-only`（marked v16 + `compatibleTaskList` 已就位；2 个 CM spec 测试） |
| 04834032 | parser | tab 缩进 list | PR-7a | `verified-not-applicable`：commit title 误导，实际修的是 markup code-block 内 Tab → Emmet HTML 展开（`parseSelector(undefined)` 崩 + `lastWord` 未限定到光标前 + postText 丢失）。新仓 `codeBlockContent.tabHandler` 已含 `lastWordBeforeCursor` + `postText` + `parseSelector(str='')` 三重修复。**新增 5 个回归测试**（含 mid-text、empty、non-markup 分支） |
| 240d64aa | parser | 合并不同类型 list #706 | PR-7a | `verified-not-applicable`：marktext bug 在 `pasteCtrl` 合并 list-items 进现存 list 时未对齐 looseness。新仓 `pasteHandler` (`clipboard/index.ts:631-635`) 走 `for (state of remaining) ScrollPage.loadBlock(state.name).create(...) + insertAfter`，**每个粘贴状态独立成块**，不会与既存 list 合并，结构上不存在 looseness 错配 |
| 02841ffd | parser | list 后续段落归属（exportMarkdown 缩进配置） | PR-2b | `test-only`（stateToMarkdown 已实现 indent/listIndent 拆分；4 个 marktext 缩进 fixture + 4 个扩展 round-trip） |
| 5f191681 | parser | blockquote 内 list（exportMarkdown） | PR-2b | `test-only`（3 个 blockquote round-trip 测试） |
| insertLineBreak 行尾空格 | serializer | 列表项内空行带尾随空格 | PR-2b | `fixed`（`insertLineBreak` 去掉尾随空格，保留 `>` 前缀；1 个回归测试） |
| 70d49c30 | parser | `-foo` 误识 list item | PR-2a | `test-only`（marked v16 已要求 bullet 后接空格；2 个正负回归测试） |
| 7b7a9424 | math | math block 嵌套 | PR-7b | `verified-not-applicable`：marktext `insertContainerBlock` 缺 anchor 校验导致 math 嵌套；新仓所有 container 创建路径（front menu / quick-insert / `$$` enter convert）都门控在 `paragraph.content`，`canTurnIntoMenu` 对 math/code/html/diagram/table 返回 `[]`。**新增 7 个回归测试**锁住 front-menu 门 |
| d937fac0 | inline | inline 语法 (#1071 重复 `**\`x\`**` 只末尾加粗) | PR-2c | `test-only`（`lowerPriority` 的 `ignoreIndex` 已就位；2 个回归测试） |
| 57af8304 | inline | link/image dest 含括号 (#1169) | PR-2c | `test-only`（`correctUrl` 用 `findClosingBracket` 已就位；3 个回归测试） |
| 9c2f6cb3 | inline | inline math 样式 | — | `skipped`（CSS-only，新仓样式体系自有 inline math 样式） |
| 6dfa7938 | inline | inline math selection | — | `skipped`（CSS-only，新仓样式体系自有 selection 样式） |
| d9f64bab | inline | reference link 渲染 | PR-2a | `test-only`（lexer.ts:357 `labels.has(...)` 已就位；2 个回归测试） |
| b8e2cd82 | inline | inline html renderer | PR-13 | `verified-not-applicable`：marktext fix 给 marked `textRenderer` 加 `script(content, marker)` 让 sup/sub 出现在 HTML 导出。新仓 `utils/marked/extensions/superSubscript.ts:59-64` 直接在 marked extension `renderer` 中发射 `<sup>...</sup>` / `<sub>...</sub>`，编辑器渲染与 `renderToStaticHTML` 走同一发射器，无独立 textRenderer 待对齐。**新增 2 个 b8e2cd82 防御测试**锁住段落 / heading / list 内 sup/sub 同时出现的 HTML 输出 |
| 962fdf35 | inline | heading emoji 偏移 | — | `skipped`（CSS-only，新仓样式体系自有 emoji 处理） |
| 8e32838b | inline | 上/下标 | PR-2a | `test-only`（`super_sub_script` token + 渲染器已就位；3 个正负回归测试） |
| c0853f64 | inline | auto link / extension | PR-2a | `test-only`（auto_link + auto_link_extension + 边界 guard 已就位；4 个回归测试） |
| 1c42555a | block | 粘贴多行进 heading | PR-4a | `fixed`（提取 `mergePasteIntoHeading` 纯函数，6 个测试） |
| dec7502e | block | setext heading | PR-2a | `test-only`（marked v16 lheading + walkTokens `headingStyle` 已就位；3 个回归测试） |
| f00da152 | block | 嵌套块插表 crash | PR-7b | `verified-not-applicable`：marktext 老 `createFigure` 缺 anchor 校验导致 math/code/html/table 内插表崩；新仓 `canTurnIntoMenu` 同一道门把 table 也挡在外，`/table` quick-insert 只对 `paragraph.content` 触发。**新增 6 个回归测试**复用 `canTurnIntoMenu` 门同时锁住 table 不可嵌入 |
| 9cb2cbe8 | toc | TOC 更新（如做 TOC 参考） | PR-15 | `fixed`：新仓加 `muya.getTOC()` 公共 API，对齐 marktext `tocCtrl.js`（同步 9cb2cbe8 `\s` 正则修复，让 NBSP/tab 前后置都能正确剥离 atx `#` 标记）。`state/getTOC.ts` 委托实现，`utils/slug.ts` 导出 `generateGithubSlug`（与 marktext url.js 一致：ASCII `\w` only）。`packages/core/src/index.ts` 导出 `ITocItem` 类型。**新增 10 个回归测试**：空文档、单 atx、多层级、setext、raw inline 保留、`\s` 正则修复、CJK/emoji 退化、重复标题 slug 稳定但 githubSlug 同、跨调用 slug 稳定、跳过非 heading 顶层块 |
| reference link/image | parser+state | markdown 加载时 reference definition 丢失（marked v16 `def` block token 未处理）+ reference image 不走 `loadImageAsync` 解析后 src + 内联 label 查找漏大小写 | PR-16 | `fixed`：`markdownToState.ts` 新增 `case 'def'`，把 marked v16 提取的 `[label]: url "title"` block token 还原为 paragraph state（沿用 marktext "definition 是 paragraph text" 模型，**不**引入新 state 节点）；`loadImageAsync.ts` 缓存并返回 resolved `url`（marktext `domsrc` 等价），`referenceImage.ts` 用它作为 `<img src>` fallback；`lexer.ts` 两处 `labels.has(...)` 调用前 `.toLowerCase()`（CommonMark §6.5）；`ILinkReferenceDefinitionState` 标 `@deprecated`（unused，v0.3 移除）。**新增 8 个回归测试**：def→paragraph 保留、round-trip、inline tokenize、Full/Collapsed/Shortcut 三形式、title 透传、case-insensitive lookup、duplicate label 取首条、orphan ref-link |

## P2 — 编辑 / 光标 / 选择 / IME

| Hash | 范畴 | 说明 | PR | 状态 |
|---|---|---|---|---|
| 6f1e733c | cursor | codeblock 光标 #2013 | PR-3a | `verified-not-applicable`（旧 bug 根因是 `partialRender` + `singleRender` 重渲流程，新仓不存在；`codeBlockContent.backspaceHandler` 已有 `text[start.offset-1] === '\n'` 分支显式处理 `\n`） |
| 0a3efbf8 | selection | 文本选区 #622 | PR-3a | `verified-not-applicable`（新仓 selection 通过 `selection/index.ts:_listenSelectActions` 独立监听 mouse 事件，不受 `shownFloat` 影响） |
| 7936e3f4 | selection | 选区无法取消 #636 | PR-3a | `verified-not-applicable`（`content.ts:keydownHandler` 已对 `shownFloat` 内每个浮层细粒度白名单化判定是否 `preventDefault`） |
| 02dbb8af | search | 嵌套 block 搜索 | PR-3d | `verified-not-applicable`（新仓 `Search.search` 用 `scrollPage.depthFirstTraverse` 自然遍历嵌套 block；无 `CAN_NEST_RULES` 白名单限制） |
| 4c517b16 | search | search group | PR-3d | `verified-not-applicable`（`utils/search.ts:buildRegexValue` 已采用新仓正则 `(?<!\\)\$\d` + `$0=full match` 语义；新增 5 个防御测试） |
| 1a4844f8 | history | undo/redo 不触发 change | PR-3d | `verified-not-applicable`（`history._change` → `editor.updateContents` → `jsonState.dispatch` 仍 emit `json-change`；selection 改变由 `editor.updateContents` 末尾 `setCursor` 触发 `selection-change`） |
| 16d61572 | render | partialRender 光标已移除 block | PR-3a | `verified-not-applicable`（新仓 `Editor.updateContents` 走 ot-json1 + `replaceWith` 路径，无 `partialRender`，光标定位通过 `setCursor` 在已存在 block 上重置） |
| 701fb9ae | text | text 删除追加 soft-line | PR-3a | `test-only`（旧多段落删除路径不存在；`autoPair` 内 in-block soft-line 保留分支已就位，2 个防御测试；跨 block 删除依赖浏览器原生行为，需 examples/ 手测） |
| 0dc4b415 | table | cell backspace | PR-3d | `test-only`（`<br/>X` 末尾 backspace 旧路径在 contentState 内被特化；新仓走 `Format.backspaceHandler` token-based + 浏览器原生删除；建议 examples/ 手测 `<br/>` 后字符删除） |
| 5fb130d9 | table | shift+tab 表格导航 | PR-3d | `fixed`（`tableCell.tabHandler` 新增 `event.shiftKey` 分支 + `previousContentInContext()`；3 个回归测试） |
| 9e32c4a0 | table | cursor → next cell index 0 | PR-3d | `verified-not-applicable`（`tableCell.tabHandler` 已 `setCursor(0, 0, true)`，不会选中整 cell 文本） |
| 0028a4bc | table | cell copy 异常 | PR-7a | `verified-not-applicable`：marktext fix 是 `paragraphCtrl.selectTableCells` 单 cell descriptor 缺 `text` 字段。新仓无 selected-cells descriptor —— `getClipboardData` 同块分支直读 `anchorBlock.text.substring(begin, end)`（`clipboard/index.ts:133`）。**新增 3 个回归测试**锁住 table.cell.content 单块 copy 路径 |
| 3fa8a9ae | autopair | inline code 内禁用 | PR-3b | `verified-not-applicable`（`content.ts:autoPair` 已有 `isInInlineCode` 参数 + `format.ts` 调用前用 `_checkCursorInTokenType` 计算；defensive 测试 2 个） |
| 4278362f | autopair | inline math 内禁用 | PR-3b | `verified-not-applicable`（同上，`isInInlineMath` 参数已就位；defensive 测试 1 个） |
| bbea7eca | autopair | 优化自动补全 | PR-3b | `verified-not-applicable`（`!/[a-z0-9]/i.test(preInputChar)` 已在 markdown-syntax 分支；defensive 测试 3 个） |
| 358fa83d | autopair | 引号自动配对 | PR-3b | `fixed`（`content.ts:autoPair` 加 `postIsNotTouching` 门控，5 个回归测试） |
| 6a50b5cb | tasklist | 切换 task-list 光标跳末尾 | PR-3d | `verified-not-applicable`（`taskListCheckbox` click 已 `event.stopPropagation()`，不会触发 editor click → cursor restore；建议 examples/ 手测确认体感 OK） |
| c3f128e7 | tasklist | copy 保留勾选态 | PR-4b | `verified-not-applicable`：marktext fix 是其 DOM-based copy 的 checkbox 注入边界，新仓走 marked 渲染（task-list `[x]/[ ]` → `<input checked>`），渲染层一致 |
| edbab6ed | ime | 中文输入误删 | PR-3c | `verified-not-applicable`（Ctrl+A 在新仓走浏览器原生，多 block 选区被 `editor.ts` 提前 return，`format.inputHandler` 期初也 `if (isComposed) return`；跨 block + IME 边角仍建议 examples/ 手测） |
| 67e18176 | ime | 中文回车多行 | PR-3c | `verified-not-applicable`（`content.ts:autoPair` 软换行补齐分支已包含 `event.type === 'compositionend'` 条件，新增 1 个 compositionend 防御测试） |
| 8a7e6559 | ime | compose bug | PR-3c | `verified-not-applicable`（`composeHandler` 翻转 `isComposed`；`keyupHandler` / `inputHandler` / Enter+Arrow 都已用 `!this.isComposed` 门控） |
| 63642d39 | typing | 回车 typewriter 抖动 | PR-3d | `verified-not-applicable`（新仓无 typewriter 模式，`scrollIntoView` 抖动场景不存在） |
| 6b3ead95 | keyboard | 非 US 键盘 | PR-3d | `skipped`（marktext 应用层 renderer keybindings 设置页，非 muya 内核） |
| ed1b3354 | keyboard | 图片选中按 delete | PR-3d | `fixed`（`selection/index.ts:_listenSelectActions` 把 `/Backspace\|Enter/` 替换为 `/^(?:Backspace\|Delete\|Enter)$/`，覆盖 Delete 键 + 锁住完整匹配避免子串碰撞；clipboard 路径无 selectedImage 副作用，无需同步修复） |
| b925f7d6 | clipboard | 移动端 cut | PR-4b | `verified-not-applicable`：新仓 `cutHandler` 起手即 `if (selection == null) return;`，等价 marktext 的 `if (!start || !end) return;` 守卫 |
| 393139e5 | clipboard | clipboard 过度 sanitize | PR-4b | `verified-not-applicable`：新仓 `getClipboardData` 单块/多块路径都 `text = substring(...)`/`mdGenerator.generate(...)` 直出，无 `escapeHtml`；含 2 个防御测试 |
| 54a3b585 | clipboard | 粘贴 HTML escape | PR-4a | `verified-not-applicable`：`utils/paste.ts` 已 `sanitize(html, PREVIEW_DOMPURIFY_CONFIG, false)` |
| 485fcfe0 | clipboard | image paste handler 不执行 | PR-4a | `verified-not-applicable`：新仓 pasteHandler 无 image paste 路径；进入 paste handler 后不会因 `!text && !html` 早退 |
| 5b1cd85d | clipboard | 末尾 html block 粘贴错误 | PR-13 | `verified-not-applicable`：marktext 老 `pasteCtrl` 用 `getLastBlock(blocks)` 在 fragment 树中递归找末叶并写 `lastBlock.text += cacheText`；如果末块是 `editable === false` 的 html-block，递归会进入 children 取错节点或崩。新仓 `clipboard/index.ts:631-649` 多段粘贴是 `for (state of remaining) → ScrollPage.loadBlock(state.name).create(...) + insertAfter`，结尾用 `wrapperBlock.firstContentInDescendant()` 取光标块（`block/base/parent.ts:251-258`，沿 `children.head` 向下找 `Content` 叶；html-block→html-container→code 是规则结构，永远命中一个可写 leaf）。无 fragment 末块的 cacheText 追加路径，结构上不触发 marktext bug |
| fb8fca7b | clipboard | copy/paste list | PR-4b | `verified-not-applicable`：turndown `paragraph`/`listItem` 规则已在 `utils/turndownService/index.ts`；checkbox 注入是 marktext DOM-based copy 特有，新仓走 marked 渲染不需要 |
| 067ec485 | clipboard | HTML paste handler | PR-4a | `partial-fixed`：text-only `<table>...</table>` 现在升级到 html 槽走 HtmlToMarkdown；recursion 与 pasteImage 分支新架构不适用（无 pasteImage） |
| ef59a743 | clipboard | 富文本复制 | PR-4b | `verified-not-applicable`：copyHandler 'normal' 已 `setData('text/html', html); setData('text/plain', text)`；`getClipBoardHtml` 经 marked 渲染 |
| c841facd | clipboard | 空内容不写剪贴板 | PR-4b | `fixed`（含 6 个回归测试） |

## P3 — 体验特性（PR-5 按需）

| Hash | 类型 | 说明 | 状态 |
|---|---|---|---|
| 7377de3c | feat | footnote 完整链路 | PR-8a `fixed`（block class + 注册 + 嵌套子树解析；6 个测试） |
| ab97336e | feat | highlight 菜单 | PR-9 `test-only`（`<mark>` 已在 `inlineFormatToolbar/config.ts` 含 `type: 'mark'` + 快捷键 `⇧+Cmd+H`；3 个防御测试锁住 7 个核心 inline-format type + icon 不被回退） |
| 1ef0d016 | feat | linkTools unlink/jump | PR-9 `test-only`（subscriber + `selectItem` dispatcher 已就位但 `muya-link-tools` 暂无 emitter；删 `@ts-nocheck` 补类型 + 2 个防御测试锁住 unlink / jump 分支） |
| cb25b3d4 | feat | linkTools 支持 `<a>` 与 ref link | PR-11b `fixed`（渲染端 `link.ts` / `referenceLink.ts` / `htmlTag.ts` 早已带 `dataset.{start,end,raw}` + `mu-link` / `mu-reference-link` / `mu-raw-html` class，PR-9 也铺好了 linkTools 浮层订阅器；本 PR 补齐**缺失的发射端**——新增 `editor/linkMouseEvents.ts` 把 mouseover/mouseout 上的三种 link wrapper 都派发到 `muya-link-tools`（markdown / 引用链接需上一个兄弟节点 `.mu-hide` 处于预览态，HTML `<a>` 永久触发；mouseout 用 `relatedTarget` 守门，鼠标在 wrapper 内部移动不会误隐藏）；新增纯函数 `utils/getLinkInfo.ts` 兼容读 `<a href>` 属性与 `<span>` snabbdom `props.href` 自定义 DOM 属性，`data-start`/`data-end` 走 `Number.isFinite` 守 NaN；examples 接 `LinkTools` 插件并加 `jumpClick` 回调；19 个红→绿测试 = 11 个 getLinkInfo 单测 + 8 个 mouse dispatch DOM 测试） |
| 141d25d8 | feat | 粘贴链接抓页面标题 | PR-4c | `fixed`（`res.json()`→`res.text()`，5 个测试） |
| d26f5092 | feat | image resize + inline/block 切换 | PR-11a | `fixed`（切换 UX 在新仓 `imageToolbar` 已就位 + `updateImage`/`data-align` 渲染分支；本 PR 补齐**最后一道 UX 缺口**：`selection/index.ts:_handleClickInlineImage` 在 `imageInfo.token.attrs['data-align'] === 'inline'` 时不再 emit `muya-transformer`，inline 图片不再叠出 resize bar；抽出 `selection/imageDisplay.ts:shouldShowImageResizeBar` 纯函数 + 11 个单元测试锁住规则） |
| cb7be189 | feat | inline image / small image | PR-11a | `fixed`（`image.ts` 渲染器接住 `loadImageAsync` 已返回的 `width`/`height`，当 `width < 100 || height < 100` 时给 wrapper 追加 `.mu-small-image` 类；`CLASS_NAMES.MU_SMALL_IMAGE` 加入 hash；5 个渲染单测覆盖小宽 / 小高 / 双大 / loading / fail 5 个分支；后续修补：`loadImageAsync` 异步加载成功分支同步加 `.mu-small-image`，避免 cache miss 首次渲染后类延迟到下次 re-render 才出现；新增 3 个 first-load DOM 测试） |
| 9eff8248 | feat | focus / blur 事件 | PR-10a | `fixed`（`muya.ts::_bindFocusBlurEvents` 用 `attachDOMEvent` 监听 `domNode` 的 focus/blur DOM 事件并 `emit('focus')`/`emit('blur')`，destroy 时 `detachAllDomEvents` 自动清理；3 个 happy-dom 测试 + examples 加 demo log） |
| 8474a997 | feat | prism 语言别名 | `verified-not-applicable`（新仓 `packages/core/src/utils/prism/index.ts:21-36,47` fuse 已含 alias key + `loadLanguage.ts:24-55 transformAliasToOrigin` 已实现） |
| 8af9605e | feat | code block Solidity 等语言 | `verified-not-applicable`（新仓 `packages/core/src/utils/prism/loadLanguage.ts` 已动态读 `prismjs/components.js`，删掉了上游那张白名单 JSON，Solidity 等天然可用） |
| 47cb2bbe | feat | indent code block | `verified-not-applicable`（上游核心是"4-space 自动转换"路径，新仓 `packages/core/src/block/base/format.ts:53` regex `^( {4,})` + `_convertToIndentedCodeBlock()` (`:1163-1211`) 已实现；UI 上无显式入口，但上游也没有） |
| 7aa0d1bf | feat | code block 复制按钮 | `verified-not-applicable`（新仓 `packages/core/src/block/commonMark/codeBlock/code.ts:15-41 renderCopyButton` + `:88-101` 点击经 `editor.clipboard.copy('copyCodeContent', ...)`；`.mu-code-copy` 样式见 `blockSyntax.css`） |
| a028a7c2 | feat | code block 行号 | PR-5a | `fixed`（`codeBlockLineNumbers` 选项默认关闭；`renderLineNumbersInnerHTML` + `.mu-line-numbers-rows` 渲染；仅 `code-block` 容器接入，frontmatter / math / diagram / html 不挂；10 个回归测试） |
| ef9fe756 | feat | underline 格式 | PR-9 `test-only`（`<u>` 已在 `inlineFormatToolbar/config.ts` 含 `type: 'u'` + 快捷键 `Cmd+U`；由 `ab97336e` 同一份 7-type 防御测试覆盖） |
| 81af43be | feat | quick insert hint 隐藏 | PR-9 `test-only`（`muya.ts::getContainer` 已读 `options.hideQuickInsertHint` 控制 `mu-show-quick-insert-hint` class；3 个防御测试锁住 默认 / false / true 三态） |
| c0c8ea4b | feat | 打开外链 / 本地 md | PR-12 `skipped`（Electron `shell.openExternal` 路径，跨 SDK 边界，应用层做） |
| afe68891 | feat | SM.MS 上传删除链接 | PR-12 `skipped`（uploader 专属，新仓不集成 uploader） |
| 435dca74 | feat | Unsplash 搜图 | PR-12 `skipped`（网络依赖 + API key + UI 重大改动，对纯 markdown 库过重） |
| f3b53427 | feat | 跳光标到末尾再格式化 | PR-10b `fixed`（`format.ts::_addFormat` 在 paired marker (strong/em/inline_code/del/inline_math) 和 tag marker (u/sub/sup/mark) 分支按 `wasCollapsed` 分流：非空选区光标跳到闭合标记之后，单点光标保留在 marker 之间（toggle-then-type）；link/image 保持原"光标落在 `()` 之间"行为；17 个单元测试覆盖每种 marker + 偏移 + collapsed 回归） |
| efd38644 | feat | 长 footnote 编号 | PR-8c `fixed`（renderToStaticHTML 收集 + inline 编号 sup + `<section class="footnotes">` 反链；6 个测试） |
| 318bfc6a / fc89d04a / 37b96c88 | feat | footnote 系列 | PR-8b `fixed`（footnoteTool TS 重写 + click 接线 + Create/Go to；4 个测试） |

## P4 — 明确不迁

- marktext 应用层（Electron / preferences / IPC / 文件系统 / theme / print / 键位设置 UI）
- 老 muya CSS 主题
- 已被新架构结构性解决的 partialRender / contentState ctrl 系列
- 纯 lint / 格式化 / 依赖升级
- marktext i18n 文案

## PR-6 — 测试合规迁移（PR-2~4 落地后做）

PR-6a 已落地（2026-05-20）：CommonMark 0.31 + GFM 0.29-gfm spec 合规基础设施。

### PR-6a 交付

- 新增公开同步 API：`renderToStaticHTML(markdown, options?)`，18 个单元测试（happy-path + DOMPurify XSS 处理 + 全部 5 选项覆盖 + mermaid/diagram 占位 + `sanitize: false` 关闭路径）
- `commonmark-spec@^0.31.2` devDep（652 个 example）
- 自解析 GFM spec：`packages/core/test/spec/fixtures/gfm-spec-0.29-gfm.json`（672 个 example，含 5 个 GFM extension section）
- spec runner：`test/spec/runner.ts`（normalizeHtml 折叠 cosmetic 空白 + 防回归 expected-failures 锁）+ 8 个 normalizer 单测
- 两份 spec 测试：`commonmark.spec.ts` + `gfm.spec.ts`，每 example 一条 `it.each`，共 1324 测试，全部锁定通过
- 修复 `getHighlightHtml` 中 `footnote` 选项未连线的 no-op bug
- baseline 报告：`test/spec/conformance.md`（按 section 拆 pass-rate）
- expected-failures.json：CM 80 个 + GFM 92 个待修 example_id
- vitest 配置拆分：默认 `pnpm test` 仅跑 unit；新增 `pnpm test:spec` / `test:spec:commonmark` / `test:spec:gfm`，独立 `vitest.spec.config.ts`
- CI：`.github/workflows/ci-test.yml` 增加 `pnpm test:spec` 步骤

### PR-6a baseline 通过率

| Suite | 通过 | 总数 | 通过率 |
|---|---|---|---|
| CommonMark 0.31 | 572 | 652 | **87.7%** |
| GFM 0.29-gfm | 580 | 672 | **86.3%** |

> 合并后通过率只能涨不能跌：`expected-failures.json` 中的 example 若开始通过，测试会以 "unexpected pass" 报错，要求 reviewer 把它从列表里移除。

Spec runner 用 `renderToStaticHTML(..., { sanitize: false })` 跑——衡量的是 parser 的合规度，不是 DOMPurify sanitizer 行为（sanitizer 该激进就激进，spec 的 Raw HTML allowance example 会被它合法地剥离）。DOMPurify sanitize 行为由 `renderToStaticHTML` 默认 `sanitize: true` 单元测试覆盖。

`normalizeHtml` 规范化：兼属性名排序、self-closing void 标签统一、相邻 tag 间空白折叠（`>(WS)<` → `><`）、void 标签后空白剥离。`<pre>`/`<code>` 内容（如行末 `\n`）保留——因为 collapse 只匹配纯空白 token 间隔，content 字符不动。

### PR-6b 交付（2026-05-20）

完成 marktext 测试补齐三件套：

- **footnote 510 行补齐**：`utils/marked/extensions/__tests__/footnote.spec.ts` 从 13 → 21 个测试，新增 8 个 multi-line body 场景（next-line / next-paragraph / 多段落 body / 嵌套 list / 嵌套 code block / 终止于非缩进段落 / 终止于不足 4-space 缩进）。顺手修了 `footnote.ts` cleanup 路径的小 bug：第一行 4-space 缩进未剥离导致 multi-line body 被误识别成 indented code block（解决方案：cleanup 加一道 `^ {4}` strip）。
- **markdown-basic round-trip**：新增 `test/spec/roundTrip.spec.ts` + 11 个 marktext fixture（`test/spec/fixtures/marktext-round-trip/{common,gfm}/`）。15 个测试（11 stability + 4 strict identity round-trip）。
- **list-indentation 5 个策略**：`state/__tests__/listSerialization.spec.ts` 原 11 个 + 新增 `dfm` (Daring Fireball) 策略 → 12 个。

合计 PR-6b 新增 24 个测试，1 个 footnote parser bug fix。

### PR-6b 待办（旧；保留为后续追踪参考）

目标：补足"非 bug regression"的测试覆盖。PR-2~5 的每条 fix 都自带回归测试，但 happy-path、合规性、广覆盖的测试目前稀疏。

### 值得迁（高信号）

- marktext `test/unit/specs/parser/marked` 系列的 lexer / tokenizer 单元测试 —— 对应新仓 `state/markdownToState.ts` + `inlineRenderer/lexer/`，纯输入→输出，架构无关
- markdown ↔ state ↔ html 的 round-trip 测试
- footnote / table / list / emoji / math 块和内联的 happy path 测试（区别于 bug regression）

### 值得替代（不搬 marktext 的，直接接上游）

- **CommonMark 0.31 合规**：把 [`spec.json`](https://github.com/commonmark/CommonMark/blob/master/test/spec.json) 接进 vitest 驱动 `markdownToHtml`。约 670 个 example，比 marktext 自带合规测试更广更权威
- **GFM 合规**：用 [GFM spec example list](https://github.github.com/gfm/) 同样做法

可接受 fail rate 阶梯：初期允许 5%（先有 baseline 看见缺口），逐步降到 1%；按 spec section 拆分单独跟踪。

### 不迁

- 针对 `ContentState.prototype.*` / 旧 ctrl 方法的行为测试（API 不存在）
- 光标位置 / DOM 交互 / partialRender 的实现细节测试（OT 架构后机制完全不同）

### 实施

- 拆 PR-6a（marktext 选择性测试搬运）+ PR-6b（CommonMark/GFM spec 集成 + baseline 报告）
- 单独的 vitest project 配置（`test:spec` 命令），与现有 unit test 分开，可独立看通过率
- 在 CI 加 spec compliance 趋势报告（每次 PR 不要求 100%，但不能下降）

---

## 进度统计

| PR | 计划条数 | 已完成 | 占比 |
|---|---|---|---|
| PR-1a | 6 | 4 | 67%（2 fixed + 2 verified-not-applicable，2 转 PR-3） |
| PR-1b | 7 | 6 | 86%（1 fixed + 4 verified-not-applicable + 1 skipped；防御测试 15 个） |
| PR-2 | 26 | 15 | 58%（PR-2a 8 commits = 2 fixed bugs + 9 test-only；PR-2b 3 commits = 1 fixed bug + 2 test-only；PR-2c 1 commit = 2 test-only + 3 skipped；3 条转 PR-3/PR-4；新增 57af8304 入册）|
| PR-3a | 5 | 5 | 100%（4 verified-not-applicable + 1 test-only；防御测试 2 个 soft-line） |
| PR-3b | 4 | 4 | 100%（1 fixed `358fa83d` + 3 verified-not-applicable；回归测试 13 个） |
| PR-3c | 3 | 3 | 100%（3 verified-not-applicable；+1 compositionend 防御测试；跨 block+IME 留 examples/ 手测） |
| PR-3d | 11 | 11 | 100%（2 fixed `5fb130d9`+`ed1b3354` + 6 verified-not-applicable + 2 test-only + 1 转 PR-4；回归测试 8 个） |
| PR-4a (粘贴) | 5 | 5 | 100%（2 fixed + 3 verified-not-applicable；5b1cd85d 末尾 html-block 经 PR-13 代码路径验证） |
| PR-4b (复制) | 7 | 7 | 100%（1 fixed + 6 verified-not-applicable；防御测试 8 个） |
| PR-4c (P3 抓标题) | 1 | 1 | 100%（fixed，5 个测试） |
| PR-5 | 18+ | 5 | 28%（PR-5a 1 fixed `a028a7c2`（行号，10 个测试）+ 4 verified-not-applicable：`8474a997`/`8af9605e`/`47cb2bbe`/`7aa0d1bf`） |
| PR-5a (P3 code block 行号) | 1 | 1 | 100%（fixed，10 个测试） |
| PR-6a | — | done | spec 合规基础设施落地（CM 572/652 = 87.7%, GFM 580/672 = 86.3%，1324 spec 测试 + 8 normalizer 单测 + 18 个 renderToStaticHTML 单测） |
| PR-6b | — | done | marktext 测试补齐落地（footnote 8 个新测试 + 1 个 parser fix；round-trip 15 个测试 + 11 fixture；list-indent +1 dfm 策略） |
| PR-13 (residuals) | 5 | 4 | 80%（4 项 A 组遗留收尾：3 verified-not-applicable `b8e2cd82`/`5b1cd85d`/`0baf2e9e`+`7de33f11` + 1 skipped (已拆条) `0a3fda63`+`2754e393`+`4b362e52`；`9cb2cbe8` 原计入此 PR 为 skipped，已转入 PR-15 处理；新增 18 个防御测试: 2 sup/sub HTML + 16 DOMPurify XSS；post-refactor 拆出 11 个子条目: 2 pending + 6 verified-not-applicable + 3 skipped 应用层/docs） |
| PR-15 (TOC) | 1 | 1 | 100%（1 fixed `9cb2cbe8`：新增 `muya.getTOC()` 公共 API + `generateGithubSlug` helper + `ITocItem` 类型导出；10 个回归测试） |
| PR-16 (reference link/image) | 1 | 1 | 100%（fixed：`markdownToState` 加 `case 'def'` + `loadImageAsync` 返回 resolved `url` + `referenceImage` 用它 + `lexer.ts` label lookup 大小写规范化 + `ILinkReferenceDefinitionState` 标 `@deprecated`；8 个回归测试 + examples demo） |
| PR-17 (EventCenter fixes) | 2 | 2 | 100%（2 fixed：`unsubscribeAll()` + `muya.destroy()` 调用消除 pub/sub 闭包泄漏；`emit()` `.slice()` snapshot 修复 once-listener 迭代索引塌缩；5 个回归测试）|

最后更新：2026-05-21（PR-17 落地：EventCenter listener 泄漏 + once-listener 迭代变更修复，5 个回归测试，全套 386 测试通过）
