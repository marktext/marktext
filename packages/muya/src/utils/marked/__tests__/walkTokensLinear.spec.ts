import type { Token } from 'marked';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { describe, expect, it } from 'vitest';
import { lexBlock } from '../lexBlock';
import { LinearMarked } from '../linearMarked';

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

describe('linear token walk', () => {
    it('visits the same token objects in the same order and preserves callback results and this', () => {
        const reference = new Marked();
        const linear = new LinearMarked();
        for (const marked of [reference, linear])
            marked.use({ extensions: [{ name: 'custom', level: 'block', childTokens: ['parts'], tokenizer: () => undefined }] });
        const tokens = reference.lexer(NESTED);
        tokens.push({ type: 'custom', raw: '', parts: [[{ type: 'text', raw: 'extra', text: 'extra' }]] });
        const promise = Promise.resolve();
        function visit(marked: Marked) {
            const seen: Token[] = [];
            const results = marked.walkTokens(tokens, function (this: Marked, token) {
                expect(this).toBe(marked);
                seen.push(token);
                return [undefined, promise];
            });
            return { seen, results };
        }
        const expected = visit(reference);
        const actual = visit(linear);
        expect(actual.seen).toHaveLength(expected.seen.length);
        actual.seen.forEach((token, i) => expect(token).toBe(expected.seen[i]));
        expect(actual.results).toEqual(expected.results);
        expect(actual.seen.map(token => token.type)).toContain('table');
        expect(actual.seen.map(token => token.type)).toContain('list_item');
        expect(actual.seen.at(-1)?.raw).toBe('extra');
    });

    it('walks deep children iteratively and observes children added by callbacks', () => {
        let token: Token = { type: 'text', raw: 'leaf', text: 'leaf' };
        for (let i = 0; i < 10000; i++)
            token = { type: 'blockquote', raw: '', text: '', tokens: [token] };
        let visited = 0;
        new LinearMarked().walkTokens([token], (node) => {
            visited += 1;
            if (node.type === 'text' && node.raw === 'leaf')
                node.tokens = [{ type: 'text', raw: 'added', text: 'added' }];
        });
        expect(visited).toBe(10002);
    });

    it.each([false, true])('preserves parse and highlighting with async=%s', async (async) => {
        const source = '> ```js\n> const value = 1;\n> ```\n';
        const extension = () => async
            ? markedHighlight({ async: true, highlight: code => Promise.resolve(`<b>${code}</b>`) })
            : markedHighlight({ highlight: code => `<b>${code}</b>` });
        const expected = await new Marked(extension()).parse(source);
        const actual = await new LinearMarked(extension()).parse(source);
        expect(actual).toBe(expected);
        expect(actual).toContain('<b>const value = 1;</b>');
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
