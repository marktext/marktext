// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// Coverage for the selection-change payload extras added for the
// muyajs -> @muyajs/core desktop migration: `cursorCoords` (typewriter-mode
// scrolling) and `formats` (active inline formats, for lighting up the
// desktop toolbar). The legacy engine put both on its `selectionChange`
// event; the desktop reads `changes.cursorCoords.y` and the format list.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('selection-change payload', () => {
    it('includes cursorCoords and a formats array', () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        let payload: Record<string, unknown> | null = null;
        muya.on('selection-change', (p: unknown) => {
            payload = p as Record<string, unknown>;
        });

        muya.editor.selection.setSelection(
            { offset: 0, block: first, path: first.path },
            { offset: 5, block: first, path: first.path },
        );

        expect(payload).not.toBeNull();
        // cursorCoords is a DOMRect | null (null under happy-dom, which has no
        // real layout) — assert the key is present so the desktop typewriter
        // path always receives it.
        expect(payload!).toHaveProperty('cursorCoords');
        expect(Array.isArray(payload!.formats)).toBe(true);
    });

    it('reports the active inline format when the cursor is inside bold text', () => {
        const muya = bootMuya('**bold**\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        let payload: Record<string, unknown> | null = null;
        muya.on('selection-change', (p: unknown) => {
            payload = p as Record<string, unknown>;
        });

        // `**bold**` — place the selection inside the bolded word (offsets 3–5).
        muya.editor.selection.setSelection(
            { offset: 3, block: first, path: first.path },
            { offset: 5, block: first, path: first.path },
        );

        expect(payload).not.toBeNull();
        const formats = payload!.formats as Array<{ type: string }>;
        expect(formats.some(f => f.type === 'strong')).toBe(true);
    });

    it('reports BOTH strong and em when the cursor is inside overlapping markers', () => {
        // `**_x_**` nests an emphasis token inside a strong token. With the
        // selection inside the shared `x`, `getFormatsInRange` recurses into the
        // strong token's children and surfaces both inline formats so the
        // desktop toolbar lights up bold AND italic at once.
        const muya = bootMuya('**_x_**\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        let payload: Record<string, unknown> | null = null;
        muya.on('selection-change', (p: unknown) => {
            payload = p as Record<string, unknown>;
        });

        // Text is `**_x_**`: `**_` is offsets 0-3, the `x` is offset 3-4, the
        // closing `_**` is 4-7. Select just the `x` (3..4) — inside both ranges.
        muya.editor.selection.setSelection(
            { offset: 3, block: first, path: first.path },
            { offset: 4, block: first, path: first.path },
        );

        expect(payload).not.toBeNull();
        const formats = (payload!.formats as Array<{ type: string }>).map(f => f.type);
        expect(formats).toContain('strong');
        expect(formats).toContain('em');
    });
});
