<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>

<div align="center">
  <strong>🔆 次世代の Markdown エディタ 🌙</strong><br>
  速度と使いやすさに重点を置いた、シンプルでエレガントなオープンソースの Markdown エディタ。<br>
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

- [MarkText](https://github.com/marktext/marktext) は、当初 [Jocs](https://github.com/Jocs) と[コントリビューター](https://github.com/marktext/marktext/graphs/contributors)によって作成された、無料でオープンソースの Markdown エディタです。

- 残念ながら、コアリポジトリは約 3 年前からメンテナンスされておらず、日常的な使用で気付いた利便性の問題がいくつか残っています。

- 本リポジトリは、私のお気に入りの Markdown エディタをモダン化する試みであり、[Jacob Whall のフォーク](https://github.com/jacobwhall/marktext)を元にした派生版です
  - 下記の[私の動機](#1-soo-is-this-fork-any-different-from-the-countless-others)も参照してください

- 私の動機については以下でもう少し詳しく読めます

# 1. インストール

> ⚠️ これらのリリースは依然として **ベータ版** です（移行中にどれだけ壊してしまったか分からないため）。不具合は[Issue トラッカー](https://github.com/marktext/marktext/issues)で報告してください

## Windows

- [リリースページ](https://github.com/marktext/marktext/releases)を確認するだけです！

- 動作確認環境:
  - `Windows 11`

## Linux

- [リリースページ](https://github.com/marktext/marktext/releases)を確認するだけです
- 動作確認環境:
  - `Ubuntu 24.0.2`（`AppImage` と `.deb` パッケージ）
  - _他の Linux パッケージのテストにご協力いただけると幸いです！_

### Linux パッケージマネージャ

##### 1. Arch Linux ![AUR Version](<https://img.shields.io/aur/version/marktext-bin?label=(AUR)%20marktext-bin%3E>)

- [@kromsam](https://github.com/kromsam) のおかげで [AUR](https://aur.archlinux.org/packages/marktext-bin) で利用可能です

## MacOS

> ⚠️ **公証の欠如** により、MacOS 版では「`MarkText is damaged and can't be opened`」と表示されます。
> [こちらの修正](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300)を参照してください（開発者アカウント署名のない他のアプリにも当てはまります）

- [リリースページ](https://github.com/marktext/marktext/releases)で入手できます

# 2. スクリーンショット

![](../marktext.png?raw=true)

# 3. ✨機能 ⭐

- **9 言語** に対応 🆕（[@hubo1989](https://github.com/hubo1989) に特別感謝）
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- リアルタイムプレビュー（WYSIWYG）と、気が散らない執筆体験のためのクリーンでシンプルなインターフェイス。
- [CommonMark 仕様](https://spec.commonmark.org/0.29/)、[GitHub Flavored Markdown 仕様](https://github.github.com/gfm/)に対応し、[Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown)を選択的にサポート。
- 数学式（KaTeX）、Front Matter、絵文字などの Markdown 拡張。
- 段落やインラインスタイルのショートカットに対応し、執筆効率を向上。
- **HTML** と **PDF** での出力に対応。
- 多彩なテーマ：**Cadmium Light**、**Material Dark** など。
- 多様な編集モード：**ソースコードモード**、**タイプライターモード**、**フォーカスモード**。
- クリップボードから画像を直接貼り付け可能。

## 3.1 🌙 テーマ🔆

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

## 3.2 😸編集モード🐶

|    ソースコード    |     タイプライター     |    フォーカス     |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. 動機

## 1. このフォークは数え切れない他のフォークと何が違うの？

- `marktext` を調べていて不満だったのは、開発フレームワークと環境が著しく古く、ビルドに非常に時間がかかる点でした
  - 多くのライブラリが古く、現代の Node.JS/Python ではインストールすらできないものもありました

- そこでこのフォークは、旧来の `Babel + Webpack` 構成の代わりに [electron-vite](https://electron-vite.org/) を採用した、いわば大規模な「書き直し」です
  - 目的は、**可能な限りモダンなフレームワークとライブラリ**を用いて `marktext` に**新たな出発**を与えること
  - すべてを `Vue3` と `Pinia` に移行し、各ライブラリも可能な限り最新バージョンへ更新しました

- `main` と `preload` の各プロセスは引き続き `CommonJS` にコンパイルされますが、`renderer` は現在 **`ESModules` のみ** に完全移行しました（移行中は興味深い問題にも遭遇しました）

## 2. 良いね！ どうやって貢献できる？

- 次のいずれの形でも歓迎します:
  1. バグのテスト（バグ報告）
  2. Pull Request

  大歓迎です！

- このリポジトリでの基本的なコマンドは下記にあります。その他の点では、ディレクトリ構成は**オリジナルの marktext**と非常に近いはずです

## 3. プロジェクト設定

- [開発者向けドキュメント](../dev/README.md)を参照してください
