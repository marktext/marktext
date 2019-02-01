<p align="center"><img src="https://github.com/marktext/marktext/blob/master/static/logo-small.png" alt="mark text" width="100" height="100"></p>

<h1 align="center">Mark Text</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?text=Wow:&url=https%3A%2F%2Fgithub.com%2Fmarktext%2Fmarktext">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness:次世代のマークダウンエディタ:crescent_moon:</strong>
</div>
<div align="center">
  OS XとLinuxとWindows向けの<code>Electron</code>アプリ
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
    <img src="https://img.shields.io/github/downloads/marktext/marktext/v0.13.65/total.svg" alt="latest download">
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
      ウェブサイト
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      特徴
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download-and-install">
      ダウンロード
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#development">
      開発
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#contribution">
      コントリビューション
    </a>
  </h3>
</div>

<div align="center">
  <sub>Translations:</sub>
  <a href="https://github.com/marktext/marktext/blob/master/readme.md#readme">
    <span>:en:</span>
  </a>
  <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/zh_cn.md#readme">
    <span>:cn:</span>    
  </a>
  <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/pl.md#readme">
    <span>:poland:</span>
  </a>  
  <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/french.md#readme">
    <span>:fr:</span>
  </a>
  <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/tr.md#readme">
    <span>:tr:</span>
  </a>
  <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/spanish.md#readme">
    <span>:es:</span>
  </a>
  <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/pt.md#readme">
    <span>:portugal:</span>
  </a>
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

## 特徴

- リアルタイムプレビューと[snabbdom](https://github.com/snabbdom/snabbdom) を用いたレンダリング。
- [CommonMark Spec](https://spec.commonmark.org/0.28/) と [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)をサポート。
- 段落とインラインショートカットを利用することで編集効率を向上。
- **HTML** ファイルと **PDF** ファイルを出力可能.
- ダークテーマとライトテーマが利用可能.
- 沢山の編集モード: **Source Code mode**, **Typewriter mode**, **Focus mode**.

<h4 align="center">:crescent_moon:利用可能なテーマ:high_brightness:</h4>

| Dark :crescent_moon:                                               | Light :high_brightness:                                             |
|:------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/dark.jpg) | ![](https://github.com/marktext/marktext/blob/master/doc/light.jpg) |

<h4 align="center">:smile_cat:編集モード:dog:</h4>

| Source Code                                                          | Typewriter                                                               | Focus                                                               |
|:--------------------------------------------------------------------:|:------------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/source.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/typewriter.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/focus.gif) |

## 開発の意図

1. 私は書くことが好きです。これまでに沢山のマークダウンエディタを使ってきましたが、まだ私の要望を完璧に満たすものを見つけられていません。致命的なバグに執筆を邪魔されたくないのです。**Mark Text**はページのレンダリングに仮想DOMを用いることで効率を向上させ、さらにオープンソースで提供しました。
2. 上記の通り、**Mark Text**はオープンソースなので、誰でもソースコードをコントリビュートすることで開発に参加し、**Mark Text** をポピュラーなマークダウンエディタにしていくことができます。
3. 特徴的な機能を備えたマークダウンエディタは既に沢山ありますが、全てのマークダウンユーザーの要望を満たすのは難しいです。まだまだ未熟ですが、**Mark Text** がマークダウンユーザーの要望を可能な限り叶えられるエディタになることを願っています。

## ダウンロードとインストール

![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png)                                                                                                             | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png)                                                                                                                     | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png)                                                                                                                                   |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65.dmg.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65.dmg) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-setup-0.13.65.exe.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-setup-0.13.65.exe) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65-x86_64.AppImage.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65-x86_64.AppImage) |

上記にご利用のプラットフォームが無い場合は、[リリースページ](https://github.com/marktext/marktext/releases)を探してみてください。それでも見つからない場合は [issue](https://github.com/marktext/marktext/issues) を作成してお知らせいただけると幸いです。

このバージョンでの新着情報をご確認いただくには、[CHANGELOG](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md)を参照してください。

macOSをご利用の場合は、[**homebrew cask**](https://github.com/caskroom/homebrew-cask)からもインストールいただけます、homebrew-caskの利用には[Homebrew](https://brew.sh/)が必要です。

> brew cask install mark-text

![](https://github.com/marktext/marktext/blob/master/doc/brew-cask.gif)

## 開発

**Mark Text** をビルドしたい場合は以下の手順で可能です:

- このリポジトリをcloneします
- `npm install` を実行します
- `npm run build` を実行します
- ビルドしたアプリをApplicationsフォルダにコピーするか、Windowsの場合は実行可能なインストーラを起動します。

**Mark Text**のご利用中にご質問がありましたら、フォーマットを参考にissueを作成してください。もちろんプルリクエストを直接提出して頂いても構いません。ご協力ありがとうございます。

## コントリビューション

Mark Textは開発の真っ最中です、プルリクエストを作成する場合は事前に [Contributing Guide](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md) をご確認ください。Mark Textに追加したい新機能がある場合は、 [TODO LIST](https://github.com/marktext/marktext/blob/master/.github/TODOLIST.md) を参考にしてください。

## 後援者

全ての後援者に感謝申し上げます🙏  [[Become a backer](https://opencollective.com/marktext#backers)]

<a href="https://opencollective.com/marktext#backers" target="_blank"><img src="https://opencollective.com/marktext/tiers/backer.svg?avatarHeight=36" /></a>

## スポンサー

スポンサーになることでこのプロジェクトをサポートすることができます。あなたのロゴがWebサイトへのリンクと共にここに表示されます。 [[Become a sponsor](https://opencollective.com/marktext#silver-sponsors)]

<a href="https://opencollective.com/marktext#silver-sponsors" target="_blank"><img src="https://opencollective.com/marktext/tiers/silver-sponsors.svg?avatarHeight=36" /></a>

## コントリビューター

Mark Textにコントリビュートしてくださった [[コントリビューター](https://github.com/marktext/marktext/graphs/contributors)] の皆さんに感謝を申し上げます。

Mark Textのロゴをデザインしてくださった @[Yasujizr](https://github.com/Yasujizr) に感謝を申し上げます。

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>


## ライセンス

[**MIT**](https://github.com/marktext/marktext/blob/master/LICENSE).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext?ref=badge_large)
