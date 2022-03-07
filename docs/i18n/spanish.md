> **This documentation is outdated, based on the original readme from 1 October 2018!**

<p align="center"><img src="../../static/logo-small.png" alt="marktext" width="100" height="100"></p>

<h1 align="center">MarkText</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20me?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness:Editor de Markdown next-gen:crescent_moon:</strong>
</div>
<div align="center">
  Una aplicación hecha en <code>Electron</code> disponible para OS X, Windows y Linux
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
      Página web
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      Funcionalidades
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download-and-installation">
      Descargas
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#development">
      Desarrollo
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#contribution">
      Contribuciones
    </a>
  </h3>
</div>

<div align="center">
  <sub>Editor escrito con ❤︎ por
    <a href="https://github.com/Jocs">Jocs</a> y
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      contribuidores
    </a>
  </sub>
</div>

<br />

![](../../docs/marktext.gif)

## Características

- Renderizado en tiempo real, y utiliza [snabbdom](https://github.com/snabbdom/snabbdom) como motor de renderizado.
- Soporta [CommonMark Spec](https://spec.commonmark.org/0.29/) y [GitHub Flavored Markdown Spec](https://github.github.com/gfm/).
- Soporta párrafos y atajos en mitad de la línea para mejorar la eficiencia de escritura
- Exporta archivos markdown en **HTML** y **PDF**.
- Temas claro y oscuro.
- Varios modos de edición: **Modo código fuente**, **Modo máquina de escribir**, **Modo concentración**.

<h4 align="center">:crescent_moon:Temas claro y oscuro:high_brightness:</h4>

| Oscuro :crescent_moon:                                               | Claro :high_brightness:                                             |
|:------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](../../docs/dark.jpg) | ![](../../docs/light.jpg) |

<h4 align="center">:smile_cat:Mode d'édition:dog:</h4>

| Código fuente                                                          | Máquina de escribir                                                               | Concentración                                                               |
|:--------------------------------------------------------------------:|:------------------------------------------------------------------------:|:-------------------------------------------------------------------:|
| ![](../../docs/source.gif) | ![](../../docs/typewriter.gif) | ![](../../docs/focus.gif) |

## ¿Por qué hacer otro editor ?

1. Me encanta escribir. He usado un montón de editores de markdown, y todavía no he encontrado ninguno que cumpla todas mis necesidades. No me gusta que me moleste ningún bug cuando escribo. **MarkText** usa virtual DOM para renderizar páginas, la cual tiene el beneficio de ser muy eficiente y de código abierto. Así, a cualquiera que le guste escribir y use markdown puede usar MarkText
2. Como se ha mencionado arriba, **MarkText** es de código abierto, y lo será para siempre. Esperamos que todos los amantes de markdown contribuyan y ayuden al desarrollo de **MarkText**, para que sea popular.
3. Hay muchos editores de markdown, y todos tienen sus méritos. Algunos tienen funcionalidades que otros no. Es difícil satisfacer los gustos de todo el mundo, pero esperamos que **MarkText** cubra las necesidades de todos lo máximo posible. Aunque lo último de **MarkText** no sea perfecto, lo damos todo para intentar que sea lo mejor

## Descarga e instalación

![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

| ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png)                                                                                                             | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png)                                                                                                                     | ![]( https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png)                                                                                                                                   |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-x64.dmg.svg)](https://github.com/marktext/marktext/releases/download/v0.17.1/marktext-x64.dmg) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-setup.exe.svg)](https://github.com/marktext/marktext/releases/download/v0.17.1/marktext-setup.exe) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-x86_64.AppImage.svg)](https://github.com/marktext/marktext/releases/download/v0.17.1/marktext-x86_64.AppImage) |

¿No encuentras tu sistema? Ve a la [página de descargas](https://github.com/marktext/marktext/releases). ¿No se encuentra disponible tu versión? Abre una [issue](https://github.com/marktext/marktext/issues).

¿Quieres saber las nuevas funcionalidades de la última versión? Échale un vistazo al [CHANGELOG](../../.github/CHANGELOG.md)

Si estás usando macOS, puedes instalar Mart Text usando [**homebrew cask**](https://github.com/caskroom/homebrew-cask). Para usar Homebrew-Cask, tienes que tener instalado [Homebrew](https://brew.sh/)
```bash
brew install --cask mark-text
```

![](../../docs/brew-cask.gif)

#### macOS y Windows

Descarga e instala Mart Text a partir del asistente de instalación

#### Linux

Sigue las [instrucciones de instalación de Linux]	(../../docs/LINUX.md).

## Desarrollo

Si quieres construir tú mismo **MarkText**, por favor, sigue las  [instrucciones de desarrollo](../../CONTRIBUTING.md#build-instructions).

Si tienes dudas sobre **MarkText**, puedes abrir un issue. Si lo haces, por favor, sigue el formato estándar. Por supuesto, apreciamos que mandes directamente un Pull Request

## Integración
- [Alfred Workflow](http://www.packal.org/workflow/mark-text): un workflow  para la aplicación de macOS Alfred: usa "mt" para abrir archivos/carpetas con MarkText
## Contribución

**MarkText** está en pleno desarrollo. Asegúrate de leer [la guía de contribución](../../CONTRIBUTING.md) antes de hacer un Pull Request. ¿Quieres añadir algunas funcionalidades? Échale un vistazo a la [TODO LIST](../../.github/TODOLIST.md) y abre issues.

## Backers

¡Gracias a todos nuestros colaboradores! 🙏 [[Conviértete en un backer](https://opencollective.com/marktext#backers)]

<a href="https://opencollective.com/marktext#backers" target="_blank"><img src="https://opencollective.com/marktext/tiers/backer.svg?avatarHeight=36" /></a>

## Sponsors

Apoya este proyecto convirtiéndote en un sponsor. Tu logo se verá aquí con un link a tu página [[Conviértete en un sponsor](https://opencollective.com/marktext#silver-sponsors)]

**Bronze Sponsors**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/bronze-sponsors.svg?avatarHeight=36&width=600">
</a>

**Silver Sponsors**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/silver-sponsors.svg?avatarHeight=36&width=600">
</a>

**Gold Sponsors**

<a href="https://opencollective.com/marktext#platinum-sponsors">
  <img src="https://opencollective.com/marktext/tiers/gold-sponsors.svg?avatarHeight=36&width=600">
</a>

**Platinum Sponsors**

<a href="https://readme.io" target="_blank"><img src="../../docs/sponsor/readme.png" /></a>


## Contribuidores

Gracias a todo el mundo que ha contribuido al desarrollo de MarkText! [[contributors](https://github.com/marktext/marktext/graphs/contributors)]

Un especial agradecimiento a @[Yasujizr](https://github.com/Yasujizr) por hacer el logo de MarkText.

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>

## Licencia

[**MIT**](../../LICENSE).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext?ref=badge_large)
