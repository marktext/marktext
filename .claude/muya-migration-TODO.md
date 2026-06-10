# muyajs → @muyajs/core 迁移 TODO

> 迁移工作跟踪文档（归档于 develop 的 `.claude/`，作为本次引擎迁移的完整记录）。
> 状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成。
> 最后刷新：parity 15/15 + 阶段 A–G 全部完成并合入 develop；表格回归 #4435/#4437 已收尾。**H（删 muyajs）推迟到 0.20.0 正式发布后。**
> 剩余：① Phase H（删除 muyajs，待 0.20.0）② 用户手动功能回归（清单见 `~/Desktop/MarkText功能回归清单.md`）。

## ✅ 阶段 A/B/C — 引擎层（全部合入 develop）
- [x] A1 块编辑 updateParagraph(#4391) · createTable/insertImage/setCursor(#4397) · duplicate/insert/deleteParagraph(#4384)
- [x] A2 inline format(type) (#4381) · A3 选区/光标/聚焦(#4381,#4397) · A4 运行时 setOptions/setFont/setTabSize/setListIndentation(#4393)
- [x] A5 历史序列化(#4394) · A6 剪贴板(#4381) · A7 拼写替换(#4392) · A8 selection-change cursorCoords+formats(#4387)
- [x] A9 交互事件 format-click/preview-image(#4390) · A10 工具函数导出(#4381)
- [x] B1 focus 模式(#4389) · B2/B3/B4 flowchart+sequence+sequenceTheme+菜单(#4385) · B5 ImagePathPicker/clipboardFilePath/invalidateImageCache(#4386/#4398/#4396)
- [x] B6 imageAction(state) 签名桌面适配（muyaImageAction adapter + 构造器 options 接入 #4417）
- [x] C1/C2 可主题化 CSS 变量 + mermaid/vega 主题色(#4382)
- [x] 额外：CJK 加粗 flanking(#4401) · lint:css(#4388/#4419) · 回归 specs #4341/#4307/#4190(#4399)

## ✅ 阶段 D — 桌面切换（完成）
- [x] D1+D4 接入 @muyajs/core + 工具文件重写(#4402)（pdf Slugger / printService getImageInfo 暂留 → 已收尾：pdf slugger #4415、printService #4423）
- [x] D2 editor.vue 核心切换（构造+init/插件集/options/事件/方法/导出/i18n/图片工作流）+ e2e — **#4406 + Wave2 #4415 已合**
- [x] D3 i18n locale 桥接（并入 #4406/#4405）
- [x] D5 导出/PDF/print 包装（MarkdownToHtml.generate+getTOC / exportStyledHTML #4412 + printService #4423）
- [x] D6 CSS 引入 `@muyajs/core`（#4406）
- [x] D7 quickinsert 触发键统一 `/`（桌面 `@` 残留清理 + EDITING.md）— **#4405 已合**

## ✅ 阶段 D-gaps — parity 15/15 全部修复合入 develop
> 由 d2-parity-review 对抗式复核得出；test-first（记分板 #4407）→ Wave1 7 引擎 PR → Wave2 桌面 #4415。
### MAJOR（9）
- [x] PG1 selection-change affiliation + anchorBlockInfo/focusBlockInfo — 引擎 **#4410** + 桌面适配器 **#4415**
- [x] PG2 源码模式返回 WYSIWYG 光标还原 — 引擎 Muya.setCursorByOffset **#4420** + 桌面 handleFileChange **#4415**
- [x] PG3 autoCheck 任务列表勾选级联 — **#4409**
- [x] PG4 拖拽插图 drop/dragover→imageAction（dragDropImage.ts + 7 单测）— 引擎 **#4413** + 桌面构造器接入 **#4417**
- [x] PG5 剪贴板二进制/位图粘贴(FileReader→imageAction) — **#4411** + 构造器 **#4417**（OS 剪贴板半留人工QA）
- [x] PG6 粘贴图片文件走 imageAction(落盘) — **#4411** + 构造器 **#4417**
- [x] PG7 导出内联核心 CSS(?inline) — **#4412**
- [x] PG8 导出标题注入 github slug id — **#4412** + 桌面 pdf.ts slugger **#4415**
- [x] PG9 引擎 Muya.copyAsRich() — **#4411** + 桌面 COPY_PASTE_METHOD_MAP 映射 **#4415**
### MINOR（6）
- [x] PG10 Space 选中图片 emit preview-image — **#4414**（桌面已订阅）
- [x] PG11 标题 hover-copy + heading-copy-link — 引擎 **#4414** + 桌面重订阅 **#4415**
- [x] PG12 hideLinkPopup 消费 — **#4409**
- [x] PG13 insertParagraph 嵌套块就近锚定 — **#4408**
- [x] PG14 源码模式批量编辑单步 undo（Muya.replaceContent 整步重建，27 单测）— **#4420**（用户要求做正确修复，已做）
- [x] PG15 undo 回磁盘内容后 saved 指示器复位（合成 history id = 撤销栈深度）— **#4415**
> ⚠️ #4417：#4406 重写漏接构造器 imageAction/getPathForFile，导致 PG4/5/6 桌面侧一度失效（headless 测不到，记分板漏）；已修。印证 G 的必要。

## ✅ 阶段 E — 主题迁移（完成；E5 归 H）
- [x] E1 32 *.theme.css 加 kebab 编辑器变量(#4404)
- [x] E2 prism + CodeMirror 主题：核实无需改（.CodeMirror + 通用 code/language- 选择器引擎无关）
- [x] E3 academic/liber 导出主题 target `.markdown-body`（#4412 产该 wrapper）— 已核实，无需改
- [x] E4 theme.ts 注入选择器 ag-→mu-（wrapCodeBlocks `.mu-code-block .mu-code` 提权 / `.mu-emoji-picker` / `.mu-code-block`）— **#4421**
- [ ] E5 *.theme.css 里编辑器用的 camelCase 旧变量清理 → 随 H 删 muyajs 时一并做

## ✅ 阶段 F — 测试清理（完成）
- [x] F1 删 8 冗余引擎单测（markdown-*/slugger/extract-word，全 import muya/lib，muya conformance/footnote/strongCjk/getTOC/replaceCurrentWord 已覆盖）— **#4422 已合**
- [x] F2 回归用例移植到 muya（#4399 + CJK #4401）
- [x] F3 slugger/extract-word 随 F1 删除（muya 覆盖）— **#4422**
- [x] F4 e2e 无 muya-DOM ag- 残留（仅 .ag-dialog-table 桌面自有对话框 + .el-overlay 兜底；crash-* 的 muya/lib 仅注释）

## 📋 剩余（除 G/H）
- [~] printService.ts getImageInfo 移植 → **PR #4423（待合）**：桌面源码**最后一个** muya/lib import；内联 file:// 解析（window.path.resolve + DIRNAME），typecheck 绿。合后桌面源码不再依赖 muyajs → 解锁 H。

## 🔍 阶段 G — 逐功能对照验证（审计已跑，发现 8 个真实 bug）
> 静态接线审计 workflow（run wf_4245520d，18 agent/9 维度，对抗式验证）。证据：/tmp/d2-review/phase-g-gaps.md。
> 设置/Edit/Paragraph/Format 大量接线**完好**；但发现 8 个 CI/记分板都漏掉的真实功能 bug（1 blocker + 5 major + 2 minor）。
> 另：i18n key 审计发现 3 个缺失 key（heading-copy-link #4424 已合 + Click-to-add-image/Load-image-failed #4427 已合）。
- [x] G1 [BLOCKER] 相对路径图片渲染修复（getImageSrc 锚定 window.DIRNAME）— **#4428 已合** + Win/UNC root 加固 **#4430 已合**
- [x] G2 frontmatterType 正确推导 lang/style（yaml/toml/json）— **#4429 已合**
- [x] G4 Paragraph▸"Paragraph" 只转就近 leaf、不毁容器（review 修：heading-in-list 也能转）— **#4429 已合**
- [x] G5 Front Matter 文首插入+幂等（review 修：quick-insert 路径同样走文首）— **#4429 已合**
- [x] G3 Edit▸Replace 改发 'replace' — **#4431 已合**
- [x] G6 saved 指示器 false-clean 修复（合成 id 改为内容键控、单调不复用）— **#4431 已合**
- [x] G7 WYSIWYG→源码模式光标同步（引擎 getCursorOffset 读向 + 桌面 emit muyaIndexCursor）— **#4432 已合**
- [x] G8 切语言刷新内联提示（Muya.locale() 触发 _forceRender，保历史/光标）— **#4432 已合**
> 教训：这些都是 headless 测不到的运行时/真机 bug —— 印证 G 必须在删 muyajs 前做。

## 🗑️ 阶段 H — 删 muyajs + 文档（**推迟到 0.20.0 正式发布后**，用户决定 packages/muyajs 保留至发布；其余非删除类清理可做）
- [ ] H1 删 packages/muyajs + 移除 muya alias / src/types/muya.d.ts / @marktext/muyajs 依赖 + 重建 lock + E5 清 camelCase 变量
- [ ] H2 文档：根 CLAUDE.md / packages/muya/CLAUDE.md（移除"暂不接入桌面"）/ ARCHITECTURE.md / TYPESCRIPT.md / INTERFACE.md / IPC.md

## 杂项 / 收尾
- markdownMathMode.ts / dompurify.ts / icon.vue 里的 muya/lib 仅注释（非 import）→ 随 H 顺手清。
- 停掉/完成 agent 的 worktree + 孤立 fix/muya-lint-css 分支（含一处 lint:css 注释 grammar 改）→ 收尾统一 prune/删。

## 已合入里程碑（develop）
Parity 15/15：#4406 引擎切换 · #4405 i18n · #4407 记分板 · Wave1 #4408-#4414 · Wave2 #4415 · #4417 构造器 imageAction/getPathForFile · #4420 PG14。
其它：lint:css #4419 · E4 主题 #4421 · F 测试清理 #4422。
收尾：test 缺口 #4434 + de-flake #4436 · 表格跨单元格选择 #4435 · **表格 grid picker 纠错恢复 #4437（54b12e21）**。
> ✅ 本 session 全部活跃迁移工作完成。剩余仅：Phase H（删 muyajs，推迟到 0.20.0）+ 用户手动回归。

## 📦 迁移收尾交付（本 session）
- [x] 功能回归文档 12/12 区域、286 条 → 英文 `MIGRATION_REGRESSION_CHECKLIST.md` + **中文版已放桌面** `~/Desktop/MarkText功能回归清单.md`（潜在回归 7 项 + 测试缺口 255 条）。用户下个 session 手动回归。
- [x] 表格疑似回归修复 → **#4435 已合**（df98a723）：跨单元格选择恢复（TableCellSelection + cellAt/getSubTableState + 剪贴板，+18 测试）。✅ 正确，保留。
- [x] ⚠️ **#4435 误删 TableChessboard 已纠正 → #4437 已合**（54b12e21）：#4435 把 TableChessboard 判为 "dead-on-arrival" 删除是**错的**——它是真功能（legacy muyajs `/table` 走 `showTablePicker`→grid 选择器），TS 重写只丢了**触发器**没丢 UI，所以读着像死代码（订阅了 `muya-table-picker` 但无人 dispatch）。#4437 恢复插件 + 移植触发器（`replaceBlockByLabel` 拦截 `label==='table'`→emit `muya-table-picker`，handler `createTable({rows:row+1,columns:column+1})`），并修了两个 legacy 隐藏 bug（keyupHandler NaN 守卫、`_current/_select` 别名克隆）+ e2e 改写为 picker 流程 + 单测 teardown。跨单元格选择（#4435 正确那半）未动。
  > 教训：删除前 "无引用" ≠ "无功能"——当引用是**运行时事件 dispatch** 时，headless gate 只能验 handler 不能验 trigger。Phase H 删 muyajs 时务必逐个核运行时触发路径。
- [x] 高价值测试缺口补全 → **#4434 已合**（52ec2b18）：headingLocaleCrash（非 en 打 '#' 不崩）/backspaceUnwrap/tableCell backspace/formatToggle/insertRowColumn。其余缺口留 backlog。
- [ ] 非删除类清理：muya/lib 注释 + muya.d.ts shim + alias 实为 H（muyajs 留到 0.20.0，推迟）；孤立 agent worktree/分支 → session 末统一 prune（避免干扰在跑 agent）。
