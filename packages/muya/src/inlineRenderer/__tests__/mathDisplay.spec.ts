// @vitest-environment happy-dom

import type { IMuyaOptions } from '../../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';

const dollars: Array<[markdown: string, display: boolean[]]> = [
    ['$$a \\ne b$$', [true]],
    ['   $$a$$   ', [true]],
    ['$$a$$ $$b$$', [true, true]],
    ['$$a$$\n$$b$$', [true, true]],
    ['> $$a$$', [true]],
    ['> > $$a$$', [true]],
    ['- $$c$$', [true]],
    ['- item\n\n  $$c$$', [true]],
    ['1. $$d$$', [true]],
    ['- [ ] $$t$$', [true]],
    ['- > $$x$$', [true]],
    ['> - $$y$$', [true]],
    ['text $$a$$ text', [false]],
    ['$$a$$ text', [false]],
    ['text $$a$$', [false]],
    ['line one\n$$a$$\nline three', [false]],
    ['$x$ and $$x$$', [false, false]],
    ['**$$a$$**', [false]],
    ['- see $$c$$', [false]],
    ['# $$a$$', [false]],
    ['| h |\n| --- |\n| $$d$$ |', [false]],
    ['$$a$$  \n$$b$$', [true, true]],
    ['- a\n  - $$n$$', [true]],
];

const backslashes: Array<[markdown: string, display: boolean[]]> = [
    ['\\[a\\]', [true]],
    ['\\[\nx\n\\]', [true]],
    ['   \\[a\\]   ', [true]],
    ['\\[a\\] \\[b\\]', [true, true]],
    ['> \\[a\\]', [true]],
    ['- \\[a\\]', [true]],
    ['\\(a\\)', [false]],
    ['See \\[x\\] here', [false]],
    ['\\[a\\] text', [false]],
    ['# \\[a\\]', [false]],
    ['| h |\n| --- |\n| \\[d\\] |', [false]],
    ['\\[a \\ne b\\]', [true]],
    ['\\[\na\n\\]', [true]],
    ['- \\[c\\]', [true]],
    ['text \\[a\\] text', [false]],
    ['$$a$$ \\[b\\]', [true, true]],
];

const instances: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    for (const muya of instances.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function boot(markdown: string, options: Partial<IMuyaOptions>): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options });
    muya.init();
    instances.push(muya);
    return muya;
}

// Centered display math requires a paragraph containing only formulas (#4904).
for (const { name, options, cases, source } of [
    { name: 'dollar', options: {}, cases: dollars, source: '$$x$$' },
    { name: 'single-backslash', options: { texMathSingleBackslash: true }, cases: backslashes, source: '\\[x\\]' },
]) {
    describe(`${name} math display in editor and export`, () => {
        it.each(cases)('%s', (markdown, display) => {
            const muya = boot(`${markdown}\n`, options);
            const wrappers = [...muya.domNode.querySelectorAll('.mu-math')];
            expect(wrappers.map(wrapper => wrapper.classList.contains('mu-display-math'))).toEqual(display);
            expect(wrappers.map(wrapper => wrapper.querySelector('.katex-display') !== null)).toEqual(display);
            const html = getHighlightHtml(markdown, options);
            expect(html.match(/class="katex"/g)?.length ?? 0).toBe(display.length);
            expect(html.match(/class="katex-display"/g)?.length ?? 0).toBe(display.filter(Boolean).length);
        });

        it('maps the preview offsets across the two-character markers', () => {
            const muya = boot(`${source}\n`, options);
            const preview = muya.domNode.querySelector<HTMLElement>('.mu-math-render');
            expect(preview?.dataset.start).toBe('2');
            expect(preview?.dataset.end).toBe('3');
        });
    });
}

it('preserves authored same-line dollar syntax when serializing Markdown', () => {
    const source = '$$ E=MC^2 $$\n';
    expect(boot(source, {}).getMarkdown()).toBe(source);
});

// The export dollar grammar excludes soft line breaks; this covers the editor's wider grammar.
it('renders soft line breaks inside dollar math in the editor', () => {
    const muya = boot('$$e\nf$$\n', {});
    expect(muya.domNode.querySelector('.mu-display-math .katex-display')).not.toBeNull();
});
