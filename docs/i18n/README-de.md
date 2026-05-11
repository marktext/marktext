<p align="center"><img src="../../static/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText</h1>

<div align="center">
  <strong>🔆 Markdown-Editor der nächsten Generation 🌙</strong><br>
  Ein einfacher und eleganter Open-Source-Markdown-Editor mit Fokus auf Geschwindigkeit und Benutzerfreundlichkeit.<br>
</div>

<div align="center">
  <!-- Latest Release Version -->
  <a href="https://github.com/marktext/marktext/releases/latest">
    <img alt="GitHub Release" src="https://img.shields.io/github/v/release/tkaixiang/marktext">
  </a>
  <!-- Downloads total -->
  <a href="https://github.com/marktext/marktext/releases">
    <img alt="GitHub Downloads (all assets, all releases)" src="https://img.shields.io/github/downloads/tkaixiang/marktext/total">
  </a>
  <!-- Downloads latest release -->
  <a href="https://github.com/marktext/marktext/releases/latest">
    <img alt="GitHub Downloads (all assets, latest release)" src="https://img.shields.io/github/downloads/tkaixiang/marktext/latest/total">
  </a>
</div>

- [MarkText](https://github.com/marktext/marktext) ist ein freier und Open-Source-Markdown-Editor, ursprünglich geschrieben von [Jocs](https://github.com/Jocs) und [Mitwirkenden](https://github.com/marktext/marktext/graphs/contributors).

- Leider wird das Kern-Repository seit etwa 3 Jahren nicht mehr gepflegt, doch verschiedene Komfortprobleme blieben bestehen, die mir in der täglichen Nutzung aufgefallen sind.

- Dieses Repository ist ein Versuch, meinen Lieblings-Markdown-Editor zu modernisieren, und ist ein Fork, der auf dem [Fork von Jacob Whall](https://github.com/jacobwhall/marktext) basiert
  - Siehe [meine Motivation unten](#1-soo-is-this-fork-any-different-from-the-countless-others)

- Du kannst unten mehr über meine Motivation lesen

# 1. Installation

> ⚠️ Diese Releases befinden sich weiterhin in der **Beta-Phase** (da ich nicht weiss, wie viel während der Migration kaputtgegangen sein könnte). Bitte melde alle Fehler im [Issue-Tracker](https://github.com/marktext/marktext/issues)

## Windows

- Schau dir einfach die [Release-Seite](https://github.com/marktext/marktext/releases) an!

- Getestet auf:
  - `Windows 11`

## Linux

- Schau dir einfach die [Release-Seite](https://github.com/marktext/marktext/releases) an
- Getestet auf:
  - `Ubuntu 24.0.2` (`AppImage` und `.deb`-Pakete)
  - _Ich würde mich über Hilfe beim Testen der anderen Linux-Pakete freuen!_

### Linux-Paketmanager

##### 1. Arch Linux ![AUR Version](<https://img.shields.io/aur/version/marktext-tkaixiang-bin?label=(AUR)%20marktext-tkaixiang-bin%3E>)

- Verfügbar im [AUR](https://aur.archlinux.org/packages/marktext-tkaixiang-bin) dank [@kromsam](https://github.com/kromsam)

## MacOS

> ⚠️ MacOS-Releases zeigen „`MarkText is damaged and can't be opened`“ aufgrund fehlender **Notarisierung**.
> Bitte sieh dir [diese Lösung hier](https://github.com/marktext/marktext/issues/3004#issuecomment-1038207300) an (gilt auch für jede andere App ohne Signatur eines Entwicklerkontos)

- Verfügbar auf der [Release-Seite](https://github.com/marktext/marktext/releases)

# 2. Bildschirmfotos

![](../marktext.png?raw=true)

# 3. ✨Funktionen ⭐

- Jetzt in **9 Sprachen** verfügbar 🆕 (besonderer Dank an [@hubo1989](https://github.com/hubo1989))
  - `English` 🇺🇸
  - `简体中文` 🇨🇳
  - `繁體中文` 🇹🇼
  - `Deutsch` 🇩🇪
  - `Español` 🇪🇸
  - `Français` 🇫🇷
  - `日本語` 🇯🇵
  - `한국어` 🇰🇷
  - `Português` 🇵🇹

- Echtzeitvorschau (WYSIWYG) sowie eine klare, schlichte Oberfläche für ein ablenkungsfreies Schreiberlebnis.
- Unterstützt die [CommonMark-Spezifikation](https://spec.commonmark.org/0.29/), die [GitHub-Flavoured-Markdown-Spezifikation](https://github.github.com/gfm/) sowie selektive Unterstützung für [Pandoc Markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).
- Markdown-Erweiterungen wie mathematische Ausdrücke (KaTeX), Front Matter und Emojis.
- Unterstützung für Absatz- und Inline-Stil-Kurzbefehle, um deine Schreibeﬃzienz zu steigern.
- Exportiert **HTML**- und **PDF**-Dateien.
- Verschiedene Themes: **Cadmium Light**, **Material Dark** usw.
- Verschiedene Bearbeitungsmodi: **Quellcode-Modus**, **Schreibmaschinen-Modus**, **Fokus-Modus**.
- Bilder direkt aus der Zwischenablage einfügen.

## 3.1 🌙 Themes🔆

| Cadmium Light                                   | Dark                                          |
| ----------------------------------------------- | --------------------------------------------- |
| ![](../themeImages/cadmium-light.png?raw=true)  | ![](../themeImages/dark.png?raw=true)         |
| Graphite Light                                  | Material Dark                                 |
| ![](../themeImages/graphite-light.png?raw=true) | ![](../themeImages/materal-dark.png?raw=true) |
| Ulysses Light                                   | One Dark                                      |
| ![](../themeImages/ulysses-light.png?raw=true)  | ![](../themeImages/one-dark.png?raw=true)     |

## 3.2 😸Bearbeitungsmodi🐶

|     Quellcode      |    Schreibmaschine     |       Fokus       |
| :----------------: | :--------------------: | :---------------: |
| ![](../source.gif) | ![](../typewriter.gif) | ![](../focus.gif) |

# 4. Motivation

## 1. Ist dieser Fork anders als die unzähligen anderen?

- Ein Hauptärgernis bei `marktext` war für mich, dass das Entwicklungs-Framework und die Umgebung stark veraltet waren und der Build ewig dauerte
  - Die meisten Bibliotheken waren veraltet und einige liessen sich mit modernen Versionen von Node.JS/Python nicht einmal installieren

- Daher ist dieser Fork eine Art umfassende „Neuimplementierung“, die [electron-vite](https://electron-vite.org/) anstelle des alten `Babel + Webpack`-Setups verwendet
  - Ziel ist es, `marktext` einen **Neuanfang** mit **möglichst modernen Frameworks und Bibliotheken** zu geben
  - Ausserdem wurde alles auf `Vue3` und `Pinia` migriert und sämtliche Bibliotheken auf ihre jeweils neuesten verfügbaren Versionen aktualisiert

- Die Prozesse `main` und `preload` werden weiterhin zu `CommonJS` kompiliert, der `renderer` ist nun aber vollständig **nur `ESModules`** (was während der Migration zu einigen interessanten Problemen führte)

## 2. Klingt gut! Wie kann ich helfen?

- Jede Form von:
  1. Testen auf Fehler (Fehlermeldungen)
  2. Pull Requests

  ist sehr willkommen!

- Unten findest du eine grundlegende Liste von Befehlen, um dich in diesem Repo zurechtzufinden; ansonsten sollte die Ordnerstruktur **dem ursprünglichen marktext** sehr ähnlich sein

## 3. Projektsetup

- Siehe die [Entwicklerdokumentation](../dev/README.md)
