// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';

// Regression coverage for PR-15: re-introduces marktext's TOC API as a
// public muya method (`muya.getTOC()`). Mirrors marktext's `tocCtrl.js`
// behaviour and the 9cb2cbe8 regex fix (`/^\s*#{1,6}\s{1,}/` to handle
// non-breaking spaces and tab-prefixed atx markers).
//
//  - Only top-level heading blocks are surfaced (matches marktext
//    iterating `this.blocks`).
//  - Heading text is the raw inner content — inline markdown markers are
//    NOT stripped. marktext used `block.children[0].text` for the same
//    reason.
//  - Slug is a stable per-block identifier (so `getTOC()` returns the
//    same slug across multiple invocations on the same document); duplicate
//    headings keep distinct slugs but share `githubSlug`. The marktext
//    fix didn't dedupe and we don't either — that is the caller's call.
//  - `generateGithubSlug` mirrors marktext url.js literally: ASCII `\w`
//    only, so CJK / emoji collapse to hyphens. Future Unicode-aware
//    slugging is a separate change.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('muya.getTOC()', () => {
    it('returns [] for an empty document', () => {
        const muya = bootMuya('');
        expect(muya.getTOC()).toEqual([]);
    });

    it('extracts a single atx h1', () => {
        const muya = bootMuya('# Hello world');
        const toc = muya.getTOC();
        expect(toc).toHaveLength(1);
        expect(toc[0].lvl).toBe(1);
        expect(toc[0].content).toBe('Hello world');
        expect(typeof toc[0].slug).toBe('string');
        expect(toc[0].slug.length).toBeGreaterThan(0);
        expect(toc[0].githubSlug).toBe('hello-world');
    });

    it('extracts mixed h1 / h2 / h3 in document order with correct levels', () => {
        const md = `# Alpha\n\n## Beta\n\n### Gamma\n\n# Delta`;
        const muya = bootMuya(md);
        const toc = muya.getTOC();
        expect(toc.map(item => [item.lvl, item.content])).toEqual([
            [1, 'Alpha'],
            [2, 'Beta'],
            [3, 'Gamma'],
            [1, 'Delta'],
        ]);
    });

    it('extracts setext h1 (===) and h2 (---) without the underline', () => {
        const md = `Title One\n=========\n\nTitle Two\n---------\n`;
        const muya = bootMuya(md);
        const toc = muya.getTOC();
        expect(toc).toHaveLength(2);
        expect(toc[0]).toMatchObject({ lvl: 1, content: 'Title One' });
        expect(toc[1]).toMatchObject({ lvl: 2, content: 'Title Two' });
    });

    it('keeps raw markdown inline markers in `content` (no inline parsing)', () => {
        // marktext reads `block.children[0].text` — the raw source of the
        // heading line — so `**bold**` and `[link](url)` are preserved as
        // typed. Consumers that want rendered text should run their own
        // inline tokenizer over `content`.
        const md = `## **bold** and [link](https://example.com)`;
        const muya = bootMuya(md);
        const toc = muya.getTOC();
        expect(toc).toHaveLength(1);
        expect(toc[0].content).toBe('**bold** and [link](https://example.com)');
    });

    it('strips the leading hash run robustly (9cb2cbe8 \\s regex fix)', () => {
        // Pre-9cb2cbe8 marktext used `/^ *#{1,6} {1,}/` (plain ASCII
        // space). After the fix it accepts any whitespace before the
        // markers and between markers and text, so headings authored with
        // tabs / NBSPs / other unicode whitespace strip cleanly.
        // CommonMark only accepts ASCII space/tab around atx markers, but
        // the fix still matters because the underlying `text` is the
        // source line and we want defensive matching.
        const md = `#\tTabbed heading`;
        const muya = bootMuya(md);
        const toc = muya.getTOC();
        expect(toc).toHaveLength(1);
        expect(toc[0].lvl).toBe(1);
        expect(toc[0].content).toBe('Tabbed heading');
    });

    it('githubSlug strips non-ASCII letters and emoji and collapses whitespace', () => {
        // marktext url.js literal behavior: `[^\w\s-]/g` removes CJK and
        // emoji because JS `\w` is ASCII-only without the `/u` flag.
        // Future Unicode-aware slugging would be a separate change; this
        // test locks the marktext-faithful output in place.
        const md = `# 你好 World 🎉\n\n# API & Usage Examples!`;
        const muya = bootMuya(md);
        const toc = muya.getTOC();
        expect(toc[0].githubSlug).toBe('-world-');
        expect(toc[1].githubSlug).toBe('api-usage-examples');
    });

    it('duplicate headings share githubSlug but get distinct stable slugs', () => {
        const md = `## Foo\n\n## Foo`;
        const muya = bootMuya(md);
        const toc = muya.getTOC();
        expect(toc).toHaveLength(2);
        expect(toc[0].githubSlug).toBe('foo');
        expect(toc[1].githubSlug).toBe('foo');
        expect(toc[0].slug).not.toBe(toc[1].slug);
    });

    it('returns the same `slug` across repeated getTOC() calls on the same document', () => {
        const muya = bootMuya('# Stable');
        const first = muya.getTOC()[0].slug;
        const second = muya.getTOC()[0].slug;
        expect(first).toBe(second);
    });

    it('skips non-heading top-level blocks (paragraph, code, list)', () => {
        const md = [
            'a paragraph',
            '',
            '```js',
            'console.log(1)',
            '```',
            '',
            '- list item',
            '',
            '## Only Heading',
        ].join('\n');
        const muya = bootMuya(md);
        const toc = muya.getTOC();
        expect(toc).toHaveLength(1);
        expect(toc[0].content).toBe('Only Heading');
        expect(toc[0].lvl).toBe(2);
    });
});
