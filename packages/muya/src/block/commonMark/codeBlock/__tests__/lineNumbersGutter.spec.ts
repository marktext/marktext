// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// Characterization coverage for the code-block line-numbers gutter
// (option: codeBlockLineNumbers, marktext a028a7c2). The gutter lives in two
// places that must stay in sync:
//   - CodeBlock (the <pre>, class `mu-code-block`) adds the `mu-line-numbers`
//     class purely from the option.
//   - Code.createCopyNode() only creates the `.mu-line-numbers-rows` wrapper
//     when the option is on AND the host is a real `code-block` (not
//     frontmatter / math / diagram / html). CodeBlock.create then MOVES that
//     wrapper into the <pre> so the gutter is not clipped by `.mu-code`.
// Spans are filled lazily on CodeBlockContent.update() via syncLineNumbersSpans
// (one span per visible row, trailing-newline row included). State and the
// reposition pass flush on requestAnimationFrame.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
});

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function nextFrame(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

const THREE_LINE_FENCE = '```js\nconst a = 1\nconst b = 2\nconst c = 3\n```\n';

describe('code-block line-numbers gutter', () => {
    describe('when codeBlockLineNumbers is true', () => {
        it('adds the mu-line-numbers class to the code-block <pre>', () => {
            const muya = bootMuya(THREE_LINE_FENCE, { codeBlockLineNumbers: true });
            const pre = muya.domNode.querySelector<HTMLElement>('pre.mu-code-block');
            expect(pre).not.toBeNull();
            expect(pre!.tagName).toBe('PRE');
            expect(pre!.classList.contains('mu-line-numbers')).toBe(true);
        });

        it('creates a single .mu-line-numbers-rows wrapper inside the <pre>', () => {
            const muya = bootMuya(THREE_LINE_FENCE, { codeBlockLineNumbers: true });
            const root = muya.domNode;
            const wrappers = root.querySelectorAll('.mu-line-numbers-rows');
            expect(wrappers.length).toBe(1);

            const wrapper = wrappers[0] as HTMLElement;
            // CodeBlock.create lifts the wrapper out of `.mu-code` into the <pre>.
            expect(wrapper.parentElement!.tagName).toBe('PRE');
            expect(wrapper.parentElement!.classList.contains('mu-code-block')).toBe(true);
            expect(wrapper.getAttribute('contenteditable')).toBe('false');
            expect(wrapper.getAttribute('aria-hidden')).toBe('true');
        });

        it('fills the wrapper with one span per visible row after the rAF flush', async () => {
            const muya = bootMuya(THREE_LINE_FENCE, { codeBlockLineNumbers: true });
            const wrapper = muya.domNode.querySelector<HTMLElement>('.mu-line-numbers-rows')!;
            await nextFrame();
            await nextFrame();
            expect(wrapper.childElementCount).toBe(3);
            expect(wrapper.querySelectorAll('span').length).toBe(3);
        });

        it('renders one span per line for a single-line block', async () => {
            const muya = bootMuya('```js\nsolo\n```\n', { codeBlockLineNumbers: true });
            const wrapper = muya.domNode.querySelector<HTMLElement>('.mu-line-numbers-rows')!;
            await nextFrame();
            await nextFrame();
            expect(wrapper.childElementCount).toBe(1);
        });

        // The lazy fill only runs from CodeBlockContent.update(). During the
        // initial tree build that fires once per code-block via the
        // language-load callback — but a fenced block with no info string, an
        // unknown language, or an indented block never loads a language, so the
        // gutter must be seeded on first render independent of the language.
        it('fills spans on first render for a fenced block with no language', async () => {
            const muya = bootMuya('```\nconst a = 1\nconst b = 2\nconst c = 3\n```\n', { codeBlockLineNumbers: true });
            const wrapper = muya.domNode.querySelector<HTMLElement>('.mu-line-numbers-rows')!;
            await nextFrame();
            await nextFrame();
            expect(wrapper.childElementCount).toBe(3);
        });

        it('fills spans on first render for an unknown language', async () => {
            const muya = bootMuya('```not-a-real-language\none\ntwo\n```\n', { codeBlockLineNumbers: true });
            const wrapper = muya.domNode.querySelector<HTMLElement>('.mu-line-numbers-rows')!;
            await nextFrame();
            await nextFrame();
            expect(wrapper.childElementCount).toBe(2);
        });

        it('fills spans on first render for an indented code block', async () => {
            const muya = bootMuya('    const a = 1\n    const b = 2\n', { codeBlockLineNumbers: true });
            const wrapper = muya.domNode.querySelector<HTMLElement>('.mu-line-numbers-rows')!;
            await nextFrame();
            await nextFrame();
            expect(wrapper.childElementCount).toBe(2);
        });
    });

    describe('when codeBlockLineNumbers is false', () => {
        it('does not add the mu-line-numbers class to the <pre>', () => {
            const muya = bootMuya(THREE_LINE_FENCE, { codeBlockLineNumbers: false });
            const pre = muya.domNode.querySelector<HTMLElement>('pre.mu-code-block');
            expect(pre).not.toBeNull();
            expect(pre!.classList.contains('mu-line-numbers')).toBe(false);
        });

        it('does not create a .mu-line-numbers-rows wrapper', () => {
            const muya = bootMuya(THREE_LINE_FENCE, { codeBlockLineNumbers: false });
            expect(muya.domNode.querySelectorAll('.mu-line-numbers-rows').length).toBe(0);
        });

        it('defaults to off (option omitted behaves like false)', () => {
            const muya = bootMuya(THREE_LINE_FENCE);
            const pre = muya.domNode.querySelector<HTMLElement>('pre.mu-code-block');
            expect(pre!.classList.contains('mu-line-numbers')).toBe(false);
            expect(muya.domNode.querySelectorAll('.mu-line-numbers-rows').length).toBe(0);
        });
    });

    describe('the gutter is exclusive to real code blocks', () => {
        it('does not gutter a math block even with the option on', () => {
            const muya = bootMuya('$$\na + b\nc + d\n$$\n', { codeBlockLineNumbers: true });
            const root = muya.domNode;
            const mathBlock = root.querySelector<HTMLElement>('.mu-math-block');
            expect(mathBlock).not.toBeNull();
            expect(mathBlock!.classList.contains('mu-line-numbers')).toBe(false);
            // The math container reuses Code with _withLineNumbers=false, so no
            // gutter class and no rows wrapper anywhere in the surface.
            expect(root.querySelectorAll('.mu-line-numbers').length).toBe(0);
            expect(root.querySelectorAll('.mu-line-numbers-rows').length).toBe(0);
        });

        it('does not gutter front matter even with the option on', () => {
            const muya = bootMuya('---\ntitle: x\nlang: en\n---\n\nbody\n', { codeBlockLineNumbers: true });
            const root = muya.domNode;
            const frontmatter = root.querySelector<HTMLElement>('pre.mu-frontmatter');
            expect(frontmatter).not.toBeNull();
            expect(frontmatter!.classList.contains('mu-line-numbers')).toBe(false);
            expect(root.querySelectorAll('.mu-line-numbers').length).toBe(0);
            expect(root.querySelectorAll('.mu-line-numbers-rows').length).toBe(0);
        });

        it('does not gutter a diagram block even with the option on', () => {
            const muya = bootMuya('```mermaid\ngraph TD\nA-->B\n```\n', { codeBlockLineNumbers: true });
            const root = muya.domNode;
            const diagram = root.querySelector<HTMLElement>('pre.mu-diagram-container');
            expect(diagram).not.toBeNull();
            expect(diagram!.classList.contains('mu-line-numbers')).toBe(false);
            expect(root.querySelectorAll('.mu-line-numbers').length).toBe(0);
            expect(root.querySelectorAll('.mu-line-numbers-rows').length).toBe(0);
        });
    });
});
