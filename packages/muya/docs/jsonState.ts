// the output json doc by muya.getJSON API, and it contains all cases.
// eslint-disable-next-line unused-imports/no-unused-vars
const doc = [
    /**
     * CommonMark Spec
     */
    /**
     * Leaf Blocks
     */

    // Paragraphs
    {
        name: 'paragraph',
        text: 'foo\nbar',
    },
    // Atx headings
    {
        name: 'atx-heading',
        meta: {
            level: 1, // 1 ~ 6
        },
        text: '# foo bar', // can not contain `\n`!
    },
    // Setext headings
    {
        name: 'setext-heading',
        meta: {
            level: 1,
            underline: '===', // === or ---
        },
        text: 'foo\nbar', // can contain multiple lines.
    },
    // Thematic breaks
    {
        name: 'thematic-break',
        text: '---', // --- or ___ or ***
    },
    // Indented code blocks and Fenced code blocks
    {
        name: 'code-block',
        meta: {
            type: 'indented', // indented or fenced
            lang: 'javascript', // lang will be enpty string if block is indented block. set language will auto change into fenced code block.
        },
        text: 'const foo = `bar`',
    },
    // HTML blocks
    {
        name: 'html-block',
        text: '<div>\nfoo bar\n</div>',
    },
    // Link reference definitions ?
    {
        name: 'link-reference-definition',
        text: '[foo]: /url "title"',
    },

    /**
     * Container Blocks
     */
    // Block quotes
    {
        name: 'block-quote',
        children: [
            {
                // Can contains any type and number of leaf blocks.
                name: 'paragraph',
                text: 'foo\nbar',
            },
        ],
    },
    // Order List Blocks
    {
        name: 'order-list',
        meta: {
            start: 1, // 0 ~ 999999999
            loose: true, // true or false, true is loose list and false is tight.
            delimiter: '.', // . or )
        },
        children: [
            // List Item
            {
                name: 'list-item', // Can contains any type and number of leaf blocks.
                children: [
                    {
                        name: 'paragraph',
                        text: 'foo\nbar',
                    },
                ],
            },
        ],
    },
    // Bullet List Blocks
    {
        name: 'bullet-list',
        meta: {
            marker: '-', // - + *
            loose: false, // true or false
        },
        children: [
            // List Item
            {
                name: 'list-item', // Can contains any type and number of leaf blocks.
                children: [
                    {
                        name: 'paragraph',
                        text: 'foo\nbar',
                    },
                ],
            },
        ],
    },
    /**
     * GitHub Flavored Markdown Spec
     */
    /**
     * Leaf Blocks
     */
    // Table
    {
        name: 'table',
        children: [
            {
                name: 'table.row',
                children: [
                    {
                        name: 'table.cell',
                        meta: {
                            align: 'none', // none left center right, cells in the same column has the same alignment.
                        },
                        text: 'foo bar',
                    },
                ],
            },
        ],
    },
    // Task List
    {
        name: 'task-list',
        meta: {
            marker: '-', // - + *
            loose: false,
        },
        children: [
            {
                name: 'task-list-item',
                meta: {
                    checked: true, // true or false
                },
                children: [
                    {
                        name: 'paragraph',
                        text: 'foo\nbar',
                    },
                ],
            },
        ],
    },
    /**
     * Extra Markdown Spec
     */
    /**
     * Leaf Blocks
     */
    // Math Block
    {
        name: 'math-block',
        text: 'a \ne b',
        meta: {
            mathStyle: '', // '' for `$$` and 'gitlab' for ```math
        },
    },
    // Front Matter
    {
        name: 'frontmatter',
        text: 'title: marktext\nname: ransixi',
        meta: {
            lang: 'yaml', // yaml | toml | json
            style: '-', // `-` for yaml | `+` for toml | `;;;` and `{}` for json
        },
    },
    // Diagram: mermaid | plantuml | vega-lite
    {
        name: 'diagram',
        text: `plantuml TD
  A[Hard] -->|Text| B(Round)
  B --> C{Decision}
  C -->|One| D[Result 1]
  C -->|Two| E[Result 2]`,
        meta: {
            lang: 'yaml',
            type: 'mermaid',
        },
    },
];
