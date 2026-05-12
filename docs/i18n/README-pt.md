<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>
<div align="center">
  Traduções também disponíveis em:
  <a href="../../README.md">EN</a>
  <a href="README-zh_cn.md">CN</a>
  <a href="README-zh_tw.md">TW</a>
  <a href="README-de.md">DE</a>
  <a href="README-es.md">ES</a>
  <a href="README-fr.md">FR</a>
  <a href="README-jp.md">JP</a>
  <a href="README-kr.md">KR</a>
</div>

---

<div align="center">
  <strong>🔆 Editor Markdown de próxima geração 🌙</strong><br>
  Um editor Markdown de código aberto, simples e elegante, focado em velocidade e usabilidade.<br>
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

- [MarkText](https://github.com/marktext/marktext) é um editor Markdown gratuito e de código aberto escrito por [Jocs](https://github.com/Jocs) e [colaboradores](https://github.com/marktext/marktext/graphs/contributors).

# 1. Instalação

> ⚠️ Estas versões ainda estão em **beta** (não sei o quanto pode ter quebrado durante a migração). Por favor, reporte qualquer bug no [issue tracker](https://github.com/marktext/marktext/issues)

## Windows

- Basta conferir a [página de releases](https://github.com/marktext/marktext/releases)!

- Testado em:
  - `Windows 11`

## Linux

- Basta conferir a [página de releases](https://github.com/marktext/marktext/releases)
- Testado em: `Ubuntu 24.0.2`, `Ubuntu 22.04.5`
  - _Adoraria alguma ajuda para testar os outros pacotes Linux!_

### Gerenciadores de pacotes Linux

##### 1. Arch Linux [![AUR Version](https://img.shields.io/aur/version/marktext-bin)](https://aur.archlinux.org/packages/marktext-bin)

- Disponível no [AUR](https://aur.archlinux.org/packages/marktext-bin) graças a [@kromsam](https://github.com/kromsam)

## MacOS

> ⚠️ As versões para MacOS exibirão "`MarkText is damaged and can't be opened`" devido à **falta de notarização**.
> Consulte [esta correção aqui](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) (que também se aplica a qualquer outro app sem assinatura de uma conta de desenvolvedor)

- Disponível na [página de releases](https://github.com/marktext/marktext/releases)

# 2. Capturas de tela

![](../marktext.png?raw=true)

# 3. ✨Recursos ⭐

- 🆕 Agora disponível em **9 idiomas** no editor de `Preferências` (Agradecimentos especiais a [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- Visualização em tempo real (WYSIWYG) e uma interface limpa e simples para uma experiência de escrita sem distrações.

- Suporta a [especificação CommonMark](https://spec.commonmark.org/0.29/), a [especificação GitHub Flavored Markdown](https://github.github.com/gfm/) e suporte seletivo a [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).

- Extensões Markdown como expressões matemáticas (KaTeX), front matter e emojis.

- Suporte a atalhos de parágrafo e estilo inline para melhorar sua eficiência de escrita.

- Exportação de arquivos **HTML** e **PDF**.

- **33 temas integrados** incluindo esquemas populares como **Dracula**, **Nord**, **Catppuccin**, **Tokyo Night**, **Gruvbox** e mais.

- Vários modos de edição: **Modo Código-Fonte**, **Modo Máquina de Escrever**, **Modo Foco**.

- Cole imagens diretamente da área de transferência.

## 3.1 🌙 Temas🔆

MarkText inclui **33 temas integrados** - 10 claros e 23 escuros:

**Claros**: Ayu Light, Cadmium Light, Catppuccin Latte, Everforest Light, Graphite Light, Gruvbox Light, Rosé Pine Dawn, Solarized Light, Tokyo Night Light, Ulysses Light

**Escuros**: Ayu Dark, Ayu Mirage, Cadmium Dark, Catppuccin Mocha, cyberdream, Dracula, Everforest Dark, Gruvbox Dark, Horizon Dark, Kanagawa, Material Dark, Monokai Pro, Nightfox, Nord, One Dark, Oxocarbon Dark, Palenight, Rosé Pine, Rosé Pine Moon, Solarized Dark, Synthwave '84, Tokyo Night, Tokyo Night Storm

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

> 📖 Veja [docs/THEMES.md](../THEMES.md) para a lista completa de temas com descrições e capturas de tela.

## 3.2 😸Modos de edição🐶

|    Código-Fonte    |    Máquina de Escrever    |        Foco        |
| :----------------: | :-----------------------: | :----------------: |
| ![](../source.gif) | ![](../typewriter.gif)    | ![](../focus.gif)  |

# 4. Colaboradores

<a href="https://github.com/marktext/marktext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=marktext/marktext" />
</a>

## 5. Que legal! Como posso ajudar?

- Qualquer forma de:
  1. Testes para detectar bugs (Bug-Reports)
  2. Pull Requests

  são mais que bem-vindos!

## 6. Configuração do projeto

- Veja a [Documentação para Desenvolvedores](../dev/README.md)
