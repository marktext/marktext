import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';
import { CopyType } from '../types';

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

const ClipboardModule = await import('../index');
const Clipboard = ClipboardModule.default;

// Regression for marktext commit c841facd (#3130).
// `Clipboard.copyHandler` previously wrote the clipboard even when the
// selection produced an empty string, clobbering whatever the user had
// stashed there from another source. The fix mirrors native behavior:
// skip `setData` entirely when there's nothing to copy.

function makeEvent() {
    const setData = vi.fn();
    return {
        event: {
            clipboardData: {
                setData,
            },
        } as unknown as ClipboardEvent,
        setData,
    };
}

function makeClipboard(html: string, text: string) {
    const clipboard = new Clipboard({} as Muya);
    clipboard.getClipboardData = () => ({ html, text });
    return clipboard;
}

describe('clipboard.copyHandler — skip empty clipboard writes', () => {
    it('normal copy: does not call setData when both html and text are empty', () => {
        const clipboard = makeClipboard('', '');
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).not.toHaveBeenCalled();
    });

    it('normal copy: writes markdown source to text/plain and blanks text/html', () => {
        // Track B / D1: a `normal` copy writes ONLY the markdown source to
        // text/plain and blanks text/html (legacy `copyCutCtrl.copyHandler`),
        // so an external paste lands as markdown and an internal copy → paste
        // round-trips through the markdown branch losslessly.
        const clipboard = makeClipboard('<p>hi</p>', 'hi');
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).toHaveBeenCalledWith('text/html', '');
        expect(setData).toHaveBeenCalledWith('text/plain', 'hi');
    });

    it('copyAsMarkdown: does not call setData when text is empty', () => {
        const clipboard = makeClipboard('', '');
        clipboard.copyType = CopyType.COPY_AS_MARKDOWN;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).not.toHaveBeenCalled();
    });

    it('copyAsHtml: does not call setData when html is empty', () => {
        const clipboard = makeClipboard('', '');
        clipboard.copyType = CopyType.COPY_AS_HTML;
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).not.toHaveBeenCalled();
    });

    it('copyCodeContent: does not call setData when copyInfo is empty', () => {
        const clipboard = new Clipboard({} as Muya);
        clipboard.copyType = CopyType.COPY_CODE_CONTENT;
        clipboard.copyInfo = '';
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).not.toHaveBeenCalled();
    });

    it('copyCodeContent: writes plain text when copyInfo is non-empty', () => {
        const clipboard = new Clipboard({} as Muya);
        clipboard.copyType = CopyType.COPY_CODE_CONTENT;
        clipboard.copyInfo = 'console.log("x")';
        const { event, setData } = makeEvent();

        clipboard.copyHandler(event);

        expect(setData).toHaveBeenCalledWith('text/html', '');
        expect(setData).toHaveBeenCalledWith('text/plain', 'console.log("x")');
    });
});
