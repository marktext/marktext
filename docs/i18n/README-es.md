<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>

<div align="center">
  <strong>🔆 Editor de Markdown de próxima generación 🌙</strong><br>
  Un editor de Markdown de código abierto, sencillo y elegante, centrado en la velocidad y la facilidad de uso.<br>
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

- [MarkText](https://github.com/marktext/marktext) es un editor de Markdown gratuito y de código abierto escrito originalmente por [Jocs](https://github.com/Jocs) y [colaboradores](https://github.com/marktext/marktext/graphs/contributors).

- Por desgracia, el repositorio principal dejó de mantenerse hace unos 3 años, pero siguieron existiendo varios problemas de calidad de vida que noté en mi uso diario.

- Este repositorio sirve como un intento de modernizar mi editor de Markdown favorito y es un fork basado en el [fork de Jacob Whall](https://github.com/jacobwhall/marktext)
  - Consulta [mi motivación más abajo](#1-soo-is-this-fork-any-different-from-the-countless-others)

- Puedes leer más sobre mi motivación a continuación

# 1. Instalación

> ⚠️ Estas versiones siguen en **beta** (ya que no sé cuánto habré roto durante la migración). Informa de cualquier error en el [issue tracker](https://github.com/marktext/marktext/issues)

## Windows

- Simplemente visita la [página de lanzamientos](https://github.com/marktext/marktext/releases)!

- Probado en:
  - `Windows 11`

## Linux

- Simplemente visita la [página de lanzamientos](https://github.com/marktext/marktext/releases)
- Probado en:
  - `Ubuntu 24.0.2` (paquetes `AppImage` y `.deb`)
  - _Me encantaría recibir ayuda para probar los otros paquetes de Linux_

### Gestores de paquetes en Linux

##### 1. Arch Linux ![AUR Version](<https://img.shields.io/aur/version/marktext-bin?label=(AUR)%20marktext-bin%3E>)

- Disponible en el [AUR](https://aur.archlinux.org/packages/marktext-bin) gracias a [@kromsam](https://github.com/kromsam)

## MacOS

> ⚠️ Las versiones para MacOS mostrarán "`MarkText is damaged and can't be opened`" debido a la **falta de notarización**.
> Consulta [esta solución](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) (también se aplica a cualquier otra app sin firma de cuenta de desarrollador)

- Disponible en la [página de lanzamientos](https://github.com/marktext/marktext/releases)

# 2. Capturas de pantalla

![](../marktext.png?raw=true)

# 3. ✨Funciones ⭐

- Ahora disponible en **9 idiomas** 🆕 (agradecimientos especiales a [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- Vista previa en tiempo real (WYSIWYG) y una interfaz limpia y sencilla para lograr una experiencia de escritura sin distracciones.
- Compatible con la [especificación CommonMark](https://spec.commonmark.org/0.29/), la [especificación de GitHub Flavored Markdown](https://github.github.com/gfm/) y compatibilidad selectiva con [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).
- Extensiones de Markdown como expresiones matemáticas (KaTeX), front matter y emojis.
- Atajos para párrafos y estilos en línea para mejorar tu eficiencia al escribir.
- Exporta archivos **HTML** y **PDF**.
- Varios temas: **Cadmium Light**, **Material Dark**, etc.
- Varios modos de edición: **modo código fuente**, **modo máquina de escribir**, **modo enfoque**.
- Pega imágenes directamente desde el portapapeles.

## 3.1 🌙 Temas🔆

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

## 3.2 😸Modos de edición🐶

|   Código fuente    |  Máquina de escribir   |      Enfoque      |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. Motivación

## 1. Entonces, ¿este fork es diferente de los innumerables otros?

- Una de mis principales quejas al examinar `marktext` era que el framework y el entorno de desarrollo estaban muy desfasados y tardaba una eternidad en compilarse
  - La mayoría de las bibliotecas estaban obsoletas y algunas ni siquiera podían instalarse con versiones modernas de Node.JS/Python

- Por ello, este fork es una especie de "re-escritura" importante que utiliza [electron-vite](https://electron-vite.org/) en lugar de la configuración antigua de `Babel + Webpack`
  - El objetivo es darle a `marktext` un **nuevo comienzo** usando **frameworks y bibliotecas modernas siempre que sea posible**
  - Todo también se ha migrado a `Vue3` y `Pinia`, con todas las bibliotecas actualizadas a sus últimas versiones posibles

- Los procesos `main` y `preload` siguen compilándose a `CommonJS`, pero el `renderer` ahora es totalmente **solo `ESModules`** (_lo que planteó algunos problemas interesantes durante la migración_)

## 2. ¡Genial! ¿Cómo puedo ayudar?

- Cualquier forma de:
  1. Pruebas de errores (informes de fallos)
  2. Pull Requests

  es más que bienvenida

- A continuación encontrarás una lista básica de comandos para moverte por este repositorio, pero por lo demás la estructura de archivos debería ser **muy similar a la de marktext original**

## 3. Configuración del proyecto

- Consulta la [documentación para desarrolladores](../dev/README.md)
