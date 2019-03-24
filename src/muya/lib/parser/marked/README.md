# Marked

This folder contains a patched [Marked.js](https://github.com/markedjs/marked/) version based on `v0.6.1` commit [6eec528e5d6e08ea751251f9dc195d052caf4a79](https://github.com/markedjs/marked/commit/6eec528e5d6e08ea751251f9dc195d052caf4a79).

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
