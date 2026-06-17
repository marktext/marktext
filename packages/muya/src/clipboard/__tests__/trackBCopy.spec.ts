// @vitest-environment happy-dom

import type { ImageToken } from '../../inlineRenderer/types';
import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';
import { CopyType } from '../types';

// Track B — Copy (clipboard chain step 1). Ports `packages/muyajs`
// `copyCutCtrl.copyHandler` behaviour into `@muyajs/core`:
//   1. `normal` copy writes ONLY text/plain (markdown source); text/html is
//      blanked so an internal copy → paste round-trips through the markdown
//      branch losslessly and external pastes land as markdown source.
//   2. `copyAsHtml` writes the DOMPurify-sanitized rendered HTML into
//      text/plain and blanks text/html, with the empty-guard keyed on `text`.
//   3. A selected inline image copies its raw `![alt](src)` markdown.

// The clipboard module pulls in CodeBlockContent → utils/prism which touches
// `window` at import time. Stub the prism shim (same stub as the sibling
// clipboard specs).
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
        event: {
            clipboardData: { setData },
        } as unknown as ClipboardEvent,
        setData,
    };
}

function dataFor(setData: ReturnType<typeof vi.fn>, format: string) {
    const call = setData.mock.calls.find(([f]) => f === format);
    return call ? call[1] : undefined;
}

function fakeMuya(overrides: Partial<Muya> = {}) {
    return {
        options: { frontMatter: true },
        editor: { selection: { image: null } },
        ...overrides,
    } as unknown as Muya;
}

function clipboardWithData(html: string, text: string, muya: Muya = fakeMuya()) {
    const clipboard = new Clipboard(muya);
    clipboard.getClipboardData = () => ({ html, text });
    return clipboard;
}

describe('track B — normal copy writes only text/plain', () => {
    it('blanks text/html and writes markdown source to text/plain', () => {
        const clipboard = clipboardWithData('<p>hi</p>', 'hi');
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(dataFor(setData, 'text/html')).toBe('');
        expect(dataFor(setData, 'text/plain')).toBe('hi');
    });

    it('skips setData entirely when the selection is empty', () => {
        const clipboard = clipboardWithData('', '');
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).not.toHaveBeenCalled();
    });

    it('round-trips: a normal copy produces markdown that pastes losslessly', () => {
        // text/html empty means `getCopyTextType` classifies the paste as
        // `onlyMarkdown`, so the markdown source is re-inserted verbatim.
        const markdown = '**bold** and `code`';
        const clipboard = clipboardWithData('<p><strong>bold</strong></p>', markdown);
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(dataFor(setData, 'text/html')).toBe('');
        expect(dataFor(setData, 'text/plain')).toBe(markdown);
    });
});

describe('track B — copyAsRich still writes both slots', () => {
    it('keeps rendered html in text/html and markdown in text/plain', () => {
        const clipboard = clipboardWithData('<p>hi</p>', 'hi');
        clipboard.copyType = CopyType.COPY_AS_RICH;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(dataFor(setData, 'text/html')).toBe('<p>hi</p>');
        expect(dataFor(setData, 'text/plain')).toBe('hi');
    });
});

describe('track B — copyAsHtml is sanitized and text-guarded', () => {
    it('writes sanitized rendered HTML to text/plain, blanks text/html', () => {
        const clipboard = clipboardWithData('', '# Heading\n\nhello');
        clipboard.copyType = CopyType.COPY_AS_HTML;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(dataFor(setData, 'text/html')).toBe('');
        const plain = dataFor(setData, 'text/plain') as string;
        expect(plain).toContain('<h1');
        expect(plain).toContain('hello');
    });

    it('neutralises XSS payloads in the exported html (DOMPurify)', () => {
        // muyajs `getSanitizeHtml` runs `sanitize(html, EXPORT_DOMPURIFY_CONFIG,
        // false)`, which escapes raw in-block HTML rather than dropping it. The
        // guarantee is no LIVE `<script>` element survives — the markup is
        // escaped to inert text.
        const clipboard = clipboardWithData('', 'before\n\n<script>alert(1)</script>\n\nafter');
        clipboard.copyType = CopyType.COPY_AS_HTML;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        const plain = dataFor(setData, 'text/plain') as string;
        expect(plain).not.toContain('<script>');
        expect(plain).toContain('&lt;script&gt;');
    });

    it('guards on `text` being empty, not html', () => {
        // html empty but text non-empty: legacy guarded on text, so it MUST
        // still copy. (muya previously returned early on empty html.)
        const clipboard = clipboardWithData('', 'plain text');
        clipboard.copyType = CopyType.COPY_AS_HTML;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).toHaveBeenCalled();
        expect(dataFor(setData, 'text/plain')).toBeTruthy();
    });

    it('skips when text is empty', () => {
        const clipboard = clipboardWithData('', '');
        clipboard.copyType = CopyType.COPY_AS_HTML;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).not.toHaveBeenCalled();
    });
});

describe('track B — selected inline image copies its raw markdown', () => {
    function imageToken(raw: string): ImageToken {
        return { type: 'image', raw } as unknown as ImageToken;
    }

    it('writes `![alt](src)` to both slots and short-circuits', () => {
        const raw = '![alt](https://e.com/x.png)';
        const muya = fakeMuya({
            editor: {
                selection: { image: { token: imageToken(raw) } },
            },
        } as unknown as Partial<Muya>);
        const clipboard = new Clipboard(muya);
        const getData = vi.fn(() => ({ html: 'SHOULD_NOT_RUN', text: 'SHOULD_NOT_RUN' }));
        clipboard.getClipboardData = getData;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(dataFor(setData, 'text/html')).toBe(raw);
        expect(dataFor(setData, 'text/plain')).toBe(raw);
        expect(getData).not.toHaveBeenCalled();
    });

    it('does nothing for an image with empty raw', () => {
        const muya = fakeMuya({
            editor: {
                selection: { image: { token: imageToken('') } },
            },
        } as unknown as Partial<Muya>);
        const clipboard = new Clipboard(muya);
        clipboard.getClipboardData = () => ({ html: '', text: '' });
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).not.toHaveBeenCalled();
    });
});
