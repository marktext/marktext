<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  다음 언어로도 번역되어 있습니다:
  <a href="../../README.md">EN</a>
  <a href="README-zh_cn.md">CN</a>
  <a href="README-zh_tw.md">TW</a>
  <a href="README-de.md">DE</a>
  <a href="README-es.md">ES</a>
  <a href="README-fr.md">FR</a>
  <a href="README-jp.md">JP</a>
  <a href="README-pt.md">PT</a>
</div>

---

<div align="center">
  <strong>🔆 차세대 마크다운 에디터 🌙</strong><br>
  속도와 사용성에 중점을 둔 단순하고 우아한 오픈 소스 마크다운 에디터.<br>
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

- [MarkText](https://github.com/marktext/marktext)는 [Jocs](https://github.com/Jocs)와 [기여자들](https://github.com/marktext/marktext/graphs/contributors)이 작성한 무료 오픈 소스 마크다운 에디터입니다.

# 1. 설치

> ⚠️ 이 릴리스는 아직 **베타** 입니다(마이그레이션 도중에 얼마나 많은 부분이 깨졌는지 알 수 없기 때문입니다). 버그는 [issue tracker](https://github.com/marktext/marktext/issues) 에 보고해 주세요

## Windows

- [릴리스 페이지](https://github.com/marktext/marktext/releases) 를 확인하세요!

- 테스트 환경:
  - `Windows 11`

## Linux

- [릴리스 페이지](https://github.com/marktext/marktext/releases) 를 확인하세요
- 테스트 환경: `Ubuntu 24.0.2`, `Ubuntu 22.04.5`
  - _다른 Linux 패키지 테스트에 도움 주실 분을 환영합니다!_

### Linux 패키지 매니저

##### 1. Arch Linux [![AUR Version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- [@kromsam](https://github.com/kromsam) 덕분에 [AUR](https://aur.archlinux.org/packages/marktext-bin)에서 이용할 수 있습니다

## MacOS

> ⚠️ MacOS 릴리스는 **공증 부재** 로 인해 "`MarkText is damaged and can't be opened`" 메시지가 표시됩니다.
> [이 해결 방법](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) 을 참조하세요(개발자 계정 서명이 없는 다른 모든 앱에도 적용됩니다)

- [릴리스 페이지](https://github.com/marktext/marktext/releases) 에서 이용할 수 있습니다

# 2. 스크린샷

![](../marktext.png?raw=true)

# 3. ✨기능 ⭐

- 🆕 이제 `환경설정` 에디터에서 **9개 언어** 로 사용 가능합니다([@hubo1989](https://github.com/hubo1989) 님께 특별히 감사드립니다)
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- 실시간 미리보기(WYSIWYG)와 깔끔하고 단순한 인터페이스로 방해받지 않는 작성 경험을 제공합니다.

- [CommonMark 사양](https://spec.commonmark.org/0.29/), [GitHub Flavored Markdown 사양](https://github.github.com/gfm/)을 지원하고, [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown)을 부분적으로 지원합니다.

- 수식(KaTeX), 프론트 매터, 이모지 등 마크다운 확장 기능.

- 단락 및 인라인 스타일 단축키로 작성 효율을 높여 줍니다.

- **HTML** 및 **PDF** 파일 출력.

- **33개의 내장 테마** 를 포함하며 **Dracula**, **Nord**, **Catppuccin**, **Tokyo Night**, **Gruvbox** 등 인기 있는 테마가 포함되어 있습니다.

- 다양한 편집 모드: **소스 코드 모드**, **타자기 모드**, **포커스 모드**.

- 클립보드에서 직접 이미지를 붙여넣기.

## 3.1 🌙 테마🔆

MarkText에는 **33개의 내장 테마** 가 포함되어 있습니다 — 라이트 10개, 다크 23개:

**라이트**: Ayu Light, Cadmium Light, Catppuccin Latte, Everforest Light, Graphite Light, Gruvbox Light, Rosé Pine Dawn, Solarized Light, Tokyo Night Light, Ulysses Light

**다크**: Ayu Dark, Ayu Mirage, Cadmium Dark, Catppuccin Mocha, cyberdream, Dracula, Everforest Dark, Gruvbox Dark, Horizon Dark, Kanagawa, Material Dark, Monokai Pro, Nightfox, Nord, One Dark, Oxocarbon Dark, Palenight, Rosé Pine, Rosé Pine Moon, Solarized Dark, Synthwave '84, Tokyo Night, Tokyo Night Storm

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

> 📖 전체 테마 목록과 설명, 스크린샷은 [docs/THEMES.md](../THEMES.md) 를 참조하세요.

## 3.2 😸편집 모드🐶

|     소스 코드      |        타자기          |       포커스      |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. 기여자

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. 멋지네요! 어떻게 도울 수 있나요?

- 어떤 형태든:
  1. 버그 테스트(Bug-Reports)
  2. Pull Request

  모두 환영합니다!

## 6. 프로젝트 설정

- [개발자 문서](../dev/README.md) 를 참조하세요
