# Marked

This folder contains a patched [Marked.js](https://github.com/markedjs/marked/) version based on `v0.6.2` commit [529a8d4e185a8aa561e4d8d2891f8556b5717cd4](https://github.com/markedjs/marked/commit/529a8d4e185a8aa561e4d8d2891f8556b5717cd4).

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
