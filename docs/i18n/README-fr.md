<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>

<div align="center">
  <strong>🔆 Éditeur Markdown nouvelle génération 🌙</strong><br>
  Un éditeur Markdown open source, simple et élégant, axé sur la vitesse et l’ergonomie.<br>
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

- [MarkText](https://github.com/marktext/marktext) est un éditeur Markdown gratuit et open source, initialement écrit par [Jocs](https://github.com/Jocs) et les [contributeurs](https://github.com/marktext/marktext/graphs/contributors).

- Malheureusement, le dépôt principal n’est plus maintenu depuis environ 3 ans, mais divers problèmes de confort d’usage subsistent et je les ai constatés au quotidien.

- Ce dépôt vise à moderniser mon éditeur Markdown préféré et constitue un fork basé sur le [fork de Jacob Whall](https://github.com/jacobwhall/marktext)
  - Voir [ma motivation ci-dessous](#1-soo-is-this-fork-any-different-from-the-countless-others)

- Vous pouvez en savoir plus sur ma motivation ci-dessous

# 1. Installation

> ⚠️ Ces versions sont encore en **bêta** (je ne sais pas combien d’éléments j’ai pu casser durant la migration). Merci de signaler tout bug dans le [issue tracker](https://github.com/marktext/marktext/issues)

## Windows

- Consultez simplement la [page des releases](https://github.com/marktext/marktext/releases) !

- Testé sur :
  - `Windows 11`

## Linux

- Consultez simplement la [page des releases](https://github.com/marktext/marktext/releases)
- Testé sur :
  - `Ubuntu 24.0.2` (paquets `AppImage` et `.deb`)
  - _Toute aide pour tester les autres paquets Linux est la bienvenue !_

### Gestionnaires de paquets Linux

##### 1. Arch Linux ![AUR Version](<https://img.shields.io/aur/version/marktext-bin?label=(AUR)%20marktext-bin%3E>)

- Disponible sur l’[AUR](https://aur.archlinux.org/packages/marktext-bin) grâce à [@kromsam](https://github.com/kromsam)

## MacOS

> ⚠️ Les versions MacOS afficheront « `MarkText is damaged and can't be opened` » en raison d’une **absence de notarisation**.
> Veuillez consulter [ce correctif](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) (qui s’applique aussi à toute autre application sans signature de compte développeur)

- Disponible sur la [page des releases](https://github.com/marktext/marktext/releases)

# 2. Captures d’écran

![](../marktext.png?raw=true)

# 3. ✨Fonctionnalités ⭐

- Désormais disponible en **9 langues** 🆕 (remerciements particuliers à [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- Aperçu en temps réel (WYSIWYG) et interface claire et épurée pour une expérience d’écriture sans distraction.
- Prend en charge la [spécification CommonMark](https://spec.commonmark.org/0.29/), la [spécification GitHub Flavored Markdown](https://github.github.com/gfm/) et une prise en charge sélective de [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).
- Extensions Markdown telles que les expressions mathématiques (KaTeX), le front matter et les émojis.
- Raccourcis pour les paragraphes et les styles en ligne afin d’améliorer votre efficacité d’écriture.
- Export de fichiers **HTML** et **PDF**.
- Divers thèmes : **Cadmium Light**, **Material Dark**, etc.
- Divers modes d’édition : **mode code source**, **mode machine à écrire**, **mode focus**.
- Collage d’images directement depuis le presse-papiers.

## 3.1 🌙 Thèmes🔆

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

## 3.2 😸Modes d’édition🐶

|    Code source     |    Machine à écrire    |       Focus       |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. Motivation

## 1. Ce fork est-il différent des innombrables autres ?

- L’un de mes principaux griefs à propos de `marktext` était que le framework et l’environnement de développement vieillissaient mal et que la compilation prenait une éternité
  - La plupart des bibliothèques étaient obsolètes et certaines ne pouvaient même pas être installées avec des versions modernes de Node.JS/Python

- Ce fork est donc une sorte de « réécriture » majeure qui utilise [electron-vite](https://electron-vite.org/) au lieu de l’ancien ensemble `Babel + Webpack`
  - L’objectif est d’offrir à `marktext` un **nouveau départ** en s’appuyant **autant que possible sur des frameworks et bibliothèques modernes**
  - Tout a également été migré vers `Vue3` et `Pinia`, avec une mise à jour de toutes les bibliothèques vers leurs dernières versions possibles

- Les processus `main` et `preload` sont toujours compilés en `CommonJ
