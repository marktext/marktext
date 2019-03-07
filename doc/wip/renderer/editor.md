# Editor

TBD

## Internal

### Raw markdown document

```typescript
interface IMarkdownDocumentRaw
{
  // Markdown content
  markdown: string,
  // Filename
  filename: string,
  // Full path (may be empty?)
  pathname: string,

  // Indicates whether the document is UTF8 or UTF8-DOM encoded.
  isUtf8BomEncoded: boolean,
  // "lf" or "crlf"
  lineEnding: string,
  // Convert document ("lf") to `lineEnding` when saving
  adjustLineEndingOnSave: boolean

  // Whether the document has mixed line endings (lf and crlf) and was converted to lf.
  isMixedLineEndings: boolean

  // TODO(refactor:renderer/editor): Remove this entry! This should be loaded separately if needed.
  textDirection: boolean
}
```

### Markdowm document

A markdown document (`IMarkdownDocument`) represent a file.

```typescript
interface IMarkdownDocument
{
  // Markdown content
  markdown: string,
  // Filename
  filename: string,
  // Full path (may be empty?)
  pathname: string,

  // Indicates whether the document is UTF8 or UTF8-DOM encoded.
  isUtf8BomEncoded: boolean,
  // "lf" or "crlf"
  lineEnding: string,
  // Convert document ("lf") to `lineEnding` when saving
  adjustLineEndingOnSave: boolean
}
```

### File State

Internal state of a markdown document. `IMarkdownDocument` is used to create a `IFileState`.

```typescript
interface IDocumentState
{
  isSaved: boolean,
  pathname: string,
  filename: string,
  markdown: string,
  isUtf8BomEncoded: boolean,
  lineEnding: string,
  adjustLineEndingOnSave: boolean,
  textDirection: string,
  history: {
    stack: Array<any>,
    index: number
  },
  cursor: any,
  wordCount: {
    paragraph: number,
    word: number,
    character: number,
    all: number
  },
  searchMatches: {
    index: number,
    matches: Array<any>,
    value: string
  }
}
```

### ...

TBD

## View

TBD

### Side Bar

TBD

### Tabs

TBD

### Document

TBD
