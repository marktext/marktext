# Project Architecture

MarkText is an Electron application with a Vue 3 interface and a separate TypeScript editor engine, Muya. The desktop application, editor engine and website share a pnpm workspace.

## Repository layout

```text
package.json                 Workspace commands and shared tooling
pnpm-workspace.yaml          Workspace membership and build permissions
scripts/                     Installation, locales and license tooling
.github/workflows/           Desktop, Muya and website CI
packages/
  desktop/                   Electron application (marktext)
    src/common/              Shared Node utilities
    src/main/                Application lifecycle, windows, IO and IPC
    src/preload/             Typed contextBridge APIs
    src/renderer/src/        Vue components, Pinia stores and editor hosts
    src/shared/types/        Cross-process types and IPC contract
    src/types/               Ambient declarations
    static/                  Locales, icons and other app assets
    build/                   Packaging resources
    test/                    Desktop unit and Playwright tests
    out/                     Compiled bundles (generated)
  muya/                      Editor engine (@muyajs/core)
    src/                     TypeScript implementation
    test/spec/               CommonMark and GFM conformance suites
    examples/                Standalone development demo workspace
    e2e/                     Editor Playwright workspace
  website/                   Next.js documentation and project website
    content/docs/            Documentation Markdown sources
    public/docs/             Documentation images and other static assets
dist/                        Packaged installers (generated)
```

Root desktop commands proxy to `packages/desktop`. Paths beginning with `src/` in the desktop developer guides are relative to `packages/desktop/` unless stated otherwise.

## Electron boundaries

### Main process

`packages/desktop/src/main/index.ts` initializes the application. The main process has Node.js and Electron access and owns windows, filesystem operations, native dialogs, file watchers and operating-system integrations. Avoid blocking it with long synchronous operations.

### Preload bridge

`packages/desktop/src/preload/index.ts` exposes typed APIs through `contextBridge`. Editor and preferences windows both use `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false` in `src/main/config.ts`.

Renderer code accesses capabilities through `window.electron`, `window.fileUtils`, `window.path` and other narrow bridge APIs. It cannot import Node.js or Electron directly. Main and preload compile to CommonJS; the renderer compiles to ES modules.

Production windows enable web security. Development disables it to load document-local `file://` images from the Vite HTTP origin. Keep this development exception distinct from production behavior when debugging resources.

### Renderer

`packages/desktop/src/renderer/src/main.ts` mounts the Vue application for an editor window. Pinia stores coordinate tabs, document modes, preferences, layout and folder roots. Each window hosts the Muya WYSIWYG editor and a CodeMirror source editor.

Source mode transfers Markdown between CodeMirror and Muya. Reading mode is tracked per document and protects editing and writes across the renderer and main process. The independent document outline derives from the active document's headings.

## Muya

`packages/muya/src/index.ts` is the public entry point of `@muyajs/core`. The engine handles Markdown parsing, block data, editing interactions, rendering and Markdown/HTML export without Electron APIs. It is consumed as a workspace dependency by the desktop app.

At runtime, electron-vite and Vitest resolve the package's source through its `exports` map. Desktop type checking uses generated declarations in `packages/muya/lib/types/` to keep the two packages' compiler settings separate. See [TypeScript](TYPESCRIPT.md).

## Opening a document

1. A file-menu action or command requests a native open dialog in the main process.
2. The application selects an editor window, loads the document and registers filesystem watching.
3. The main process sends `mt::open-new-tab` through IPC.
4. The renderer editor store creates or selects the document tab and notifies the editor host.
5. The active document is loaded into the appropriate editor view.

Sidebar opens can reuse a preview tab. Editing the document or double-clicking the sidebar file keeps that tab open. Folder state is maintained separately: one window can host multiple roots, each with its own tree and watcher state; folder search covers available roots.

See [IPC](IPC.md) for the communication contract, [Interface](INTERFACE.md) for the window layout, and [Build instructions](BUILD.md) for package-specific checks.
