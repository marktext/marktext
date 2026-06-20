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

    it('skips block handling but does not preventDefault for a non-capturing float', () => {
        const ui = makeUi();
        ui.shownFloat.add(fakeFloat(false));
        const event = keyEvent('Enter');

        expect(ui.handleContentKeydown(event)).toBe(true);
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
});
