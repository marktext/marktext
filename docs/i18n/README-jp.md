<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  以下の翻訳もご利用いただけます:
  <a href="../../README.md">EN</a>
  <a href="README-zh_cn.md">CN</a>
  <a href="README-zh_tw.md">TW</a>
  <a href="README-de.md">DE</a>
  <a href="README-es.md">ES</a>
  <a href="README-fr.md">FR</a>
  <a href="README-kr.md">KR</a>
  <a href="README-pt.md">PT</a>
</div>

---

<div align="center">
  <strong>🔆 次世代のマークダウンエディタ 🌙</strong><br>
  スピードと使いやすさにフォーカスした、シンプルで洗練されたオープンソースのマークダウンエディタ。<br>
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

- [MarkText](https://github.com/marktext/marktext) は [Jocs](https://github.com/Jocs) と [コントリビューター](https://github.com/marktext/marktext/graphs/contributors) によって書かれた、無料でオープンソースのマークダウンエディタです。

# 1. インストール

> ⚠️ これらのリリースはまだ **ベータ版** です（移行中にどれだけ壊してしまったかわからないため）。バグは [issue tracker](https://github.com/marktext/marktext/issues) に報告してください

## Windows

- [リリースページ](https://github.com/marktext/marktext/releases) をご確認ください！

- 動作確認済み:
  - `Windows 11`

## Linux

- [リリースページ](https://github.com/marktext/marktext/releases) をご確認ください
- 動作確認済み: `Ubuntu 24.0.2`、`Ubuntu 22.04.5`
  - _他の Linux パッケージのテストにご協力いただけると幸いです！_

### Linux パッケージマネージャ

##### 1. Arch Linux [![AUR Version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- [@kromsam](https://github.com/kromsam) のおかげで [AUR](https://aur.archlinux.org/packages/marktext-bin) で利用可能です

## MacOS

> ⚠️ MacOS リリースは **公証の不足** により「`MarkText is damaged and can't be opened`」と表示されます。
> [こちらの修正方法](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) をご確認ください（開発者アカウント署名のない他のアプリにも当てはまります）

- [リリースページ](https://github.com/marktext/marktext/releases) で利用可能です

# 2. スクリーンショット

![](../marktext.png?raw=true)

# 3. ✨機能 ⭐

- 🆕 `環境設定` エディタから **9 言語** で利用可能になりました（[@hubo1989](https://github.com/hubo1989) に感謝）
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- リアルタイムプレビュー（WYSIWYG）と、シンプルでクリーンなインターフェースで、集中して執筆できる体験を提供。

- [CommonMark 仕様](https://spec.commonmark.org/0.29/)、[GitHub Flavored Markdown 仕様](https://github.github.com/gfm/) に対応し、[Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown) も部分的にサポート。

- 数式（KaTeX）、フロントマター、絵文字などのマークダウン拡張機能。

- 段落とインラインスタイルのショートカットで執筆効率を向上。

- **HTML** および **PDF** ファイルへの出力。

- **33 種類の組み込みテーマ** を搭載。**Dracula**、**Nord**、**Catppuccin**、**Tokyo Night**、**Gruvbox** などの人気テーマを含みます。

- 各種編集モード: **ソースコードモード**、**タイプライターモード**、**フォーカスモード**。

- クリップボードから直接画像を貼り付け。

## 3.1 🌙 テーマ🔆

MarkText には **33 種類の組み込みテーマ** が含まれています — ライト 10、ダーク 23：

**ライト**: Ayu Light, Cadmium Light, Catppuccin Latte, Everforest Light, Graphite Light, Gruvbox Light, Rosé Pine Dawn, Solarized Light, Tokyo Night Light, Ulysses Light

**ダーク**: Ayu Dark, Ayu Mirage, Cadmium Dark, Catppuccin Mocha, cyberdream, Dracula, Everforest Dark, Gruvbox Dark, Horizon Dark, Kanagawa, Material Dark, Monokai Pro, Nightfox, Nord, One Dark, Oxocarbon Dark, Palenight, Rosé Pine, Rosé Pine Moon, Solarized Dark, Synthwave '84, Tokyo Night, Tokyo Night Storm

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

> 📖 全テーマの説明とスクリーンショットは [docs/THEMES.md](../THEMES.md) を参照してください。

## 3.2 😸編集モード🐶

|    ソースコード    |     タイプライター     |     フォーカス     |
| :----------------: | :--------------------: | :----------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif)  |

# 4. コントリビューター

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. いいね！どう貢献できる？

- どんな形でも:
  1. バグのテスト（Bug-Reports）
  2. Pull Request

  大歓迎です！

## 6. プロジェクトのセットアップ

- [開発者向けドキュメント](../dev/README.md) を参照してください
