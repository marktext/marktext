# Build Instructions

MarkText is built from the pnpm workspace at the repository root. Compiling the application and packaging installers are separate steps.

## Prerequisites

- Node.js `>=20.19.0` and pnpm `>=10`. Use the pnpm version pinned by `packageManager` in the root `package.json`.
- Python `>=3.12` and a C++ toolchain for native dependencies.
- Build on the target operating system: Linux, macOS or Windows. The release workflow builds x64 and arm64 on native runners.

### Linux

On Debian-based distributions:

```sh
sudo apt-get install libx11-dev libxkbfile-dev libsecret-1-dev libfontconfig-dev rpm
```

On Red Hat-based distributions:

```sh
sudo dnf install libX11-devel libxkbfile-devel libsecret-devel fontconfig-devel
```

On Arch Linux:

```sh
sudo pacman -S libx11 libxkbfile libsecret fontconfig
```

See [Linux development](LINUX_DEV.md) for additional tooling and troubleshooting. Running the application also requires Electron's desktop libraries; the Debian and RPM packages declare their runtime dependencies in `packages/desktop/electron-builder.yml`.

### Windows

Install Build Tools for Visual Studio 2022 with the C++ toolchain, Windows SDK and the **MSVC VS2022 C++ Spectre-Mitigated Libs** component. The repository's `.npmrc` selects MSVC for native dependencies.

### macOS

Install Xcode Command Line Tools. The CI build sets `CXXFLAGS` to `-std=gnu++20 -stdlib=libc++` when rebuilding native modules.

## Install and compile

```sh
git clone https://github.com/marktext/marktext.git
cd marktext
pnpm install
pnpm run build:unpack
pnpm run start
```

Installation runs `scripts/postinstall.ts`, including native dependency setup, patching, Muya type generation and locale minification. `build:unpack` minifies locales and compiles the main, preload and renderer bundles. Despite its name, it does not run electron-builder or create an unpacked distribution directory. `start` previews the existing bundles without rebuilding them.

Compiled bundles are written to `packages/desktop/out/`. The shorter `pnpm run build` only runs electron-vite; run locale minification separately if using it for a production preview.

## Package installers

Run the command for your host platform:

| Command                      | Output                                        |
| ---------------------------- | --------------------------------------------- |
| `pnpm run build:win:x64`     | Windows x64 NSIS installer and zip            |
| `pnpm run build:win:arm64`   | Windows arm64 NSIS installer and zip          |
| `pnpm run build:mac:x64`     | Intel macOS DMG and zip                       |
| `pnpm run build:mac:arm64`   | Apple Silicon macOS DMG and zip               |
| `pnpm run build:linux:x64`   | Linux x64 AppImage, snap, deb, rpm and tar.gz |
| `pnpm run build:linux:arm64` | Linux arm64 AppImage, deb, rpm and tar.gz     |

Each packaging script minifies locales, rebuilds native modules, compiles the app and runs electron-builder with publishing disabled. Installers land in the repository-root `dist/`, configured by `directories.output: ../../dist` in `packages/desktop/electron-builder.yml`.

The shorter commands remain available: `build:win` selects x64; `build:mac` and `build:linux` use their electron-builder configuration without an explicit architecture argument. Use the architecture-specific scripts to match CI.

## Development and checks

Run all commands below from the repository root:

| Command                   | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `pnpm run dev`            | Launch Electron with renderer hot reload                 |
| `pnpm run lint`           | Check desktop/shared tooling code style                  |
| `pnpm run typecheck`      | Build Muya declarations and check desktop TypeScript/Vue |
| `pnpm run test:unit`      | Run desktop unit tests                                   |
| `pnpm run test:e2e`       | Run desktop Playwright tests                             |
| `pnpm run rebuild-native` | Rebuild native modules after changing Electron           |

The renderer hot-reloads through Vite. Reload the window with `Ctrl+R` if necessary; this also reruns preload. Restart `pnpm run dev` after main-process changes.

Package-specific test paths are relative to that package:

```sh
pnpm -C packages/desktop exec vitest run test/unit/specs/markdown-basic.spec.ts
pnpm -C packages/desktop exec playwright test test/e2e/launch.spec.ts
```

Muya has its own checks:

```sh
pnpm --filter @muyajs/core lint
pnpm --filter @muyajs/core lint:types
pnpm --filter @muyajs/core test
pnpm --filter @muyajs/core test:spec
```

For the documentation site, see [Website development](WEBSITE.md).
