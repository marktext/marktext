// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';
import { getImageInfo } from '../../../utils/image';

// #2505 — aligning an image rewrites `![alt](src)` into an inline HTML `<img …>`
// so it can carry the alignment attribute. The generated tag was left OPEN
// (`<img …>`), which is valid Markdown/HTML but breaks JSX/MDX (Docusaurus:
// "Unterminated JSX contents"). It must be self-closed (`<img … />`). This
// drives the real alignment path the image toolbar uses
// (block.updateImage(info, 'data-align', …)) and the edit path
// (block.replaceImage) on a booted engine.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
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

function firstBlock(muya: Muya): Format {
    return muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
}

describe('#2505 — aligned/edited images emit a self-closing <img/> (JSX-safe)', () => {
    it('aligning a markdown image produces a self-closed <img …/>', () => {
        const muya = bootMuya('![cat](https://example.com/cat.png)\n');
        const block = firstBlock(muya);
        const imageEl = muya.domNode.querySelector<HTMLElement>('[data-raw]');
        expect(imageEl).not.toBeNull();

        const imageInfo = getImageInfo(imageEl!);
        block.updateImage(imageInfo, 'data-align', 'center');

        expect(block.text).toMatch(/<img\b[^>]*\/>/);
        // and never an unterminated open tag
        expect(block.text).not.toMatch(/<img\b[^>]*[^/]>/);
    });

    it('editing an existing inline HTML <img> keeps it self-closed', () => {
        const muya = bootMuya('<img src="https://example.com/a.png" alt="a" data-align="left">\n');
        const block = firstBlock(muya);
        const imageEl = muya.domNode.querySelector<HTMLElement>('[data-raw]');
        expect(imageEl).not.toBeNull();

        const imageInfo = getImageInfo(imageEl!);
        block.replaceImage(imageInfo, { alt: 'b', src: 'https://example.com/b.png', title: '' });

        expect(block.text).toMatch(/<img\b[^>]*\/>/);
        expect(block.text).not.toMatch(/<img\b[^>]*[^/]>/);
    });
});
