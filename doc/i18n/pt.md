<p align="center"><img src="https://github.com/marktext/marktext/blob/master/static/logo-small.png" alt="mark text" width="100" height="100"></p>

<h1 align="center">Mark Text</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20me?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness:Editor de Markdown next-gen:crescent_moon:</strong>
</div>
<div align="center">
  Uma aplicação feita em <code>Electron</code> disponível para OS X, Windows e Linux
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
  <!-- sponsors -->
  <a href="https://opencollective.com/marktext">
    <img src="https://opencollective.com/marktext/tiers/silver-sponsors/badge.svg?label=SilverSponsors&color=brightgreen" alt="sponsors">
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://marktext.github.io/website">
      Página web
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      Funcionalidades
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download-and-install">
      Downloads
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#development">
      Desenvolvimento
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#contribution">
      Constribuições
    </a>
  </h3>
</div>

<div align="center">
  <sub>Desenvolvido com amor ❤︎ por
    <a href="https://github.com/Jocs">Jocs</a> e
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      constribuidores
    </a>
  </sub>
</div>

<br />

![](https://github.com/marktext/marktext/blob/master/doc/marktext.gif)

## Características

- Renderizado em tempo real, e utiliza [snabbdom](https://github.com/snabbdom/snabbdom) como motor de renderização.
- Soporta [CommonMark Spec](https://spec.commonmark.org/0.28/) e [GitHub Flavored Markdown Spec](https://github.github.com/gfm/).
- Suporta parágrafos e atalhos no meio da linha para melhorar a eficiência da escrita
- Exporta arquivos markdown para **HTML** e **PDF**.
- Temas claro e escuro.
- Varios modos de edição: **Modo código fonte**, **Modo máquina de escrever**, **Modo contração**.

<h4 align="center">:crescent_moon:Temas claro e escuro:high_brightness:</h4>

| Escuro :crescent_moon:                                               | Claro :high_brightness:                                             |
|:------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/dark.jpg) | ![](https://github.com/marktext/marktext/blob/master/doc/light.jpg) |

<h4 align="center">:smile_cat:Modo de edição:dog:</h4>

| Código Fonte                                                          | Máquina de Escrever                                                               | Concentração                                                               |
|:--------------------------------------------------------------------:|:------------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](https://github.com/marktext/marktext/blob/master/doc/source.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/typewriter.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/focus.gif) |

## Por que criar um novo editor ?

1. Eu amo escrever. Eu usei muitos editores gratuitos, e ainda não encontrei um que atenda a todas as minhas necessidades. Eu não gosto de ser incomodado por algum bug quando escrevo. **Mark Text** usa DOM virtual para renderizar páginas, o que tem a vantagem de ser muito eficiente e de código aberto. Então, quem gosta de escrever e usar o markdown pode usar o Mark Text.
2. Como mencionado acima, **Mark Text** é de código aberto e será para sempre.
Esperamos que todos os amantes do markdown contribuam e ajudem no desenvolvimento do **Mark Text**, para torná-lo popular.
3. Há muitos editores gratuitos e todos possuem seus méritos. Alguns possuem recursos que outros não possuem. É difícil satisfazer os gostos de todos, mas esperamos que **Mark Text** cubra as necessidades de todos, tanto quanto possível. Embora o mais recente de **Mark Text** não seja perfeito, damos tudo para tentar torná-lo o melhor.

## Download e Instalação

![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png)                                                                                                             | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png)                                                                                                                     | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png)                                                                                                                                   |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65.dmg.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65.dmg) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-setup-0.13.65.exe.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-setup-0.13.65.exe) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65-x86_64.AppImage.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65-x86_64.AppImage) |

Não encontra seu sistema? [página de downloads](https://github.com/marktext/marktext/releases). Ainda não encontrou? Abra uma [issue](https://github.com/marktext/marktext/issues).

Quer saber o que tem de novo? É só ler o [CHANGELOG](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md)

Se está usando macOS você pode utilizar para instalação [**homebrew cask**](https://github.com/caskroom/homebrew-cask). Para usar Homebrew-Cask, vocÊ precisa ter instalado [Homebrew](https://brew.sh/)
```bash
brew cask install mark-text
```

![](https://github.com/marktext/marktext/blob/master/doc/brew-cask.gif)

#### macOS e Windows

Baixe e instale a partir do assistente de instalação.

#### Linux

Siga as instruções: [Clique aqui](https://github.com/marktext/marktext/blob/master/doc/LINUX.md).

## Desenvolvimento

Gostou da missão? Para contribuir com **Mark Text**, por favor, siga as instruções: [instruções](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md#build-instructions).

Possui dúvidas sobre o **Mark Text**, pode abrir um issue. Se você fizer isso, por favor siga o formato padrão. Naturalmente, agradecemos que você envie uma solicitação pull diretamente

## Integração
- [Alfred Workflow](http://www.packal.org/workflow/mark-text): um workflow feito para macOS Alfred: usa "mt" para abrir arquivos com Mark Text

## Constribuição

**Mark Text** está em pleno desenvolvimento. Por favor leia [o guia de constribuição](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md) antes de criar um Pull Request. Você quer adicionar alguns recursos? Dê uma olhada no [TODO LIST](https://github.com/marktext/marktext/blob/master/.github/TODOLIST.md) e abra um issues.

## Apoiadores

Graças a todos os colaboradores! 🙏 [[Seja um apoiador](https://opencollective.com/marktext#backers)]

<a href="https://opencollective.com/marktext#backers" target="_blank"><img src="https://opencollective.com/marktext/tiers/backer.svg?avatarHeight=36" /></a>

## Patrocinadores

Se você patrocinar esse projeto tera sua logo aqui com um link :) [[Quero patrocinar!](https://opencollective.com/marktext#silver-sponsors)]

**Bronze**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/bronze-sponsors.svg?avatarHeight=36&width=600">
</a>

**Prata**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/silver-sponsors.svg?avatarHeight=36&width=600">
</a>

**Ouro**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/gold-sponsors.svg?avatarHeight=36&width=600">
</a>

**Platinum**

<a href="https://readme.io" target="_blank"><img src="https://github.com/marktext/marktext/blob/master/doc/sponsor/readme.png" /></a>


## Contribuidores

Obrigado a todos os contribuidores que apoiam o desenvolvimento do  MarkText! [[Contribuidores](https://github.com/marktext/marktext/graphs/contributors)]

Agradecimentos especiais ao  @[Yasujizr](https://github.com/Yasujizr) por criar a logo do Mark Text.

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>

## Licença

[**MIT**](https://github.com/marktext/marktext/blob/master/LICENSE).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext?ref=badge_large)
