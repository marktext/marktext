# Marked

This folder contains a patched [Marked.js](https://github.com/markedjs/marked/) version based on `v0.7.0` commit [f569637ddaf30c39a4bbc48ced0c5796d9cbe126](https://github.com/markedjs/marked/commit/f569637ddaf30c39a4bbc48ced0c5796d9cbe126).

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
