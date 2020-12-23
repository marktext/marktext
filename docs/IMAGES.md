# Image support

Mark Text can automatically copy your images into a specified directory or handle images from clipboard.

### Upload to cloud using selected uploader

Please see [here](IMAGE_UPLOADER_CONFIGRATION.md) for more information.

### Move to designated local folder

All images are automatically copied into the specified local directory that may be relative.

**Prefer relative assets folder:**

When this option is enabled, all images are copied relative to the opened file or the root directory when a project is opened. You can specify the path via the *relative image folder name* text box. The local resource directory is used if the file is not saved.

NB: The assets directory name must be a valid path name and Mark Text need write access to the directory.

Examples for relative paths:

- `assets`
- `../assets`
- `.`: current file directory
- `assets/123`

### Keep original location

Mark Text only saves images from clipboard into the specified local directory.
