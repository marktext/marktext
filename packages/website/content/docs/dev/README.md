# Developer Documentation

## Workspace commands

Run the commands below from the repository root. Desktop scripts proxy to `packages/desktop`; Muya (`packages/muya`) and the Next.js website (`packages/website`) have their own package scripts. See [Architecture](ARCHITECTURE.md) for the directory layout and [Website development](WEBSITE.md) for documentation changes.

## 1. Project Setup

### 1.1 Pre-Requisites

- Python 3 for native dependency builds; release CI selects Python 3.12

- Node.js (`>=22.12.0`) — the PR build CI uses Node 22.21.1, the release CI uses Node 24.14.1

- pnpm `>=10`; use the version pinned in the root `package.json` (`packageManager`).

### 1.2 Linux Specific Pre-requisites

- Linux environments require additional dependencies, please see [Linux Specific Pre-reqs](LINUX_DEV.md)

### 1.3 Windows Specific Pre-requisites

Install Visual Studio 2022 C++ build tools and a Windows SDK. The root `.npmrc` sets `msvs_version=2022` and `clang=0` for native dependency builds.

### 1.4 Clone and Install

```bash
git clone https://github.com/marktext/marktext.git
cd marktext
pnpm install
```

### 1.5 Create minified locale files

- Installation and platform packaging scripts minify locales automatically. `build:unpack` also includes this step; `dev` and the plain `build` script do not.

```
pnpm run minify-locales
```

### 1.6 Run in Development

```bash
pnpm run dev
```

#### 1.6.1 Some Points to Note:

- Restart `pnpm run dev` after changing the main process. A window reload (`Ctrl+R`) reruns preload; restart development if a preload change is not reflected.
- The renderer hot-reloads through Vite. Reload the window if it retains stale state.
- Compile targets:
  - `main` and `preload` still compile to `CommonJS`
  - `renderer` is `ESModules` only (take note when using any legacy `CommonJS` libraries)

### 1.7 Build for Production

```bash
# For windows
$ pnpm run build:win

# For macOS
$ pnpm run build:mac

# For Linux
$ pnpm run build:linux
```

### 1.8 Compile and test

`pnpm run build:unpack` compiles without packaging. `pnpm run start` runs `electron-vite preview`, which rebuilds before launching. To launch existing bundles without rebuilding, use `pnpm -C packages/desktop exec electron-vite preview --skipBuild`. Platform packaging commands above write installers to the repository-root `dist/`.

Run `pnpm run lint`, `pnpm run typecheck` and `pnpm run test:unit` for desktop changes. See [Build instructions](BUILD.md#development-and-checks) for single-spec commands, E2E tests and Muya checks.

## 2. Sub-sections

- [Performance testing](PERFORMANCE.md)
- [Project architecture](ARCHITECTURE.md)
- [Build instructions](BUILD.md)
- [Website development](WEBSITE.md)
- [Debugging](DEBUGGING.md)
- [Inter-process communication (IPC)](IPC.md)
- [Interface](INTERFACE.md)
- [Steps to release MarkText](RELEASE.md)
- [Prepare a hotfix](RELEASE_HOTFIX.md)
- [TypeScript layout and conventions](TYPESCRIPT.md)
