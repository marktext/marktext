<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  Traducciones también disponibles en:
  <a href="../../README.md">EN</a>
  <a href="README-zh_cn.md">CN</a>
  <a href="README-zh_tw.md">TW</a>
  <a href="README-de.md">DE</a>
  <a href="README-fr.md">FR</a>
  <a href="README-jp.md">JP</a>
  <a href="README-kr.md">KR</a>
  <a href="README-pt.md">PT</a>
</div>

---

<div align="center">
  <strong>🔆 Editor Markdown de nueva generación 🌙</strong><br>
  Un editor Markdown de código abierto, simple y elegante, centrado en la velocidad y la usabilidad.<br>
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

- [MarkText](https://github.com/marktext/marktext) es un editor Markdown gratuito y de código abierto escrito por [Jocs](https://github.com/Jocs) y [colaboradores](https://github.com/marktext/marktext/graphs/contributors).

# 1. Instalación

> ⚠️ Estas versiones aún están en **beta** (no sé cuántas cosas pude haber roto durante la migración). Por favor, informe cualquier error en el [issue tracker](https://github.com/marktext/marktext/issues)

## Windows

- ¡Solo consulte la [página de releases](https://github.com/marktext/marktext/releases)!

- Probado en:
  - `Windows 11`

## Linux

- Solo consulte la [página de releases](https://github.com/marktext/marktext/releases)
- Probado en: `Ubuntu 24.0.2`, `Ubuntu 22.04.5`
  - _¡Cualquier ayuda para probar otros paquetes de Linux es bienvenida!_

### Gestores de paquetes de Linux

##### 1. Arch Linux [![AUR Version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- Disponible en el [AUR](https://aur.archlinux.org/packages/marktext-bin) gracias a [@kromsam](https://github.com/kromsam)

## MacOS

> ⚠️ Las versiones de MacOS mostrarán "`MarkText is damaged and can't be opened`" debido a **la falta de notarización**.
> Consulte [esta solución aquí](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) (que también se aplica a cualquier otra aplicación que no tenga firma de cuenta de desarrollador)

- Disponible en la [página de releases](https://github.com/marktext/marktext/releases)

# 2. Capturas de pantalla

![](../marktext.png?raw=true)

# 3. ✨Características ⭐

- 🆕 Ahora disponible en **9 idiomas** desde el editor de `Preferencias` (Agradecimientos especiales a [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- Vista previa en tiempo real (WYSIWYG) y una interfaz limpia y simple para una experiencia de escritura sin distracciones.

- Compatible con [CommonMark Spec](https://spec.commonmark.org/0.29/), [GitHub Flavored Markdown Spec](https://github.github.com/gfm/) y soporte selectivo de [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).

- Extensiones Markdown como expresiones matemáticas (KaTeX), front matter y emojis.

- Soporte para atajos de párrafo y estilo en línea para mejorar su eficiencia de escritura.

- Exportación de archivos **HTML** y **PDF**.

- **33 temas integrados** incluyendo esquemas populares como **Dracula**, **Nord**, **Catppuccin**, **Tokyo Night**, **Gruvbox** y más.

- Varios modos de edición: **Modo Código Fuente**, **Modo Máquina de Escribir**, **Modo Enfoque**.

- Pegado de imágenes directamente desde el portapapeles.

## 3.1 🌙 Temas🔆

MarkText incluye **33 temas integrados** - 10 claros y 23 oscuros:

**Claros**: Ayu Light, Cadmium Light, Catppuccin Latte, Everforest Light, Graphite Light, Gruvbox Light, Rosé Pine Dawn, Solarized Light, Tokyo Night Light, Ulysses Light

**Oscuros**: Ayu Dark, Ayu Mirage, Cadmium Dark, Catppuccin Mocha, cyberdream, Dracula, Everforest Dark, Gruvbox Dark, Horizon Dark, Kanagawa, Material Dark, Monokai Pro, Nightfox, Nord, One Dark, Oxocarbon Dark, Palenight, Rosé Pine, Rosé Pine Moon, Solarized Dark, Synthwave '84, Tokyo Night, Tokyo Night Storm

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

> 📖 Consulta [docs/THEMES.md](../THEMES.md) para ver la lista completa de temas con descripciones y capturas de pantalla.

## 3.2 😸Modos de edición🐶

|    Código fuente   |    Máquina de escribir   |       Enfoque       |
| :----------------: | :----------------------: | :-----------------: |
| ![](../source.gif) | ![](../typewriter.gif)   | ![](../focus.gif)   |

# 4. Colaboradores

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. ¡Genial! ¿Cómo puedo ayudar?

- Cualquier forma de:
  1. Pruebas para detectar errores (Bug-Reports)
  2. Pull Requests

  ¡Son más que bienvenidos!

## 6. Configuración del proyecto

- Consulta la [Documentación para Desarrolladores](../dev/README.md)
