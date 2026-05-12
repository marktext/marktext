<p align="center"><img src="static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  Translations also available in:
  <a href="docs/i18n/README-zh_cn.md">CN</a>
  <a href="docs/i18n/README-zh_tw.md">TW</a>
  <a href="docs/i18n/README-de.md">DE</a>
  <a href="docs/i18n/README-es.md">ES</a>
  <a href="docs/i18n/README-fr.md">FR</a>
  <a href="docs/i18n/README-jp.md">JP</a>
  <a href="docs/i18n/README-kr.md">KR</a>
  <a href="docs/i18n/README-pt.md">PT</a>
</div>

---

<div align="center">
  <strong>🔆 Next generation markdown editor 🌙</strong><br>
  A simple and elegant open-source markdown editor that focused on speed and usability.<br>
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

- [MarkText](https://github.com/marktext/marktext) is a free and open source markdown editor written by [Jocs](https://github.com/Jocs) and [contributors](https://github.com/marktext/marktext/graphs/contributors).

# 1. Installing

> ⚠️ These releases are still in **beta** (since I do not know how much stuff I might have broken during the migration). Please report any bugs in the [issue tracker](https://github.com/marktext/marktext/issues)

## Windows

- Simply check out the [Releases Page](https://github.com/marktext/marktext/releases)!

- Tested on:
  - `Windows 11`

## Linux

- Simply check out the [Releases Page](https://github.com/marktext/marktext/releases)
- Tested on: `Ubuntu 24.0.2`, `Ubuntu 22.04.5`
  - _Would love some help in testing the other Linux packages!_

### Linux Package Managers

##### 1. Arch Linux [![AUR version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- Available on [AUR](https://aur.archlinux.org/packages/marktext-bin) thanks to [@kromsam](https://github.com/kromsam)

## MacOS

> ⚠️ MacOS releases will show a "`MarkText is damaged and can't be opened`" due to a **lack of notorisation**.
> Please see [this fix here](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) (which also applies to any other app that lacks a Developer Account signing)

- Available on the [Releases Page](https://github.com/marktext/marktext/releases)

# 2. Screenshots

![](docs/marktext.png?raw=true)

# 3. ✨Features ⭐

- 🆕 Now available in **9 languages** from the `Preferences` editor (Special thanks to [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- Realtime preview (WYSIWYG) and a clean and simple interface to get a distraction-free writing experience.

- Support [CommonMark Spec](https://spec.commonmark.org/0.29/), [GitHub Flavored Markdown Spec](https://github.github.com/gfm/) and selective support [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).

- Markdown extensions such as math expressions (KaTeX), front matter and emojis.

- Support paragraphs and inline style shortcuts to improve your writing efficiency.

- Output **HTML** and **PDF** files.

- **33 built-in themes** including popular schemes like **Dracula**, **Nord**, **Catppuccin**, **Tokyo Night**, **Gruvbox**, and more.

- Various editing modes: **Source Code mode**, **Typewriter mode**, **Focus mode**.

- Paste images directly from clipboard.

## 3.1 🌙 Themes🔆

MarkText includes **33 built-in themes** - 10 light and 23 dark themes:

**Light**: Ayu Light, Cadmium Light, Catppuccin Latte, Everforest Light, Graphite Light, Gruvbox Light, Rosé Pine Dawn, Solarized Light, Tokyo Night Light, Ulysses Light

**Dark**: Ayu Dark, Ayu Mirage, Cadmium Dark, Catppuccin Mocha, cyberdream, Dracula, Everforest Dark, Gruvbox Dark, Horizon Dark, Kanagawa, Material Dark, Monokai Pro, Nightfox, Nord, One Dark, Oxocarbon Dark, Palenight, Rosé Pine, Rosé Pine Moon, Solarized Dark, Synthwave '84, Tokyo Night, Tokyo Night Storm

| Cadmium Light                                     | Dark                                            |
| ------------------------------------------------- | ----------------------------------------------- |
| ![](docs/themeImages/cadmium-light.png?raw=true)  | ![](docs/themeImages/dark.png?raw=true)         |
| Graphite Light                                    | Material Dark                                   |
| ![](docs/themeImages/graphite-light.png?raw=true) | ![](docs/themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                     | One Dark                                        |
| ![](docs/themeImages/ulysses-light.png?raw=true)  | ![](docs/themeImages/one-dark.png?raw=true)     |

> 📖 See [docs/THEMES.md](docs/THEMES.md) for the complete theme list with descriptions and screenshots.

## 3.2 😸Edit Modes🐶

|     Source Code      |        Typewriter        |        Focus        |
| :------------------: | :----------------------: | :-----------------: |
| ![](docs/source.gif) | ![](docs/typewriter.gif) | ![](docs/focus.gif) |

# 4. Contributors

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. That's cool! How can I help?

- Any form of:
  1. Testing for bugs (Bug-Reports)
  2. Pull Requests

  Are more than welcome!

## 6. Project Setup

- See [Developer Documentation](docs/dev/README.md)

**Looking for MarkText-like editing with cloud storage? try [Inkio](https://inkio.me)**

<a href="https://inkio.me/" target="_blank">
 <img src="https://inkio.me/static/media/logo.35f605dc31b1a0615087.png" width="100">
</a>
