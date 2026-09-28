# 示例语言包

这是一个**最小可用**的语言包插件示例，演示：

- `$meta`：在偏好设置里显示「示例语言包」
- `muya`：覆盖编辑器引擎的少量文案
- 其余键：与 `en.json` 同构的界面文案（可只翻译一部分，缺省回退英文）

## 安装

把本目录复制到用户数据目录下的 `lang-packs/`：

| 系统 | 路径 |
| --- | --- |
| Windows | `%APPDATA%/marktext/lang-packs/sample/` |
| macOS | `~/Library/Application Support/marktext/lang-packs/sample/` |
| Linux | `~/.config/marktext/lang-packs/sample/` |

也可以只复制 `xx.json` 到 `lang-packs/xx.json`。

重启 MarkText → 偏好设置 → 通用 → 语言 → 选择「示例语言包」。

完整说明见 [LANGUAGE_PACKS.md](../../LANGUAGE_PACKS.md)。
