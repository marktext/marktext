import type {
    IBulletListState,
    IListItemState,
    IOrderListState,
    ITaskListItemState,
    ITaskListState,
    TState,
} from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

// Round-trip helper: parse markdown to state, then serialise back.
// Lets us verify that `listIndentation` produces stable output the same
// way marktext's old `markdown-list-indentation.spec.js` did.
function roundTrip(md: string, listIndentation: number | string = 1): string {
    const states = new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    }).generate(md);
    return new ExportMarkdown({ listIndentation }).generate(states);
}

function parseMarkdown(md: string): TState[] {
    return new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    }).generate(md);
}

function serializeState(states: TState[]): string {
    return new ExportMarkdown({ listIndentation: 1 }).generate(states);
}

function firstNestedBulletList(
    state: IBulletListState | IOrderListState | ITaskListState,
): IBulletListState {
    const parent = state.children[0];
    expect(parent.children.some(child => child.name === 'setext-heading')).toBe(false);
    const nested = parent.children.find(
        (child): child is IBulletListState => child.name === 'bullet-list',
    );
    expect(nested).toBeDefined();
    return nested!;
}

function paragraph(text: string): TState {
    return { name: 'paragraph', text };
}

function listItem(children: TState[]): IListItemState {
    return { name: 'list-item', children };
}

function taskListItem(children: TState[]): ITaskListItemState {
    return { name: 'task-list-item', meta: { checked: false }, children };
}

function emptyListItem(): IListItemState {
    return listItem([paragraph('')]);
}

function bulletList(marker: string, children: IListItemState[]): IBulletListState {
    return { name: 'bullet-list', meta: { marker, loose: false }, children };
}

function bulletParent(nested: IBulletListState): TState[] {
    return [{
        name: 'bullet-list',
        meta: { marker: '-', loose: false },
        children: [listItem([paragraph('a'), nested])],
    }];
}

describe('stateToMarkdown — nested empty list items', () => {
    it('uses an alternate nested marker instead of making a tight list loose', () => {
        const nested = bulletList('-', [emptyListItem(), emptyListItem()]);
        const out = serializeState(bulletParent(nested));
        expect(out).toBe('- a\n  * \n  * \n');
        expect(nested.meta.marker).toBe('-');

        const reparsed = parseMarkdown(out);
        const outer = reparsed[0] as IBulletListState;
        expect(outer.name).toBe('bullet-list');
        expect(outer.meta.loose).toBe(false);
        expect(outer.children[0].children[0]).toEqual({ name: 'paragraph', text: 'a' });
        const reparsedNested = firstNestedBulletList(outer);
        expect(reparsedNested.meta.marker).toBe('*');
        expect(reparsedNested.children).toHaveLength(2);
        expect(serializeState(reparsed)).toBe(out);
    });

    it('uses the same safe marker under ordered and task-list parents', () => {
        const orderedStates: TState[] = [{
            name: 'order-list',
            meta: { start: 1, loose: false, delimiter: '.' },
            children: [listItem([paragraph('a'), bulletList('-', [emptyListItem(), emptyListItem()])])],
        }];
        const orderedOut = serializeState(orderedStates);
        expect(orderedOut).toBe('1. a\n   * \n   * \n');
        const ordered = parseMarkdown(orderedOut)[0] as IOrderListState;
        expect(ordered.name).toBe('order-list');
        expect(ordered.meta.loose).toBe(false);
        expect(firstNestedBulletList(ordered).children).toHaveLength(2);

        const taskStates: TState[] = [{
            name: 'task-list',
            meta: { marker: '-', loose: false },
            children: [taskListItem([paragraph('a'), bulletList('-', [emptyListItem(), emptyListItem()])])],
        }];
        const taskOut = serializeState(taskStates);
        expect(taskOut).toBe('- [ ] a\n  * \n  * \n');
        const task = parseMarkdown(taskOut)[0] as ITaskListState;
        expect(task.name).toBe('task-list');
        expect(task.meta.loose).toBe(false);
        expect(firstNestedBulletList(task).children).toHaveLength(2);
    });

    it('handles a first empty nested item followed by a non-empty item', () => {
        const out = serializeState(bulletParent(bulletList('-', [
            emptyListItem(),
            listItem([paragraph('b')]),
        ])));
        expect(out).toBe('- a\n  * \n  * b\n');
        const outer = parseMarkdown(out)[0] as IBulletListState;
        const nested = firstNestedBulletList(outer);
        expect(nested.children).toHaveLength(2);
        expect(nested.children[1].children[0]).toEqual({ name: 'paragraph', text: 'b' });
    });

    it('does not rewrite nested dash lists whose first item is not empty', () => {
        const out = serializeState(bulletParent(bulletList('-', [
            listItem([paragraph('b')]),
            emptyListItem(),
        ])));
        expect(out).toBe('- a\n  - b\n  - \n');
        const outer = parseMarkdown(out)[0] as IBulletListState;
        const nested = firstNestedBulletList(outer);
        expect(nested.meta.marker).toBe('-');
        expect(nested.children).toHaveLength(2);
        expect(serializeState(parseMarkdown(out))).toBe(out);
    });

    it('keeps already-loose parent lists on their original dash marker', () => {
        const states: TState[] = [{
            name: 'bullet-list',
            meta: { marker: '-', loose: true },
            children: [listItem([paragraph('a'), bulletList('-', [emptyListItem(), emptyListItem()])])],
        }];
        const out = serializeState(states);
        expect(out).toBe('- a\n\n  - \n  - \n');
        const outer = parseMarkdown(out)[0] as IBulletListState;
        expect(outer.meta.loose).toBe(true);
        const nested = firstNestedBulletList(outer);
        expect(nested.meta.marker).toBe('-');
        expect(nested.children).toHaveLength(2);
    });

    it('serializes parser-created empty list items as separate lines', () => {
        const out = serializeState(parseMarkdown('- \n- \n'));
        expect(out).toBe('- \n- \n');
    });
});

// Regression baseline ported from marktext's
// test/unit/specs/markdown-list-indentation.spec.js, the suite touched by
// commit 02841ffd (fix: subsequent list paragraphs, PR #916). marktext used
// these four fixtures to lock down the indentation produced by the
// `listIndentation = 1|2|3|4` option once the bug was fixed. The new muya's
// stateToMarkdown.ts already implements the split between "subsequent
// paragraph indent" (marker width) and "nested list indent" (configurable),
// so this round-trips the same fixtures end-to-end.
describe('stateToMarkdown — list indentation round-trip (marktext 02841ffd)', () => {
    it('indent by 1 space — round-trips marktext fixture', () => {
        const md = `start

- foo
- foo
  - foo
  - foo
    - foo
    - foo
      - foo
  - foo
- foo

sep

1. foo
2. foo
   1. foo
   2. foo
      1. foo
   3. foo
3. foo
   20. foo
       141. foo
            1. foo
`;
        expect(roundTrip(md, 1)).toBe(md);
    });

    it('indent by 2 spaces — round-trips marktext fixture', () => {
        const md = `start

- foo
- foo
   - foo
   - foo
      - foo
      - foo
         - foo
   - foo
- foo

sep

1. foo
2. foo
    1. foo
    2. foo
        1. foo
    3. foo
3. foo
    20. foo
         141. foo
               1. foo
`;
        expect(roundTrip(md, 2)).toBe(md);
    });

    it('indent by 3 spaces — round-trips marktext fixture', () => {
        const md = `start

- foo
- foo
    - foo
    - foo
        - foo
        - foo
            - foo
    - foo
- foo

sep

1. foo
2. foo
     1. foo
     2. foo
          1. foo
     3. foo
3. foo
     20. foo
           141. foo
                  1. foo
`;
        expect(roundTrip(md, 3)).toBe(md);
    });

    // Regression baseline for marktext commit 5f191681 (PR #840):
    // ordered or bullet lists nested inside a blockquote used to serialise
    // with the wrong leading whitespace. The fixtures below come straight
    // from `test/unit/data/common/Blockquotes.md` in the marktext repo at
    // that commit.
    it('round-trips an ordered list nested inside a blockquote (marktext 5f191681)', () => {
        const md = `> 1. Lorem Ipsum is simply dummy text 1
> 2. Lorem Ipsum is simply dummy text 2
> 3. Lorem Ipsum is simply dummy text 3
`;
        expect(roundTrip(md, 1)).toBe(md);
    });

    it('round-trips a bullet list nested inside a blockquote (marktext 5f191681)', () => {
        const md = `> - one
> - two
> - three
`;
        expect(roundTrip(md, 1)).toBe(md);
    });

    it('round-trips a blockquote nested inside a list item (marktext 5f191681)', () => {
        const md = `- foo
- > bar
- baz
`;
        expect(roundTrip(md, 1)).toBe(md);
    });

    // Beyond the marktext fixtures: lock in a few subsequent-paragraph and
    // mixed-content scenarios that exercise the same indent / listIndent
    // split the marktext 02841ffd fix introduced.
    //
    // These also surface a separate latent bug in `insertLineBreak`: blank
    // lines inside a list item were carrying the item's indent as trailing
    // whitespace (`"  \n"` instead of `"\n"`). Marktext shipped the same
    // bug, but it's serialization-correctness — fix it as part of the
    // stateToMarkdown baseline.
    it('round-trips a loose list with a subsequent paragraph', () => {
        // Canonical loose-list form: blank line between every item.
        const md = `- foo

  Second paragraph in the same item.

- bar
`;
        expect(roundTrip(md, 1)).toBe(md);
    });

    it('round-trips a loose list containing a fenced code block', () => {
        const md = `- foo

  \`\`\`
  code line 1
  code line 2
  \`\`\`

- bar
`;
        expect(roundTrip(md, 1)).toBe(md);
    });

    it('does not emit trailing whitespace on blank lines inside a list item', () => {
        // Direct assertion of the bug: every line of the output must either
        // be non-blank or be exactly "\n".
        const md = `- foo

  bar
`;
        const out = roundTrip(md, 1);
        for (const line of out.split('\n')) {
            if (line.trim() === '')
                expect(line).toBe('');
        }
    });

    it('round-trips an ordered list with two-digit item numbers', () => {
        // CommonMark allows up to 9 digits, but marktext's 02841ffd capped
        // dfm at 99 to avoid runaway indentation. We only assert behavior
        // up to typical document scale here.
        const md = `1. one
2. two
3. three
4. four
5. five
6. six
7. seven
8. eight
9. nine
10. ten
`;
        expect(roundTrip(md, 1)).toBe(md);
    });

    it('indent by 4 spaces — round-trips marktext fixture', () => {
        const md = `start

- foo
- foo
     - foo
     - foo
          - foo
          - foo
               - foo
     - foo
- foo

sep

1. foo
2. foo
      1. foo
      2. foo
            1. foo
      3. foo
3. foo
      20. foo
             141. foo
                     1. foo
`;
        expect(roundTrip(md, 4)).toBe(md);
    });

    // Daring Fireball Markdown Spec: nested list items indent by a hard
    // 4 spaces regardless of marker width. Backported from marktext
    // `markdown-list-indentation.spec.js`, last case in the suite.
    it('indent using Daring Fireball Markdown Spec (dfm) — round-trips marktext fixture', () => {
        const md = `start

- foo
- foo
    - foo
    - foo
        - foo
        - foo
            - foo
    - foo
- foo

sep

1. foo
2. foo
    1. foo
    2. foo
        1. foo
    3. foo
3. foo
    20. foo
        99. foo
            1. foo
`;
        expect(roundTrip(md, 'dfm')).toBe(md);
    });

    // Characterization test, NOT a spec for desired behavior.
    //
    // The desktop preferences UI offers a `'tab'` option for list indentation
    // (prefComponents/markdown/config.ts), but neither this engine nor the
    // legacy muyajs engine ever implemented it. stateToMarkdown's constructor
    // only branches on `'dfm'` and `typeof === 'number'`; any other value
    // (including `'tab'`) falls through to the `else` and yields a 1-space
    // indent (_listIndentationCount = 1). The TODO in stateToMarkdown.ts
    // (mirrored verbatim from muyajs/lib/utils/exportMarkdown.js) records why:
    // the serializer builds every indent out of spaces, and the author left
    // mixing real tabs with those space-based indents (blockquote prefixes,
    // subsequent-paragraph alignment) as "work for another day".
    //
    // This test pins that degraded-to-1-space behavior so it can't change
    // silently. If `'tab'` ever gets a real implementation, this assertion
    // SHOULD fail — replace it with the proper tab-indent fixture then.
    it('treats the unimplemented \'tab\' option as a 1-space indent', () => {
        const md = `start

- foo
- foo
  - foo
  - foo
    - foo
    - foo
      - foo
  - foo
- foo

sep

1. foo
2. foo
   1. foo
   2. foo
      1. foo
   3. foo
3. foo
   20. foo
       141. foo
            1. foo
`;
        // Identical to the 1-space fixture above, and identical to what
        // listIndentation = 1 produces — confirming 'tab' is silently coerced.
        expect(roundTrip(md, 'tab')).toBe(md);
        expect(roundTrip(md, 'tab')).toBe(roundTrip(md, 1));
    });
});

// stateToMarkdown reads `loose` straight off the list meta. In a real boot
// that flag is seeded from `muya.options.preferLooseListItem` at list
// creation time (see block/base/format.ts `_convertToList`); here we drive the
// serializer directly with both flag values to lock in the exact spacing the
// option controls. A loose list separates every item with a blank line; a
// tight list does not.
describe('stateToMarkdown — list looseness (preferLooseListItem)', () => {
    function serialize(states: TState[]): string {
        return new ExportMarkdown({ listIndentation: 1 }).generate(states);
    }

    function bulletList(loose: boolean): IBulletListState {
        return {
            name: 'bullet-list',
            meta: { marker: '-', loose },
            children: [
                { name: 'list-item', children: [{ name: 'paragraph', text: 'foo' }] },
                { name: 'list-item', children: [{ name: 'paragraph', text: 'bar' }] },
                { name: 'list-item', children: [{ name: 'paragraph', text: 'baz' }] },
            ],
        };
    }

    it('inserts blank lines between items when loose is true', () => {
        expect(serialize([bulletList(true)])).toBe('- foo\n\n- bar\n\n- baz\n');
    });

    it('keeps items adjacent (no blank lines) when loose is false', () => {
        expect(serialize([bulletList(false)])).toBe('- foo\n- bar\n- baz\n');
    });

    it('list meta.loose carries the preferLooseListItem flag verbatim', () => {
        // The serializer is the only consumer of meta.loose; assert the round
        // contract by parsing a canonical loose list and reading the flag back.
        const looseStates = new MarkdownToState({
            footnote: false,
            math: false,
            isGitlabCompatibilityEnabled: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
        }).generate('- foo\n\n- bar\n');
        const list = looseStates[0] as IBulletListState;
        expect(list.name).toBe('bullet-list');
        expect(list.meta.loose).toBe(true);

        const tightStates = new MarkdownToState({
            footnote: false,
            math: false,
            isGitlabCompatibilityEnabled: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
        }).generate('- foo\n- bar\n');
        const tightList = tightStates[0] as IBulletListState;
        expect(tightList.meta.loose).toBe(false);
    });
});

// Ordered-list start number is preserved through the markdown round-trip, and
// the per-item number is computed by incrementing `meta.start` (see
// stateToMarkdown.ts `serializeListItem`). The delimiter (`.` or `)`) likewise
// comes from `meta.delimiter`, which a real boot seeds from
// `muya.options.orderListDelimiter`.
describe('stateToMarkdown — ordered list start + delimiter', () => {
    function serialize(states: TState[]): string {
        return new ExportMarkdown({ listIndentation: 1 }).generate(states);
    }

    it('keeps a non-1 start number through the round-trip', () => {
        // The parser stores start=3; the serializer renders 3., 4. (start + i).
        expect(roundTrip('3. one\n4. two\n')).toBe('3. one\n4. two\n');
    });

    it('parses the start number into order-list meta.start', () => {
        const states = new MarkdownToState({
            footnote: false,
            math: false,
            isGitlabCompatibilityEnabled: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
        }).generate('3. one\n4. two\n');
        const list = states[0] as IOrderListState;
        expect(list.name).toBe('order-list');
        expect(list.meta.start).toBe(3);
        expect(list.meta.delimiter).toBe('.');
    });

    it('emits the configured delimiter (")") for an ordered list', () => {
        const states: IOrderListState[] = [{
            name: 'order-list',
            meta: { start: 1, loose: false, delimiter: ')' },
            children: [
                { name: 'list-item', children: [{ name: 'paragraph', text: 'one' }] },
                { name: 'list-item', children: [{ name: 'paragraph', text: 'two' }] },
            ],
        }];
        expect(serialize(states)).toBe('1) one\n2) two\n');
    });

    it('combines a non-1 start with the ")" delimiter', () => {
        const states: IOrderListState[] = [{
            name: 'order-list',
            meta: { start: 5, loose: false, delimiter: ')' },
            children: [
                { name: 'list-item', children: [{ name: 'paragraph', text: 'one' }] },
                { name: 'list-item', children: [{ name: 'paragraph', text: 'two' }] },
            ],
        }];
        expect(serialize(states)).toBe('5) one\n6) two\n');
    });
});
