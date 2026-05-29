// Reference shapes for several common block types — not exhaustive
// (footnote, html-preview/container, math/diagram containers, and other
// internal/attachment blocks are not represented). Not consumed at
// runtime; kept as a quick lookup for plugin authors who need to
// construct JSON state directly instead of going through markdown.
export const DEFAULT_STATE = [
    {
        name: 'frontmatter',
        text: 'title: muya',
        meta: {
            lang: 'yaml', // yaml | toml | json
            style: '-', // `-` for yaml | `+` for toml | `;;;` and `{}` for json
        },
    },
    {
        name: 'atx-heading',
        meta: {
            level: 1, // 1 ~ 6
        },
        text: '# Inline Format', // can not contain `\n`!
    },
    {
        name: 'paragraph',
        text: '**strong** *emphasis* `inline code` &gt; <u>underline</u> <mark>highlight</mark> <ruby>北京<rt>Beijing</rt></ruby> [Baidu](http://www.baidu.com) H0~2~ X^5^',
    },
    {
        name: 'setext-heading',
        meta: {
            level: 1,
            underline: '===', // === or ---
        },
        text: 'GitHub and Extra\nInline format',
    },
    {
        name: 'paragraph',
        text: ':man:  ~~del~~ http://google.com $a \\ne b$',
    },
    {
        name: 'diagram',
        text: `mermaid TD
    A[Hard] -->|Text| B(Round)
    B --> C{Decision}
    C -->|One| D[Result 1]
    C -->|Two| E[Result 2]`,
        meta: {
            lang: 'yaml',
            type: 'mermaid',
        },
    },
    {
        name: 'code-block',
        meta: {
            type: 'indented',
            lang: 'javascript',
        },
        text: 'const foo = `bar`',
    },
    {
        name: 'math-block',
        text: 'a \\ne b',
        meta: {
            mathStyle: '',
        },
    },
    {
        name: 'html-block',
        text: '<div>\nfoo bar\n</div>',
    },
    {
        name: 'table',
        children: [
            {
                name: 'table.row',
                children: [
                    { name: 'table.cell', meta: { align: 'right' }, text: 'foo' },
                    { name: 'table.cell', meta: { align: 'none' }, text: 'bar' },
                ],
            },
            {
                name: 'table.row',
                children: [
                    { name: 'table.cell', meta: { align: 'right' }, text: 'zar' },
                    { name: 'table.cell', meta: { align: 'none' }, text: 'foo bar' },
                ],
            },
        ],
    },
    {
        name: 'order-list',
        meta: { start: 0, loose: true, delimiter: '.' },
        children: [
            {
                name: 'list-item',
                children: [{ name: 'paragraph', text: 'foo\nbar' }],
            },
        ],
    },
    {
        name: 'bullet-list',
        meta: { marker: '-', loose: false },
        children: [
            {
                name: 'list-item',
                children: [
                    { name: 'paragraph', text: 'foo bar1' },
                    { name: 'paragraph', text: 'foo bar2' },
                ],
            },
        ],
    },
    {
        name: 'task-list',
        meta: { marker: '-' },
        children: [
            { name: 'task-list-item', meta: { checked: false }, children: [{ name: 'paragraph', text: 'a' }] },
            { name: 'task-list-item', meta: { checked: true }, children: [{ name: 'paragraph', text: 'b' }] },
        ],
    },
    { name: 'thematic-break', text: '---' },
    {
        name: 'block-quote',
        children: [{ name: 'paragraph', text: 'foo\nbar' }],
    },
];

// Playground markdown. Organized into ATX chapters so `muya.getTOC()` (in the
// sidebar "Show TOC" button) doubles as a feature-coverage checklist. Each
// chapter targets one category of supported features; remove a chapter only
// if you also remove the corresponding feature from packages/core.
export const DEFAULT_MARKDOWN = `---
title: Muya Playground
description: Demo coverage for every supported block and inline format
tags: [muya, editor, demo]
---

# 1. Headings

## ATX H2

### ATX H3

#### ATX H4

##### ATX H5

###### ATX H6

Setext H1
=========

Setext H2
---------

# 2. Paragraphs and Line Breaks

A regular paragraph. The two lines below are joined by a **soft** line break (single newline, no visible \`<br>\`):

first line of soft break
second line of soft break

The two lines below are joined by a **hard** line break (two trailing spaces produce a \`<br>\`):

first line of hard break  
second line of hard break

Backslash escapes: \\* \\_ \\[ \\] \\\\ \\\` produce literal punctuation instead of formatting.

# 3. Inline Formatting

**strong**, *emphasis*, ***both at once***, \`inline code\`, ~~strikethrough~~, inline math $a \\ne b$, super^script^ and sub~script~, emoji :smile: :rocket: :tada:.

# 4. Links and Images

Inline link with title: [Anthropic](https://www.anthropic.com "Hello Claude").

Autolink: <https://commonmark.org>.

Raw URL autolink (GFM extension): https://github.com/marktext/muya.

HTML anchor: <a href="https://github.com/marktext/muya">marktext/muya on GitHub</a>.

Reference link: [Wikipedia][wiki] and shorthand [example].

Reference image: ![marktext logo small][img].

Inline image:

![marktext logo](https://raw.githubusercontent.com/marktext/marktext/develop/static/icon.png "marktext icon")

[wiki]: https://en.wikipedia.org "Wikipedia"
[example]: https://example.com "Example"
[img]: https://raw.githubusercontent.com/marktext/marktext/develop/static/logo-96px.png "marktext logo 96px"

# 5. Inline HTML

<u>underline</u>, <mark>highlight</mark>, H<sub>2</sub>O, E=mc<sup>2</sup>, <ruby>北京<rt>Beijing</rt></ruby>.

HTML entities: &gt; &lt; &amp;.

Custom span: <span style="color:#d33">red text</span>.

# 6. Block Quotes

> Level 1 block quote.
>
> > Level 2 nested quote.
> >
> > > Level 3 nested quote.

> A quote that contains a list:
>
> - item one
> - item two

# 7. Lists

Bullet list with \`-\` marker:

- dash one
- dash two

Bullet list with \`+\` marker:

+ plus one
+ plus two

Bullet list with \`*\` marker:

* asterisk one
* asterisk two

Ordered list with \`.\` delimiter:

1. one
2. two
3. three

Ordered list with \`)\` delimiter:

1) alpha
2) beta
3) gamma

Nested mixed list:

- outer item
    - nested unordered
        1. nested ordered
        2. second
- outer next

Tight list (no blank lines):

- tight one
- tight two
- tight three

Loose list (blank lines between items):

- loose one

- loose two

- loose three

# 8. Task Lists

- [ ] open task
- [x] completed task
- [ ] parent task
    - [x] nested done
    - [ ] nested pending

# 9. Thematic Breaks

Three dashes:

---

Three asterisks:

***

Three underscores:

___

# 10. Code Blocks

Indented code block (4-space indent):

    const greet = (name) => \`Hello, \${name}!\`;
    greet('world');

Fenced TypeScript (toggle \`codeBlockLineNumbers\` in the sidebar to see line numbers):

\`\`\`typescript
import { Muya } from '@muyajs/core';

const muya = new Muya(document.querySelector('#editor')!, {
    markdown: '# hello',
    codeBlockLineNumbers: true,
});

muya.init();
muya.on('json-change', () => console.log('changed'));
\`\`\`

Fenced Python:

\`\`\`python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

Fenced Bash:

\`\`\`bash
pnpm install && pnpm dev
\`\`\`

Fenced JSON:

\`\`\`json
{
    "name": "@muyajs/core",
    "version": "0.2.0"
}
\`\`\`

Empty fenced block (toggle \`trimUnnecessaryCodeBlockEmptyLines\` to see how empty lines are handled on import):

\`\`\`


\`\`\`

# 11. Math

Block math (KaTeX, requires \`math: true\`):

$$
\\int_{0}^{\\infty} e^{-x^2} \\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

# 12. Tables

| Left aligned | Centered | Right aligned |
| :----------- | :------: | ------------: |
| **strong**   | \`code\`   | $a \\ne b$     |
| row 2        | foo \\| bar | 42            |

# 13. Diagrams

Mermaid flowchart:

\`\`\`mermaid
flowchart TD
    A[Start] -->|input| B(Process)
    B --> C{Decision}
    C -->|yes| D[Result]
    C -->|no| E[Reject]
\`\`\`

Mermaid mindmap:

\`\`\`mermaid
mindmap
  root((Muya))
    Block
      Headings
      Lists
      Tables
    Inline
      Strong
      Emoji
      Math
\`\`\`

PlantUML sequence:

\`\`\`plantuml
@startuml
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response
@enduml
\`\`\`

Vega-Lite bar chart (swap \`vegaTheme\` in the sidebar to restyle):

\`\`\`vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple bar chart with embedded data.",
  "data": {
    "values": [
      {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43},
      {"a": "D", "b": 91}, {"a": "E", "b": 81}, {"a": "F", "b": 53},
      {"a": "G", "b": 19}, {"a": "H", "b": 87}, {"a": "I", "b": 52}
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "a", "type": "nominal"},
    "y": {"field": "b", "type": "quantitative"}
  }
}
\`\`\`

# 14. HTML Block

<div style="padding: 12px; border: 1px dashed #999;">
    <p>This is a raw HTML block.</p>
    <p>Toggle <code>disableHtml</code> in the sidebar Options panel to see it as source instead.</p>
</div>

# 15. Footnotes

Footnotes require \`footnote: true\` in the Muya options. A paragraph can reference a footnote[^note] and another one[^pandoc].

[^note]: First footnote definition. It can span multiple
    lines when continuation lines are indented by four spaces.

[^pandoc]: A footnote can also contain nested blocks:

    - bullet item one
    - bullet item two

# 16. Interaction Hints

Most editing tools are triggered by mouse or keyboard inside the editor. See the **UI plugin hints** section in the left sidebar for the full list (paragraph menu, format toolbar, quick insert, emoji picker, table tools, image tools, code language picker, link tools, footnote tool, preview toolbar).
`;
