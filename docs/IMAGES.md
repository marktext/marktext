# Image support

MarkText can automatically copy your images into a specified directory or handle images from clipboard.

### Upload to cloud using selected uploader

Please see [here](IMAGE_UPLOADER_CONFIGRATION.md) for more information.

### Move to designated local folder

All images are automatically copied into the specified local directory that may be relative.

**Prefer relative assets folder:**

When this option is enabled, all images are copied relative to the opened file. The root directory is used when a project is opened and no variables are used. You can specify the path via the *relative image folder name* text box and include variables like `${filename}` to add the file name to the relative directory. The local resource directory is used if the file is not saved.

Note: The assets directory name must be a valid path name and MarkText need write access to the directory.

Examples for relative paths:

- `assets`
- `../assets`
- `.`: current file directory
- `assets/123`
- `assets_${filename}` (add the document file name)

### Keep original location

MarkText only saves images from clipboard into the specified local directory.
