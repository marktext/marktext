<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  也提供以下語言翻譯：
  <a href="../../README.md">EN</a>
  <a href="README-zh_cn.md">CN</a>
  <a href="README-de.md">DE</a>
  <a href="README-es.md">ES</a>
  <a href="README-fr.md">FR</a>
  <a href="README-jp.md">JP</a>
  <a href="README-kr.md">KR</a>
  <a href="README-pt.md">PT</a>
</div>

---

<div align="center">
  <strong>🔆 下一代 Markdown 編輯器 🌙</strong><br>
  一款專注於速度與易用性的簡潔優雅的開源 Markdown 編輯器。<br>
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

- [MarkText](https://github.com/marktext/marktext) 是由 [Jocs](https://github.com/Jocs) 與[貢獻者們](https://github.com/marktext/marktext/graphs/contributors)編寫的免費開源 Markdown 編輯器。

# 1. 安裝

> ⚠️ 這些版本仍處於 **測試階段**（因為我不清楚遷移過程中破壞了多少內容）。請在 [問題追蹤器](https://github.com/marktext/marktext/issues) 中回報任何錯誤

## Windows

- 直接查看 [發布頁](https://github.com/marktext/marktext/releases)！

- 已在以下系統測試：
  - `Windows 11`

## Linux

- 直接查看 [發布頁](https://github.com/marktext/marktext/releases)
- 已在以下系統測試： `Ubuntu 24.0.2`、`Ubuntu 22.04.5`
  - _歡迎協助測試其他 Linux 軟體包！_

### Linux 套件管理員

##### 1. Arch Linux [![AUR Version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- 感謝 [@kromsam](https://github.com/kromsam)，可在 [AUR](https://aur.archlinux.org/packages/marktext-bin) 取得

## MacOS

> ⚠️ 由於**缺少公證**，MacOS 版本會顯示「`MarkText is damaged and can't be opened`」。
> 請參考[此處的修復方法](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300)（同樣適用於任何缺少開發者帳號簽署的應用）

- 可在[發布頁](https://github.com/marktext/marktext/releases)取得

# 2. 截圖

![](../marktext.png?raw=true)

# 3. ✨功能 ⭐

- 🆕 現已支援從 `偏好設定` 編輯器中切換 **9 種語言**（特別感謝 [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- 即時預覽（所見即所得），介面乾淨簡潔，帶來無干擾寫作體驗。

- 支援 [CommonMark 規範](https://spec.commonmark.org/0.29/)、[GitHub 擴充 Markdown 規範](https://github.github.com/gfm/)，並選擇性支援 [Pandoc Markdown](https://pandoc.org/MANUAL.html#pandocs-markdown)。

- 提供 Markdown 擴充，例如數學公式（KaTeX）、Front Matter 與表情符號。

- 支援段落與行內樣式的快捷方式，提升你的寫作效率。

- 可匯出 **HTML** 與 **PDF** 檔案。

- **33 款內建主題**，包含 **Dracula**、**Nord**、**Catppuccin**、**Tokyo Night**、**Gruvbox** 等熱門方案。

- 多種編輯模式：**原始碼模式**、**打字機模式**、**專注模式**。

- 可直接從剪貼簿貼上圖片。

## 3.1 🌙 主題🔆

MarkText 內建 **33 款主題** —— 10 款淺色與 23 款深色：

**淺色**：Ayu Light、Cadmium Light、Catppuccin Latte、Everforest Light、Graphite Light、Gruvbox Light、Rosé Pine Dawn、Solarized Light、Tokyo Night Light、Ulysses Light

**深色**：Ayu Dark、Ayu Mirage、Cadmium Dark、Catppuccin Mocha、cyberdream、Dracula、Everforest Dark、Gruvbox Dark、Horizon Dark、Kanagawa、Material Dark、Monokai Pro、Nightfox、Nord、One Dark、Oxocarbon Dark、Palenight、Rosé Pine、Rosé Pine Moon、Solarized Dark、Synthwave '84、Tokyo Night、Tokyo Night Storm

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

> 📖 完整主題列表（含描述與截圖）請參見 [docs/THEMES.md](../THEMES.md)。

## 3.2 😸編輯模式🐶

|       原始碼       |         打字機         |       專注        |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. 貢獻者

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. 太棒了！我能如何貢獻？

- 任何形式的：
  1. 錯誤測試（Bug-Reports）
  2. Pull Request

  都非常歡迎！

## 6. 專案設定

- 參見[開發者文件](../dev/README.md)
