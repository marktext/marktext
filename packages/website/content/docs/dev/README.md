# Developer Documentation

## Workspace commands

Run the commands below from the repository root. Desktop scripts proxy to `packages/desktop`; Muya (`packages/muya`) and the Next.js website (`packages/website`) have their own package scripts. See [Architecture](ARCHITECTURE.md) for the directory layout and [Website development](WEBSITE.md) for documentation changes.

## 1. Project Setup

### 1.1 Pre-Requisites

- Python (`>= 3.12`)

- Node.js (`>=20.19.0`) — the PR build CI uses Node 22.21.1, the release CI uses Node 24.14.1; any version meeting the minimum should work
  - Using versions significantly newer than the Electron-bundled Node may cause issues compiling native add-ons

- pnpm `>=10`; use the version pinned in the root `package.json` (`packageManager`).

### 1.2 Linux Specific Pre-requisites

- Linux environments require additional dependencies, please see [Linux Specific Pre-reqs](LINUX_DEV.md)

### 1.3 Windows Specific Pre-requisites

- You will need [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/) (Scroll all the way to the bottom)
  - Additionally, you need **spectre-mitigated MSVC**, go to "Individual Components" and select "MSVC ... - VS2022 C++ Spectre-Mitigated Libs"
  - Many native libraries do not support ClangCL well yet, hence we force it to use MSVC in our `.npmrc` (pnpm respects this file)

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
- Although the `renderer` process is hot-loaded, loss of states can often lead to **weird errors**. I recommend doing a full reload if this happens
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

`pnpm run build:unpack` compiles without packaging. `pnpm run start` previews the existing build in `packages/desktop/out/`. Platform packaging commands above write installers to the repository-root `dist/`.

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
