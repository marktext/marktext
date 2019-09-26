# Marked

This folder contains a patched [Marked.js](https://github.com/markedjs/marked/) version based on `v0.7.0` commit [16a6495326b2fe7623840d4054b0deba5afbc00a](https://github.com/markedjs/marked/commit/16a6495326b2fe7623840d4054b0deba5afbc00a).

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
