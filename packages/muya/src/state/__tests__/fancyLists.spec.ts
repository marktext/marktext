import type { TState } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';

function toState(markdown: string, fancyLists = true) {
    return new MarkdownToState({ fancyLists }).generate(markdown);
}

type TOutline = string | { list: string; start?: number; loose?: boolean; items: TOutline[][] };

// Lists as `{ list: '<style> <delimiter>', start, items }`, paragraphs as text.
function outline(states: TState[]): TOutline[] {
    return states.map((state): TOutline => {
        switch (state.name) {
            case 'paragraph':
                return state.text;
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

describe('fancy lists: markers', () => {
    it('reads each style and delimiter', () => {
        expect(outline(toState('I.  x\nII. y\n'))).toEqual([
            { list: 'upper-roman .', start: 1, items: [['x'], ['y']] },
        ]);
        expect(outline(toState('A.  x\nB.  y\n'))).toEqual([
            { list: 'upper-alpha .', start: 1, items: [['x'], ['y']] },
        ]);
        expect(outline(toState('(a) x\n(b) y\n'))).toEqual([
            { list: 'lower-alpha ()', start: 1, items: [['x'], ['y']] },
        ]);
        expect(outline(toState('(1) x\n(2) y\n'))).toEqual([
            { list: 'decimal ()', start: 1, items: [['x'], ['y']] },
        ]);
        expect(outline(toState('i) x\nii) y\n'))).toEqual([
            { list: 'lower-roman )', start: 1, items: [['x'], ['y']] },
        ]);
    });

    it('keeps the written start', () => {
        expect(outline(toState('III. x\n'))).toEqual([{ list: 'upper-roman .', start: 3, items: [['x']] }]);
        expect(outline(toState('C) x\n'))).toEqual([{ list: 'upper-alpha )', start: 3, items: [['x']] }]);
        expect(outline(toState('(C) x\n'))).toEqual([{ list: 'upper-alpha ()', start: 3, items: [['x']] }]);
        expect(outline(toState('V.  x\n'))).toEqual([{ list: 'upper-alpha .', start: 22, items: [['x']] }]);
        expect(outline(toState('ii. x\n'))).toEqual([{ list: 'lower-roman .', start: 2, items: [['x']] }]);
        expect(outline(toState('v. x\n'))).toEqual([{ list: 'lower-alpha .', start: 22, items: [['x']] }]);
    });

    it('needs two spaces after a capital letter or initial-like numeral with a period', () => {
        expect(outline(toState('I. x\n'))).toEqual(['I. x']);
        expect(outline(toState('A. x\n'))).toEqual(['A. x']);
        expect(outline(toState('B. Russell won a Nobel Prize\n'))).toEqual(['B. Russell won a Nobel Prize']);
        expect(outline(toState('IV. x\n'))).toEqual([{ list: 'upper-roman .', start: 4, items: [['x']] }]);
        expect(outline(toState('IV.  x\nV. y\n'))).toEqual([{ list: 'upper-roman .', start: 4, items: [['x\nV. y']] }]);
    });

    it('takes single ASCII letters only and pandoc roman numerals', () => {
        expect(outline(toState('aa. x\n'))).toEqual(['aa. x']);
        expect(outline(toState('IL. x\n'))).toEqual(['IL. x']);
        expect(outline(toState('IIII. x\n'))).toEqual([{ list: 'upper-roman .', start: 4, items: [['x']] }]);
        expect(outline(toState('p. 5 x\n'))).toEqual(['p. 5 x']);
    });

    it('reads later items in the style of the first', () => {
        expect(outline(toState('i. a\nii. b\niii. c\niv. d\nv. e\n'))).toEqual([
            { list: 'lower-roman .', start: 1, items: [['a'], ['b'], ['c'], ['d'], ['e']] },
        ]);
        expect(outline(toState('a. x\ni. y\n'))).toEqual([
            { list: 'lower-alpha .', start: 1, items: [['x'], ['y']] },
        ]);
    });
});

describe('fancy lists: list boundaries', () => {
    it('starts a new list when the style or delimiter changes', () => {
        expect(outline(toState('(a) x\n(b) y\na) z\n'))).toEqual([
            { list: 'lower-alpha ()', start: 1, items: [['x'], ['y']] },
            { list: 'lower-alpha )', start: 1, items: [['z']] },
        ]);
        expect(outline(toState('i. x\nj. y\n'))).toEqual([
            { list: 'lower-roman .', start: 1, items: [['x']] },
            { list: 'lower-alpha .', start: 10, items: [['y']] },
        ]);
        expect(outline(toState('I.  x\n1. y\n'))).toEqual([
            { list: 'upper-roman .', start: 1, items: [['x']] },
            { list: 'decimal .', start: 1, items: [['y']] },
        ]);
    });

    it('ends a decimal or bullet list at a fancy marker', () => {
        expect(outline(toState('1. x\na. y\n'))).toEqual([
            { list: 'decimal .', start: 1, items: [['x']] },
            { list: 'lower-alpha .', start: 1, items: [['y']] },
        ]);
        expect(outline(toState('- x\nA.  y\n'))).toEqual([
            { list: '-', items: [['x']] },
            { list: 'upper-alpha .', start: 1, items: [['y']] },
        ]);
    });

    it('needs a blank line before a list that follows a paragraph', () => {
        expect(outline(toState('para\nA.  x\n'))).toEqual(['para\nA.  x']);
        expect(outline(toState('para\n(a) x\n'))).toEqual(['para\n(a) x']);
        expect(outline(toState('para\n\n(a) x\n'))).toEqual(['para', { list: 'lower-alpha ()', start: 1, items: [['x']] }]);
        expect(outline(toState('# H\n(a) x\n'))).toEqual(['# H', { list: 'lower-alpha ()', start: 1, items: [['x']] }]);
    });

    it('makes a list loose across a blank line between items', () => {
        expect(outline(toState('a. x\nb. y\n\nc. z\n'))).toEqual([
            { list: 'lower-alpha .', start: 1, loose: true, items: [['x'], ['y'], ['z']] },
        ]);
    });
});

describe('fancy lists: nesting', () => {
    it('nests items at the parent content column', () => {
        const markdown = [
            'I.  Introduction',
            '    A.  Background',
            '        1. Early work',
            '           a. Teaching',
            '    B.  Research question',
            'II. Method',
            '',
        ].join('\n');
        expect(outline(toState(markdown))).toEqual([{
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
        }]);
    });

    it('allows up to three extra spaces before a nested marker', () => {
        const markdown = '9)  Ninth\n10)  Tenth\n11)  Eleventh\n       i. subone\n      ii. subtwo\n     iii. subthree\n';
        expect(outline(toState(markdown))).toEqual([{
            list: 'decimal )',
            start: 9,
            items: [
                ['Ninth'],
                ['Tenth'],
                ['Eleventh', { list: 'lower-roman .', start: 1, items: [['subone'], ['subtwo'], ['subthree']] }],
            ],
        }]);
    });

    it('nests fancy lists inside bullet lists', () => {
        expect(outline(toState('- x\n  (a) y\n  (b) z\n'))).toEqual([
            { list: '-', items: [['x', { list: 'lower-alpha ()', start: 1, items: [['y'], ['z']] }]] },
        ]);
    });

    it('keeps a nested marker that does not start at one as text', () => {
        expect(outline(toState('- x\n  ii. foo\n'))).toEqual([{ list: '-', items: [['x\nii. foo']] }]);
    });

    it('ends an item at a marker left of its content column', () => {
        expect(outline(toState('I.  x\n   A.  y\n'))).toEqual([
            { list: 'upper-roman .', start: 1, items: [['x']] },
            { list: 'upper-alpha .', start: 1, items: [['y']] },
        ]);
    });
});

describe('fancy lists: task items', () => {
    it('reads task items in a fancy list', () => {
        const states = toState('(a) [ ] foo\n(b) [x] bar\n');
        expect(outline(states)).toEqual([
            { list: 'task lower-alpha ()', start: 1, items: [['foo'], ['bar']] },
        ]);
        expect(states[0]).toMatchObject({
            children: [{ meta: { checked: false } }, { meta: { checked: true } }],
        });
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
