import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';

function codeMeta(md: string): { type: string; lang: string } {
    const states = new MarkdownToState().generate(md) as Array<{
        name: string;
        meta?: { type: string; lang: string };
    }>;
    const block = states.find(s => s.name === 'code-block')!;
    return block.meta!;
}

describe('info string is stored whole on meta.lang', () => {
    it('keeps a language + attributes verbatim', () => {
        expect(codeMeta('```js title="app.js"\nx\n```\n').lang).toBe('js title="app.js"');
    });

    it('keeps a Pandoc attribute block verbatim', () => {
        expect(codeMeta('```{example, listing1-name}\nx\n```\n').lang).toBe('{example, listing1-name}');
    });

    it('stores a plain language as-is', () => {
        expect(codeMeta('```js\nx\n```\n').lang).toBe('js');
    });
});
