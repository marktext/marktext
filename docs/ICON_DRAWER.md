# Icon Drawer

The icon drawer adds a quick icon picker to the editor toolbar.

## Open the icon drawer

1. Open a Markdown file in the normal editor mode.
2. Click `Icons` in the markdown toolbar.
3. Select an icon to insert it at the current cursor position.

## Default icon set

- MarkText ships with a GitHub-style icon list based on this shortcode reference:
  - https://gist.github.com/rxaviers/7360908
- Default icons are inserted as GitHub-style shortcodes such as `:smile:`.
- The bundled defaults include the shortcode aliases that map to Unicode emojis.

## Custom and local icons

- `Add Custom` lets you save an image URL, file URL, or local path as an icon.
- `Import Local` imports image files from a selected directory (`.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.gif`).
- Imported/custom icons are inserted as images.

## Persistence

- Drawer settings and custom/local icons are stored in `feature-config.sqlite` under the user data directory.
- See [Application data directory](APPLICATION_DATA_DIRECTORY.md) for platform-specific locations.
