// @vitest-environment happy-dom

import type AtxHeading from '../../../block/commonMark/atxHeading';
import type Content from '../../../block/base/content';
import type Parent from '../../../block/base/parent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';
import { ParagraphFrontMenu } from '../index';

// The paragraph front menu (the "•" handle left of a block) offers heading-only
// fold actions: Fold all / Unfold all / Fold to this level. These route to the
// heading's document-wide fold methods. Non-heading blocks must NOT show them.

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
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

function firstHeading(muya: Muya): AtxHeading {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as Content;
    return content.outMostBlock as unknown as AtxHeading;
}

function firstBlock(muya: Muya): Parent {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as Content;
    return content.outMostBlock as Parent;
}

describe('paragraph front menu — heading fold actions', () => {
    it('renders Fold all / Unfold all / Fold to this level for a heading', () => {
        const muya = bootMuya('# One\n\ntext\n');
        const heading = firstHeading(muya);

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = heading as unknown as Parent;
        menu.render();

        // snabbdom patches the vnode over the container element; query the
        // menu's outer float container which holds the rendered <ul>.
        const container = (menu as unknown as { container: HTMLElement }).container;
        expect(container.querySelector('.fold-all')).toBeTruthy();
        expect(container.querySelector('.unfold-all')).toBeTruthy();
        expect(container.querySelector('.fold-to-level')).toBeTruthy();
    });

    it('does NOT render fold actions for a non-heading block', () => {
        const muya = bootMuya('just a paragraph\n');
        const paragraph = firstBlock(muya);
        expect(paragraph.blockName).toBe('paragraph');

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = paragraph;
        menu.render();

        const container = (menu as unknown as { container: HTMLElement }).container;
        expect(container.querySelector('.fold-all')).toBeNull();
    });

    it('routes "fold all" to the heading and folds every heading', () => {
        const muya = bootMuya('# A\n\na\n\n## B\n\nb\n\n# C\n\nc\n');
        const heading = firstHeading(muya);

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = heading as unknown as Parent;
        menu.selectItem(new Event('click'), { label: 'fold-all' });

        // All three headings become folded.
        expect(muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded').length).toBe(3);
    });

    it('routes "unfold all" and reopens everything', () => {
        const muya = bootMuya('# A\n\na\n\n## B\n\nb\n\n# C\n\nc\n');
        const heading = firstHeading(muya);

        const menu = new ParagraphFrontMenu(muya, {});
        const setBlock = () => {
            (menu as unknown as { _block: Parent })._block = heading as unknown as Parent;
        };

        setBlock();
        menu.selectItem(new Event('click'), { label: 'fold-all' });
        expect(muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded').length).toBeGreaterThan(0);

        setBlock();
        menu.selectItem(new Event('click'), { label: 'unfold-all' });
        expect(muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded').length).toBe(0);
    });

    it('routes "fold to level" using the clicked heading\'s level', () => {
        const muya = bootMuya('# A\n\n## B\n\n### C\n\nc\n');
        // Reach the h2 (second top-level heading) — folding to its level (2)
        // should fold only the deeper h3.
        let node: any = muya.editor.scrollPage!.firstChild;
        let h2: AtxHeading | null = null;
        while (node) {
            if (node.blockName === 'atx-heading' && node.meta.level === 2)
                h2 = node as AtxHeading;
            node = node.next;
        }
        expect(h2).toBeTruthy();

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = h2 as unknown as Parent;
        menu.selectItem(new Event('click'), { label: 'fold-to-level' });

        const folded = Array.from(muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded'));
        expect(folded.length).toBe(1);
        expect(folded[0].tagName.toLowerCase()).toBe('h3');
    });
});
