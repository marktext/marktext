// @vitest-environment happy-dom

import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';

// PARITY SCOREBOARD — gap PG9 (file PG-COPYRICH).
//
// Legacy `packages/muyajs` "Copy as Rich Text" put the rendered HTML into
// `text/html` (so pasting into Word / email yields formatted rich text) plus
// the markdown source into `text/plain`.
//
// `@muyajs/core` exposes no `copyAsRich` path. The desktop renderer maps
// `copyAsRich` → `copyAsHtml`, whose `copyHandler` branch does
// `setData('text/html', '')` + `setData('text/plain', html)` — pasting yields
// the raw HTML markup as literal text, NOT rich text. The engine's `normal`
// copyType already does the rich thing (`text/html = html`,
// `text/plain = text`) but is not exposed as a method/copyType.
//
// These tests assert the DESIRED `copyAsRich` behaviour. The engine now adds
// the `copyAsRich` copyType in `copyHandler` plus the `copyAsRich()` method on
// `Clipboard`/`Muya` (PG-COPYRICH), so they pass.

// The clipboard module pulls in CodeBlockContent → utils/prism which touches
// `window` at import time. Stub the prism shim so the test can run under Node.
vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

const Clipboard = (await import('../index')).default;

function makeEvent() {
    const setData = vi.fn();
    return {
        event: { clipboardData: { setData } } as unknown as ClipboardEvent,
        setData,
    };
}

function makeClipboard(html: string, text: string) {
    const clipboard = new Clipboard({} as Muya);
    clipboard.getClipboardData = () => ({ html, text });
    return clipboard;
}

describe('parity PG9: copyAsRich writes rendered HTML as rich text', () => {
    it(
        'PG9: copyAsRich sets text/html=rendered html AND text/plain=text',
        () => {
            const html = '<h1>Title</h1><p><strong>bold</strong></p>';
            const text = '# Title\n\n**bold**';
            const clipboard = makeClipboard(html, text);
            clipboard.copyType = 'copyAsRich';
            const { event, setData } = makeEvent();

            clipboard.copyHandler(event);

            // Desired: rich-text contract — html in the html slot (so a
            // rich-text target renders it), source in the plain slot.
            expect(setData).toHaveBeenCalledWith('text/html', html);
            expect(setData).toHaveBeenCalledWith('text/plain', text);
        },
    );

    it(
        'PG9: copyAsRich puts the rendered HTML in the text/html slot (unlike copyAsHtml)',
        () => {
            const html = '<p>rich</p>';
            const text = 'rich';

            // copyAsHtml (the current mapping target) blanks text/html and puts
            // the markup into text/plain — pasting yields literal markup.
            const asHtmlClip = makeClipboard(html, text);
            asHtmlClip.copyType = 'copyAsHtml';
            const asHtml = makeEvent();
            asHtmlClip.copyHandler(asHtml.event);
            const asHtmlHtmlSlot = asHtml.setData.mock.calls.find(
                c => c[0] === 'text/html',
            )?.[1];
            expect(asHtmlHtmlSlot).toBe('');

            // copyAsRich must instead place the real rendered HTML in the html
            // slot so a rich-text target renders it.
            const asRichClip = makeClipboard(html, text);
            asRichClip.copyType = 'copyAsRich';
            const asRich = makeEvent();
            asRichClip.copyHandler(asRich.event);
            const asRichHtmlSlot = asRich.setData.mock.calls.find(
                c => c[0] === 'text/html',
            )?.[1];
            expect(asRichHtmlSlot).toBe(html);
        },
    );
});
