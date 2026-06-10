// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// Coverage for the PUBLIC `Format.format()` toggle-OFF and `clear` paths over a
// real engine boot. `formatCursor.spec.ts` pins the apply-side `_addFormat`
// text rewriter at the function level, but the migration audit flagged that
// removing an existing inline format (toggle-off) and the `clear`-all path had
// NO direct coverage — both are the text surgery that, if it miscounts offsets,
// silently corrupts user content. These tests drive `format()` on a booted
// block whose run already carries the format, with the caret resting INSIDE the
// run (the way Ctrl+B-to-un-bold works), and assert the markers are stripped
// while the run's text survives.

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
    // The DOM selection is document-global; a range left pointing into the
    // just-removed host would corrupt the next test's `setCursor`. Clear it so
    // each test starts from a clean selection.
    document.getSelection()?.removeAllRanges();
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

// Rest a collapsed caret at `offset` (in RENDERED-text coordinates — markdown
// markers are hidden) inside the first content block and mark it active, the
// way a click lands the caret inside a formatted run before a Format command.
function caretInFirstBlock(muya: Muya, offset: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(offset, offset, true);
    return content;
}

describe('format.format() toggle-off with the caret inside the formatted run', () => {
    it('strong: `**word**` un-bolds to plain `word`', () => {
        const content = caretInFirstBlock(bootMuya('**word**\n'), 2);
        content.format('strong');
        expect(content.text).toBe('word');
    });

    it('un-bolding also drops the markers from the serialized markdown', async () => {
        const muya = bootMuya('**word**\n');
        caretInFirstBlock(muya, 2).format('strong');
        // getMarkdown() reads the JSON state, which flushes on the next frame.
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('word');
        });
    });

    it('em: `*word*` un-italics to plain `word`', () => {
        const content = caretInFirstBlock(bootMuya('*word*\n'), 2);
        content.format('em');
        expect(content.text).toBe('word');
    });

    it('del: `~~word~~` un-strikes to plain `word`', () => {
        const content = caretInFirstBlock(bootMuya('~~word~~\n'), 2);
        content.format('del');
        expect(content.text).toBe('word');
    });

    it('u (html_tag): `<u>word</u>` removes the underline tags', () => {
        // `format('u')` matches the html_tag token whose tag === 'u'.
        const content = caretInFirstBlock(bootMuya('<u>word</u>\n'), 2);
        content.format('u');
        expect(content.text).toBe('word');
    });

    it('mark (html_tag): `<mark>word</mark>` removes the highlight tags', () => {
        const content = caretInFirstBlock(bootMuya('<mark>word</mark>\n'), 2);
        content.format('mark');
        expect(content.text).toBe('word');
    });
});

describe('format.format(\'clear\') with the caret inside the run', () => {
    it('strips a strong run to plain text', () => {
        const content = caretInFirstBlock(bootMuya('**word**\n'), 2);
        content.format('clear');
        expect(content.text).toBe('word');
    });

    it('unwraps an inline-code run to its raw content', () => {
        const content = caretInFirstBlock(bootMuya('`code`\n'), 2);
        content.format('clear');
        expect(content.text).toBe('code');
        expect(content.text).not.toContain('`');
    });

    it('unwraps a link to its anchor text', () => {
        // Caret rests inside the anchor text `Anthropic`.
        const content = caretInFirstBlock(bootMuya('[Anthropic](https://example.com)\n'), 4);
        content.format('clear');
        expect(content.text).toBe('Anthropic');
        expect(content.text).not.toContain('](');
    });
});
