<p align="center"><img src="https://github.com/marktext/marktext/blob/master/static/logo-small.png" alt="mark text" width="100" height="100"></p>

<h1 align="center">Mark Text</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20me?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness:Next generation markdown editor:crescent_moon:</strong>
</div>
<div align="center">
  An <code>Electron</code> app for platforms of OS X Windows and Linux
</div>

<br />

<div align="center">
  <!-- Version -->
  <a href="https://marktext.github.io/website">
    <img src="https://badge.fury.io/gh/jocs%2Fmarktext.svg" alt="website">
  </a>
  <!-- License -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/license/marktext/marktext.svg" alt="LICENSE">
  </a>
  <!-- Build Status -->
  <a href="https://marktext.github.io/website">
    <img src="https://travis-ci.org/marktext/marktext.svg?branch=master" alt="build">
  </a>
  <!-- Downloads total -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/total.svg" alt="total download">
  </a>
  <!-- Downloads latest release -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/v0.12.25/total.svg" alt="latest download">
  </a>
  <!-- deps -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/hackage-deps/v/lens.svg" alt="dependencies">
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
    <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/zh_cn.md#readme">
      中文
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/pl.md#readme">
      Polski
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/ja.md#readme">
      日本語
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

## Features

- Realtime preview and use [snabbdom](https://github.com/snabbdom/snabbdom) as its render engine.
- Support [CommonMark Spec](https://spec.commonmark.org/0.28/) and [GitHub Flavored Markdown Spec](https://github.github.com/gfm/).
- Support paragraphs and inline style shortcuts to improve your writing efficiency.
- Output **HTML** and **PDF** file.
- Dark and Light themes.
- Various edit mode: **Source Code mode**, **Typewriter mode**, **Focus mode**.

<h4 align="center">:crescent_moon:Dark and Light themes:high_brightness:</h4>

| Dark :crescent_moon:                                               | Light :high_brightness:                                             |
|:------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/dark.jpg) | ![](https://github.com/marktext/marktext/blob/master/doc/light.jpg) |

<h4 align="center">:smile_cat:Edit modes:dog:</h4>

| Source Code                                                          | Typewriter                                                               | Focus                                                               |
|:--------------------------------------------------------------------:|:------------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/source.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/typewriter.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/focus.gif) |

## Why write another editor?

1. I love writing. I have used a lot of markdown editors, yet there is still not an editor that can fully meet my needs. I don't like to be disturbed when I write by some unbearable bug. **Mark Text** uses virtual DOM to render the page, so it's high efficiency, and open source to all friends who love markdown and writing.
2. As mentioned above, **Mark Text** will be open source forever. It is also hoped that all markdown lovers can contribute their own code, and develop **Mark Text** into a popular markdown editor.
3. There are many markdown editors, and each editor has its own characteristics, but it is also difficult to satisfy all markdown users' needs. I hope **Mark Text** can satisfy markdown users' needs as much as possible. Although the latest **Mark Text** is still not perfect, we are trying to make it as perfect as we can.

## Download and Install

![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png)                                                                                                             | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png)                                                                                                                     | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png)                                                                                                                                   |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.12.25.dmg.svg)](https://github.com/marktext/marktext/releases/download/v0.12.25/marktext-0.12.25.dmg) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-setup-0.12.25.exe.svg)](https://github.com/marktext/marktext/releases/download/v0.12.25/marktext-setup-0.12.25.exe) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.12.25-x86_64.AppImage.svg)](https://github.com/marktext/marktext/releases/download/v0.12.25/marktext-0.12.25-x86_64.AppImage) |

Can't find your system? Go the the [release page](https://github.com/marktext/marktext/releases). Still can't find? Open an [issue](https://github.com/marktext/marktext/issues).

Want to see new features in this version? Refer to [CHANGELOG](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md)

If you use OS X system, you can install Mark Text by [**homebrew cask**](https://github.com/caskroom/homebrew-cask), to start using Homebrew-Cask, you just need [Homebrew](https://brew.sh/) installed.

```bash
brew cask install mark-text
```

![](https://github.com/marktext/marktext/blob/master/doc/brew-cask.gif)

#### macOS and Windows

Simply download and install Mark Text via setup wizard.

#### Linux

Please follow the [Linux installation instructions](https://github.com/marktext/marktext/blob/master/doc/linux.md).

## Development

If you wish to build **Mark Text** yourself, please check out our [developer documentation](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md#build-instructions).

When you have any questions while using **Mark Text**, you are welcome to write an issue, but I hope you will follow the format of issue. Of course, if you submit a PR directly, it will be appreciated.

## Contribution

Mark Text is in full development, please make sure to read the [Contributing Guide](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md) before making a pull request. Want to add some features to Mark Text? Refer to [TODO LIST](https://github.com/marktext/marktext/blob/master/.github/TODOLIST.md) and open issues.

## Backers

Thank you to all our backers! 🙏 [[Become a backer](https://opencollective.com/marktext#backers)]

<a href="https://opencollective.com/marktext#backers" target="_blank"><img src="https://opencollective.com/marktext/tiers/backer.svg?avatarHeight=36" /></a>

## Sponsors

Support this project by becoming a sponsor. Your logo will show up here with a link to your website. [[Become a sponsor](https://opencollective.com/marktext#silver-sponsors)]

**Platinum Sponsors**

<a href="https://readme.io" target="_blank"><img src="https://github.com/marktext/marktext/blob/master/doc/sponsor/readme.png" /></a>

## Contributors

Thank you to all the people who have already contributed to Mark Text[[contributors](https://github.com/marktext/marktext/graphs/contributors)]

Special thanks to @[Yasujizr](https://github.com/Yasujizr) who designed the logo of Mark Text.

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>


## License

[**MIT**](https://github.com/marktext/marktext/blob/master/LICENSE).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext?ref=badge_large)
