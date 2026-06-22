// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollPage } from '../../../scrollPage';
import ThematicBreakContent from '../index';

// Regression #4559: deleting consecutive blocks crashed the renderer with
// `NotFoundError: ... is not a child of this node`. Backspace at offset 0 of a
// thematic break (and Enter at offset 0) convert/insert a block but used to
// forget `event.preventDefault()`. Because the mu-container is contenteditable,
// the browser's native edit then mutated the DOM out from under muya's block
// tree, so a later `insertBefore` on the now-detached node threw. The fix
// mirrors the existing AtxHeadingContent guard.
//
// Exercised with a structurally-typed `this` so no Muya bootstrap is needed.
interface IFakeTBContent {
    text: string;
    muya: unknown;
    cursor: { start: number; end: number };
    parent: { parent: { insertBefore: (block: unknown, ref: unknown) => void } };
    getCursor: () => { start: { offset: number }; end: { offset: number } };
    setCursor: (start: number, end: number) => void;
    convertToParagraph: () => void;
}

function makeFakeContent(cursorAt: number): IFakeTBContent {
    return {
        text: '---',
        muya: {},
        cursor: { start: cursorAt, end: cursorAt },
        parent: { parent: { insertBefore: vi.fn() } },
        getCursor() {
            return {
                start: { offset: this.cursor.start },
                end: { offset: this.cursor.end },
            };
        },
        setCursor(start, end) {
            this.cursor = { start, end };
        },
        convertToParagraph: vi.fn(),
    };
}

function makeKeyEvent() {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
}

describe('thematicBreakContent handlers — block native DOM mutation (#4559)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('backspaceHandler at offset 0 calls preventDefault before converting', () => {
        const content = makeFakeContent(0);
        const event = makeKeyEvent();

        ThematicBreakContent.prototype.backspaceHandler.call(
            content as unknown as ThematicBreakContent,
            event,
        );

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(content.convertToParagraph).toHaveBeenCalledTimes(1);
    });

    it('enterHandler at offset 0 calls preventDefault and stopPropagation before inserting', () => {
        const create = vi.fn().mockReturnValue({});
        vi.spyOn(ScrollPage, 'loadBlock').mockReturnValue({ create } as never);

        const content = makeFakeContent(0);
        const event = makeKeyEvent();

        ThematicBreakContent.prototype.enterHandler.call(
            content as unknown as ThematicBreakContent,
            event,
        );

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(content.parent.parent.insertBefore).toHaveBeenCalledTimes(1);
    });
});
