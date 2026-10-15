// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXPORT_DOMPURIFY_CONFIG } from '../../config';
import { sanitize } from '../../utils';
import { resolveExportImageSrc } from '../../utils/fileUrl';
import { getSanitizeClipboardHtml } from '../../utils/marked';
import { MarkdownToHtml } from '../markdownToHtml';
import { renderToStaticHTML } from '../renderToStaticHTML';

// Exported `<img>` srcs are resolved to absolute `file://` URLs while DOMPurify
// sanitizes, before it validates them. A Windows drive path used to reach the
// allowlist as `C:%5C…`, read as an unknown `c:` scheme, and lose its src
// (#3323); relative paths were patched up by the desktop after sanitizing.

beforeEach(() => {
    window.DIRNAME = '/docs';
});

afterEach(() => {
    window.DIRNAME = undefined;
});

const renderers: [string, (markdown: string) => Promise<string> | string][] = [
    ['MarkdownToHtml (HTML / PDF / print export)', markdown => new MarkdownToHtml(markdown).generate()],
    ['renderToStaticHTML', markdown => renderToStaticHTML(markdown)],
];

describe.each(renderers)('%s — image src resolution', (_name, render) => {
    it.each([
        ['a drive path with backslashes (#3323)', '![photo](<C:\\Users\\Alice\\Pictures\\photo.png>)', 'file:///C:/Users/Alice/Pictures/photo.png'],
        ['a drive path with forward slashes', '![photo](C:/Users/Alice/Pictures/photo.png)', 'file:///C:/Users/Alice/Pictures/photo.png'],
        ['a drive path with spaces', '![photo](<C:\\Users\\Alice\\My Pictures\\photo.png>)', 'file:///C:/Users/Alice/My%20Pictures/photo.png'],
        ['a reference definition', '![photo][pic]\n\n[pic]: <C:\\pics\\photo.png>', 'file:///C:/pics/photo.png'],
        ['a relative path (issue 230)', '![photo](./img/photo.png)', 'file:///docs/img/photo.png'],
        ['a relative path with backslashes (#5714)', '![photo](img\\photo.png)', 'file:///docs/img/photo.png'],
        ['a raw <img> with a drive path', '<img src="C:\\pics\\photo.png" width="200">', 'file:///C:/pics/photo.png'],
        ['a raw <img> with a relative path', '<img src="img/photo.png" width="200">', 'file:///docs/img/photo.png'],
    ])('resolves %s', async (_case, markdown, expected) => {
        expect(await render(markdown)).toContain(`src="${expected}"`);
    });

    it('leaves a remote image untouched', async () => {
        expect(await render('![photo](https://example.com/photo.png)')).toContain('src="https://example.com/photo.png"');
    });

    it('still strips a script URL', async () => {
        const html = await render('![photo](javascript:alert%281%29)');
        expect(html).not.toContain('javascript:');
    });

    it('does not resolve a script URL with an image extension as a relative path', async () => {
        const html = await render('<img src="javascript:alert(1)//a.png">');
        expect(html).not.toContain('javascript:');
    });
});

describe('the export image hook is scoped to export sanitizing', () => {
    it('does not resolve images when renderToStaticHTML skips sanitizing', () => {
        expect(renderToStaticHTML('![photo](./img/photo.png)', { sanitize: false })).toContain('src="./img/photo.png"');
    });

    // The copied markup is pasted into other sites, where an absolute local
    // path would be useless and would leak the user's folder layout.
    it('leaves image paths as written in Copy as HTML', () => {
        expect(getSanitizeClipboardHtml('![photo](./img/photo.png)')).toContain('src="./img/photo.png"');
    });

    it('is detached from the shared purifier after an export', async () => {
        await new MarkdownToHtml('![photo](./img/photo.png)').generate();
        expect(sanitize('<img src="./img/photo.png">', EXPORT_DOMPURIFY_CONFIG, false)).toContain('src="./img/photo.png"');
    });
});

describe('resolveExportImageSrc', () => {
    it.each([
        ['/tmp/b.png', 'file:///tmp/b.png'],
        ['/tmp/b.png?v=2', 'file:///tmp/b.png?v=2'],
        ['C:\\pics\\b.png', 'file:///C:/pics/b.png'],
        ['C:%5Cpics%5cb.png', 'file:///C:/pics/b.png'],
        ['\\\\host\\share\\c.png', 'file://host/share/c.png'],
        ['%5C%5Chost%5Cshare%5Cc.png', 'file://host/share/c.png'],
        ['../img/a.png', 'file:///img/a.png'],
    ])('resolves %s', (src, expected) => {
        expect(resolveExportImageSrc(src)).toBe(expected);
    });

    it.each([
        '',
        'https://example.com/a.png',
        'https://example.com/assets%5Cimage.png',
        'file:///docs/a.png',
        'data:image/png;base64,iVBORw0KGgo=',
        'javascript:alert(1)//a.png',
        '/api/image?id=1',
    ])('leaves %s unchanged', (src) => {
        expect(resolveExportImageSrc(src)).toBe(src);
    });

    it('leaves a relative path unchanged without a document directory', () => {
        window.DIRNAME = undefined;
        expect(resolveExportImageSrc('img/a.png')).toBe('img/a.png');
    });

    it('keeps the host of a WSL UNC document directory', () => {
        window.DIRNAME = '\\\\wsl.localhost\\Ubuntu-24.04\\home\\me\\docs';
        expect(resolveExportImageSrc('./img/my_image.png')).toBe(
            'file://wsl.localhost/Ubuntu-24.04/home/me/docs/img/my_image.png',
        );
    });

    it('escapes #, ? and % in the document directory (#5335)', () => {
        window.DIRNAME = '/home/me/C# 100%25 what?';
        const url = new URL(resolveExportImageSrc('assets/cat.png'));
        expect(decodeURIComponent(url.pathname)).toBe('/home/me/C# 100%25 what?/assets/cat.png');
        expect(url.hash).toBe('');
        expect(url.search).toBe('');
    });

    it('keeps the query and the already-encoded characters of the image path', () => {
        window.DIRNAME = '/home/me/C#';
        expect(resolveExportImageSrc('my%20cat.png?v=2')).toBe('file:///home/me/C%23/my%20cat.png?v=2');
    });
});
