> **This documentation is outdated, based on the original readme from 22 June 2018!**

<p align="center"><img src="../../static/logo-small.png" alt="marktext" width="100" height="100"></p>

<h1 align="center">MarkText</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20me?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness:Nouvelle génération d'éditeur markdown:crescent_moon:</strong>
</div>
<div align="center">
  Une application <code>Electron</code> disponible sous OS X, Windows et Linux
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
    <img src="https://img.shields.io/github/downloads/marktext/marktext/v0.17.1/total.svg" alt="latest download">
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
      Site web
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      Fonctionnalités
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download-and-installation">
      Téléchargement
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#development">
      Dévelopment
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#contribution">
      Contribution
    </a>
  </h3>
</div>

<div align="center">
  <sub>Cette éditeur est écrit avec ❤︎ par
    <a href="https://github.com/Jocs">Jocs</a> et ses
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      contributeurs
    </a>
  </sub>
</div>

<br />

![](../../docs/marktext.gif)

## Features

- Rendu en temps réelle et utilise [snabbdom](https://github.com/snabbdom/snabbdom) en tant que moteur de rendu.
- Supporte [CommonMark Spec](https://spec.commonmark.org/0.29/) et [GitHub Flavored Markdown Spec](https://github.github.com/gfm/).
- Supporte les paragraphes et raccourices clavier afin d'améliorer votre productivité.
- Export de votre markdown en **HTML** et **PDF**.
- Thèmes Sombre et Clair.
- Plusieurs mode d'édition: **Mode code source**, **Mode machine à écrire**, **Mode focus**.

<h4 align="center">:crescent_moon:Thèmes Sombre et Clair:high_brightness:</h4>

| Sombre :crescent_moon:                                               | Clair :high_brightness:                                             |
|:------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](../../docs/dark.jpg) | ![](../../docs/light.jpg) |

<h4 align="center">:smile_cat:Mode d'édition:dog:</h4>

| Code Source                                                          | Machine à écrire                                                               | Focus                                                               |
|:--------------------------------------------------------------------:|:------------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](../../docs/source.gif) | ![](../../docs/typewriter.gif) | ![](../../docs/focus.gif) |

## Pourquoi écrire un nouvel éditeur?

1. J'adore écrire. J'ai utilisé de nombreux éditeurs markdown et pourtant, aucun ne correspondait réellement à mes besoins. **MarkText** utilise un DOM virtuel pour le rendu ce qui le rend très efficace. C'est aussi un outil open source pour tous les amoureux de l'écriture et du markdown.
2. Comme mentionné **MarkText** est et restera open source. Il est aussi espérer que des amoureux du markdown puissent participer au dévelopement du projet afin de rendre **MarkText** un éditeur parmis les plus populaire.
3. Il y a beaucoup d'éditeur markdown et chacun de ses éditeurs à ses propres caractéristiques mais il est aussi difficile de pouvoir satisfaire tout les besoins utilisateurs. J'espère que **MarkText** pourra satisfaire vos besoins le plus possible. De plus **MarkText** n'est pas parfait mais nous faisons de notre mieux pour aller dans cette direction.

## Download and Install

![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png)                                                                                                             | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png)                                                                                                                     | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png)                                                                                                                                   |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-x64.dmg.svg)](https://github.com/marktext/marktext/releases/download/v0.17.1/marktext-x64.dmg) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-setup.exe.svg)](https://github.com/marktext/marktext/releases/download/v0.17.1/marktext-setup.exe) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-x86_64.AppImage.svg)](https://github.com/marktext/marktext/releases/download/v0.17.1/marktext-x86_64.AppImage) |

Vous ne trouvez pas votre système? Aller sur la [page des releases](https://github.com/marktext/marktext/releases). Toujours pas? Ouvrez une [issue](https://github.com/marktext/marktext/issues).

Vous voulez voir une nouvelle feature dans la prochaine version? Consulté le [CHANGELOG](../../.github/CHANGELOG.md)

Si vous êtes sur OS X, vous pouvez installer MarkText via [**homebrew cask**](https://github.com/caskroom/homebrew-cask), pour commencer à utiliser Homebrew-Cask, vous avez seulement besoin d'avoir [Homebrew](https://brew.sh/) installer sur votre machine.

```bash
brew install --cask mark-text
```

![](../../docs/brew-cask.gif)

#### macOS and Windows

Télécharger et installer simplement MarkText via le client d'installation.

#### Linux

Veuillez suivre [les instructions d'installations Linux](../../docs/LINUX.md).

## Development

Si vous souhaiter participer à l'amélioration de **MarkText**, référer vous au [instructions de dévelopement](../../CONTRIBUTING.md#build-instructions).

Si vous avez des questions pendant votre utilisation, vous êtes les bienvenues pour ouvrir une issue, mais j'espère que vous suivrez le format requis. Bien sûr, si vous soumettez une PR directement, cela sera apprécié.

## Contribution

**MarkText** est en plein déveloment, prenez soin d'étudier le [guide de contribution](../../CONTRIBUTING.md) avant de faire une pull request. Vous souhaitez plus de fonctionnalités à MarkText? Rendez-vous sur la [TODO LIST](../../.github/TODOLIST.md) pour ouvrir des issues.

## Backers

Merci à tous nos collaborateurs! 🙏 [[Deviens un backer](https://opencollective.com/marktext#backers)]

<a href="https://opencollective.com/marktext#backers" target="_blank"><img src="https://opencollective.com/marktext/tiers/backer.svg?avatarHeight=36" /></a>

## Sponsors

Supporter ce projet en devenant sponsor de celui-ci. Votre logo sera affiché ici ainsi qu'un lien vers votre site internet. [[Deviens un sponsor](https://opencollective.com/marktext#silver-sponsors)]

**Platinum Sponsors**

<a href="https://readme.io" target="_blank"><img src="../../docs/sponsor/readme.png" /></a>

## Contributors

Merci à tous les contributeurs ayant déjà participé à MarkText [[contributors](https://github.com/marktext/marktext/graphs/contributors)]

Un remerciement spécial à @[Yasujizr](https://github.com/Yasujizr) qui est l'auteur du logo de MarkText.

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>


## License

[**MIT**](../../LICENSE).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext?ref=badge_large)
