# Developer Documentation

## 1. Project Setup

### 1.1 Pre-Requisites

- Python (`>= 3.12`)

- Node.JS (`24.14.1`) [Same version as the current Electron release]
  - Using other versions _may_ work, but you might run into errors while compiling native add-ons

- A lot of patience

### 1.2 Linux Specific Pre-requisites

- Linux environments require additional dependencies, please see [Linux Specific Pre-reqs](LINUX_DEV.md)

### 1.3 Windows Specific Pre-requisites

- You will need [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/) (Scroll all the way to the bottom)
  - Additionally, you need **spectre-mitigated MSVC**, go to "Individual Components" and select "MSVC ... - VS2022 C++ Spectre-Mitigated Libs"
  - Many native libraries do not support ClangCL well yet, hence we force it to use MSVC in our `.npmrc`

### 1.4 Clone and Install

```bash
git clone https://github.com/marktext/marktext.git
cd marktext
npm install
```

### 1.5 Create minified locale files

- This is **automatically ran** when building for production, but not for dev for performance

```
npm run minify-locales
```

### 1.6 Run in Development

```bash
npm run dev
```

#### 1.6.1 Some Points to Note:

- The `main` and `preload` processes are **NOT** automatically hot-loaded on edit, you need to **reload the development process** on each edit unfortunately
  - The good news is Vite bundles it _really really quickly_ so it shouldnt be too big of a hassle
- Although the `renderer` process is hot-loaded, loss of states can often lead to **weird errors**. I recommend doing a full reload if this happens
- Compile targets:
  - `main` and `preload` still compile to `CommonJS`
  - `renderer` is `ESModules` only (take note when using any legacy `CommonJS` libraries)

### 1.7 Build for Production

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## 2. Sub-sections

- [Performance testing](PERFORMANCE.md)
- [Project architecture](ARCHITECTURE.md)
- [Build instructions](BUILD.md)
- [Debugging](DEBUGGING.md)
- [Interface](INTERFACE.md)
- [Steps to release MarkText](RELEASE.md)
- [Prepare a hotfix](RELEASE_HOTFIX.md)
- [Internal documentation](code/README.md)
