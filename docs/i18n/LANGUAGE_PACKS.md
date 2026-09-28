# 语言包插件（Language Packs）

MarkText 支持**热插拔语言包**：把一个 JSON（或一个文件夹）丢进指定目录，重启（或重新扫描）后即可在「偏好设置 → 语言」里选用，**无需改源码、无需重新打包**。

适合社区译者、企业内部分发、小语种快速扩展。

---

## 一、安装一个语言包

任选其一（目录不存在时可自行创建）：

| 优先级 | 目录 | 适用场景 |
| --- | --- | --- |
| 1（低） | 安装目录内 `static/locales/` | 官方内置语言 |
| 2 | **用户数据目录** `lang-packs/` | **推荐：用户/译者安装** |
| 3 | 用户数据目录 `locales/` | 兼容简单丢文件 |
| 4（高） | 便携版/源码运行时的 `./lang-packs/` | 覆盖同名内置翻译 |

**用户数据目录**位置：

- Windows：`%APPDATA%/marktext/lang-packs/`
- macOS：`~/Library/Application Support/marktext/lang-packs/`
- Linux：`~/.config/marktext/lang-packs/`

> 后扫描到的目录会**覆盖**先扫描到的同语言 id。因此用户包可覆盖内置翻译。

安装后：

1. 完全退出并重新启动 MarkText（或重新打开应用）
2. 打开 **偏好设置 → 通用 → 语言**
3. 选择新出现的语言（显示为语言包里的 `nativeName`）

---

## 二、两种打包格式

### 格式 A：扁平 JSON（最简单）

文件名即语言代码，例如 `th.json`、`pt-BR.json`。

```json
{
  "$meta": {
    "id": "th",
    "name": "Thai",
    "nativeName": "ไทย",
    "author": "Your Name",
    "version": "1.0.0"
  },
  "muya": {
    "Code Block": "บล็อกโค้ด",
    "Paragraph": "ย่อหน้า"
  },
  "menu": {
    "file": {
      "save": "บันทึก"
    }
  }
}
```

说明：

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| 文件名 | 是 | 语言 id，须匹配 `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`（如 `th`、`pt-BR`） |
| `$meta.id` | 否 | 若填写，必须与文件名一致 |
| `$meta.name` | 否 | 英文名，缺省用 id |
| `$meta.nativeName` | 否 | **偏好设置里显示的名字**，缺省用 `name` 或 id |
| `$meta.author` / `$meta.version` | 否 | 元信息 |
| `muya` | 否 | 编辑器引擎 UI 字符串（可只翻一部分） |
| 其余键 | 是 | 与 `packages/desktop/static/locales/en.json` **同构** 的界面文案 |

**不完整翻译是允许的**：缺的键会自动回退到英文。

可直接复制 `en.json` 或 `zh-CN.json` 作为底稿翻译。

### 格式 B：文件夹语言包（便于附带说明与多人协作）

```text
lang-packs/
  thai/
    manifest.json
    messages.json
    muya.json          ← 可选
    README.md          ← 可选，给人看
```

`manifest.json`：

```json
{
  "id": "th",
  "name": "Thai",
  "nativeName": "ไทย",
  "author": "Your Name",
  "version": "1.0.0"
}
```

`messages.json`：与格式 A 的正文相同（可带或不带 `$meta` / `muya`）。

`muya.json`：任选其一

```json
{ "resource": { "Code Block": "บล็อกโค้ด" } }
```

或

```json
{ "Code Block": "บล็อกโค้ด" }
```

消息文件也可以叫 `<id>.json`（例如 `th.json`），与 `messages.json` 二选一。

---

## 三、文案键从哪里来？

1. **界面 / 菜单 / 对话框**：以 `packages/desktop/static/locales/en.json` 为权威键集  
2. **编辑器内浮层（工具栏、快速插入等）**：以 `packages/muya/src/locales/en.ts` 的 `resource` 为键集  
   - 这部分放在语言包的 `muya` 段  
   - 键是英文原文（如 `'Code Block'`），不是嵌套路径  

推荐流程：

```bash
# 1. 复制英文底稿
cp packages/desktop/static/locales/en.json ~/path/to/my-lang-packs/th.json

# 2. 在 th.json 顶部加上 $meta，并翻译各层字符串

# 3. （可选）复制 muya 键
# 见 packages/muya/src/locales/en.ts
```

占位符 `{name}`、`{count}` 等请**原样保留**，否则插值会失败。

---

## 四、示例

仓库内示例：[`examples/lang-packs/sample/`](./examples/lang-packs/sample/)

可直接把 `sample/` 复制到用户数据目录的 `lang-packs/` 下试用。

---

## 五、实现说明（给开发者）

| 模块 | 职责 |
| --- | --- |
| `packages/desktop/src/common/langPacks.ts` | 扫描、解析、校验、注册表 |
| `packages/desktop/src/common/i18n.ts` | 取词、回退英文、暴露 catalog |
| `packages/desktop/src/main/langPacks.ts` | 注册用户/便携目录 |
| `mt::i18n::catalog` IPC | 向渲染进程提供语言列表与元数据 |
| `prefComponents/general/config.ts` | 偏好设置语言下拉（动态） |
| `util/muyaLocale.ts` | 引擎 UI：内置映射 → 包内 `muya` → 英文 |

校验规则摘要：

- id 必须是合法 locale 标签  
- `$meta.id` 若存在必须与文件名一致（扁平包）  
- 必须是 JSON object  
- 损坏文件会被**静默跳过**，不会拖垮启动  

单测：`packages/desktop/test/unit/specs/langPacks.spec.ts`

---

## 六、常见问题

**Q: 装了语言包但下拉里没有？**  
A: 确认放在了「用户数据目录」的 `lang-packs/`（不是安装目录），且 JSON 能被解析、id 合法。看主进程日志中的 `Language packs discovered...`。

**Q: 可以只翻译一部分吗？**  
A: 可以。未翻译的键显示英文。

**Q: 能覆盖内置的 `zh-CN` 吗？**  
A: 可以。放一个 `zh-CN.json` 在用户 `lang-packs/` 即可覆盖。

**Q: 为什么编辑器里少数按钮仍是英文？**  
A: 那些属于 muya 引擎文案，请补语言包的 `muya` 段。

**Q: 需要改代码加入 `SUPPORTED_LANGUAGES` 吗？**  
A: **不需要。** 插件语言是运行时发现的。仅当要贡献**内置**语言时才改 `static/locales` 与相关注册表（见 `language-registries.spec.ts`）。
