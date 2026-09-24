// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// `update()` ended every render in `domNode.innerHTML = code`, which destroys
// and recreates the content's child nodes even when the rebuilt string is
// byte-identical — so every keystroke replaced the text node the caret was in,
// as did every render that changed nothing at all.
//
// These tests pin the property that stops it: a render whose output has not
// changed must leave the existing DOM nodes in place. Node identity is the
// thing at stake, so they compare nodes, not their values.
// `e2e/tests/typing/codeblock-node-identity.spec.ts` pins the same property
// against a real Chromium composition.

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
    document.getSelection()?.removeAllRanges();
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

// Resolve the single `codeblock.content` leaf, the way a click on the code
// block resolves the active content block.
function codeContent(muya: Muya): Content {
    let target: Content | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'codeblock.content')
            target = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error('codeblock.content block not found');
    return target;
}

describe('codeBlockContent render idempotence', () => {
    it('keeps the existing text node when the rendered output is unchanged', () => {
        const content = codeContent(bootMuya('```\nて\n```\n'));
        const before = content.domNode!.firstChild;
        expect(before!.nodeType).toBe(Node.TEXT_NODE);

        content.update();

        expect(content.domNode!.firstChild).toBe(before);
    });

    it('still replaces the DOM when the text changed', () => {
        const content = codeContent(bootMuya('```\nて\n```\n'));
        const before = content.domNode!.firstChild;

        content.text = 'てす';
        content.update();

        expect(content.domNode!.firstChild).not.toBe(before);
        expect(content.domNode!.textContent).toBe('てす');
    });

    // A trailing newline carries a `<span class="mu-trailing-break">` (#5114);
    // it has to be part of the comparison or every render of such a block
    // rebuilds regardless.
    it('is idempotent for a block whose text ends in a newline', () => {
        const content = codeContent(bootMuya('```\nて\n\n```\n'));
        expect(content.text.endsWith('\n')).toBe(true);
        const before = [...content.domNode!.childNodes];
        expect(before.length).toBeGreaterThan(1);

        content.update();

        // Node identity, not value: two fresh nodes with the same text compare
        // equal, which is exactly the rebuild this guards against.
        const after = [...content.domNode!.childNodes];
        expect(after).toHaveLength(before.length);
        after.forEach((node, i) => expect(node).toBe(before[i]));
    });

    // Search paints its marks through `update(undefined, highlights)`; the
    // comparison must see those, or a search over an unchanged block renders
    // nothing.
    it('re-renders when highlights are added and when they are cleared', () => {
        const content = codeContent(bootMuya('```\nfoo\n```\n'));
        const highlight = [{ start: 0, end: 3, active: true }];

        content.update(undefined, highlight as never);
        expect(content.domNode!.querySelector('.mu-highlight')).not.toBeNull();

        content.update();
        expect(content.domNode!.querySelector('.mu-highlight')).toBeNull();
    });
});
