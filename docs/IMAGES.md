# Image support

MarkText can automatically copy your images into a specified directory or handle images from clipboard.

### Maintaining server paths during editing and preview

When editing documents, you may want image paths to represent absolute paths on the server that will ultimately host them (such as `/images/myImage.png`) rather than
local filesystem paths (such as `C:\assets\static\images\myImage.png`). You can use _Maintain server paths during editing and preview_ to support this scenario.

When MarkText sees a specified server path for an image in your document, it will instead look into the local path you've provided when previewing images. Your document will retain the original server path as specified.


### Upload to cloud using selected uploader

Please see [here](IMAGE_UPLOADER_CONFIGRATION.md) for more information.

### Move to designated local folder

This option automatically copies images into the specified local directory. This path may be a relative path, and may include variables like `${filename}`. The local resource directory is used if the file is not saved. This directory must be a valid path name and MarkText need write access to the directory.

The following are valid variables for use in the image path:

- `${filename}`: The document's file name, without path or extension
- `${year}`: The current year
- `${month}`: The current month, in 2-digit format
- `${day}`: The current day, in 2-digit format

If you have specified the option to _Maintain server paths during editing and preview_, MarkText will replace local filesystem paths with the corresponding server path.

**Prefer relative assets folder:**

When this option is enabled, all images are copied relative to the opened file. The root directory is used when a project is opened and no variables are used. You can specify the path via the *relative image folder name* text box.

Examples for relative paths:

- `assets`
- `../assets`
- `.`: current file directory
- `assets/123`
- `assets_${filename}` (add the document file name)
- `assets/${year}/${month}` (save the assets into year and month subdirectories)

### Keep original location

MarkText only saves images from clipboard into the specified local directory.
