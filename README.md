<p align="center"><img src="https://github.com/marktext/marktext/blob/master/static/logo-small.png" alt="mark text" width="100" height="100"></p>

<h1 align="center">Mark Text</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?text=Wow:&url=https%3A%2F%2Fgithub.com%2Fmarktext%2Fmarktext">
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
    <img src="https://img.shields.io/github/downloads/marktext/marktext/latest/total.svg" alt="latest download">
  </a>
  <!-- deps -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/hackage-deps/v/lens.svg" alt="dependencies">
  </a>
  <!-- donates -->
  <a href="https://opencollective.com/marktext">
    <img src="https://opencollective.com/marktext/tiers/backer/badge.svg?label=backer&color=brightgreen" alt="donate">
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
</div>

<br />

![](https://github.com/marktext/marktext/blob/master/doc/marktext.gif)

### Features

- Realtime preview and use [snabbdom](https://github.com/snabbdom/snabbdom) as its render engine.
- Support [CommonMark Spec](http://spec.commonmark.org/0.28/) and [GitHub Flavored Markdown Spec](http://spec.commonmark.org/0.28/).
- Support paragraphs and inline style shortcuts to improve your writing efficiency.
- Output **HTML** and **PDF** file.
- Dark and Light themes.
- Various edit mode: **Source Code mode**, **Typewriter mode**, **Focus mode**.

<h4 align="center">:crescent_moon:Dark and Light themes:high_brightness:</h4>

|                     Dark :crescent_moon:                     |                    Light :high_brightness:                    |
| :----------------------------------------------------------: | :----------------------------------------------------------: |
| ![](https://github.com/marktext/marktext/blob/master/doc/dark.jpg) | ![](https://github.com/marktext/marktext/blob/master/doc/light.jpg) |

<h4 align="center">:smile_cat:Edit modes:dog:</h4>

|                         Source Code                          |                          Typewriter                          |                            Focus                             |
| :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| ![](https://github.com/marktext/marktext/blob/master/doc/source.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/typewriter.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/focus.gif) |

### Why write another editor?

1. I love writing. I have used a lot of markdown editors, yet there is still not an editor that can fully meet my needs. I don't like to be disturbed when I write by some unbearable bug. **Mark Text** uses virtual DOM to render the page, so it's high efficiency, and open source to all friends who love markdown and writing.
2. As mentioned above, **Mark Text** will be open source forever. It is also hoped that all markdown lovers can contribute their own code, and develop **Mark Text** into a popular markdown editor.
3. There are many markdown editors, and each editor has its own characteristics, but it is also difficult to satisfy all markdown users' needs. I hope **Mark Text** can satisfy markdown users' needs as much as possible. Although the latest **Mark Text** is still not perfect, we are trying to make it as perfect as we can.

### Download and Install

Mark Text build for these platforms ![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png) | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png) | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png) |
| :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| [latest version](https://github.com/marktext/marktext/releases/download/v0.9.25/marktext-0.9.25.dmg) | [latest version](https://github.com/marktext/marktext/releases/download/v0.9.25/marktext-setup-0.9.25.exe) | [latest version](https://github.com/marktext/marktext/releases/download/v0.9.25/marktext-0.9.25-x86_64.AppImage) |

Did not found your system ? Go the the [release page](https://github.com/marktext/marktext/releases). Still not found ? Shoot an [issue](https://github.com/marktext/marktext/issues).

Want to see new features in this version? Refer to [CHANGELOG](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md)

If you use OS X system, you can install Mark Text by [**homebrew cask**](https://github.com/caskroom/homebrew-cask), to start using Homebrew-Cask, you just need [Homebrew](http://brew.sh/) installed.

> brew cask install mark-text

![](https://github.com/marktext/marktext/blob/master/doc/brew-cask.gif)

### Development

If you wish to build **Mark Text** yourself:

- first clone this repo.
- Run `npm install`
- Run `npm run build`
- copy the build app to Applications folder, or if on Windows run the executable installer.

When you have any questions while using **Mark Text**, you are welcome to write an issue, but I hope you will follow the format of issue. Of course, if you submit a PR directly, it will be appreciated.

## Contribution

Mark Text is in full development, please make sure to read the [Contributing Guide](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md) before making a pull request. Want to add some features to Mark Text? Refer to [TODO LIST](https://github.com/marktext/marktext/blob/master/.github/TODOLIST.md)

Thank you to all the people who have already contributed to Mark Text! If you are a member of [contributors](https://github.com/marktext/marktext/graphs/contributors), open a PR to add your name and photo to the contribution list bellow.

Special thanks to @[Yasujizr](https://github.com/Yasujizr) who designed the logo of Mark Text.

[![Jocs](https://avatars0.githubusercontent.com/u/9712830?s=150&v=4)](https://github.com/Jocs) | [![ywwhack](https://avatars1.githubusercontent.com/u/8746197?s=150&v=4)](https://github.com/ywwhack) | [![notAlaanor](https://avatars1.githubusercontent.com/u/17591936?s=150&v=4)](https://github.com/notAlaanor) | [![fxha](https://avatars1.githubusercontent.com/u/22716132?s=150&v=4)](https://github.com/fxha)
:---:|:---:|:---:|:---:
[Jocs](https://github.com/Jocs) | [ywwhack](https://github.com/ywwhack) | [notAlaanor](https://github.com/notAlaanor) | [fxha](https://github.com/fxha)

### License

 [**MIT**](https://github.com/marktext/marktext/blob/master/LICENSE).

Copyright (c) 2017-present, Jocs
