// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Phase G: the legacy `tableChessboard` (table grid picker) plugin subscribed
// to the `muya-table-picker` event, but nothing in @muyajs/core OR the desktop
// app ever dispatched it (verified across upstream marktext/muya too). It was a
// dead, registered-but-untriggered plugin — table dimensions are chosen via the
// desktop's rows×columns dialog (`Muya.createTable`) and the in-editor
// quick-insert menu inserts a default table directly. These tests pin the
// removal so the dead plugin can't silently creep back.

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

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
});

describe('tableChessboard plugin removal', () => {
    it('is no longer exported from the package entrypoint', async () => {
        const pkg = await import('../../index');
        expect('TableChessboard' in pkg).toBe(false);
    });

    it('does not subscribe to the dead `muya-table-picker` event on boot', async () => {
        const { Muya } = await import('../../muya');
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, { markdown: '\n' } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);

        // Nothing dispatches `muya-table-picker`; assert there is no listener
        // waiting on it either (the chessboard was the only subscriber).
        expect(muya.eventCenter.listeners['muya-table-picker']).toBeUndefined();

        // And dispatching it is a harmless no-op (no throw, no float shown).
        expect(() =>
            muya.eventCenter.emit('muya-table-picker', { row: -1, column: -1 }, host, vi.fn()),
        ).not.toThrow();
    });
});
