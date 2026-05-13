# Development Setup Guide

## Quick Start (Node v24+)

Due to Node v24's C++20 requirement and `native-keymap`'s build compatibility, use the setup script:

```bash
npm run setup
```

This runs the following steps:
1. `npm install --ignore-scripts` — Download packages without building native modules
2. `npx patch-package` — Apply C++20 compiler flag patches to native-keymap
3. `npm rebuild` — Build native modules with the patched configuration

Then proceed with development:

```bash
npm run dev
```

## Standard Installation (Node < v24)

If using Node v20 or v22 LTS:

```bash
npm install
npm run dev
```

## Building for Release

```bash
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
```

## Why the patch?

`native-keymap@3.3.9` compiles without explicitly specifying the C++20 standard. Node v24's V8 headers require C++20 (`v8config.h:13`), but the package's `binding.gyp` didn't specify it, causing ~20 compiler errors when built with Node v24.

The patch (in `patches/native-keymap+3.3.9.patch`) adds:
- **macOS**: `CLANG_CXX_LANGUAGE_STANDARD: c++20`
- **Linux**: `cflags_cc: ['-std=c++20']`
- **Windows**: `LanguageStandard: stdcpp20`

This patch is automatically applied during the setup process via `patch-package`.

## About native-keymap

`native-keymap` enables **keyboard layout-aware shortcuts**. It detects the OS keyboard layout (e.g., Dvorak, AZERTY) so shortcuts map to the correct physical keys. Without it, shortcuts would be hardcoded to US QWERTY positions.

**Why not replace it?**
- **`keyboard-layout` (Atom)**: Archived in Dec 2022, no maintenance
- **`@electron/keyboard-layout`**: Doesn't exist on npm registry
- **Other packages**: No maintained alternatives provide the same functionality

So `native-keymap` remains the only actively maintained package for this feature, with 110K+ weekly downloads in production (VS Code, Theia, others).

## Troubleshooting

If `npm run setup` fails:

1. Ensure you have Xcode Command Line Tools installed:
   ```bash
   xcode-select --install
   ```

2. Verify Node version is >= 20.19.0:
   ```bash
   node --version
   ```

3. Clear build cache and try again:
   ```bash
   rm -rf node_modules
   npm run setup
   ```

4. Check the npm build log:
   ```bash
   cat ~/.npm/_logs/*-debug-0.log | tail -50
   ```
