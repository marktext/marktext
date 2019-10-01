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

  // Document encoding
  encoding: string,
  // "lf" or "crlf"
  lineEnding: string,
  // Convert document ("lf") to `lineEnding` when saving
  adjustLineEndingOnSave: boolean

  // Whether the document has mixed line endings (lf and crlf) and was converted to lf.
  isMixedLineEndings: boolean
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

  // Document encoding
  encoding: string,
  // "lf" or "crlf"
  lineEnding: string,
  // Convert document ("lf") to `lineEnding` when saving
  adjustLineEndingOnSave: boolean
}
```

```typescript
interface IMarkdownDocumentOptions
{
  // Document encoding
  encoding: string,
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
  encoding: string,
  lineEnding: string,
  adjustLineEndingOnSave: boolean,
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

### Sidebar

TBD

### Tabs

TBD

### Document

TBD
