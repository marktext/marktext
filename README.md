<p align="center"><img src="docs/assets/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>

<div align="center">
  <strong>:high_brightness: 下一代 Markdown 编辑器 :crescent_moon:</strong><br>
  一款简洁优雅的开源 Markdown 编辑器，专注速度与易用性。<br>
  <sub>支持 Linux、macOS 和 Windows。</sub>
</div>

<br>

<div align="center">
  <!-- License -->
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/marktext/marktext.svg" alt="LICENSE">
  </a>
  <!-- Downloads total -->
  <a href="https://github.com/marktext/marktext/releases">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/total.svg" alt="total download">
  </a>
  <!-- Downloads latest release -->
  <a href="https://github.com/marktext/marktext/releases/latest">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/latest/total.svg" alt="latest download">
  </a>
</div>

<div align="center">
  <h3>
    <a href="docs/i18n/README-zh_cn.md#readme">
      中文说明
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      功能特性
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download-and-installation">
      下载安装
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#development">
      开发构建
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#contribution">
      参与贡献
    </a>
  </h3>
</div>

<div align="center">
  <sub>其他语言：</sub>
  <a href="https://github.com/marktext/marktext/blob/master/README.md">
    <span>English</span>
  </a>
  <span> · </span>
  <a href="docs/i18n/README-zh_tw.md#readme">
    <span>繁體中文</span>
  </a>
  <span> · </span>
  <a href="docs/i18n/README-jp.md#readme">
    <span>日本語</span>
  </a>
  <span> · </span>
  <a href="docs/i18n/README-fr.md#readme">
    <span>Français</span>
  </a>
  <span> · </span>
  <a href="docs/i18n/README-es.md#readme">
    <span>Español</span>
  </a>
</div>

<div align="center">
  <sub>这款 Markdown 编辑器，值得拥有。由
    <a href="https://github.com/Jocs">Jocs</a> 与
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      贡献者们
    </a>
    用 ❤︎ 构建。
  </sub>
</div>

<br />

## 界面截图

![](docs/assets/marktext.png?raw=true)

## 功能特性

- 实时预览（所见即所得），界面简洁，专注写作。
- 支持 [CommonMark 规范](https://spec.commonmark.org)、[GitHub Flavored Markdown 规范](https://github.github.com/gfm/)，并选择性支持 [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown)。
- Markdown 扩展：数学公式（KaTeX）、前置元数据（Front Matter）、表情符号等。
- 支持段落与行内样式快捷键，提升写作效率。
- 可导出 **HTML** 与 **PDF**。
- 多种[主题](https://marktext.me/docs/themes)：**Cadmium Light**、**Material Dark** 等。
- 多种编辑模式：**源码模式**、**打字机模式**、**专注模式**。
- 支持直接从剪贴板粘贴图片。
- **默认界面语言为简体中文**（可在偏好设置中切换其他语言）。

## 下载与安装

![platform](https://img.shields.io/static/v1.svg?label=Platform&message=Linux%20x64%20|%20macOS%20x64%2Farm64%20|%20Windows%20x64%2Farm64&style=for-the-badge)

|               ![](https://raw.githubusercontent.com/wiki/ryanoasis/nerd-fonts/screenshots/v1.0.x/mac-pass-sm.png)               |               ![](https://raw.githubusercontent.com/wiki/ryanoasis/nerd-fonts/screenshots/v1.0.x/windows-pass-sm.png)               |              ![](https://raw.githubusercontent.com/wiki/ryanoasis/nerd-fonts/screenshots/v1.0.x/linux-pass-sm.png)              |
| :-----------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------------------: |
| [![Download for macOS](https://img.shields.io/badge/macOS-Download-blue)](https://github.com/marktext/marktext/releases/latest) | [![Download for Windows](https://img.shields.io/badge/Windows-Download-blue)](https://github.com/marktext/marktext/releases/latest) | [![Download for Linux](https://img.shields.io/badge/Linux-Download-blue)](https://github.com/marktext/marktext/releases/latest) |

想了解最新版本的新功能？请查看 [CHANGELOG](https://marktext.me/docs/changelog)。

#### macOS

需要 macOS 11（Big Sur）或更高版本。官方不提供通用二进制，请按芯片选择对应的 `arm64` 或 `x64` 安装包。

可从[发布页](https://github.com/marktext/marktext/releases/latest)下载最新的 `marktext-mac-(arm64|x64)-%version%.dmg`，或使用 [**homebrew cask**](https://github.com/caskroom/homebrew-cask) 安装：

```bash
brew install --cask mark-text
```

#### Windows

需要 Windows 10 或 11。提供 x64 与 arm64 安装包，请选择与本机架构匹配的版本。

可下载安装向导（`marktext-win-(x64|arm64)-%version%-setup.exe`）并选择“仅当前用户”或“本机全部用户”安装；也可用 [Chocolatey](https://chocolatey.org/) 或 [Winget](https://docs.microsoft.com/en-us/windows/package-manager/winget/) 安装：

```bash
choco install marktext
```

```bash
winget install marktext
```

#### Linux

请参考 [Linux 安装说明](https://marktext.me/docs/installation)。

#### 其他平台

Linux、macOS、Windows 的全部二进制包都可在[发布页](https://github.com/marktext/marktext/releases/latest)下载。若你的系统没有对应版本，请提交 [issue](https://github.com/marktext/marktext/issues)。

## 开发

如果你想自行构建 MarkText，请查看[构建说明](https://marktext.me/docs/dev/build)。

- [用户文档](https://marktext.me/docs/introduction)
- [开发者文档](https://marktext.me/docs/dev/overview)

如有任何问题，欢迎提交 issue，并尽量使用默认模板。若能直接提交 PR，我们不胜感激。

## 参与贡献

MarkText 仍在持续开发中，提交 Pull Request 前请先阅读[贡献指南]((.github/CONTRIBUTING.md))。想为 MarkText 增加功能？可参考 [roadmap](https://github.com/marktext/marktext/projects) 与未关闭的 issues。

## 贡献者

感谢所有为 MarkText 做出贡献的人们[[contributors](https://github.com/marktext/marktext/graphs/contributors)]。

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>

## 许可证

[**MIT**](LICENSE)。
