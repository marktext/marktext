import { describe, expect, it, vi } from 'vitest';
import LangInputContent from '../index';

function makeFakeEvent() {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as Event;
}

describe('langInputContent.enterHandler', () => {
    it('preventDefault + stopPropagation and moves caret to parent.lastContentInDescendant(0,0)', () => {
        const lastContent = { setCursor: vi.fn() };
        const fakeThis = {
            parent: {
                lastContentInDescendant: vi.fn(() => lastContent),
            },
        };
        const event = makeFakeEvent();

        LangInputContent.prototype.enterHandler.call(
            fakeThis as unknown as LangInputContent,
            event,
        );

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(fakeThis.parent.lastContentInDescendant).toHaveBeenCalledTimes(1);
        expect(lastContent.setCursor).toHaveBeenCalledWith(0, 0);
    });

    it('does not throw when parent.lastContentInDescendant() returns null', () => {
        const fakeThis = {
            parent: {
                lastContentInDescendant: vi.fn(() => null),
            },
        };
        const event = makeFakeEvent();

        expect(() =>
            LangInputContent.prototype.enterHandler.call(
                fakeThis as unknown as LangInputContent,
                event,
            ),
        ).not.toThrow();

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    });
});

describe('langInputContent.backspaceHandler', () => {
    it('firefox single-char branch: cursor {1,1} with text length 1 → preventDefault + updateLanguage("")', () => {
        const fakeThis = {
            text: 'a',
            getCursor: vi.fn(() => ({
                start: { offset: 1 },
                end: { offset: 1 },
            })),
            _updateLanguage: vi.fn(),
            previousContentInContext: vi.fn(() => null),
        };
        const event = makeFakeEvent();

        LangInputContent.prototype.backspaceHandler.call(
            fakeThis as unknown as LangInputContent,
            event,
        );

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(fakeThis._updateLanguage).toHaveBeenCalledWith('');
        expect(fakeThis.previousContentInContext).not.toHaveBeenCalled();
    });

    it('cursor {0,0} with a previousContentInContext → caret to that block end, preventDefault', () => {
        const previousBlock = {
            text: 'previous',
            setCursor: vi.fn(),
        };
        const fakeThis = {
            text: 'js',
            getCursor: vi.fn(() => ({
                start: { offset: 0 },
                end: { offset: 0 },
            })),
            _updateLanguage: vi.fn(),
            previousContentInContext: vi.fn(() => previousBlock),
        };
        const event = makeFakeEvent();

        LangInputContent.prototype.backspaceHandler.call(
            fakeThis as unknown as LangInputContent,
            event,
        );

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        const offset = previousBlock.text.length;
        expect(previousBlock.setCursor).toHaveBeenCalledWith(offset, offset, true);
        expect(fakeThis._updateLanguage).not.toHaveBeenCalled();
    });

    it('cursor {0,0} with NO previousContentInContext → preventDefault, no caret move, no throw', () => {
        const fakeThis = {
            text: 'js',
            getCursor: vi.fn(() => ({
                start: { offset: 0 },
                end: { offset: 0 },
            })),
            _updateLanguage: vi.fn(),
            previousContentInContext: vi.fn(() => null),
        };
        const event = makeFakeEvent();

        expect(() =>
            LangInputContent.prototype.backspaceHandler.call(
                fakeThis as unknown as LangInputContent,
                event,
            ),
        ).not.toThrow();

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(fakeThis.previousContentInContext).toHaveBeenCalledTimes(1);
        expect(fakeThis._updateLanguage).not.toHaveBeenCalled();
    });

    it('cursor in the middle (e.g. {1,1} text length > 1) → neither branch fires, no preventDefault', () => {
        const fakeThis = {
            text: 'java',
            getCursor: vi.fn(() => ({
                start: { offset: 1 },
                end: { offset: 1 },
            })),
            _updateLanguage: vi.fn(),
            previousContentInContext: vi.fn(() => null),
        };
        const event = makeFakeEvent();

        LangInputContent.prototype.backspaceHandler.call(
            fakeThis as unknown as LangInputContent,
            event,
        );

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(fakeThis._updateLanguage).not.toHaveBeenCalled();
        expect(fakeThis.previousContentInContext).not.toHaveBeenCalled();
    });
});
