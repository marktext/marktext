import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

// #1841 — a fenced code block whose info-string fence is longer than 3
// backticks (needed when the block's content itself contains a ``` line) was
// always re-serialized with exactly 3 backticks, so the first ``` inside the
// content prematurely closed the block and the saved markdown was corrupt.

function gen(markdown: string): Parameters<ExportMarkdown['generate']>[0] {
    return new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    }).generate(markdown) as unknown as Parameters<ExportMarkdown['generate']>[0];
}

function openingFence(md: string): string {
    return md.split('\n')[0];
}

describe('code fence length (#1841)', () => {
    it('keeps a fence long enough to wrap content that contains ```', () => {
        // A 4-backtick fence wrapping a body that contains a 3-backtick line.
        const input = '````\n```\nfoo\n```\n````\n';

        const md = new ExportMarkdown().generate(gen(input));

        // The opening fence must be at least 4 backticks, otherwise the inner
        // ``` closes the block and the markdown is broken.
        expect(openingFence(md)).toMatch(/^`{4,}$/);

        // Re-parsing must still yield a single code block whose body keeps the
        // inner ``` — i.e. the round trip did not corrupt the document.
        const reparsed = gen(md) as Array<{ name: string; text?: string }>;
        const codeBlocks = reparsed.filter(b => b.name === 'code-block');
        expect(codeBlocks).toHaveLength(1);
        expect(codeBlocks[0].text).toContain('```');
    });

    it('round-trips a long-fenced block byte-stably', () => {
        const input = '````js\n```\nconst a = 1\n```\n````\n';
        const once = new ExportMarkdown().generate(gen(input));
        const twice = new ExportMarkdown().generate(gen(once));
        expect(twice).toBe(once);
    });

    it('still uses a plain 3-backtick fence for ordinary blocks', () => {
        const input = '```js\nconst a = 1\n```\n';
        const md = new ExportMarkdown().generate(gen(input));
        expect(openingFence(md)).toBe('```js');
    });
});
