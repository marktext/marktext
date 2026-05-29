# Marked

This folder contains a patched [Marked.js](https://github.com/markedjs/marked/) version based on `v0.8.2` and bug fixes from `v1.2.5`, no breaking changes from `v1.0.0` are included.

## Changes

### Features

- Markdown Extra: frontmatter and inline and block math
- GFM like: emojis

### (Inline) Lexer

- `disableInline` mode
- Custom list and list item implementation based on an older marked.js version
- Slightly modified definition due `disableInline`
- More token information like list item bullet type

### Renderer

- Emoji renderer
- Frontmatter renderer
- Inline and block (`multiplemath`) math renderer

## License

[MIT](LICENSE)
