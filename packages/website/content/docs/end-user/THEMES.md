# Themes

MarkText includes 33 built-in themes organized into Light and Dark categories. Each theme provides a complete color scheme for the editor interface and syntax highlighting.

The names below match the labels shown in the **Theme** menu. The underlying id stored in `preferences.json` under the `theme` field can differ — e.g. _Cadmium Light_ → `light`, _Cadmium Dark_ → `dark`, _Graphite Light_ → `graphite`, _Ulysses Light_ → `ulysses`. The full label↔id mapping lives in `packages/desktop/src/main/menu/templates/theme.ts`.

## Light Themes

| Theme                 | Description                                    |
| --------------------- | ---------------------------------------------- |
| **Ayu Light**         | Warm, comfortable light theme with soft colors |
| **Cadmium Light**     | Clean, minimal light theme                     |
| **Catppuccin Latte**  | Soothing pastel theme with warm tones          |
| **Everforest Light**  | Nature-inspired green-tinted light theme       |
| **Graphite Light**    | Cool gray-toned light theme                    |
| **Gruvbox Light**     | Retro groove with warm, earthy colors          |
| **Rosé Pine Dawn**    | Elegant theme with subtle rose accents         |
| **Solarized Light**   | Classic precision color scheme                 |
| **Tokyo Night Light** | Modern light variant of Tokyo Night            |
| **Ulysses Light**     | Inspired by the Ulysses writing app            |

## Dark Themes

| Theme                 | Description                                 |
| --------------------- | ------------------------------------------- |
| **Ayu Dark**          | Deep, comfortable dark theme                |
| **Ayu Mirage**        | Softer dark variant of Ayu                  |
| **Cadmium Dark**      | Clean, minimal dark theme                   |
| **Catppuccin Mocha**  | Rich, warm dark pastel theme                |
| **cyberdream**        | Neon-accented futuristic dark theme         |
| **Dracula**           | Popular purple-tinted dark theme            |
| **Everforest Dark**   | Nature-inspired forest dark theme           |
| **Gruvbox Dark**      | Retro groove with warm dark colors          |
| **Horizon Dark**      | Vibrant warm dark theme                     |
| **Kanagawa**          | Inspired by Hokusai's Great Wave painting   |
| **Material Dark**     | Google Material Design dark theme           |
| **Monokai Pro**       | Professional variant of the classic Monokai |
| **Nightfox**          | Cool-toned dark theme with good contrast    |
| **Nord**              | Arctic, bluish clean dark theme             |
| **One Dark**          | Atom editor's signature dark theme          |
| **Oxocarbon Dark**    | IBM Carbon-inspired minimal dark theme      |
| **Palenight**         | Elegant purple-tinted dark theme            |
| **Rosé Pine**         | Soho vibes with muted rose tones            |
| **Rosé Pine Moon**    | Darker variant of Rosé Pine                 |
| **Solarized Dark**    | Classic precision dark color scheme         |
| **Synthwave '84**     | Retro 80s neon aesthetic                    |
| **Tokyo Night**       | Modern VSCode-inspired dark theme           |
| **Tokyo Night Storm** | Higher contrast Tokyo Night variant         |

## Switching Themes

You can switch themes in several ways:

1. **Menu**: Go to `Theme` menu and select your preferred theme
2. **Preferences**: Open `Preferences` → `Theme` tab to preview and select themes
3. **Follow System**: "Follow System Theme" is enabled on first launch. It switches between the configured light and dark themes with the system. Disable it to select a fixed theme.

## Theme Screenshots

### Light Themes

| Cadmium Light                                      | Graphite Light                                       |
| -------------------------------------------------- | ---------------------------------------------------- |
| ![Cadmium Light](../themeImages/cadmium-light.png) | ![Graphite Light](../themeImages/graphite-light.png) |

| Ulysses Light                                      | Catppuccin Latte                                         |
| -------------------------------------------------- | -------------------------------------------------------- |
| ![Ulysses Light](../themeImages/ulysses-light.png) | ![Catppuccin Latte](../themeImages/catppuccin-latte.png) |

### Dark Themes

| Dark                             | Material Dark                                      |
| -------------------------------- | -------------------------------------------------- |
| ![Dark](../themeImages/dark.png) | ![Material Dark](../themeImages/material-dark.png) |

| One Dark                                 | Dracula                                |
| ---------------------------------------- | -------------------------------------- |
| ![One Dark](../themeImages/one-dark.png) | ![Dracula](../themeImages/dracula.png) |

| Nord                             | Tokyo Night                                    |
| -------------------------------- | ---------------------------------------------- |
| ![Nord](../themeImages/nord.png) | ![Tokyo Night](../themeImages/tokyo-night.png) |

## Custom Themes

Use **Custom CSS** in Preferences → Theme to override the active theme's styles. The Theme menu and preferences expose the built-in themes listed above; they do not provide a custom-theme import control.

## Theme Credits

Many of these themes are inspired by popular color schemes from the developer community:

- [Catppuccin](https://github.com/catppuccin/catppuccin)
- [Dracula](https://github.com/dracula/dracula-theme)
- [Everforest](https://github.com/sainnhe/everforest)
- [Gruvbox](https://github.com/morhetz/gruvbox)
- [Nord](https://github.com/nordtheme/nord)
- [Rosé Pine](https://github.com/rose-pine/rose-pine-theme)
- [Solarized](https://github.com/altercation/solarized)
- [Tokyo Night](https://github.com/enkia/tokyo-night-vscode-theme)
- [Gogh Themes](https://github.com/Gogh-Co/Gogh) (color palette reference)
