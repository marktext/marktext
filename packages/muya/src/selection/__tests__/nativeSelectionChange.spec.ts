// @vitest-environment happy-dom

import type Table from '../../block/gfm/table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { getNodeAndOffset } from '../dom';

const editors: Muya[] = [];
let originalVersion: string | undefined;

beforeEach(() => {
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    document.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
    if (originalVersion === undefined)
        delete (window as Partial<Window>).MUYA_VERSION;
    else
        window.MUYA_VERSION = originalVersion;
});

function boot(markdown: string, parent: HTMLElement = document.body): Muya {
    const host = document.createElement('div');
    parent.appendChild(host);
    const muya = new Muya(host, { markdown });
    muya.init();
    editors.push(muya);
    return muya;
}

function nativeRange(start: Node, startOffset: number, end: Node, endOffset: number): void {
    document.getSelection()!.setBaseAndExtent(start, startOffset, end, endOffset);
    document.dispatchEvent(new Event('selectionchange'));
}

describe('native selection notifications', () => {
    it('reports live endpoints without rewriting the range or committing the editing cursor', () => {
        const muya = boot('Alpha beta gamma\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(0, 0);
        const setSelection = vi.spyOn(muya.editor.selection, 'setSelection');
        const report = vi.fn();
        muya.on('selection-change', report);
        const start = getNodeAndOffset(block.domNode!, 6);
        const end = getNodeAndOffset(block.domNode!, 10);

        nativeRange(start.node, start.offset, end.node, end.offset);

        expect(report).toHaveBeenLastCalledWith(expect.objectContaining({
            type: 'Range',
            anchor: { offset: 6 },
            focus: { offset: 10 },
        }));
        expect(muya.getSelectedText()).toBe('beta');
        expect(document.getSelection()!.toString()).toBe('beta');
        expect(muya.editor.selection.anchor?.offset).toBe(0);
        expect(muya.editor.selection.focus?.offset).toBe(0);
        expect(setSelection).not.toHaveBeenCalled();

        const count = report.mock.calls.length;
        document.dispatchEvent(new Event('selectionchange'));
        expect(report).toHaveBeenCalledTimes(count);
    });

    it('does not duplicate the notification for an API-driven selection', () => {
        const muya = boot('Alpha beta\n');
        const report = vi.fn();
        muya.on('selection-change', report);
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 5);
        const count = report.mock.calls.length;

        document.dispatchEvent(new Event('selectionchange'));

        // happy-dom dispatches selectionchange synchronously while setCursor
        // builds the range; browsers deliver the native notification afterward.
        expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'Range' }));
        expect(report).toHaveBeenCalledTimes(count);
    });

    it('keeps an element boundary on the selected side of adjacent blocks', () => {
        const muya = boot('Alpha\n\nBeta\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const range = document.createRange();
        range.setStartBefore(first.parent!.domNode!);
        range.setEndAfter(first.parent!.domNode!);

        nativeRange(range.startContainer, range.startOffset, range.endContainer, range.endOffset);

        expect(muya.getSelection()).toMatchObject({
            anchor: { block: first, offset: 0 },
            focus: { block: first, offset: 5 },
        });
        expect(muya.getSelectedText()).toBe('Alpha');
    });

    it('converts inline element child indexes into source character offsets', () => {
        const muya = boot('Alpha beta gamma\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.domNode!.innerHTML = '<span>Alpha </span><span>beta</span><span> gamma</span>';

        nativeRange(block.domNode!, 1, block.domNode!, 2);

        expect(muya.getSelectedText()).toBe('beta');
        expect(muya.getSelection()).toMatchObject({ anchor: { offset: 6 }, focus: { offset: 10 } });
    });

    it('ignores content from another Muya even when its host is nested inside this editor', () => {
        const outer = boot('Outer\n');
        const inner = boot('Inner\n', outer.domNode);
        const report = vi.fn();
        outer.on('selection-change', report);
        const block = inner.editor.scrollPage!.firstContentInDescendant()!;
        const start = getNodeAndOffset(block.domNode!, 0);
        const end = getNodeAndOffset(block.domNode!, 5);

        nativeRange(start.node, start.offset, end.node, end.offset);

        expect(inner.getSelectedText()).toBe('Inner');
        expect(outer.getSelection()).toBeNull();
        expect(report.mock.calls.every(([change]) => change.type === 'None')).toBe(true);
    });

    it('reports None after ranges are removed and ignores unlinked DOM clones', () => {
        const muya = boot('Alpha\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(0, 5);
        const report = vi.fn();
        muya.on('selection-change', report);

        document.getSelection()!.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
        expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'None', isCollapsed: true }));

        const clone = block.domNode!.cloneNode(true);
        muya.domNode.appendChild(clone);
        nativeRange(clone, 0, clone, clone.childNodes.length);
        expect(muya.getSelection()).toBeNull();
        expect(muya.getSelectedText()).toBe('');
    });

    it('does not expose a native fallback caret as text during a table selection', () => {
        const muya = boot('| a | b |\n| --- | --- |\n| c | d |\n');
        const table = muya.editor.scrollPage!.firstContentInDescendant()!.closestBlock('table') as Table;
        muya.editor.selection.table.selectTable(table);

        nativeRange(muya.domNode, 0, muya.domNode, 0);

        expect(muya.getSelection()).toBeNull();
        expect(muya.getSelectedText()).toBe('a\nb\nc\nd');
    });

    it('detaches the document listener on destroy', () => {
        const muya = boot('Alpha\n');
        const registration = muya.eventCenter.events.find(event => event.event === 'selectionchange')!;
        expect(registration).toBeDefined();
        const remove = vi.spyOn(document, 'removeEventListener');

        muya.destroy();
        editors.pop();

        expect(remove).toHaveBeenCalledWith('selectionchange', registration.listener, registration.capture);
        expect(muya.eventCenter.events).toHaveLength(0);
    });
});
