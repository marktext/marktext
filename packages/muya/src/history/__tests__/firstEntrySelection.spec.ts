// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

const editors: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    vi.useRealTimers();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    editors.push(muya);
    return muya;
}

function contentAt(muya: Muya, index: number): Format {
    const contents: Format[] = [];
    let content = muya.editor.scrollPage!.firstContentInDescendant();
    while (content) {
        contents.push(content as unknown as Format);
        content = (content as unknown as { nextContentInContext: () => typeof content })
            .nextContentInContext();
    }
    return contents[index];
}

function firstContent(muya: Muya): Format {
    return muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
}

function undoStack(muya: Muya) {
    return muya.getHistory().stack.undo;
}

async function editContent(content: Format, text: string, muya: Muya): Promise<void> {
    const target = content as unknown as { text: string; checkInlineUpdate: () => void };
    target.text = text;
    content.setCursor(text.length, text.length, true);
    target.checkInlineUpdate();
    await vi.waitFor(() => {
        expect(muya.getMarkdown()).toContain(text);
    });
}

describe('selection recorded on the first history entry after a load', () => {
    it('captures the caret as it was immediately before the first edit', async () => {
        const muya = bootMuya('seed\n');
        // setContent clears both the undo stack and the selection baseline, which
        // is the state the app leaves the editor in for every opened document.
        muya.setContent('fresh\n');

        // Two caret moves before any edit: the entry must describe the second.
        // Seeding only the first would record a caret the user has since left.
        firstContent(muya).setCursor(1, 1, true);
        firstContent(muya).setCursor(5, 5, true);

        await editContent(firstContent(muya), 'freshly', muya);

        expect(undoStack(muya)).toHaveLength(1);
        expect(undoStack(muya)[0].selection).not.toBeNull();
        expect(undoStack(muya)[0].selection!.anchor.offset).toBe(5);
    });

    it('ignores the caret move an edit makes on its own behalf', async () => {
        const muya = bootMuya('seed\n');
        muya.setContent('fresh\n');
        const content = firstContent(muya);
        content.setCursor(2, 2, true);

        // Mirror the order Format.inputHandler works in: assigning `text` queues
        // the operation, and the caret is moved past the inserted text before that
        // batch flushes. The seed must stay the caret from before the edit.
        const target = content as unknown as { text: string; checkInlineUpdate: () => void };
        target.text = 'freshly';
        content.setCursor(7, 7, true);
        target.checkInlineUpdate();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('freshly');
        });

        expect(undoStack(muya)[0].selection!.anchor.offset).toBe(2);
    });

    it('ignores a selection that resolves to no caret', async () => {
        const muya = bootMuya('seed\n');
        muya.setContent('fresh\n');
        firstContent(muya).setCursor(3, 3, true);

        // An image selection clears the DOM range, so getSelection() reports null.
        // That must not claim the baseline and lock out the real caret.
        document.getSelection()!.removeAllRanges();
        muya.eventCenter.emit('selection-change', null);

        await editContent(firstContent(muya), 'freshly', muya);

        expect(undoStack(muya)[0].selection).not.toBeNull();
        expect(undoStack(muya)[0].selection!.anchor.offset).toBe(3);
    });

    it('restores the caret to the right block when that entry is undone', async () => {
        const muya = bootMuya('seed\n');
        // Two blocks, so the fallback in _restoreSelection (which focuses the
        // first content block) cannot be mistaken for a real restore.
        muya.setContent('first\n\nsecond\n');
        contentAt(muya, 1).setCursor(6, 6, true);

        await editContent(contentAt(muya, 1), 'secondly', muya);
        muya.undo();

        const selection = muya.editor.selection.getSelection();
        expect(selection).not.toBeNull();
        expect(selection!.anchor.block).toBe(contentAt(muya, 1));
        expect(selection!.anchor.offset).toBe(6);
    });

    it('leaves later entries reporting the caret before their own edit', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const muya = bootMuya('seed\n');
        muya.setContent('fresh\n');
        firstContent(muya).setCursor(5, 5, true);

        await editContent(firstContent(muya), 'freshly', muya);

        // Past History's coalescing delay, so the next edit starts its own entry.
        vi.advanceTimersByTime(2000);
        firstContent(muya).setCursor(7, 7, true);
        await editContent(firstContent(muya), 'freshly typed', muya);

        expect(undoStack(muya)).toHaveLength(2);
        // The oldest entry still describes the caret before the FIRST edit, and
        // the newer one comes from the ordinary previous-entry path rather than
        // from the seeding added for the first.
        expect(undoStack(muya)[0].selection!.anchor.offset).toBe(5);
        expect(undoStack(muya)[1].selection!.anchor.offset).toBe(7);
        muya.undo();
        expect(muya.getMarkdown()).toBe('freshly\n');
        expect(muya.editor.selection.getSelection()!.anchor.offset).toBe(7);
    });
});
