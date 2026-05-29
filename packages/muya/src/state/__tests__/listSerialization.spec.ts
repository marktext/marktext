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
});
