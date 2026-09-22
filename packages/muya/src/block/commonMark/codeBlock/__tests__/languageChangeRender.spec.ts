// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// Clearing a code block's language, or setting one Prism does not know, has to
// drop the markup the previous grammar produced — those are exactly the cases
// where the block must fall back to plain text. The `lang` setter used to
// re-render only when Prism reported `loaded` or `cached`, so both of them left
// the old highlighting on screen (#5515).

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

interface ICodeBlock {
    lang: string;
    lastContentInDescendant: () => { update: () => void };
}

function codeBlockOf(muya: Muya): ICodeBlock {
    let target: ICodeBlock | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'code-block')
            target ??= block as unknown as ICodeBlock;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error('code-block not found');
    return target;
}

function tokenCount(muya: Muya): number {
    return muya.domNode.querySelectorAll('.mu-codeblock-content span.token').length;
}

/**
 * Let the `lang` setter's loadLanguage promise chain settle — including the
 * rAF `CodeBlock.create` uses to seed the language after the tree is wired.
 */
async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++)
        await Promise.resolve();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    for (let i = 0; i < 5; i++)
        await Promise.resolve();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
}

const JS_FENCE = '```js\nconst x = 1\n```\n';

describe('code block re-render on language change (#5515)', () => {
    it('highlights to begin with', async () => {
        const muya = bootMuya(JS_FENCE);
        await settle();

        expect(tokenCount(muya)).toBeGreaterThan(0);
    });

    it('drops the highlighting when the language is cleared', async () => {
        const muya = bootMuya(JS_FENCE);
        await settle();
        expect(tokenCount(muya)).toBeGreaterThan(0);

        codeBlockOf(muya).lang = '';
        await settle();

        expect(tokenCount(muya)).toBe(0);
        expect(muya.domNode.querySelector('.mu-codeblock-content')!.textContent).toBe('const x = 1');
    });

    it('drops the highlighting when the language is unknown to Prism', async () => {
        const muya = bootMuya(JS_FENCE);
        await settle();
        expect(tokenCount(muya)).toBeGreaterThan(0);

        codeBlockOf(muya).lang = 'notalanguage';
        await settle();

        expect(tokenCount(muya)).toBe(0);
    });

    // The language input calls the setter on every keystroke, so typing a name
    // Prism does not have walks through a run of unknown prefixes. The block
    // already reads as plain text after the first of them; re-rendering for the
    // rest is pure waste, and on a large block a visible one.
    it('does not re-render again while an unknown language is being typed', async () => {
        const muya = bootMuya(JS_FENCE);
        await settle();
        const codeBlock = codeBlockOf(muya);
        const content = codeBlock.lastContentInDescendant();
        const update = vi.spyOn(content, 'update');

        for (const prefix of ['n', 'no', 'not', 'nota', 'notal', 'notala']) {
            codeBlock.lang = prefix;
            await settle();
        }

        // One render, for the transition out of JavaScript.
        expect(update).toHaveBeenCalledTimes(1);
        expect(tokenCount(muya)).toBe(0);
    });

    it('does not re-render when the same known language is set again', async () => {
        const muya = bootMuya(JS_FENCE);
        await settle();
        const codeBlock = codeBlockOf(muya);
        const update = vi.spyOn(codeBlock.lastContentInDescendant(), 'update');

        codeBlock.lang = 'js';
        await settle();

        expect(update).not.toHaveBeenCalled();
        expect(tokenCount(muya)).toBeGreaterThan(0);
    });

    it('still re-highlights when the language changes to another known one', async () => {
        const muya = bootMuya(JS_FENCE);
        await settle();
        const asJs = tokenCount(muya);

        codeBlockOf(muya).lang = 'css';
        await settle();

        // `const x = 1` tokenizes differently under css than under js; what
        // matters is that the render followed the language.
        expect(tokenCount(muya)).not.toBe(asJs);
    });
});
