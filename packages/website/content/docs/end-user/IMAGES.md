# Image support

MarkText can automatically copy your images into a specified directory or handle images from clipboard.

### Upload to cloud using selected uploader

Please see [here](IMAGE_UPLOADER_CONFIGRATION.md) for more information.

### Move to designated local folder

With `imageInsertAction=folder`, inserted local image files and binary images are copied into the configured directory. Remote URLs are kept as URLs. The destination can be relative for saved documents.

**Prefer relative assets folder:**

Enable this option to use a relative destination for local copies associated with a saved document. Choose `imageRelativeDirectoryBase=file` to anchor the directory next to the document or `folder` to anchor it at its project root. You can specify the path via the _relative image folder name_ text box and include variables like `${filename}` to add the file name to the relative directory. For unsaved documents, copies use the configured global image folder instead. If the folder base is selected but no matching project root contains the file, MarkText falls back to the document directory. `${filename}` expands to the document name without its extension.

Note: The assets directory name must be a valid path name and MarkText need write access to the directory.

Examples for relative paths:

- `assets`
- `../assets`
- `.`: current file directory
- `assets/123`
- `assets_${filename}` (add the document file name)

### Keep original location

Existing path strings are kept unchanged. Binary images, including pasted clipboard images, are written to the configured image folder; a saved document can use its configured relative image folder.

## Media viewer

In the WYSIWYG editor, Command-click an image on macOS or Ctrl-click it on Linux/Windows to open the media viewer. The image preview action also opens this viewer. Rendered diagrams also have a **View** action in their hover toolbar. Use the mouse wheel or the zoom buttons to zoom, and drag to pan.

The viewer supports <kbd>+</kbd>/<kbd>-</kbd> for zoom, <kbd>0</kbd> to fit, <kbd>1</kbd> for actual size, arrow keys to pan, and <kbd>Esc</kbd> to close. Diagram controls offer PNG export and, when available, SVG export, plus copying as a PNG. Available actions depend on the content being viewed.

PlantUML diagrams use the server configured by `plantumlServer` in Preferences → Markdown. The default is `https://www.plantuml.com/plantuml`; choose your own HTTP(S) endpoint to use another server. Rendering sends the encoded diagram source to the selected server.
