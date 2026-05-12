<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  也提供以下语言翻译：
  <a href="../../README.md">EN</a>
  <a href="README-zh_tw.md">TW</a>
  <a href="README-de.md">DE</a>
  <a href="README-es.md">ES</a>
  <a href="README-fr.md">FR</a>
  <a href="README-jp.md">JP</a>
  <a href="README-kr.md">KR</a>
  <a href="README-pt.md">PT</a>
</div>

---

<div align="center">
  <strong>🔆 下一代 Markdown 编辑器 🌙</strong><br>
  一款专注于速度与易用性的简洁优雅的开源 Markdown 编辑器。<br>
</div>

<div align="center">
  <!-- Latest Release Version -->
  <a href="https://github.com/marktext/marktext/releases/latest">
    <img alt="GitHub Release" src="https://img.shields.io/github/v/release/marktext/marktext">
  </a>
  <!-- Downloads total -->
  <a href="https://github.com/marktext/marktext/releases">
    <img alt="GitHub Downloads (all assets, all releases)" src="https://img.shields.io/github/downloads/marktext/marktext/total">
  </a>
  <!-- Downloads latest release -->
  <a href="https://github.com/marktext/marktext/releases/latest">
    <img alt="GitHub Downloads (all assets, latest release)" src="https://img.shields.io/github/downloads/marktext/marktext/latest/total">
  </a>
</div>

- [MarkText](https://github.com/marktext/marktext) 是由 [Jocs](https://github.com/Jocs) 与[贡献者们](https://github.com/marktext/marktext/graphs/contributors)编写的免费开源 Markdown 编辑器。

# 1. 安装

> ⚠️ 这些版本仍处于 **测试阶段**（因为我不清楚迁移过程中破坏了多少内容）。请在 [问题追踪器](https://github.com/marktext/marktext/issues) 中报告任何错误

## Windows

- 直接查看 [发布页](https://github.com/marktext/marktext/releases)！

- 已在以下系统测试：
  - `Windows 11`

## Linux

- 直接查看 [发布页](https://github.com/marktext/marktext/releases)
- 已在以下系统测试： `Ubuntu 24.0.2`、`Ubuntu 22.04.5`
  - _欢迎帮助测试其他 Linux 软件包！_

### Linux 包管理器

##### 1. Arch Linux [![AUR Version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- 感谢 [@kromsam](https://github.com/kromsam)，可在 [AUR](https://aur.archlinux.org/packages/marktext-bin) 获取

## MacOS

> ⚠️ 由于**缺少公证**，MacOS 版本会显示"`MarkText is damaged and can't be opened`"。
> 请参考[此处的修复方法](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300)（同样适用于任何缺少开发者账号签名的应用）

- 可在[发布页](https://github.com/marktext/marktext/releases)获取

# 2. 截图

![](../marktext.png?raw=true)

# 3. ✨功能 ⭐

- 🆕 现已支持从 `偏好设置` 编辑器中切换 **9 种语言**（特别感谢 [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- 实时预览（所见即所得），界面干净简洁，带来无干扰写作体验。

- 支持 [CommonMark 规范](https://spec.commonmark.org/0.29/)、[GitHub 扩展 Markdown 规范](https://github.github.com/gfm/)，并选择性支持 [Pandoc Markdown](https://pandoc.org/MANUAL.html#pandocs-markdown)。

- 提供 Markdown 扩展，例如数学公式（KaTeX）、Front Matter 与表情符号。

- 支持段落与行内样式的快捷方式，提升你的写作效率。

- 可导出 **HTML** 与 **PDF** 文件。

- **33 款内置主题**，包含 **Dracula**、**Nord**、**Catppuccin**、**Tokyo Night**、**Gruvbox** 等热门方案。

- 多种编辑模式：**源代码模式**、**打字机模式**、**专注模式**。

- 可直接从剪贴板粘贴图片。

## 3.1 🌙 主题🔆

MarkText 内置 **33 款主题** —— 10 款浅色与 23 款深色：

**浅色**：Ayu Light、Cadmium Light、Catppuccin Latte、Everforest Light、Graphite Light、Gruvbox Light、Rosé Pine Dawn、Solarized Light、Tokyo Night Light、Ulysses Light

**深色**：Ayu Dark、Ayu Mirage、Cadmium Dark、Catppuccin Mocha、cyberdream、Dracula、Everforest Dark、Gruvbox Dark、Horizon Dark、Kanagawa、Material Dark、Monokai Pro、Nightfox、Nord、One Dark、Oxocarbon Dark、Palenight、Rosé Pine、Rosé Pine Moon、Solarized Dark、Synthwave '84、Tokyo Night、Tokyo Night Storm

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

> 📖 完整主题列表（含描述与截图）请参见 [docs/THEMES.md](../THEMES.md)。

## 3.2 😸编辑模式🐶

|       源代码       |         打字机         |       专注        |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. 贡献者

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. 太棒了！我能如何贡献？

- 任何形式的：
  1. 错误测试（Bug-Reports）
  2. Pull Request

  都非常欢迎！

## 6. 项目设置

- 参见[开发者文档](../dev/README.md)
