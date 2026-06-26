// @vitest-environment happy-dom
import type { Muya } from '../../index';
import type BaseFloat from '../baseFloat';
import { describe, expect, it, vi } from 'vitest';
import { Ui } from '../ui';

function makeUi(): Ui {
    const muya = {
        eventCenter: { subscribe: () => {} },
    } as unknown as Muya;

    return new Ui(muya);
}

function fakeFloat(capturesContentKeydown: boolean): BaseFloat {
    return { capturesContentKeydown } as unknown as BaseFloat;
}

function keyEvent(key: string): KeyboardEvent {
    return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

describe('ui.handleContentKeydown', () => {
    it('returns false when no float is shown', () => {
        const ui = makeUi();
        const event = keyEvent('Enter');

        expect(ui.handleContentKeydown(event)).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('returns false for a non-navigation key even when a float is shown', () => {
        const ui = makeUi();
        ui.shownFloat.add(fakeFloat(true));
        const event = keyEvent('a');

        expect(ui.handleContentKeydown(event)).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('lets the block handle the key (and does not preventDefault) for a non-capturing float (#3196)', () => {
        // A passive float (e.g. the inline format toolbar shown on selection)
        // must not block Enter/Tab/arrows from reaching the block handler.
        const ui = makeUi();
        ui.shownFloat.add(fakeFloat(false));
        const event = keyEvent('Enter');

        expect(ui.handleContentKeydown(event)).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('preventDefaults and skips block handling when a capturing float is shown', () => {
        const ui = makeUi();
        ui.shownFloat.add(fakeFloat(false));
        ui.shownFloat.add(fakeFloat(true));
        const event = keyEvent('Enter');

        expect(ui.handleContentKeydown(event)).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    // #3645 / #3824: Shift+ArrowUp/Down extends the native selection. Even when
    // a capturing float (the inline format toolbar) is shown, that must not be
    // swallowed, or selection extension freezes while the toolbar is visible.
    it('does not preventDefault for Shift+ArrowUp/Down when a capturing float is shown', () => {
        const ui = makeUi();
        ui.shownFloat.add(fakeFloat(true));
        const up = { key: 'ArrowUp', shiftKey: true, preventDefault: vi.fn() } as unknown as KeyboardEvent;
        const down = { key: 'ArrowDown', shiftKey: true, preventDefault: vi.fn() } as unknown as KeyboardEvent;

        expect(ui.handleContentKeydown(up)).toBe(false);
        expect(up.preventDefault).not.toHaveBeenCalled();
        expect(ui.handleContentKeydown(down)).toBe(false);
        expect(down.preventDefault).not.toHaveBeenCalled();
    });

    it('still preventDefaults plain ArrowUp/Down for a capturing float', () => {
        const ui = makeUi();
        ui.shownFloat.add(fakeFloat(true));
        const event = keyEvent('ArrowUp');

        expect(ui.handleContentKeydown(event)).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
    });
});
