# Mermaid 引擎升级计划 (v10 → v11.14+)

## 概述

本文档描述将 MarkText 项目中的 mermaid 图表引擎从 v10.6.1 升级到 v11.14+ 的完整执行计划。

**当前版本**: `^10.0.0` (实际安装: 10.6.1)
**目标版本**: `^11.14.0` (最新稳定版)

---

## 1. 受影响的组件分析

### 1.1 核心依赖文件

| 文件 | 影响程度 | 说明 |
|------|----------|------|
| `package.json` | 高 | 更新依赖版本号 |
| `yarn.lock` | 高 | 重新生成依赖锁定文件 |

### 1.2 Mermaid 渲染相关代码

| 文件 | 影响程度 | 主要变更 |
|------|----------|----------|
| `src/muya/lib/renderers/index.js` | **高** | 动态导入路径可能变更 |
| `src/muya/lib/parser/render/index.js` | **高** | `mermaid.parse()` 和 `mermaid.init()` API 变更 |
| `src/muya/lib/utils/exportHtml.js` | **高** | `mermaid.init()` API 变更 |

### 1.3 配置与样式文件

| 文件 | 影响程度 | 说明 |
|------|----------|------|
| `src/muya/lib/config/index.js` | 低 | 主题配置项，无需变更 |
| `src/muya/lib/assets/styles/index.css` | 低 | CSS 选择器兼容，无需变更 |
| `src/renderer/components/editorWithTabs/editor.vue` | 低 | 主题配置传递，无需变更 |

### 1.4 辅助功能文件 (模式匹配引用)

以下文件仅引用 mermaid 作为字符串标识，无需代码变更：
- `src/muya/lib/contentState/containerCtrl.js`
- `src/muya/lib/contentState/paragraphCtrl.js`
- `src/muya/lib/contentState/copyCutCtrl.js`
- `src/muya/lib/contentState/backspaceCtrl.js`
- `src/muya/lib/parser/render/renderBlock/renderLeafBlock.js`
- `src/muya/lib/parser/render/renderBlock/renderContainerBlock.js`
- `src/muya/lib/ui/quickInsert/config.js`

---

## 2. Mermaid v10 → v11 关键破坏性变更

### 2.1 API 变更

| 旧 API (v10) | 新 API (v11) | 说明 |
|---------------|--------------|------|
| `mermaid.init(undefined, target)` | `mermaid.run({ nodes: [target] })` | `init()` 在 v10 已标记废弃，v11 中应使用 `run()` |
| `mermaid.parse(code)` 返回 `boolean` | `mermaid.parse(code)` 返回 `{ diagramType: string }` 或抛出错误 | 解析验证 API 返回值变更 |
| `mermaid.initialize(config)` | `mermaid.initialize(config)` | 保持不变，但 `mermaidAPI` 已标记废弃 |

### 2.2 打包格式变更

- **v10**: 使用 UMD 格式
- **v11**: 使用 ESBuild，输出 IIFE 和 ESM 格式
- 入口文件路径可能从 `mermaid/dist/mermaid.core.mjs` 变更为 `mermaid/dist/mermaid.esm.mjs`

### 2.3 其他变更

- `securityLevel: 'strict'` 仍然是默认值，行为保持一致
- 主题选项 (`default`, `dark`, `forest`) 保持不变
- 新增多种图表类型支持 (Kanban, Architecture, Radar 等)

---

## 3. 执行计划

### Phase 1: 依赖更新

**步骤 1.1**: 更新 `package.json`
```json
"dependencies": {
  "mermaid": "^11.14.0"
}
```

**步骤 1.2**: 重新安装依赖
```bash
yarn install
```

**步骤 1.3**: 验证安装
- 检查 `yarn.lock` 中 mermaid 版本
- 确认无依赖冲突

### Phase 2: 核心 API 适配

**步骤 2.1**: 修改 `src/muya/lib/renderers/index.js`

```javascript
// 旧代码
case 'mermaid':
  m = await import('mermaid/dist/mermaid.core.mjs')
  rendererCache.set(name, m.default)
  break

// 新代码 (需验证实际导出路径)
case 'mermaid':
  m = await import('mermaid')
  rendererCache.set(name, m.default)
  break
```

**步骤 2.2**: 修改 `src/muya/lib/parser/render/index.js`

```javascript
// renderMermaid() 方法中的变更
async renderMermaid () {
  if (this.mermaidCache.size) {
    const mermaid = await loadRenderer('mermaid')
    mermaid.initialize({
      securityLevel: 'strict',
      theme: this.muya.options.mermaidTheme
    })
    for (const [key, value] of this.mermaidCache.entries()) {
      const { code } = value
      const target = document.querySelector(key)
      if (!target) {
        continue
      }
      try {
        // 旧代码: mermaid.parse(code) + mermaid.init(undefined, target)
        // 新代码: 使用 mermaid.run()
        await mermaid.parse(code)
        target.innerHTML = sanitize(code, PREVIEW_DOMPURIFY_CONFIG, true)
        await mermaid.run({
          nodes: [target]
        })
      } catch (err) {
        target.innerHTML = '< Invalid Mermaid Codes >'
        target.classList.add(CLASS_OR_ID.AG_MATH_ERROR)
      }
    }
    this.mermaidCache.clear()
  }
}
```

**步骤 2.3**: 修改 `src/muya/lib/utils/exportHtml.js`

```javascript
// renderMermaid() 方法中的变更
async renderMermaid () {
  const codes = this.exportContainer.querySelectorAll('code.language-mermaid')
  for (const code of codes) {
    const preEle = code.parentNode
    const mermaidContainer = document.createElement('div')
    mermaidContainer.innerHTML = sanitize(unescapeHTML(code.innerHTML), EXPORT_DOMPURIFY_CONFIG, true)
    mermaidContainer.classList.add('mermaid')
    preEle.replaceWith(mermaidContainer)
  }
  const mermaid = await loadRenderer('mermaid')
  mermaid.initialize({
    securityLevel: 'strict',
    theme: 'default'
  })
  // 旧代码: mermaid.init(undefined, this.exportContainer.querySelectorAll('div.mermaid'))
  // 新代码: 使用 mermaid.run()
  await mermaid.run({
    nodes: this.exportContainer.querySelectorAll('div.mermaid')
  })
  if (this.muya) {
    mermaid.initialize({
      securityLevel: 'strict',
      theme: this.muya.options.mermaidTheme
    })
  }
}
```

### Phase 3: 验证测试

**步骤 3.1**: 基础功能测试
- [ ] 创建新的 mermaid 图表块
- [ ] 编辑现有 mermaid 图表
- [ ] 切换主题 (default/dark/forest)
- [ ] 复制粘贴 mermaid 图表块

**步骤 3.2**: 导出功能测试
- [ ] 导出为 HTML
- [ ] 导出为 PDF
- [ ] 打印预览

**步骤 3.3**: 错误处理测试
- [ ] 输入无效 mermaid 语法
- [ ] 空 mermaid 代码块
- [ ] 复杂嵌套图表

**步骤 3.4**: 构建验证
```bash
yarn build
yarn lint
```

### Phase 4: 回归测试

**步骤 4.1**: 运行单元测试
```bash
yarn unit
```

**步骤 4.2**: 运行 E2E 测试
```bash
yarn e2e
```

**步骤 4.3**: 手动回归测试其他图表类型
- [ ] Flowchart
- [ ] Sequence
- [ ] PlantUML
- [ ] Vega-Lite

---

## 4. 风险评估与回滚方案

### 4.1 潜在风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 导入路径变更 | 中 | 高 | 测试多种导入方式，查阅官方文档 |
| parse() 返回值变更 | 高 | 中 | 修改异常处理逻辑 |
| 浏览器兼容性问题 | 低 | 高 | 在多平台测试 |
| 打包体积增大 | 中 | 低 | 分析 bundle，必要时使用 tree-shaking |

### 4.2 回滚方案

如升级失败，执行以下回滚步骤：

```bash
# 1. 恢复 package.json
git checkout HEAD -- package.json

# 2. 重新安装旧版本依赖
yarn install

# 3. 恢复代码变更
git checkout HEAD -- src/muya/lib/renderers/index.js
git checkout HEAD -- src/muya/lib/parser/render/index.js
git checkout HEAD -- src/muya/lib/utils/exportHtml.js

# 4. 验证回滚
yarn build
```

---

## 5. 时间估算

| 阶段 | 预计时间 |
|------|----------|
| Phase 1: 依赖更新 | 15 分钟 |
| Phase 2: API 适配 | 1-2 小时 |
| Phase 3: 验证测试 | 1-2 小时 |
| Phase 4: 回归测试 | 1 小时 |
| **总计** | **3.5-5.5 小时** |

---

## 6. 附加说明

### 6.1 为什么不使用 `mermaid.render()`?

当前代码使用的是"预览 + 编辑"模式：
1. 预览模式：将 mermaid 代码块渲染为 SVG 图表
2. 编辑模式：显示原始代码，隐藏预览

`mermaid.run()` 更适合这种场景，因为它可以直接处理 DOM 元素，而 `mermaid.render()` 需要手动管理 SVG 输出。

### 6.2 新增图表类型

Mermaid v11 新增了多种图表类型，升级后自动支持：
- Kanban
- Architecture
- Radar
- Treemap
- Venn
- Ishikawa
- TreeView

用户无需额外配置即可使用这些新图表类型。

---

## 7. 参考资料

- [Mermaid v11 Release Notes](https://github.com/mermaid-js/mermaid/releases/tag/v11.0.0)
- [Mermaid API Usage](https://mermaid.js.org/config/usage.html)
- [Mermaid Migration Guide](https://mermaid.js.org/intro/getting-started.html)

---

**文档创建日期**: 2026-04-04
**最后更新**: 2026-04-04
**作者**: Sisyphus AI Agent
