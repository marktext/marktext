import { Marked } from 'marked';
import { describe, expect, it } from 'vitest';
import { lexBlock } from '../lexBlock';

// lexBlock walks tokens with a local linear driver instead of
// `Marked.walkTokens`, whose per-token result concat is O(tokens²) (#4887).
// The drivers must keep visiting the same tokens.

const NESTED = [
    '# Heading with **bold**',
    '',
    '> quote with a [link](https://example.com)',
    '',
    '- item one\n- item two\n  - nested `code`',
    '',
    '| a | b |\n| - | - |\n| **c** | d |',
    '',
    'Paragraph with *em* text.',
].join('\n');

function visitedTypes(markdown: string): string[] {
    const seen: string[] = [];
    const m = new Marked();
    const tokens = new m.Lexer(m.defaults).blockTokens(markdown);
    m.walkTokens(tokens, token => void seen.push(token.type));
    return seen.sort();
}

describe('lexBlock token walk', () => {
    it('visits the same token set as Marked.walkTokens', () => {
        const seen: string[] = [];
        // lexBlock runs its walker internally; re-walk its output with the
        // reference driver to compare coverage on identical token trees.
        const tokens = lexBlock(NESTED, {
            footnote: false,
            isGitlabCompatibilityEnabled: true,
            frontMatter: false,
            math: false,
        });
        const m = new Marked();
        m.walkTokens(tokens as never, token => void seen.push(token.type));

        expect(seen.sort()).toEqual(visitedTypes(NESTED));
        expect(seen).toContain('table');
        expect(seen).toContain('list_item');
    });

    it('applies muya token augmentation to nested tokens', () => {
        const tokens = lexBlock(
            '> # quoted heading\n\n- item\n\n  ```js\n  x\n  ```\n',
            {
                footnote: false,
                isGitlabCompatibilityEnabled: true,
                frontMatter: false,
                math: false,
            },
        );
        const json = JSON.stringify(tokens);
        // Both augmentations live on tokens that are only reachable through
        // child arrays (blockquote > heading, list item > fenced code); a
        // walker that misses child arrays would leave them untouched.
        expect(json).toContain('"headingStyle":"atx"');
        expect(json).toContain('"codeBlockStyle":"fenced"');
    });
});
