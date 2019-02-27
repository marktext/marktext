
<p align="center"><img src="https://github.com/marktext/marktext/blob/master/static/logo-small.png" alt="mark text" width="100" height="100"></p>

<h1 align="center">Mark Text</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20me?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness:새로운 세대의 markdown editor:crescent_moon:</strong>
</div>
<div align="center">
  macOS, Windows 그리고 Linux 플랫폼 용 <code>Electron</code> app
</div>

<br />

<div align="center">
  <!-- Version -->
  <a href="https://marktext.github.io/website">
    <img src="https://badge.fury.io/gh/jocs%2Fmarktext.svg" alt="website">
  </a>
  <!-- License -->
  <a href="https://github.com/marktext/marktext/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/marktext/marktext.svg" alt="LICENSE">
  </a>
  <!-- Build Status -->
  <a href="https://travis-ci.org/marktext/marktext/">
    <img src="https://travis-ci.org/marktext/marktext.svg?branch=master" alt="build">
  </a>
  <a href="https://ci.appveyor.com/project/marktext/marktext/branch/master">
    <img src="https://ci.appveyor.com/api/projects/status/l4gxgydj0i95hmxg/branch/master?svg=true" alt="build">
  </a>
  <!-- Downloads total -->
  <a href="https://github.com/marktext/marktext/releases">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/total.svg" alt="total download">
  </a>
  <!-- Downloads latest release -->
  <a href="https://github.com/marktext/marktext/releases/latest">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/v0.13.65/total.svg" alt="latest download">
  </a>
  <!-- sponsors -->
  <a href="https://opencollective.com/marktext">
    <img src="https://opencollective.com/marktext/tiers/silver-sponsors/badge.svg?label=SilverSponsors&color=brightgreen" alt="sponsors">
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://marktext.github.io/website">
      Website
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      Features
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download-and-install">
      Downloads
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#development">
      Development
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#contribution">
      Contribution
    </a>
  </h3>
</div>

<div align="center">
  <sub>This Markdown editor that could. Built with ❤︎ by
    <a href="https://github.com/Jocs">Jocs</a> and
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      contributors
    </a>
  </sub>
</div>

<br />

![](https://github.com/marktext/marktext/blob/master/doc/marktext.gif)

## 기능

- 실시간 미리보기 및 렌더링 엔진으로 [snabbdom](https://github.com/snabbdom/snabbdom) 사용.
- [CommonMark Spec](https://spec.commonmark.org/0.28/) 및 [GitHub Flavored Markdown Spec](https://github.github.com/gfm/) 지원.
- 단락 및 인라인 스타일 단축키를 지원하여 문서 작성의 효율을 향상.
- **HTML** 및 **PDF** 파일 출력.
- 어두운 테마와 밝은 테마 지원.
- 다양한 편집 모드 지원 : **Source Code mode**, **Typewriter mode**, **Focus mode**.

<h4 align="center">:crescent_moon:어두운 테마와 밝은 테마:high_brightness:</h4>

| Dark :crescent_moon:                                               | Light :high_brightness:                                             |
|:------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/dark.jpg) | ![](https://github.com/marktext/marktext/blob/master/doc/light.jpg) |

<h4 align="center">:smile_cat:다양한 편집 모드:dog:</h4>

| Source Code                                                          | Typewriter                                                               | Focus                                                               |
|:--------------------------------------------------------------------:|:------------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/source.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/typewriter.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/focus.gif) |

## 개발 의도

1. 나는 글쓰기를 좋아한다. 지금까지 많은 마크다운 에디터를 사용해왔지만, 여전히 내 요구를 완벽하게 충족 시키는 에디터를 찾을 수 없었다.  치명적인 버그에 글쓰기를 방해 받고 싶지 않을 것이다. **Mark Text**는 페이지의 렌더링에 가상 DOM을 이용하여 효율을 향상시키고 이를 오픈 소스로 제공했다.
2. 위에서 설명한대로 **Mark Text**는 오픈 소스이기 때문에 누구나 개발에 참여할 수 있어서 **Mark Text**를 인기있는 마크다운 에디터에 나갈 수 있다.
3. 특징적인 기능을 갖춘 마크다운 에디터는 이미 많이 있지만, 모든 마크다운 사용자의 요구를 충족하기 어렵다. 아직 미숙하지만, **Mark Text**가 마크 다운 사용자의 요구를 최대한 충족시키는 에디터가 될 것으로 기대하고 있다.

## 설치 방법

![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png)                                                                                                             | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png)                                                                                                                     | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png)                                                                                                                                   |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65.dmg.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65.dmg) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-setup-0.13.65.exe.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-setup-0.13.65.exe) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65-x86_64.AppImage.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65-x86_64.AppImage) |

시스템을 찾을 수 없다면 [release page](https://github.com/marktext/marktext/releases/latest)를 참고하여라. 그래도 없으면 [issue](https://github.com/marktext/marktext/issues)를 작성하여 알려 주시면 감사하겠다.

새로운 버전의 새로운 기능을 확인하기 위해서는 [CHANGELOG](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md)를 참조 하여라.

macOS를 이용할 경우는  [**homebrew cask**](https://github.com/caskroom/homebrew-cask)에서 설치할 수 있다.

```bash
brew cask install mark-text
```

![](https://github.com/marktext/marktext/blob/master/doc/brew-cask.gif)

#### macOS and Windows

설치 마법사를 통해 Mark Text를 다운로드하여 설치하면 된다.
#### Linux

[Linux installation instructions](https://github.com/marktext/marktext/blob/master/doc/LINUX.md) 이 문서를 따르라.

## 개발

직접 **Mark Text**를 작성하려면 [developer documentation](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md#build-instructions)를 확인하여라.

**Mark Text**와 관련하여 질문이 있으시면 언제든지 문제를 기재하실 수 있다. 그렇게 할 때 문제를 열 때 찾을 수 있는 기본 형식을 사용하여라. 물론, 직접 PR을 제출하면 크게 환영 할 것이다.

## 통합

- [Alfred Workflow](http://www.packal.org/workflow/mark-text): macOS 응용 프로그램의 Workflow Alfred: "mt"를 사용하여 Mark Text로 files/folder를 연다.

## 기여

Mark Text는 완전히 개발되었다,  pull request를 하기 전에 [Contributing Guide](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md) 문서를 읽어라. Mark Text에 몇 가지 기능을 추가하고 싶다면 [TODO LIST](https://github.com/marktext/marktext/blob/master/.github/TODOLIST.md) 및 open issues를 참조하여라.

## 스폰서

스폰서가 되어 이 프로젝트를 지원해라. 로고가 웹 사이트 링크와 함께 여기에 표시된다. [[스폰서 되기](https://opencollective.com/marktext#platinum-sponsors)]

**Platinum 스폰서**

<a href="https://readme.io" target="_blank"><img src="https://github.com/marktext/marktext/blob/master/doc/sponsor/readme.png" /></a>
<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/platinum-sponsors.svg?avatarHeight=36&width=600">
</a>

**Gold 스폰서**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/gold-sponsors.svg?avatarHeight=36&width=600">
</a>

**Silver 스폰서**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/silver-sponsors.svg?avatarHeight=36&width=600">
</a>

**Bronze 스폰서**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/bronze-sponsors.svg?avatarHeight=36&width=600">
</a>

## 후원자

모든 후원자에게 감사드립니다! 🙏 [[후원자들](https://opencollective.com/marktext#backers)]

<a href="https://opencollective.com/marktext#backers">
  <img src="https://opencollective.com/marktext/tiers/backer.svg?avatarHeight=36&width=600">
</a>

## 기여자

Mark Text에 기여한 모든 사람들에게 감사드립니다. [[기여자](https://github.com/marktext/marktext/graphs/contributors)]

Mark Text의 로고를 디자인한 @[Yasujizr](https://github.com/Yasujizr) 에게 특별히 감사드린다.

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>


## License

[**MIT**](https://github.com/marktext/marktext/blob/master/LICENSE).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext?ref=badge_large)
