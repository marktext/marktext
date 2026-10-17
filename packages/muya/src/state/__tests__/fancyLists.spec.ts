import type { IOrderListState, TState } from '../types';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function toState(markdown: string, fancyLists = true) {
    return new MarkdownToState({ fancyLists }).generate(markdown);
}

function toMarkdown(states: TState[], fancyLists = true) {
    return new ExportMarkdown({ listIndentation: 1, fancyLists }).generate(states);
}

type TOutline = string | { list: string; start?: number; loose?: boolean; items: TOutline[][] };

// Lists as `{ list: '<style> <delimiter>', start, items }`, text blocks as text.
function outline(states: TState[]): TOutline[] {
    return states.map((state): TOutline => {
        switch (state.name) {
            case 'paragraph':
            case 'atx-heading':
                return state.text;
            case 'bullet-list':
                return { list: state.meta.marker, items: state.children.map(item => outline(item.children)) };
            case 'order-list':
            case 'task-list': {
                const meta = state.meta;
                const kind = state.name === 'task-list' ? 'task ' : '';
                if (!('start' in meta))
                    return { list: `${kind}${meta.marker}`, items: state.children.map(item => outline(item.children)) };

                return {
                    list: `${kind}${meta.style ?? 'decimal'} ${meta.delimiter}`,
                    start: meta.start,
                    ...(meta.loose ? { loose: true } : {}),
                    items: state.children.map(item => outline(item.children)),
                };
            }
            default:
                return state.name;
        }
    });
}

interface IParseCase {
    name: string;
    markdown: string;
    outline: TOutline[];
    // What pandoc reads, where muya deliberately differs.
    pandoc?: TOutline[];
}

const OUTLINE = [
    'I.  Introduction',
    '    A.  Background',
    '        1. Early work',
    '           a. Teaching',
    '    B.  Research question',
    'II. Method',
    '',
].join('\n');

const PARSE_CASES: IParseCase[] = [
    {
        name: 'upper roman with a period',
        markdown: 'I.  x\nII. y\n',
        outline: [{ list: 'upper-roman .', start: 1, items: [['x'], ['y']] }],
    },
    {
        name: 'upper alpha with a period',
        markdown: 'A.  x\nB.  y\n',
        outline: [{ list: 'upper-alpha .', start: 1, items: [['x'], ['y']] }],
    },
    {
        name: 'lower alpha in two parens',
        markdown: '(a) x\n(b) y\n',
        outline: [{ list: 'lower-alpha ()', start: 1, items: [['x'], ['y']] }],
    },
    {
        name: 'decimal in two parens',
        markdown: '(1) x\n(2) y\n',
        outline: [{ list: 'decimal ()', start: 1, items: [['x'], ['y']] }],
    },
    {
        name: 'lower roman with one paren',
        markdown: 'i) x\nii) y\n',
        outline: [{ list: 'lower-roman )', start: 1, items: [['x'], ['y']] }],
    },
    { name: 'roman start', markdown: 'III. x\n', outline: [{ list: 'upper-roman .', start: 3, items: [['x']] }] },
    { name: 'alpha start with one paren', markdown: 'C) x\n', outline: [{ list: 'upper-alpha )', start: 3, items: [['x']] }] },
    { name: 'alpha start in two parens', markdown: '(C) x\n', outline: [{ list: 'upper-alpha ()', start: 3, items: [['x']] }] },
    { name: 'a first V is a letter', markdown: 'V.  x\n', outline: [{ list: 'upper-alpha .', start: 22, items: [['x']] }] },
    { name: 'a first v is a letter', markdown: 'v. x\n', outline: [{ list: 'lower-alpha .', start: 22, items: [['x']] }] },
    { name: 'a first ii is roman', markdown: 'ii. x\n', outline: [{ list: 'lower-roman .', start: 2, items: [['x']] }] },
    { name: 'I with one space is text', markdown: 'I. x\n', outline: ['I. x'] },
    { name: 'A with one space is text', markdown: 'A. x\n', outline: ['A. x'] },
    { name: 'an initial is text', markdown: 'B. Russell won a Nobel Prize\n', outline: ['B. Russell won a Nobel Prize'] },
    { name: 'IV takes one space', markdown: 'IV. x\n', outline: [{ list: 'upper-roman .', start: 4, items: [['x']] }] },
    {
        name: 'a later V needs two spaces',
        markdown: 'IV.  x\nV. y\n',
        outline: [{ list: 'upper-roman .', start: 4, items: [['x\nV. y']] }],
    },
    { name: 'two letters are text', markdown: 'aa. x\n', outline: ['aa. x'] },
    { name: 'an invalid numeral is text', markdown: 'IL. x\n', outline: ['IL. x'] },
    { name: 'a lenient numeral', markdown: 'IIII. x\n', outline: [{ list: 'upper-roman .', start: 4, items: [['x']] }] },
    { name: 'a page reference is text', markdown: 'p. 5 x\n', outline: ['p. 5 x'] },
    {
        name: 'later items read in the first item style',
        markdown: 'i. a\nii. b\niii. c\niv. d\nv. e\n',
        outline: [{ list: 'lower-roman .', start: 1, items: [['a'], ['b'], ['c'], ['d'], ['e']] }],
    },
    {
        name: 'an i continues an alpha list',
        markdown: 'a. x\ni. y\n',
        outline: [{ list: 'lower-alpha .', start: 1, items: [['x'], ['y']] }],
    },
    {
        name: 'a delimiter change starts a list',
        markdown: '(a) x\n(b) y\na) z\n',
        outline: [
            { list: 'lower-alpha ()', start: 1, items: [['x'], ['y']] },
            { list: 'lower-alpha )', start: 1, items: [['z']] },
        ],
    },
    {
        name: 'a style change starts a list',
        markdown: 'i. x\nj. y\n',
        outline: [
            { list: 'lower-roman .', start: 1, items: [['x']] },
            { list: 'lower-alpha .', start: 10, items: [['y']] },
        ],
    },
    {
        name: 'a fancy list ends at a decimal marker',
        markdown: 'I.  x\n1. y\n',
        outline: [
            { list: 'upper-roman .', start: 1, items: [['x']] },
            { list: 'decimal .', start: 1, items: [['y']] },
        ],
    },
    {
        name: 'a decimal list ends at a fancy marker',
        markdown: '1. x\na. y\n',
        outline: [
            { list: 'decimal .', start: 1, items: [['x']] },
            { list: 'lower-alpha .', start: 1, items: [['y']] },
        ],
    },
    {
        name: 'a bullet list ends at a fancy marker',
        markdown: '- x\nA.  y\n',
        outline: [
            { list: '-', items: [['x']] },
            { list: 'upper-alpha .', start: 1, items: [['y']] },
        ],
    },
    { name: 'a paragraph keeps a following marker line', markdown: 'para\nA.  x\n', outline: ['para\nA.  x'] },
    { name: 'a paragraph keeps a following paren marker', markdown: 'para\n(a) x\n', outline: ['para\n(a) x'] },
    {
        name: 'a blank line lets a list follow a paragraph',
        markdown: 'para\n\n(a) x\n',
        outline: ['para', { list: 'lower-alpha ()', start: 1, items: [['x']] }],
    },
    {
        name: 'a list may follow a heading directly',
        markdown: '# H\n(a) x\n',
        outline: ['# H', { list: 'lower-alpha ()', start: 1, items: [['x']] }],
    },
    {
        name: 'a blank line between items makes the list loose',
        markdown: 'a. x\nb. y\n\nc. z\n',
        outline: [{ list: 'lower-alpha .', start: 1, loose: true, items: [['x'], ['y'], ['z']] }],
    },
    {
        name: 'an outline nests at each content column',
        markdown: OUTLINE,
        outline: [{
            list: 'upper-roman .',
            start: 1,
            items: [
                ['Introduction', {
                    list: 'upper-alpha .',
                    start: 1,
                    items: [
                        ['Background', {
                            list: 'decimal .',
                            start: 1,
                            items: [['Early work', { list: 'lower-alpha .', start: 1, items: [['Teaching']] }]],
                        }],
                        ['Research question'],
                    ],
                }],
                ['Method'],
            ],
        }],
    },
    {
        name: 'a nested marker may sit up to three columns further in',
        markdown: '9)  Ninth\n10)  Tenth\n11)  Eleventh\n       i. subone\n      ii. subtwo\n     iii. subthree\n',
        outline: [{
            list: 'decimal )',
            start: 9,
            items: [
                ['Ninth'],
                ['Tenth'],
                ['Eleventh', { list: 'lower-roman .', start: 1, items: [['subone'], ['subtwo'], ['subthree']] }],
            ],
        }],
    },
    {
        name: 'a fancy list nests in a bullet list',
        markdown: '- x\n  (a) y\n  (b) z\n',
        outline: [{ list: '-', items: [['x', { list: 'lower-alpha ()', start: 1, items: [['y'], ['z']] }]] }],
    },
    {
        name: 'a nested list has to start at one',
        markdown: '- x\n  ii. foo\n',
        outline: [{ list: '-', items: [['x\nii. foo']] }],
        pandoc: [{ list: '-', items: [['x', 'ii. foo']] }],
    },
    {
        name: 'a marker left of the content column ends the item',
        markdown: 'I.  x\n   A.  y\n',
        outline: [
            { list: 'upper-roman .', start: 1, items: [['x']] },
            { list: 'upper-alpha .', start: 1, items: [['y']] },
        ],
    },
];

// Saved text that reads back to the same state and writes out unchanged.
const ROUND_TRIPS: Array<[name: string, markdown: string]> = [
    ['an outline', OUTLINE],
    ['paren levels', '1. Point\n   (1) Sub\n       (a) Detail\n       (b) More detail\n   (2) Sub two\n'],
    ['one-paren decimal', '1) one\n2) two\n'],
    ['a roman start', 'III. Third\nIV. Fourth\nV.  Fifth\n'],
    ['a lower roman sublist', 'a. x\n   i. y\n   ii. z\nb. w\n'],
    ['a loose list', '(a) x\n\n(b) y\n'],
    ['a style change', 'I.  x\nA.  y\n'],
    ['two lists in one style', 'A.  x\n\n<!-- -->\n\nA.  y\n'],
];

describe('fancy lists: parsing', () => {
    it.each(PARSE_CASES)('$name', ({ markdown, outline: expected }) => {
        expect(outline(toState(markdown))).toEqual(expected);
    });

    it('reads task items in a fancy list', () => {
        const states = toState('(a) [ ] foo\n(b) [x] bar\n');
        expect(outline(states)).toEqual([{ list: 'task lower-alpha ()', start: 1, items: [['foo'], ['bar']] }]);
        expect(states[0]).toMatchObject({ children: [{ meta: { checked: false } }, { meta: { checked: true } }] });
    });
});

describe('fancy lists: option off', () => {
    it('reads fancy markers as text', () => {
        expect(outline(toState('I.  x\n', false))).toEqual(['I.  x']);
        expect(outline(toState('A.  x\n', false))).toEqual(['A.  x']);
        expect(outline(toState('(a) x\n', false))).toEqual(['(a) x']);
    });

    it('reads a decimal document the same either way', () => {
        const markdown = '1. one\n2. two\n   - nested\n\n3) three\n';
        expect(toState(markdown, true)).toEqual(toState(markdown, false));
        expect(outline(toState(markdown, false))).toEqual([
            { list: 'decimal .', start: 1, items: [['one'], ['two', { list: '-', items: [['nested']] }]] },
            { list: 'decimal )', start: 3, items: [['three']] },
        ]);
    });
});

describe('fancy lists: serialization', () => {
    it.each(ROUND_TRIPS)('round-trips %s', (_name, markdown) => {
        expect(toMarkdown(toState(markdown))).toBe(markdown);
    });

    it('round-trips task items in a fancy list', () => {
        const markdown = '(a) [ ] foo\n(b) [x] bar\n';
        expect(toMarkdown(toState(markdown))).toBe(markdown);
    });

    it('keeps adjacent decimal lists as before with the option off', () => {
        const list = (text: string): IOrderListState => ({
            name: 'order-list',
            meta: { start: 1, loose: false, delimiter: '.' },
            children: [{ name: 'list-item', children: [{ name: 'paragraph', text }] }],
        });
        expect(toMarkdown([list('x'), list('y')], false)).toBe('1. x\n1. y\n');
        expect(toMarkdown([{ ...list('x'), meta: { ...list('x').meta, loose: true } }, list('y')], false)).toBe('1. x\n\n1. y\n');
    });

    it('numbers an edited list in its style with pandoc spacing', () => {
        const [list] = toState('I.  a\nII. b\nIII. c\nIV. d\n') as [IOrderListState];
        list.children.push({ name: 'list-item', children: [{ name: 'paragraph', text: 'e' }] });
        expect(toMarkdown([list])).toBe('I.  a\nII. b\nIII. c\nIV. d\nV.  e\n');
    });

    it('ends a list before another list in the same style', () => {
        const item = (text: string) => ({ name: 'list-item' as const, children: [{ name: 'paragraph' as const, text }] });
        const list = (text: string): IOrderListState => ({
            name: 'order-list',
            meta: { start: 1, loose: false, delimiter: '()', style: 'lower-roman' },
            children: [item(text)],
        });
        const markdown = toMarkdown([list('x'), list('y')]);
        expect(markdown).toBe('(i) x\n\n<!-- -->\n\n(i) y\n');
        expect(toMarkdown([list('x'), list('y')], false)).toBe('(i) x\n(i) y\n');
        expect(outline(toState(markdown))).toEqual([
            { list: 'lower-roman ()', start: 1, items: [['x']] },
            'html-block',
            { list: 'lower-roman ()', start: 1, items: [['y']] },
        ]);
    });
});

const HAS_PANDOC = spawnSync('pandoc', ['--version']).status === 0;

interface IPandocNode {
    t: string;
    c?: unknown;
}

const PANDOC_STYLES: Record<string, string> = {
    Decimal: 'decimal',
    LowerAlpha: 'lower-alpha',
    UpperAlpha: 'upper-alpha',
    LowerRoman: 'lower-roman',
    UpperRoman: 'upper-roman',
};
const PANDOC_DELIMITERS: Record<string, string> = { Period: '.', OneParen: ')', TwoParens: '()' };

function pandocText(inlines: IPandocNode[]): string {
    return inlines.map(({ t, c }) => (t === 'Str' ? String(c) : t === 'Space' ? ' ' : t === 'SoftBreak' ? '\n' : '')).join('');
}

function pandocOutline(blocks: IPandocNode[]): TOutline[] {
    return blocks.map(({ t, c }): TOutline => {
        switch (t) {
            case 'Para':
            case 'Plain':
                return pandocText(c as IPandocNode[]);
            case 'Header':
            {
                const [level, , inlines] = c as [number, unknown, IPandocNode[]];
                return `${'#'.repeat(level)} ${pandocText(inlines)}`;
            }
            case 'BulletList':
                return { list: '-', items: (c as IPandocNode[][]).map(pandocOutline) };
            case 'OrderedList': {
                const [[start, style, delimiter], items] = c as [[number, IPandocNode, IPandocNode], IPandocNode[][]];
                const loose = items.some(item => item.some(block => block.t === 'Para'));
                return {
                    list: `${PANDOC_STYLES[style.t]} ${PANDOC_DELIMITERS[delimiter.t]}`,
                    start,
                    ...(loose ? { loose: true } : {}),
                    items: items.map(pandocOutline),
                };
            }
            case 'RawBlock':
                return 'html-block';
            default:
                return t;
        }
    });
}

function readWithPandoc(markdown: string): TOutline[] {
    const json = execFileSync('pandoc', ['-f', 'markdown', '-t', 'json'], { input: markdown, encoding: 'utf8' });
    return pandocOutline(JSON.parse(json).blocks);
}

// pandoc collapses spaces and turns the one in `p. 5` into a no-break space.
function collapseSpaces(nodes: TOutline[]): TOutline[] {
    return nodes.map(node => typeof node === 'string'
        ? node.replace(/[ \u00A0]+/g, ' ')
        : { ...node, items: node.items.map(collapseSpaces) });
}

describe.skipIf(!HAS_PANDOC)('fancy lists: pandoc reads the same structure', () => {
    it.each(PARSE_CASES)('$name', ({ markdown, outline: expected, pandoc }) => {
        expect(collapseSpaces(readWithPandoc(markdown))).toEqual(collapseSpaces(pandoc ?? expected));
    });

    it.each(ROUND_TRIPS)('%s', (_name, markdown) => {
        expect(collapseSpaces(readWithPandoc(toMarkdown(toState(markdown))))).toEqual(collapseSpaces(outline(toState(markdown))));
    });
});
