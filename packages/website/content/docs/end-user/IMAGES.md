# Image support

MarkText can automatically copy your images into a specified directory or handle images from clipboard.

### Upload to cloud using selected uploader

Please see [here](IMAGE_UPLOADER_CONFIGRATION.md) for more information.

### Move to designated local folder

All images are automatically copied into the specified local directory that may be relative.

**Prefer relative assets folder:**

When this option is enabled, all images are copied relative to the opened file. Choose `imageRelativeDirectoryBase=file` to anchor the directory next to the document or `folder` to anchor it at its project root. You can specify the path via the _relative image folder name_ text box and include variables like `${filename}` to add the file name to the relative directory. The local resource directory is used if the file is not saved.

Note: The assets directory name must be a valid path name and MarkText need write access to the directory.

Examples for relative paths:

- `assets`
- `../assets`
- `.`: current file directory
- `assets/123`
- `assets_${filename}` (add the document file name)

### Keep original location

MarkText only saves images from clipboard into the specified local directory.

## Media viewer

Open an image preview to inspect it in the media viewer. Rendered diagrams also have a **View** action in their hover toolbar. Use the mouse wheel or the zoom buttons to zoom, and drag to pan.

The viewer supports <kbd>+</kbd>/<kbd>-</kbd> for zoom, <kbd>0</kbd> to fit, <kbd>1</kbd> for actual size, arrow keys to pan, and <kbd>Esc</kbd> to close. Diagram controls offer PNG export and, when available, SVG export, plus copying as a PNG. Available actions depend on the content being viewed.

PlantUML diagrams use the server configured by `plantumlServer` in Preferences → Markdown. The default is `https://www.plantuml.com/plantuml`; choose your own HTTP(S) endpoint to use another server. Rendering sends the encoded diagram source to the selected server.
