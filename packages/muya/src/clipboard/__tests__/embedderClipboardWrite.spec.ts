// @vitest-environment happy-dom

import type { Muya } from '../../muya';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// happy-dom does not implement `document.execCommand`; install a mock so each
// test can assert whether the copy path fell back to it.
let execCommand: ReturnType<typeof vi.fn>;
beforeEach(() => {
    execCommand = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;
});

// `copyAsRich` / `copyAsHtml` used to rely on `document.execCommand('copy')`,
// which no-ops when triggered from a main->renderer IPC message (menu /
// context menu) in Electron 42 Chromium — same tightening that broke
// `execCommand('paste')`. The embedder now supplies a `clipboardWrite` hook
// (backed by Electron's native clipboard) so the slots reach the OS clipboard
// without depending on a synthetic copy event.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

const Clipboard = (await import('../index')).default;

function fakeMuya(options: Record<string, unknown> = {}) {
    return {
        options: { frontMatter: true, ...options },
        editor: { selection: { image: null } },
    } as unknown as Muya;
}

function clipboardWithData(html: string, text: string, muya: Muya) {
    const clipboard = new Clipboard(muya);
    clipboard.getClipboardData = () => ({ html, text });
    return clipboard;
}

describe('copyAs* write through the clipboardWrite embedder hook', () => {
    it('copyAsRich sends rendered html + markdown to clipboardWrite, not execCommand', () => {
        const clipboardWrite = vi.fn();
        const clipboard = clipboardWithData('<p>hi</p>', 'hi', fakeMuya({ clipboardWrite }));
        clipboard.copyAsRich();

        expect(clipboardWrite).toHaveBeenCalledWith({ html: '<p>hi</p>', text: 'hi' });
        expect(execCommand).not.toHaveBeenCalled();
    });

    it('copyAsHtml sends sanitized html in the text slot and blanks the html slot', () => {
        const clipboardWrite = vi.fn();
        const clipboard = clipboardWithData('', '# Heading\n\nhello', fakeMuya({ clipboardWrite }));

        clipboard.copyAsHtml();

        expect(clipboardWrite).toHaveBeenCalledTimes(1);
        const arg = clipboardWrite.mock.calls[0][0] as { html: string; text: string };
        expect(arg.html).toBe('');
        expect(arg.text).toContain('<h1');
        expect(arg.text).toContain('hello');
    });

    it('does not write (leaves clipboard untouched) when the selection is empty', () => {
        const clipboardWrite = vi.fn();
        const clipboard = clipboardWithData('', '', fakeMuya({ clipboardWrite }));
        clipboard.copyAsRich();

        expect(clipboardWrite).not.toHaveBeenCalled();
        expect(execCommand).not.toHaveBeenCalled();
    });

    it('falls back to execCommand("copy") when no clipboardWrite hook is provided', () => {
        const clipboard = clipboardWithData('<p>hi</p>', 'hi', fakeMuya());

        clipboard.copyAsRich();

        expect(execCommand).toHaveBeenCalledWith('copy');
    });
});
