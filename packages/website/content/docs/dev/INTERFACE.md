# Interface

## Main interface

![](../assets/marktext-interface.png)

- Green: titlebar
- Orange: sidebar
- Red: editor with tabs and per-tab notification at the bottom

### Titlebar

The titlebar is located at the top of the window and shows the current opened file path and the menu on Linux and Windows. On macOS we're using client-side decorations (CSD) that look similar to the picture above. On Linux and Windows there are two type of titlebar: a custom CSD that you can see in the image above and the native one.

### Sidebar

The optional, resizable sidebar contains the filesystem explorer and a find-in-files search powered by ripgrep. The explorer includes a collapsible _Opened Files_ section (`openedFilesInSidebar`). In the 0.24.0 development version, it supports multiple folder roots, search across available roots, and a draggable divider below Opened Files.

The document outline is a separate responsive panel, available since 0.23.0. It lists the active document's headings and can remain expanded or float in a compact window. The title-bar statistics popover shows document and selection counts, file timestamps and a per-tab Reading Mode switch.

### Editor

The editor is the core element that hosts the realtime preview editor called Muya and consists of three parts. Tabs are located at the top and at the bottom the per-tab notification bar is located for events like file changed or deleted. The main part is the editor that is either provided by Muya or CodeMirror for the source-code editor. There are multiple overlays available like inline toolbar, emoji picker, quick insert or image tools. Hovering a rendered diagram, math block or HTML block shows a small toolbar in its top-right corner; for a diagram it also offers a view action that opens the diagram full-screen in the media viewer, which is shared with the image preview and adds zoom, pan and image export.
