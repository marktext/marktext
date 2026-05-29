import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

// Loose accessor type used only in this spec — every state node the
// MarkdownToState pipeline emits has some subset of these fields, and the
// tests navigate the tree generically without re-implementing the
// discriminated TState union narrowing.
interface IStateLike {
    name: string;
    text?: string;
    meta?: Record<string, unknown> & { checked?: boolean; identifier?: string; level?: number; underline?: string };
    children?: IStateLike[];
}

function generate(markdown: string, options: Partial<{ footnote: boolean }> = {}): IStateLike[] {
    return new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
        ...options,
    }).generate(markdown) as unknown as IStateLike[];
}

// Defensive regression test for marktext commit 23435ce6 (#1733 / PR #1835).
// In the legacy marked fork that marktext shipped, the list tokenizer forgot
// to subtract the four-character `[x] ` checkbox prefix from the indentation
// counter — so a `- [ ] task1_1` two levels deep was read as a sibling of
// `- [ ] task1`. The new muya drives lists through marked v16's built-in
// tokenizer (with the `compatibleTaskList` post-processor splitting on
// bullet vs task), which doesn't share that codepath. These specs lock in
// the correct nesting so a future list refactor can't quietly re-introduce
// the flattening.
describe('markdownToState — task list nesting (marktext 23435ce6)', () => {
    it('keeps three levels of task-list nesting', () => {
        const md = `- [ ] task1

  - [ ] task1_1

    - [ ] task1_1_1
`;

        const states = generate(md);

        // Outer list must contain exactly one task-list-item with a nested
        // bullet/task list as its second child (first being the text para).
        expect(states.length).toBe(1);
        const outer = states[0];
        expect(outer.name).toBe('task-list');
        expect(outer.children!.length).toBe(1);

        const level1 = outer.children![0];
        expect(level1.name).toBe('task-list-item');
        expect(level1.meta).toEqual({ checked: false });
        const level1Paragraph = level1.children!.find(c => c.name === 'paragraph');
        expect(level1Paragraph?.text).toBe('task1');

        const level1Nested = level1.children!.find(c => c.name === 'task-list');
        expect(level1Nested, 'level 1 should contain a nested bullet-list').toBeDefined();
        expect(level1Nested!.children!.length).toBe(1);

        const level2 = level1Nested!.children![0];
        expect(level2.name).toBe('task-list-item');
        expect(level2.children!.find(c => c.name === 'paragraph')?.text).toBe('task1_1');

        const level2Nested = level2.children!.find(c => c.name === 'task-list');
        expect(level2Nested, 'level 2 should contain a nested bullet-list — not a sibling').toBeDefined();
        expect(level2Nested!.children!.length).toBe(1);

        const level3 = level2Nested!.children![0];
        expect(level3.name).toBe('task-list-item');
        expect(level3.children!.find(c => c.name === 'paragraph')?.text).toBe('task1_1_1');
    });

    // Defensive regression for marktext commit dec7502e (PR #741):
    // setext headings (`text\n===` / `text\n---`) must round-trip with a
    // distinct `setext-heading` state name (atx-heading and setext-heading
    // are separate block types in the new muya).
    it('parses setext h1 (=== underline) as setext-heading with level 1', () => {
        const states = generate(`Hello world
===========
`);
        expect(states.length).toBe(1);
        expect(states[0].name).toBe('setext-heading');
        expect(states[0].meta!.level).toBe(1);
        expect(states[0].meta!.underline).toBeTruthy();
    });

    it('parses setext h2 (--- underline) as setext-heading with level 2', () => {
        const states = generate(`Hello world
-----------
`);
        expect(states.length).toBe(1);
        expect(states[0].name).toBe('setext-heading');
        expect(states[0].meta!.level).toBe(2);
    });

    it('parses `# text` as atx-heading, not setext-heading', () => {
        // Positive control: atx headings should remain atx.
        const states = generate('# Hello\n');
        expect(states[0].name).toBe('atx-heading');
        expect(states[0].meta!.level).toBe(1);
    });

    it('starts a new list when the bullet marker changes (CommonMark 264, marktext 270d33f6)', () => {
        // Different bullet markers must produce separate lists.
        const states = generate(`- foo
- bar
+ baz
`);
        expect(states.length).toBe(2);
        expect(states[0].name).toBe('bullet-list');
        expect(states[0].children!.length).toBe(2);
        expect(states[1].name).toBe('bullet-list');
        expect(states[1].children!.length).toBe(1);
    });

    it('starts a new list when the ordered delimiter changes (CommonMark 265, marktext 270d33f6)', () => {
        // `.` vs `)` are different ordered-list delimiters: separate lists.
        const states = generate(`1. foo
2. bar
3) baz
`);
        expect(states.length).toBe(2);
        expect(states[0].name).toBe('order-list');
        expect(states[0].children!.length).toBe(2);
        expect(states[1].name).toBe('order-list');
        expect(states[1].children!.length).toBe(1);
    });

    it('does not parse `-foo` (no space) as a list item (marktext 70d49c30)', () => {
        // marktext #832 issuecomment-477719256: `-foo` with no space between
        // the dash and the word was wrongly captured as a list item. A
        // bullet marker must be followed by a space (or newline) to start
        // a list. The new muya uses marked v16's built-in list rule which
        // already enforces this — keep the regression test.
        const states = generate('-foo\n');
        expect(states.length).toBe(1);
        expect(states[0].name).toBe('paragraph');
        expect(states[0].text).toBe('-foo');
    });

    it('still parses `- foo` (with space) as a list item', () => {
        // Positive control — same shape with the required space.
        const states = generate('- foo\n');
        expect(states.length).toBe(1);
        expect(states[0].name).toBe('bullet-list');
        expect(states[0].children![0].name).toBe('list-item');
    });

    it('splits a mixed task + bullet sequence into two lists (marktext 372fe02f)', () => {
        // marktext #870: writing
        //   - [x] foo
        //   - [x] bar
        //   - zar
        //   - rar
        // used to collapse into one bullet list. It should be a task list
        // followed by a bullet list — the new muya's compatibleTaskList
        // post-processor does this; lock the behaviour in.
        const states = generate(`- [x] foo
- [x] bar
- zar
- rar
`);

        expect(states.length).toBe(2);
        const [first, second] = states;
        expect(first.name).toBe('task-list');
        expect(first.children!.length).toBe(2);
        expect(first.children!.every(c => c.name === 'task-list-item')).toBe(true);
        expect(first.children!.map(c => c.meta?.checked)).toEqual([true, true]);

        expect(second.name).toBe('bullet-list');
        expect(second.children!.length).toBe(2);
        expect(second.children!.every(c => c.name === 'list-item')).toBe(true);
        const secondTexts = second.children!.map(c =>
            c.children!.find(cc => cc.name === 'paragraph')?.text,
        );
        expect(secondTexts).toEqual(['zar', 'rar']);
    });

    // The footnote extension (utils/marked/extensions/footnote.ts) emits a
    // block-level `footnote` token when `footnote: true` is set. Make sure
    // MarkdownToState lifts that into a `footnote` state instead of
    // silently dropping it with an "Unknown type" warning.
    it('converts block-level footnote tokens into footnote states', () => {
        const states = generate(
            `text[^1]

[^1]: definition`,
            { footnote: true },
        );
        const footnote = states.find(s => s.name === 'footnote');
        expect(footnote, 'a footnote state should be emitted').toBeDefined();
        expect(footnote!.meta!.identifier).toBe('1');
        const firstChild = footnote!.children![0];
        expect(firstChild.name).toBe('paragraph');
        expect(firstChild.text).toBe('definition');
    });

    it('round-trips a single-paragraph footnote through state', () => {
        const md = `text[^1]

[^1]: definition
`;
        const states = generate(md, { footnote: true });
        const out = new ExportMarkdown({ listIndentation: 1 }).generate(states as unknown as Parameters<ExportMarkdown['generate']>[0]);
        // The serialiser emits the canonical `[^id]: ` form on its own line.
        expect(out).toContain('[^1]: definition');
    });

    it('keeps tight (no blank lines) nested task lists nested', () => {
        const md = `- [ ] task1
  - [ ] task1_1
    - [ ] task1_1_1
`;

        const states = generate(md);

        expect(states.length).toBe(1);
        const outer = states[0];
        expect(outer.name).toBe('task-list');

        const level1 = outer.children![0];
        const level1Nested = level1.children!.find(c => c.name === 'task-list');
        expect(level1Nested).toBeDefined();
        const level2 = level1Nested!.children![0];
        const level2Nested = level2.children!.find(c => c.name === 'task-list');
        expect(level2Nested, 'level 2 should contain level 3 nested, not as sibling').toBeDefined();
    });
});
