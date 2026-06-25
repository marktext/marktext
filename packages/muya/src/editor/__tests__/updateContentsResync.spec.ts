// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScrollPage } from '../../block/scrollPage';
import { Muya } from '../../muya';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
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

function spState(muya: Muya) {
    const sp = muya.editor.scrollPage as unknown as {
        children: { length: number; tail: unknown };
        domNode: HTMLElement;
    };
    return { len: sp.children.length, tail: sp.children.tail, dom: sp.domNode.childElementCount };
}

describe('updateContents keeps the live tree in sync with jsonState when block construction throws', () => {
    it('does not leave the ScrollPage empty if a block fails to build during an undo apply', () => {
        const muya = bootMuya('- foo\n\n- bar\n');
        const list = (muya.editor.scrollPage as unknown as { firstChild: { firstContentInDescendant: () => { setCursor: (a: number, b: number, c: boolean) => void } } }).firstChild;
        list.firstContentInDescendant().setCursor(0, 0, true);

        // Unwrap the list -> two paragraphs, recorded as one undo entry.
        muya.resetToParagraph(list as never);
        muya.editor.jsonState.flush();
        expect(muya.getMarkdown()).not.toContain('- ');

        // Simulate a block whose construction throws while the undo's `drop`
        // phase rebuilds the live tree (KaTeX/diagram/etc. can throw on
        // create). The undo re-inserts the bullet-list, so make THAT throw.
        const realLoadBlock = ScrollPage.loadBlock.bind(ScrollPage);
        let thrown = false;
        const spy = (name: string) => {
            if (name === 'bullet-list' && !thrown) {
                thrown = true;
                throw new Error('simulated block build failure');
            }
            return realLoadBlock(name);
        }
        ;(ScrollPage as unknown as { loadBlock: (n: string) => unknown }).loadBlock = spy as never;

        try {
            muya.undo();
        }
        catch {
            // The apply may throw; the engine must still leave a consistent tree.
        }
        finally {
            ;(ScrollPage as unknown as { loadBlock: unknown }).loadBlock = realLoadBlock;
        }

        // jsonState was updated first, so the markdown is the restored list.
        expect(muya.getMarkdown()).toContain('- foo');
        // The live tree MUST match it — never left empty/half-applied.
        const s = spState(muya);
        expect(s.tail, 'ScrollPage must not be left empty after a failed undo apply').not.toBeNull();
        expect(s.len).toBe(s.dom);
        expect(s.len).toBeGreaterThan(0);
    });
});
