# Interface

## Main interface

![](../assets/marktext-interface.png)

- Green: titlebar
- Orange: sidebar
- Red: editor with tabs and per-tab notification at the bottom

The editor window contains a title bar, an optional sidebar, optional tabs and the document editor. A separate outline panel navigates the active document's headings. Layout visibility is coordinated by `packages/desktop/src/renderer/src/store/layout.ts`.

### Titlebar

The title bar shows document information and the statistics counter. Linux and Windows expose the application menu and window controls in the custom title bar; the `titleBarStyle` preference also offers native window decorations. macOS uses the hidden-inset title-bar configuration in `packages/desktop/src/main/config.ts`.

### Sidebar

The optional, resizable sidebar contains the filesystem explorer and a find-in-files search powered by ripgrep. The explorer includes a collapsible _Opened Files_ section (`openedFilesInSidebar`). In the 0.24.0 development version, it supports multiple folder roots, search across available roots, and a draggable divider below Opened Files.

The document outline is a separate responsive panel, available since 0.23.0. It lists the active document's headings and can remain expanded or float in a compact window. The title-bar statistics popover shows document and selection counts, file timestamps and a per-tab Reading Mode switch.

### Editor

The editor is the core element that hosts the realtime preview editor called Muya and consists of three parts. Tabs are located at the top and at the bottom the per-tab notification bar is located for events like file changed or deleted. The main part is the editor that is either provided by Muya or CodeMirror for the source-code editor. There are multiple overlays available like inline toolbar, emoji picker, quick insert or image tools. Hovering a rendered diagram, math block or HTML block shows a small toolbar in its top-right corner; for a diagram it also offers a view action that opens the diagram full-screen in the media viewer, which is shared with the image preview and adds zoom, pan and image export.

#### Editor shortcuts

The desktop main process owns command shortcuts. `mt::keybindings-response` sends a complete active map, including custom bindings and empty strings for unbound commands. The command-center store retains this snapshot before descriptions finish loading and reapplies it after language changes or dynamic command registration. Menu accelerators and the renderer therefore use the same command IDs.

`renderer/src/util/muyaShortcuts.ts` maps Muya action names to desktop command IDs. Register `InlineFormatToolbar` and `ParagraphQuickInsertMenu` with `keyboardShortcuts: false` and a `getShortcut(action)` callback; register `ParagraphFrontMenu` with the callback. The flag disables built-in command handling while retaining clicks, slash-menu navigation and toolbar visibility handling. Standalone Muya consumers can omit the options to retain their defaults.

Once a provider is supplied, an empty string or `undefined` hides the hint without falling back to Muya's bundled shortcuts. After changing the provider's backing data, call `muya.refreshShortcutHints()` to repaint visible menus without changing the document, selection or slash search. Add new action mappings and tests when adding menu actions that have desktop commands. Actions without a registered desktop command have no shortcut hint.

Muya cancels native `format*` beforeinput events inside its editor so browser rich-text shortcuts cannot mutate the DOM outside the document model after rebinding or unbinding a command. Plain-text editing and input controls outside the editor retain their normal behavior.

The recorder and Electron window dispatcher share the vendored `common/localShortcut` module. Its README documents layout handling and shifted symbol compatibility; retain its MIT notice in generated third-party notices when changing the module or packaging.
