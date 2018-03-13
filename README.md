<p align="center"><img src="https://github.com/marktext/marktext/blob/master/static/logo-small.png" alt="mark text" width="100" height="100"></p>

<h1 align="center">Mark Text</h1>

<div align="center">
  :high_brightness::crescent_moon:
</div>
<div align="center">
  <strong>Next generation markdown editor</strong>
</div>
<div align="center">
  A <code>Electron</code> app for platforms of OS X Windows and Linux
</div>

<br />

<div align="center">
  <!-- Version -->
  <a href="https://marktext.github.io/website">
    <img src="https://badge.fury.io/gh/jocs%2Fmarktext.svg">
  </a>
  <!-- License -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/license/marktext/marktext.svg">
  </a>
  <!-- Build Status -->
  <a href="https://marktext.github.io/website">
    <img src="https://travis-ci.org/marktext/marktext.svg?branch=master" alt="">
  </a>
  <!-- Downloads -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/total.svg" alt="">
  </a>
  <!-- deps -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/hackage-deps/v/lens.svg" alt="">
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://marktext.github.io/website">
      Website
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/zh_cn.md">
      中文
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      Features
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download">
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

- Realtime preview and use [snabbdom](https://github.com/snabbdom/snabbdom) as it's render engine.
- Support [CommonMark Spec](http://spec.commonmark.org/0.28/) and [GitHub Flavored Markdown Spec](http://spec.commonmark.org/0.28/).
- Support paragraphs and inline style shortcuts to improve your writing efficiency.
- Output **HTML** and **PDF** file.
- Dark and Light themes.
- Various edit mode: **Source Code mode**、**Typewriter mode**、**Focus mode**.

<h4 align="center">:crescent_moon:Dark and Light themes:high_brightness:</h4>

|                     Dark :crescent_moon:                     |                    Light:high_brightness:                    |
| :----------------------------------------------------------: | :----------------------------------------------------------: |
| ![](https://github.com/marktext/marktext/blob/master/doc/dark.jpg) | ![](https://github.com/marktext/marktext/blob/master/doc/light.jpg) |

<h4 align="center">:smile_cat:​Edit modes:dog:​</h4>

|                         Source Code                          |                          Typewriter                          |                            Focus                             |
| :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| ![](https://github.com/marktext/marktext/blob/master/doc/source.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/typewriter.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/focus.gif) |

### Why write another editor?

1. I love writing, I have used a lot of markdown editors,there is still not a editor can fully meet my needs, I don't like to be disturbed when I write, and some unbearable bug, **Mark Text** use virtual DOM to render the page, So it's high efficiency, and open source to friends all love markdown and writing.
2. As mentioned above, **Mark Text** will be open source forever. It is also hoped that all markdown lovers can contribute their own code, and develop **Mark Text** into a popular markdown editor.
3. There are many markdown editors, and each editor has its own characteristics, but it is also difficult to satisfy all makdown users' needs. I hope **Mark Text** can satisfy markdown users' needs as much as possible. Although the latest **Mark Text** is still not perfect, but we are trying to make it perfect.

### Download

Mark Text build for these platforms ![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png) | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png) | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png) |
| :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| [v0.6.14](https://github.com/marktext/marktext/releases/download/v0.6.14/marktext-0.6.14.dmg) | [v0.6.14](https://github.com/marktext/marktext/releases/download/v0.6.14/marktext-setup-0.6.14.exe) | [v 0.6.14](https://github.com/marktext/marktext/releases/download/v0.6.14/marktext-0.6.14-x86_64.AppImage) |

Not found your system ? Go the the [release page](https://github.com/marktext/marktext/releases), still not found ? Shoot an [issue](https://github.com/marktext/marktext/issues)

### Development

If you wish to build **Mark Text** yourself.

- first clone this repo.
- Run `npm install`
- Run `npm run build`
- copy the build app to Applications folder, or if on Windows run the executable installer.

When you use **Mark Text**, if you have any questions, you are welcome to write an issue, but I hope you follow the format of issue. Of course, if you can submit a PR directly, it will be appreciated.

## Contribution

Please make sure to read the [Contributing Guide](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md) before making a pull request.

Thank you to all the people who have already contributed to Mark Text!

[![Jocs](https://avatars0.githubusercontent.com/u/9712830?s=150&v=4)](https://github.com/Jocs) | [![ywwhack](https://avatars1.githubusercontent.com/u/8746197?s=150&v=4)](https://github.com/ywwhack) | [![notAlaanor](https://avatars1.githubusercontent.com/u/17591936?s=150&v=4)](https://github.com/notAlaanor)
:---:|:---:|:---:
[Jocs](https://github.com/Jocs) | [ywwhack](https://github.com/ywwhack) | [notAlaanor](https://github.com/notAlaanor)

### License

 [**MIT**](https://github.com/marktext/marktext/blob/master/LICENSE).

Copyright (c) 2017-present, Jocs