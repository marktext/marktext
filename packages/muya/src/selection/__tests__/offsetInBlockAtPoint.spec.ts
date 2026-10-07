// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { offsetInBlockAtPoint } from '../dom';

// #3412: happy-dom has no layout and no caret API, so the block rect and the
// caret lookup are stubbed; the code under test is the offset resolution.

const editors: Muya[] = [];
const hosts: HTMLElement[] = [];
let originalVersion: string | undefined;

beforeEach(() => {
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    while (hosts.length)
        hosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    delete (document as Partial<Document>).caretPositionFromPoint;
    delete (document as Partial<Document>).caretRangeFromPoint;
    if (originalVersion === undefined)
        delete (window as Partial<Window>).MUYA_VERSION;
    else
        window.MUYA_VERSION = originalVersion;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
    const muya = new Muya(host, { markdown });
    muya.init();
    editors.push(muya);
    return muya;
}

function content(muya: Muya, text: string): Content {
    let result: Content | undefined;
    muya.editor.scrollPage!.breadthFirstTraverse((block) => {
        if (block.isContent() && block.text === text)
            result = block;
    });
    if (!result)
        throw new Error(`Content not found: ${text}`);
    return result;
}

function textNodeIn(node: Node): Node {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (!first)
        throw new Error('no text node');
    return first;
}

function makeRect(top: number, height: number): DOMRect {
    return {
        x: 0,
        y: top,
        width: 100,
        height,
        top,
        left: 0,
        right: 100,
        bottom: top + height,
    } as unknown as DOMRect;
}

function stubRect(block: Content, rect: DOMRect): void {
    block.domNode!.getBoundingClientRect = () => rect;
}

describe('offsetInBlockAtPoint', () => {
    it('returns the resolved offset when the probe lands inside the block', () => {
        const muya = boot('alpha beta\n\nnext words\n');
        const block = content(muya, 'alpha beta');
        stubRect(block, makeRect(100, 20));

        document.caretPositionFromPoint = (x, y) => {
            expect(x).toBe(240);
            expect(y).toBe(101);
            return { offsetNode: textNodeIn(block.domNode!), offset: 6 } as unknown as CaretPosition;
        };

        expect(offsetInBlockAtPoint(document, block, 240, 'top')).toBe(6);
    });

    it('probes one pixel inside the first line for top and the last line for bottom', () => {
        const muya = boot('alpha\n\nbeta\n');
        const block = content(muya, 'alpha');
        stubRect(block, makeRect(100, 20));

        const probes: Array<{ x: number; y: number }> = [];
        document.caretPositionFromPoint = (x, y) => {
            probes.push({ x, y });
            return { offsetNode: textNodeIn(block.domNode!), offset: 1 } as unknown as CaretPosition;
        };

        offsetInBlockAtPoint(document, block, 50, 'top');
        offsetInBlockAtPoint(document, block, 50, 'bottom');
        expect(probes).toEqual([{ x: 50, y: 101 }, { x: 50, y: 119 }]);
    });

    it('falls back to caretRangeFromPoint when caretPositionFromPoint is unavailable', () => {
        const muya = boot('alpha\n\nbeta\n');
        const block = content(muya, 'alpha');
        stubRect(block, makeRect(100, 20));

        document.caretRangeFromPoint = () =>
            ({ startContainer: textNodeIn(block.domNode!), startOffset: 3 }) as unknown as Range;

        expect(offsetInBlockAtPoint(document, block, 50, 'top')).toBe(3);
    });

    it('returns null when no caret API can place the point', () => {
        const muya = boot('alpha\n\nbeta\n');
        const block = content(muya, 'alpha');
        stubRect(block, makeRect(100, 20));

        expect(offsetInBlockAtPoint(document, block, 50, 'top')).toBeNull();
    });

    it('returns null when the block has no layout', () => {
        const muya = boot('alpha\n\nbeta\n');
        const block = content(muya, 'alpha');

        expect(block.domNode!.getBoundingClientRect().height).toBe(0);
        expect(offsetInBlockAtPoint(document, block, 50, 'top')).toBeNull();
    });

    it('returns null when the probe resolves into a different block', () => {
        const muya = boot('alpha\n\nbeta\n');
        const alpha = content(muya, 'alpha');
        const beta = content(muya, 'beta');
        stubRect(alpha, makeRect(100, 20));

        document.caretPositionFromPoint = () =>
            ({ offsetNode: textNodeIn(beta.domNode!), offset: 0 }) as unknown as CaretPosition;

        expect(offsetInBlockAtPoint(document, alpha, 50, 'top')).toBeNull();
    });

    it('returns null when the block is detached from the document', () => {
        const muya = boot('alpha\n\nbeta\n');
        const block = content(muya, 'alpha');
        stubRect(block, makeRect(100, 20));
        document.caretPositionFromPoint = () =>
            ({ offsetNode: textNodeIn(block.domNode!), offset: 0 }) as unknown as CaretPosition;

        block.domNode!.remove();
        expect(offsetInBlockAtPoint(document, block, 50, 'top')).toBeNull();
    });
});
