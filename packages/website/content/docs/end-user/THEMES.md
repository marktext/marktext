# Themes

MarkText includes 33 built-in themes organized into Light and Dark categories. Each theme provides a complete color scheme for the editor interface and syntax highlighting.

The names below match the labels shown in the **Theme** menu. The underlying id stored in `preferences.json` under the `theme` field can differ — e.g. *Cadmium Light* → `light`, *Cadmium Dark* → `dark`, *Graphite Light* → `graphite`, *Ulysses Light* → `ulysses`. The full label↔id mapping lives in `src/main/menu/templates/theme.ts`.

## Light Themes

| Theme | Description |
|-------|-------------|
| **Ayu Light** | Warm, comfortable light theme with soft colors |
| **Cadmium Light** | Clean, minimal light theme (default) |
| **Catppuccin Latte** | Soothing pastel theme with warm tones |
| **Everforest Light** | Nature-inspired green-tinted light theme |
| **Graphite Light** | Cool gray-toned light theme |
| **Gruvbox Light** | Retro groove with warm, earthy colors |
| **Rosé Pine Dawn** | Elegant theme with subtle rose accents |
| **Solarized Light** | Classic precision color scheme |
| **Tokyo Night Light** | Modern light variant of Tokyo Night |
| **Ulysses Light** | Inspired by the Ulysses writing app |

## Dark Themes

| Theme | Description |
|-------|-------------|
| **Ayu Dark** | Deep, comfortable dark theme |
| **Ayu Mirage** | Softer dark variant of Ayu |
| **Cadmium Dark** | Clean, minimal dark theme |
| **Catppuccin Mocha** | Rich, warm dark pastel theme |
| **cyberdream** | Neon-accented futuristic dark theme |
| **Dracula** | Popular purple-tinted dark theme |
| **Everforest Dark** | Nature-inspired forest dark theme |
| **Gruvbox Dark** | Retro groove with warm dark colors |
| **Horizon Dark** | Vibrant warm dark theme |
| **Kanagawa** | Inspired by Hokusai's Great Wave painting |
| **Material Dark** | Google Material Design dark theme |
| **Monokai Pro** | Professional variant of the classic Monokai |
| **Nightfox** | Cool-toned dark theme with good contrast |
| **Nord** | Arctic, bluish clean dark theme |
| **One Dark** | Atom editor's signature dark theme |
| **Oxocarbon Dark** | IBM Carbon-inspired minimal dark theme |
| **Palenight** | Elegant purple-tinted dark theme |
| **Rosé Pine** | Soho vibes with muted rose tones |
| **Rosé Pine Moon** | Darker variant of Rosé Pine |
| **Solarized Dark** | Classic precision dark color scheme |
| **Synthwave '84** | Retro 80s neon aesthetic |
| **Tokyo Night** | Modern VSCode-inspired dark theme |
| **Tokyo Night Storm** | Higher contrast Tokyo Night variant |

## Switching Themes

You can switch themes in several ways:

1. **Menu**: Go to `Theme` menu and select your preferred theme
2. **Preferences**: Open `Preferences` → `Theme` tab to preview and select themes
3. **Follow System**: Enable "Follow System Theme" to automatically switch between light and dark themes based on your system settings

## Theme Screenshots

### Light Themes

| Cadmium Light | Graphite Light |
|---------------|----------------|
| ![Cadmium Light](../themeImages/cadmium-light.png) | ![Graphite Light](../themeImages/graphite-light.png) |

| Ulysses Light | Catppuccin Latte |
|---------------|------------------|
| ![Ulysses Light](../themeImages/ulysses-light.png) | ![Catppuccin Latte](../themeImages/catppuccin-latte.png) |

### Dark Themes

| Dark | Material Dark |
|------|---------------|
| ![Dark](../themeImages/dark.png) | ![Material Dark](../themeImages/material-dark.png) |

| One Dark | Dracula |
|----------|---------|
| ![One Dark](../themeImages/one-dark.png) | ![Dracula](../themeImages/dracula.png) |

| Nord | Tokyo Night |
|------|-------------|
| ![Nord](../themeImages/nord.png) | ![Tokyo Night](../themeImages/tokyo-night.png) |

## Custom Themes

You can add your own editor themes without rebuilding MarkText. A custom theme is a single CSS file you drop into a folder; MarkText discovers it and lists it under **Custom Themes** in the **Theme** menu and in **Preferences → Theme**.

### Where to put themes

Create a `.theme.css` file in the `themes/editor` folder inside MarkText's user-data directory:

- **Windows:** `%APPDATA%\marktext\themes\editor\`
- **macOS:** `~/Library/Application Support/marktext/themes/editor/`
- **Linux:** `~/.config/marktext/themes/editor/`

The quickest way to get there is **Preferences → Theme → Open themes folder**. You can also use **Import Theme** to pick a `.css` file and have it copied in for you.

> This is separate from `themes/export`, which holds custom **export** (PDF / HTML) themes.

### File name

The file must be named `<id>.theme.css`, where `<id>` is lowercase letters, numbers, `-` or `_` (for example `my-theme.theme.css`). The id is also used to remember your selection.

### File format

A theme is plain CSS that overrides MarkText's CSS variables on `:root`, with an optional metadata header:

```css
/*!
 * @name My Theme
 * @type dark
 */
:root {
  --themeColor: #8da101;
  --editorColor: #2d353b;
  --editorBgColor: #f3f4f2;
  --sideBarBgColor: #e3e4df;
  /* ...override as many variables as you like... */
}
```

- `@name` - the label shown in the menu (defaults to a title-cased file id).
- `@type` - `light` or `dark` (defaults to `light`). `dark` enables MarkText's dark-mode UI affordances.

For the full list of variables you can set, copy one of the built-in themes as a starting point - see [`src/renderer/src/assets/themes`](https://github.com/marktext/marktext/tree/develop/packages/desktop/src/renderer/src/assets/themes) (for example `everforest-light.theme.css`).

### Applying a theme

Drop the file in the folder and reopen the window (or the **Preferences → Theme** pane), or use **Import Theme**, which applies it immediately. Your theme then appears under **Custom Themes** in the **Theme** menu and in Preferences.

### Security note

Custom theme CSS is sanitized before it is applied: `@import`, `@font-face`, and any `url()` / `image-set()` value (including remote, `file:` and `data:` URLs) are removed. Custom themes are therefore **colors-only** - they cannot load external images or fonts. For deeper one-off tweaks, the **Custom CSS** box in Preferences → Theme still applies raw (unsanitized) CSS to the current theme.

## Theme Credits

Many of these themes are inspired by popular color schemes from the developer community:

- [Catppuccin](https://github.com/catppuccin/catppuccin) - MIT License
- [Dracula](https://github.com/dracula/dracula-theme) - MIT License
- [Everforest](https://github.com/sainnhe/everforest) - MIT License
- [Gruvbox](https://github.com/morhetz/gruvbox) - MIT License
- [Nord](https://github.com/nordtheme/nord) - MIT License
- [Rosé Pine](https://github.com/rose-pine/rose-pine-theme) - MIT License
- [Solarized](https://github.com/altercation/solarized) - MIT License
- [Tokyo Night](https://github.com/enkia/tokyo-night-vscode-theme) - MIT License
- [Gogh Themes](https://github.com/Gogh-Co/Gogh) - MIT License (color palette reference)
