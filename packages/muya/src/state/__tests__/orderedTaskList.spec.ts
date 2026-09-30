import type { ITaskListState } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

const OPTIONS = {
    footnote: false,
    texMathDollars: false,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    trimUnnecessaryCodeBlockEmptyLines: false,
    frontMatter: false,
};

function parseMarkdown(md: string) {
    return new MarkdownToState(OPTIONS).generate(md);
}

function serialize(states: ReturnType<typeof parseMarkdown>, listIndentation: number | string = 1) {
    return new ExportMarkdown({ listIndentation }).generate(states);
}

function roundTrip(md: string): string {
    return serialize(parseMarkdown(md));
}

// Ordered task lists share the `task-list` state name with the unordered form
// and are told apart by `meta.ordered`.
describe('markdownToState — ordered task list (#1691)', () => {
    it('parses `1. [x] …` as an ordered task list, not an order list', () => {
        const states = parseMarkdown('1. [x] Open\n2. [ ] Close\n');
        expect(states).toHaveLength(1);

        const list = states[0] as ITaskListState;
        expect(list.name).toBe('task-list');
        expect(list.meta).toEqual({
            ordered: true,
            loose: false,
            start: 1,
            delimiter: '.',
            sourceMarkers: ['1.', '2.'],
        });
        expect(list.children.map(item => item.name)).toEqual([
            'task-list-item',
            'task-list-item',
        ]);
        expect(list.children.map(item => item.meta.checked)).toEqual([true, false]);
        expect(list.children.map(item => item.meta.orderMarker)).toEqual(['1.', '2.']);
        expect(list.children[0].children).toEqual([{ name: 'paragraph', text: 'Open' }]);
    });

    it('keeps the source start number and delimiter', () => {
        const paren = parseMarkdown('1) [x] a\n2) [ ] b\n')[0] as ITaskListState;
        expect(paren.meta).toMatchObject({ ordered: true, delimiter: ')', start: 1 });

        const offset = parseMarkdown('5. [x] a\n6. [ ] b\n')[0] as ITaskListState;
        expect(offset.meta).toMatchObject({ ordered: true, start: 5 });
    });

    it('parses empty ordered task items', () => {
        const states = parseMarkdown('1. [ ] \n2. [ ] \n');
        const list = states[0] as ITaskListState;
        expect(list.name).toBe('task-list');
        expect(list.children.map(item => item.children)).toEqual([
            [{ name: 'paragraph', text: '' }],
            [{ name: 'paragraph', text: '' }],
        ]);
    });

    it('splits a mixed ordered list into task and plain runs', () => {
        const states = parseMarkdown('1. [x] a\n2. b\n3. [ ] c\n');
        expect(states.map(state => state.name)).toEqual([
            'task-list',
            'order-list',
            'task-list',
        ]);
        expect((states[1] as { meta: { start: number } }).meta.start).toBe(2);
        expect((states[2] as { meta: { start: number } }).meta.start).toBe(3);
    });

    // GFM ignores the numbers after a list's first item, so a split run numbers
    // by position rather than by the marker it happens to be written with.
    it('numbers a split run by position, not by its literal marker', () => {
        const repeated = parseMarkdown('1. [x] a\n1. b\n');
        expect((repeated[1] as { meta: { start: number } }).meta.start).toBe(2);

        const jumpy = parseMarkdown('1. [x] a\n99. b\n');
        expect((jumpy[1] as { meta: { start: number } }).meta.start).toBe(2);

        const offset = parseMarkdown('99. [x] a\n2. b\n');
        expect((offset[1] as { meta: { start: number } }).meta.start).toBe(100);
    });
});

describe('stateToMarkdown — ordered task list round trip (#1691)', () => {
    it('round trips the forms of the issue', () => {
        const md = '1. [x] Open the refrigerator\n2. [ ] Put the elephant in\n3. [ ] Close the refrigerator\n';
        expect(roundTrip(md)).toBe(md);
    });

    it('round trips parens, an offset start and nesting', () => {
        for (const md of [
            '1) [x] a\n2) [ ] b\n',
            '5. [x] a\n6. [ ] b\n',
            '1. [ ] a\n2. [ ] \n',
            '1. [ ] **bold** a\n2. [x] `code`\n',
            '1. [x] a\n   1. [ ] a1\n',
            '- outer\n  1. [x] inner\n  2. [ ] inner2\n',
            '> 1. [x] quoted\n> 2. [ ] quoted2\n',
            '1. [ ] a\n   - nested bullet\n',
        ]) {
            expect(roundTrip(md)).toBe(md);
            expect(roundTrip(roundTrip(md))).toBe(roundTrip(md));
        }
    });

    it('breaks a mixed ordered list into ordered task and plain lists that re-parse the same', () => {
        const md = '1. [x] a\n2. b\n3. [ ] c\n';
        const out = roundTrip(md);
        expect(out).toBe(md);
        expect(roundTrip(out)).toBe(out);
    });

    it('round trips the literal markers of a split run', () => {
        // Numbering is positional while the source spelling is kept verbatim.
        for (const md of ['1. [x] a\n1. b\n', '1. [x] a\n99. b\n', '99. [x] a\n2. b\n'])
            expect(roundTrip(md)).toBe(md);
    });

    it('serializes an ordered task list built by hand', () => {
        const state: ITaskListState = {
            name: 'task-list',
            meta: { ordered: true, loose: false, start: 3, delimiter: '.' },
            children: [
                { name: 'task-list-item', meta: { checked: true }, children: [{ name: 'paragraph', text: 'a' }] },
                { name: 'task-list-item', meta: { checked: false }, children: [{ name: 'paragraph', text: 'b' }] },
            ],
        };
        expect(serialize([state])).toBe('3. [x] a\n4. [ ] b\n');
    });
});
