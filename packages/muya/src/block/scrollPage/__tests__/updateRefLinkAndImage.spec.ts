// @vitest-environment happy-dom

import type Content from '../../base/content';
import type TreeNode from '../../base/treeNode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// updateRefLinkAndImage re-renders every block that references a label after
// its definition changes. The label is user text, so it must be matched
// literally (`[c++]` used to throw "Nothing to repeat" while loading the
// document) and with CommonMark's
// case-insensitive, whitespace-collapsed label matching.

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
    vi.restoreAllMocks();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function contentBlocks(muya: Muya): Content[] {
    const blocks: Content[] = [];
    muya.editor.scrollPage!.depthFirstTraverse((node: TreeNode) => {
        if (node.isContent())
            blocks.push(node as Content);
    });
    return blocks;
}

function refreshedTexts(muya: Muya, label: string): string[] {
    const blocks = contentBlocks(muya);
    const spies = blocks.map(block => vi.spyOn(block, 'update'));
    muya.editor.scrollPage!.updateRefLinkAndImage(label);
    return blocks.filter((_, i) => spies[i].mock.calls.length > 0).map(block => block.text);
}

describe('scrollPage.updateRefLinkAndImage', () => {
    it.each([
        ['c++'],
        ['a(b'],
        ['x[y'],
        ['1.0*'],
    ])('treats the label %s literally', (label) => {
        const muya = bootMuya(`[${label}]: https://example.com\n\nsee [${label}] here\n\nsee [other] here\n`);

        expect(refreshedTexts(muya, label)).toEqual([`see [${label}] here`]);
    });

    it('does not treat regex metacharacters as wildcards', () => {
        const muya = bootMuya('[a.c]: https://example.com\n\nsee [abc]\n\nsee [a.c]\n');

        expect(refreshedTexts(muya, 'a.c')).toEqual(['see [a.c]']);
    });

    it('matches references case-insensitively and across whitespace runs', () => {
        const muya = bootMuya('[Foo Bar]: https://example.com\n\nsee [FOO   bar]\n\nsee [foobar]\n');

        expect(refreshedTexts(muya, 'foo bar')).toEqual(['see [FOO   bar]']);
    });

    it('loads a document whose definition label contains metacharacters', () => {
        // Rendering the definition at init calls updateRefLinkAndImage, so the
        // unescaped regex used to throw out of Muya#init.
        let muya: Muya | undefined;
        expect(() => {
            muya = bootMuya('[c++]: https://example.com\n\nsee [c++]\n');
        }).not.toThrow();
        expect(contentBlocks(muya!).map(block => block.text)).toEqual([
            '[c++]: https://example.com',
            'see [c++]',
        ]);
    });
});
