// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSanitizeClipboardHtml } from '../../utils/marked';
import { MarkdownToHtml } from '../markdownToHtml';
import { renderToStaticHTML } from '../renderToStaticHTML';

// #3323: a Windows drive image path reached the export sanitizer as
// `C:%5C…`, which DOMPurify read as an unknown `c:` scheme and stripped.
// Every DOMPurify-sanitized HTML renderer must turn it into a `file:///` URL
// first, the way the legacy marked image renderer did (#1997).

const platform = vi.hoisted(() => ({ isWin: true }));

vi.mock('../../config', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../config')>();
    return {
        ...actual,
        get isWin() {
            return platform.isWin;
        },
    };
});

afterEach(() => {
    platform.isWin = true;
});

const renderers: [string, (markdown: string) => Promise<string> | string][] = [
    ['MarkdownToHtml (HTML / PDF / print export)', markdown => new MarkdownToHtml(markdown).generate()],
    ['renderToStaticHTML', markdown => renderToStaticHTML(markdown)],
    ['getSanitizeClipboardHtml (copy as HTML)', markdown => getSanitizeClipboardHtml(markdown)],
];

describe.each(renderers)('%s — Windows drive image paths (#3323)', (_name, render) => {
    it.each([
        ['backslashes', '![photo](<C:\\Users\\Alice\\Pictures\\photo.png>)', 'file:///C:/Users/Alice/Pictures/photo.png'],
        ['forward slashes', '![photo](C:/Users/Alice/Pictures/photo.png)', 'file:///C:/Users/Alice/Pictures/photo.png'],
        ['spaces', '![photo](<C:\\Users\\Alice\\My Pictures\\photo.png>)', 'file:///C:/Users/Alice/My%20Pictures/photo.png'],
        ['a reference definition', '![photo][pic]\n\n[pic]: <C:\\pics\\photo.png>', 'file:///C:/pics/photo.png'],
    ])('keeps a drive path written with %s', async (_case, markdown, expected) => {
        expect(await render(markdown)).toContain(`src="${expected}"`);
    });

    it('still strips a script URL', async () => {
        const html = await render('![photo](javascript:alert%281%29)');
        expect(html).not.toContain('javascript:');
    });

    it('does not invent a file URL off Windows', async () => {
        platform.isWin = false;
        expect(await render('![photo](C:/pics/photo.png)')).not.toContain('file:///');
    });
});
