# Development Setup

## Quick Start

```bash
npm install
npm run dev
```

`npm install` automatically handles all setup steps via `postinstall`:
1. Downloads the Electron binary
2. Applies C++20 patch to `native-keymap` (required for Node v24+)
3. Rebuilds native modules for Electron's ABI
4. Generates minified translation files

## Requirements

- Node.js >= 20.19.0 (recommended: match the version bundled with Electron, see `docs/dev/README.md`)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux: see `docs/dev/LINUX_DEV.md`

## Slow Electron Download

If the Electron binary download is slow, set a mirror in your `~/.npmrc`:

```ini
electron_mirror=https://npmmirror.com/mirrors/electron/
```

Or via environment variable:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## Why the C++20 Patch?

`native-keymap@3.3.9` provides keyboard layout detection. Its `binding.gyp` doesn't
declare C++20 explicitly, but Node.js v24+ and Electron v42+ use V8 headers that
require it, causing ~20 compiler errors without the patch.

The patch (`patches/native-keymap+3.3.9.patch`) adds C++20 flags for all platforms
and is applied automatically via `patch-package` during `npm install`.

## Troubleshooting

**`npm install` fails on native modules:**
```bash
rm -rf node_modules
npm install
```

**Electron binary download fails:**
Set the mirror (see above), then:
```bash
rm -rf node_modules/electron/dist node_modules/electron/path.txt
npm run postinstall
```

**Translation errors at startup:**
```bash
npm run minify-locales
```
