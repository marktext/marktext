import { Lexer } from '../../../src/muya/lib/parser/marked'

const parseMarkdown = markdown => {
  const lexer = new Lexer({
    disableInline: true,
    footnote: true
  })
  return lexer.lex(markdown)
}

const convertToken = token => {
  const obj = {}
  for (const key of Object.keys(token)) {
    obj[key] = token[key]
  }
  return obj
}

const convertTokens = tokenList => {
  const tokens = []
  for (const token of tokenList) {
    tokens.push(convertToken(token))
  }
  return tokens
}

// ----------------------------------------------------------------------------

describe('Markdown Footnotes', () => {
  it('Footnote according pandoc specification', () => {
    const expected = [
      { type: 'paragraph', text: 'foo[^1]' },
      { type: 'space' },
      { type: 'footnote_start', identifier: '1' },
      { type: 'paragraph', text: 'foo' },
      { type: 'footnote_end' }
    ]
    const markdown =
`foo[^1]

[^1]: foo`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote according pandoc specification with more text', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy[^1] eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: '1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy[^1] eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.

[^1]: At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with text as tag', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]: At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote without space between footnote tag and text', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]:At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with non-ASCII text', () => {
    const expected = [
      { type: 'paragraph', text: '掲応自情表使[^掲応自情表]供業辞金打論将' },
      { type: 'space' },
      { type: 'footnote_start', identifier: '掲応自情表' },
      { type: 'paragraph', text: '別率重帰更科申会前後度計' },
      { type: 'footnote_end' }
    ]
    const markdown =
`掲応自情表使[^掲応自情表]供業辞金打論将

[^掲応自情表]: 別率重帰更科申会前後度計`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with non-ASCII text as tag', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^掲応自情表] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: '掲応自情表' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^掲応自情表] sadipscing elitr.

[^掲応自情表]: At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with text in next paragraph', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]:

    At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with text in next line', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]:
    At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with inline text and text in next paragraph', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr.' },
      { type: 'space' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]: Lorem ipsum dolor sit amet, consetetur sadipscing elitr.

    At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with multiline text in next paragraphs', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'space' },
      { type: 'paragraph', text: 'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]:

    At vero eos et accusam et justo duo dolores et ea rebum!

    Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with multiline text in next line and paragraph', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'space' },
      { type: 'paragraph', text: 'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]:
    At vero eos et accusam et justo duo dolores et ea rebum!

    Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with multiline text and list elements', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'space' },
      { type: 'list_start', ordered: false, listType: 'bullet', start: '' },
      { checked: undefined, listItemType: 'bullet', bulletMarkerOrDelimiter: '-', type: 'list_item_start' },
      { type: 'text', text: 'list element 1' },
      { type: 'list_item_end' },
      { checked: undefined, listItemType: 'bullet', bulletMarkerOrDelimiter: '-', type: 'list_item_start' },
      { type: 'text', text: 'list element 2' },
      { type: 'list_item_end' },
      { checked: undefined, listItemType: 'bullet', bulletMarkerOrDelimiter: '-', type: 'list_item_start' },
      { type: 'text', text: 'list element 2' },
      { type: 'space' },
      { type: 'list_item_end' },
      { type: 'list_end' },
      { type: 'paragraph', text: 'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]:

    At vero eos et accusam et justo duo dolores et ea rebum!

    - list element 1
    - list element 2
    - list element 2

    Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with multiline text and code block', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'space' },
      { type: 'code', codeBlockStyle: 'fenced', lang: '', text: 'code block text' },
      { type: 'paragraph', text: 'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]:

    At vero eos et accusam et justo duo dolores et ea rebum!

    \`\`\`
    code block text
    \`\`\`

    Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote with prefix is not a footnote', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'paragraph', text: 'a[^foo1]: At vero eos et accusam et justo duo dolores et ea rebum!' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

a[^foo1]: At vero eos et accusam et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote inside paragraph is not a footnote', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'paragraph', text: 'At vero eos et accusam [^foo1]: et justo duo dolores et ea rebum!' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

At vero eos et accusam [^foo1]: et justo duo dolores et ea rebum!`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote is paragraph if escaped (front)', () => {
    const expected = [
      { type: 'paragraph', text: 'foo[^1]' },
      { type: 'space' },
      { type: 'paragraph', text: '\\[^1]: foo' }
    ]
    const markdown =
`foo[^1]

\\[^1]: foo`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Footnote is paragraph if escaped (back)', () => {
    const expected = [
      { type: 'paragraph', text: 'foo[^1]' },
      { type: 'space' },
      { type: 'paragraph', text: '[^1\\]: foo' }
    ]
    const markdown =
`foo[^1]

[^1\\]: foo`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  it('Invalid footenote token', () => {
    const expected = [
      { type: 'paragraph', text: 'foo[^1]' },
      { type: 'space' },
      { type: 'paragraph', text: '[ ^1]: foo' }
    ]
    const markdown =
`foo[^1]

[ ^1]: foo`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })
})

// These tests depend on the parsing style.
describe('Markdown Footnotes (*)', () => {
//   // TODO: This should be a footnote according pandoc but no specification details available.
//   it('Empty footnotes should be a footnote without content', () => {
//     const expected = [
//       { type: 'paragraph', text: 'foo[^foo1]' },
//       { type: 'space' },
//       { type: 'footnote_start', identifier: 'foo1' },
//       { type: 'footnote_end' }
//     ]
//     const markdown =
// `foo[^foo1]
//
// [^foo1]:`
//
//     const tokens = parseTokens(markdown)
//     expect(convertTokens(tokens)).to.deep.equal(expected)
//   })

  it('Empty footnotes with newline should be a footnote without content', () => {
    const expected = [
      { type: 'paragraph', text: 'foo[^foo1]' },
      { type: 'space' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'footnote_end' }
    ]
    const markdown =
`foo[^foo1]

[^foo1]:
`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  // According to pandoc the following test is correct but it seems wrong. Why do we
  // consume `aaaaaa` as footnote content?
  it('Strange footnote content', () => {
    const expected = [
      { type: 'paragraph', text: 'foo[^foo1]' },
      { type: 'space' },
      { type: 'space' },
      { type: 'paragraph', text: 'bbbbbb' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'aaaaaa' },
      { type: 'footnote_end' }
    ]
    const markdown =
`foo[^foo1]

[^foo1]:

aaaaaa

bbbbbb
`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  // NOTE: Currently all footnotes are moved to the bottom of the document.
  it('Footnote should end on normal paragraph', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'space' }, // TODO: Double space seems to be wrong due to reordering?
      { type: 'paragraph', text: 'Sed diam nonumy eirmod tempor.' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr.' },
      { type: 'space' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]: Lorem ipsum dolor sit amet, consetetur sadipscing elitr.

    At vero eos et accusam et justo duo dolores et ea rebum!

Sed diam nonumy eirmod tempor.`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  // NOTE: Currently all footnotes are moved to the bottom of the document.
  it('Footnote should end on wrong indentation', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'space' },
      { type: 'paragraph', text: '  Sed diam nonumy eirmod tempor.' },
      { type: 'footnote_start', identifier: 'foo1' },
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr.' },
      { type: 'space' },
      { type: 'paragraph', text: 'At vero eos et accusam et justo duo dolores et ea rebum!' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^foo1] sadipscing elitr.

[^foo1]: Lorem ipsum dolor sit amet, consetetur sadipscing elitr.

    At vero eos et accusam et justo duo dolores et ea rebum!

  Sed diam nonumy eirmod tempor.`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })

  // NOTE: Missing footnotes should be ignored according specification, but MarkText have to
  //       display even incomplete footnotes. The user should be able to edit and use these.
  it('Footnotes should be always reported', () => {
    const expected = [
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur[^1] sadipscing elitr.' },
      { type: 'space' },
      { type: 'footnote_start', identifier: '2' },
      { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr.' },
      { type: 'footnote_end' }
    ]
    const markdown =
`Lorem ipsum dolor sit amet, consetetur[^1] sadipscing elitr.

[^2]: Lorem ipsum dolor sit amet, consetetur sadipscing elitr.`

    const tokens = parseMarkdown(markdown)
    expect(convertTokens(tokens)).to.deep.equal(expected)
  })
})
