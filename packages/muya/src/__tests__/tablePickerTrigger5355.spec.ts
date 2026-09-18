// @vitest-environment happy-dom

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceBlockByLabel } from '../block/blockTransforms';
import { Muya } from '../muya';

// The table grid stays open while the document changes under it: typing, undo
// and redo. A pick must turn the block that opened the grid into the table,
// never the block that holds the caret, and only while that block is still in
// the document holding its text from when the grid opened, or nothing. Any
// other pick changes nothing at all, including the caret (#5355).

const bootedMuyas: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    delete (window as Partial<Window>).MUYA_VERSION;
});

type TPick = (row: number, column: number) => void;

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

function contentWithText(muya: Muya, text: string): Content {
    let leaf = muya.editor.scrollPage!.firstContentInDescendant();
    while (leaf && leaf.text !== text)
        leaf = leaf.nextContentInContext() ?? null;
    if (!leaf)
        throw new Error(`no content block with text "${text}"`);
    return leaf;
}

function openGrid(muya: Muya, trigger: Parent): TPick {
    let pick: TPick | null = null;
    muya.eventCenter.subscribe('muya-table-picker', (_data: unknown, _reference: unknown, cb: TPick) => {
        pick = cb;
    });
    replaceBlockByLabel({ block: trigger, muya, label: 'table' });
    if (!pick)
        throw new Error('the table grid was not requested');
    return pick;
}

// Enter at the end of "Hello" and typing "/" as the file's first edit, then
// opening the grid from that line, as the `/` menu's Table entry does.
function openGridFromSlashLine(muya: Muya): { trigger: Parent; pick: TPick } {
    const hello = contentWithText(muya, 'Hello');
    hello.setCursor(hello.text.length, hello.text.length, true);
    muya.insertParagraph('after', '/');
    muya.editor.jsonState.flush();
    const trigger = contentWithText(muya, '/').parent!;
    return { trigger, pick: openGrid(muya, trigger) };
}

function pickAndFlush(muya: Muya, pick: TPick) {
    pick(1, 1);
    muya.editor.jsonState.flush();
}

// Everything a pick could move: what muya believes the caret is, and where the
// browser's focus sits.
function caretOf(muya: Muya) {
    const { editor } = muya;
    const { anchorBlock, focusBlock, anchor, focus } = editor.selection;
    return {
        activeContentBlock: editor.activeContentBlock,
        anchorBlock,
        focusBlock,
        anchorOffset: anchor?.offset,
        focusOffset: focus?.offset,
        activeElement: document.activeElement,
    };
}

const TABLE_2X2 = '|     |     |\n| --- | --- |\n|     |     |\n';

describe('table grid pick (#5355)', () => {
    it('replaces the empty paragraph that opened the grid, not the paragraph holding the caret', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const hello = contentWithText(muya, 'Hello');
        hello.setCursor(5, 5, true);
        muya.insertParagraph('after');
        muya.editor.jsonState.flush();
        const trigger = contentWithText(muya, '').parent!;
        const world = contentWithText(muya, 'World');
        world.setCursor(5, 5, true);

        pickAndFlush(muya, openGrid(muya, trigger));

        expect(muya.getMarkdown()).toBe(`Hello\n\n${TABLE_2X2}\nWorld\n`);
    });

    it('changes nothing, caret included, once undo removed the line that opened the grid', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const { pick } = openGridFromSlashLine(muya);
        muya.undo();
        expect(muya.editor.activeContentBlock?.outMostBlock).toBeNull();
        const before = caretOf(muya);

        expect(() => pickAndFlush(muya, pick)).not.toThrow();

        expect(muya.getMarkdown()).toBe('Hello\n\nWorld\n');
        expect(caretOf(muya)).toEqual(before);
    });

    it('leaves the caret alone when the pick is ignored and the caret is elsewhere in the document', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const { pick } = openGridFromSlashLine(muya);
        contentWithText(muya, 'World').setCursor(2, 2, true);
        muya.undo();
        const before = caretOf(muya);

        pickAndFlush(muya, pick);

        expect(muya.getMarkdown()).toBe('Hello\n\nWorld\n');
        expect(caretOf(muya)).toEqual(before);
        expect(before.anchorBlock?.text).toBe('World');
        expect(before.anchorOffset).toBe(2);
    });

    it('changes nothing after undo then redo re-created the line as another block', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const { trigger, pick } = openGridFromSlashLine(muya);
        muya.undo();
        muya.redo();
        expect(muya.getMarkdown()).toBe('Hello\n\n/\n\nWorld\n');
        expect(trigger.outMostBlock).toBeNull();

        pickAndFlush(muya, pick);

        expect(muya.getMarkdown()).toBe('Hello\n\n/\n\nWorld\n');
    });

    it('keeps a line of the same text that moved into the place of the line undo removed', () => {
        const muya = bootMuya('Hello\n\n/\n\nWorld\n');
        const { pick } = openGridFromSlashLine(muya);
        expect(muya.getMarkdown()).toBe('Hello\n\n/\n\n/\n\nWorld\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe('Hello\n\n/\n\nWorld\n');

        pickAndFlush(muya, pick);

        expect(muya.getMarkdown()).toBe('Hello\n\n/\n\nWorld\n');
    });

    it('ignores the pick once setContent loaded another document with the same line at that place', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const { pick } = openGridFromSlashLine(muya);
        muya.setContent('Other\n\n/\n\nDoc\n');

        expect(() => pickAndFlush(muya, pick)).not.toThrow();

        expect(muya.getMarkdown()).toBe('Other\n\n/\n\nDoc\n');
    });

    it('keeps real text that replaced the query in the line that opened the grid', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const { trigger, pick } = openGridFromSlashLine(muya);
        trigger.firstContentInDescendant()!.text = 'Important';
        muya.editor.jsonState.flush();

        pickAndFlush(muya, pick);

        expect(muya.getMarkdown()).toBe('Hello\n\nImportant\n\nWorld\n');
    });

    it('still replaces the line that opened the grid once its query was deleted', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const { trigger, pick } = openGridFromSlashLine(muya);
        trigger.firstContentInDescendant()!.text = '';
        muya.editor.jsonState.flush();

        pickAndFlush(muya, pick);

        expect(muya.getMarkdown()).toBe(`Hello\n\n${TABLE_2X2}\nWorld\n`);
    });

    it('does not open the grid from a block that is no longer in the document', () => {
        const muya = bootMuya('- one\n- two\n');
        const nested = contentWithText(muya, 'one').parent!;
        muya.editor.scrollPage!.firstChild!.remove();
        const emit = vi.spyOn(muya.eventCenter, 'emit');

        expect(() => replaceBlockByLabel({ block: nested, muya, label: 'table' })).not.toThrow();

        expect(emit).not.toHaveBeenCalledWith('muya-table-picker', expect.anything(), expect.anything(), expect.anything());
    });

    it('createTable ignores an explicit block that is no longer in the document', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        const world = contentWithText(muya, 'World');
        world.setCursor(5, 5, true);
        const removed = contentWithText(muya, 'Hello').parent!;
        removed.remove();
        muya.editor.jsonState.flush();

        expect(() => muya.createTable({ rows: 2, columns: 2 }, { replace: true, block: removed })).not.toThrow();
        muya.editor.jsonState.flush();

        expect(muya.getMarkdown()).toBe('World\n');
    });
});
