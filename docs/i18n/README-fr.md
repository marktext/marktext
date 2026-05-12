<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  Traductions également disponibles en :
  <a href="../../README.md">EN</a>
  <a href="README-zh_cn.md">CN</a>
  <a href="README-zh_tw.md">TW</a>
  <a href="README-de.md">DE</a>
  <a href="README-es.md">ES</a>
  <a href="README-jp.md">JP</a>
  <a href="README-kr.md">KR</a>
  <a href="README-pt.md">PT</a>
</div>

---

<div align="center">
  <strong>🔆 Éditeur Markdown nouvelle génération 🌙</strong><br>
  Un éditeur Markdown open source, simple et élégant, axé sur la vitesse et l'ergonomie.<br>
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

- [MarkText](https://github.com/marktext/marktext) est un éditeur Markdown gratuit et open source écrit par [Jocs](https://github.com/Jocs) et les [contributeurs](https://github.com/marktext/marktext/graphs/contributors).

# 1. Installation

> ⚠️ Ces versions sont encore en **bêta** (je ne sais pas combien d'éléments j'ai pu casser durant la migration). Merci de signaler tout bug dans le [issue tracker](https://github.com/marktext/marktext/issues)

## Windows

- Consultez simplement la [page des releases](https://github.com/marktext/marktext/releases) !

- Testé sur :
  - `Windows 11`

## Linux

- Consultez simplement la [page des releases](https://github.com/marktext/marktext/releases)
- Testé sur : `Ubuntu 24.0.2`, `Ubuntu 22.04.5`
  - _Toute aide pour tester les autres paquets Linux est la bienvenue !_

### Gestionnaires de paquets Linux

##### 1. Arch Linux [![AUR Version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- Disponible sur l'[AUR](https://aur.archlinux.org/packages/marktext-bin) grâce à [@kromsam](https://github.com/kromsam)

## MacOS

> ⚠️ Les versions MacOS afficheront « `MarkText is damaged and can't be opened` » en raison d'une **absence de notarisation**.
> Veuillez consulter [ce correctif](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) (qui s'applique aussi à toute autre application sans signature de compte développeur)

- Disponible sur la [page des releases](https://github.com/marktext/marktext/releases)

# 2. Captures d'écran

![](../marktext.png?raw=true)

# 3. ✨Fonctionnalités ⭐

- 🆕 Désormais disponible en **9 langues** depuis l'éditeur de `Préférences` (remerciements particuliers à [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- Aperçu en temps réel (WYSIWYG) et interface claire et épurée pour une expérience d'écriture sans distraction.

- Prend en charge la [spécification CommonMark](https://spec.commonmark.org/0.29/), la [spécification GitHub Flavored Markdown](https://github.github.com/gfm/) et une prise en charge sélective de [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).

- Extensions Markdown telles que les expressions mathématiques (KaTeX), le front matter et les émojis.

- Raccourcis pour les paragraphes et les styles en ligne afin d'améliorer votre efficacité d'écriture.

- Export de fichiers **HTML** et **PDF**.

- **33 thèmes intégrés** incluant des schémas populaires comme **Dracula**, **Nord**, **Catppuccin**, **Tokyo Night**, **Gruvbox** et plus encore.

- Divers modes d'édition : **mode code source**, **mode machine à écrire**, **mode focus**.

- Collage d'images directement depuis le presse-papiers.

## 3.1 🌙 Thèmes🔆

MarkText comprend **33 thèmes intégrés** - 10 clairs et 23 sombres :

**Clairs** : Ayu Light, Cadmium Light, Catppuccin Latte, Everforest Light, Graphite Light, Gruvbox Light, Rosé Pine Dawn, Solarized Light, Tokyo Night Light, Ulysses Light

**Sombres** : Ayu Dark, Ayu Mirage, Cadmium Dark, Catppuccin Mocha, cyberdream, Dracula, Everforest Dark, Gruvbox Dark, Horizon Dark, Kanagawa, Material Dark, Monokai Pro, Nightfox, Nord, One Dark, Oxocarbon Dark, Palenight, Rosé Pine, Rosé Pine Moon, Solarized Dark, Synthwave '84, Tokyo Night, Tokyo Night Storm

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

> 📖 Voir [docs/THEMES.md](../THEMES.md) pour la liste complète des thèmes avec descriptions et captures d'écran.

## 3.2 😸Modes d'édition🐶

|    Code source     |    Machine à écrire    |       Focus       |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. Contributeurs

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. C'est cool ! Comment puis-je aider ?

- Toute forme de :
  1. Tests de bugs (Bug-Reports)
  2. Pull Requests

  est plus que bienvenue !

## 6. Configuration du projet

- Voir la [Documentation développeur](../dev/README.md)
