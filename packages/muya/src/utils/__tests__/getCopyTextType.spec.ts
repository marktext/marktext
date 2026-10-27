import { describe, expect, it, vi } from 'vitest';
import { PasteType } from '../../clipboard/types';
import { getCopyTextType, resolveClipboardImagePath } from '../paste';

describe('getCopyTextType — pre-existing classifier behaviour stays put', () => {
    it('returns html when both html and text are present', () => {
        expect(getCopyTextType('<p>x</p>', 'x', PasteType.NORMAL)).toBe('html');
    });

    it('returns code for <p> text-only', () => {
        expect(getCopyTextType('', '<p>hi</p>', PasteType.NORMAL)).toBe('code');
    });

    it('returns text for non-paragraph HTML shape text', () => {
        expect(getCopyTextType('', '<span>hi</span>', PasteType.NORMAL)).toBe('text');
    });

    it('falls back to text for plain strings', () => {
        expect(getCopyTextType('', 'plain string', PasteType.NORMAL)).toBe('text');
    });

    it('pasteAsPlainText ignores html', () => {
        expect(
            getCopyTextType('<p>hi</p>', '<p>hi</p>', PasteType.PASTE_AS_PLAIN_TEXT),
        ).toBe('code');
    });
});

describe('resolveClipboardImagePath', () => {
    it('returns "" when no hook is provided', async () => {
        expect(await resolveClipboardImagePath(undefined)).toBe('');
    });

    it('returns the path when the hook resolves an image file', async () => {
        const hook = vi.fn().mockResolvedValue('/tmp/screenshot.png');
        expect(await resolveClipboardImagePath(hook)).toBe('/tmp/screenshot.png');
        expect(hook).toHaveBeenCalledOnce();
    });

    it('accepts every supported image extension (case-insensitive)', async () => {
        for (const path of [
            '/a/b.JPG',
            '/a/b.jpeg',
            '/a/b.png',
            '/a/b.gif',
            '/a/b.svg',
            '/a/b.webp',
        ]) {
            expect(await resolveClipboardImagePath(() => Promise.resolve(path))).toBe(
                path,
            );
        }
    });

    it('tolerates a query string after the extension', async () => {
        expect(
            await resolveClipboardImagePath(() => Promise.resolve('/a/b.png?x=1')),
        ).toBe('/a/b.png?x=1');
    });

    it('returns "" when the hook resolves an empty string', async () => {
        expect(await resolveClipboardImagePath(() => Promise.resolve(''))).toBe('');
    });

    it('returns "" when the resolved path is not an image', async () => {
        expect(
            await resolveClipboardImagePath(() => Promise.resolve('/a/b.txt')),
        ).toBe('');
        expect(
            await resolveClipboardImagePath(() => Promise.resolve('/a/b.pdf')),
        ).toBe('');
    });
});
