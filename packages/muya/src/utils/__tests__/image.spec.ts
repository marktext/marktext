// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkImageContentType, getImageSrc, loadImage } from '../image';

// Regression tests for the Phase G "G1" blocker: relative-path images stopped
// rendering after the @muyajs/core migration because `getImageSrc` returned a
// non-anchored `file://assets/foo.png` instead of resolving the relative path
// against the document directory. Legacy muyajs `getImageInfo(src, baseUrl =
// window.DIRNAME)` did `'file://' + path.resolve(baseUrl, src)`; this suite
// pins the ported behaviour.

const DIRNAME = '/home/user/docs';

function withDirname(dirname: string | undefined, fn: () => void) {
    const previous = window.DIRNAME;
    window.DIRNAME = dirname;
    try {
        fn();
    }
    finally {
        window.DIRNAME = previous;
    }
}

afterEach(() => {
    window.DIRNAME = undefined;
});

describe('checkImageContentType — tolerates Content-Type parameters (#3837)', () => {
    function mockFetch(status: number, contentType: string | null) {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                status,
                headers: {
                    get: (h: string) =>
                        h.toLowerCase() === 'content-type' ? contentType : null,
                },
            }),
        );
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('accepts an image type carrying a charset parameter (shields.io badges)', async () => {
        mockFetch(200, 'image/svg+xml;charset=utf-8');
        expect(await checkImageContentType('https://img.shields.io/badge/x-blue')).toBe(true);
    });

    it('accepts a bare image content type', async () => {
        mockFetch(200, 'image/png');
        expect(await checkImageContentType('https://example.com/badge')).toBe(true);
    });

    it('reports a non-image content type as false', async () => {
        mockFetch(200, 'text/html;charset=utf-8');
        expect(await checkImageContentType('https://example.com/page')).toBe(false);
    });

    it('returns null (undetermined) on a non-200 response', async () => {
        mockFetch(404, 'image/png');
        expect(await checkImageContentType('https://example.com/missing')).toBeNull();
    });

    it('returns null when the HEAD request is blocked (CSP/CORS/network)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Refused to connect (CSP)')));
        expect(await checkImageContentType('https://img.shields.io/badge/x-blue')).toBeNull();
    });
});

describe('loadImage — undetermined content-type still attempts the load (#3837)', () => {
    // Drive the <img> load deterministically: setting `src` fires onload/onerror.
    function stubImage(succeeds: boolean) {
        class FakeImage {
            width = 10;
            height = 10;
            onload: (() => void) | null = null;
            onerror: ((err: unknown) => void) | null = null;
            private _src = '';
            get src(): string {
                return this._src;
            }

            set src(v: string) {
                this._src = v;
                queueMicrotask(() =>
                    succeeds ? this.onload?.() : this.onerror?.(new Error('load failed')),
                );
            }
        }
        vi.stubGlobal('Image', FakeImage);
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads a cross-origin extensionless image when the HEAD check is CSP-blocked', async () => {
        // In the shipping app the HEAD fetch to shields.io is refused by CSP, so
        // the content-type can't be checked — the badge must still load via img-src.
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Refused to connect (CSP)')));
        stubImage(true);
        await expect(
            loadImage('https://img.shields.io/badge/example-blue', true),
        ).resolves.toMatchObject({ width: 10, height: 10 });
    });

    it('still rejects when the HEAD check positively reports a non-image type', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ status: 200, headers: { get: () => 'text/html' } }),
        );
        stubImage(true);
        await expect(loadImage('https://example.com/page', true)).rejects.toBe('not an image.');
    });
});

describe('getImageSrc — relative local image paths anchored to window.DIRNAME', () => {
    it('resolves a relative path against the document directory', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('assets/foo.png')).toEqual({
                isUnknownType: false,
                src: 'file:///home/user/docs/assets/foo.png',
            });
        });
    });

    it('resolves a `./` relative path', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('./img/cat.jpg').src).toBe(
                'file:///home/user/docs/img/cat.jpg',
            );
        });
    });

    it('collapses `../` parent segments', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('../shared/logo.svg').src).toBe(
                'file:///home/user/shared/logo.svg',
            );
        });
    });

    it('does not produce a double `file://` prefix', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('assets/foo.png').src).not.toContain(
                'file://file://',
            );
        });
    });

    it('falls back to bare `file://` when window.DIRNAME is absent', () => {
        withDirname(undefined, () => {
            expect(getImageSrc('assets/foo.png')).toEqual({
                isUnknownType: false,
                src: 'file://assets/foo.png',
            });
        });
    });

    it('resolves Windows-drive base dirs with forward slashes', () => {
        withDirname('C:\\Users\\me\\docs', () => {
            expect(getImageSrc('assets\\foo.png').src).toBe(
                'file://C:/Users/me/docs/assets/foo.png',
            );
        });
    });
});

describe('getImageSrc — non-relative sources are left unchanged', () => {
    it('leaves an absolute POSIX local path as a single `file://`', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('/var/img/pic.png')).toEqual({
                isUnknownType: false,
                src: 'file:///var/img/pic.png',
            });
        });
    });

    it('leaves an absolute Windows-drive path as a single `file://`', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('C:/img/pic.png').src).toBe('file://C:/img/pic.png');
        });
    });

    it('leaves an http(s) URL untouched', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('https://example.com/x.png')).toEqual({
                isUnknownType: false,
                src: 'https://example.com/x.png',
            });
        });
    });

    it('leaves an already-`file://` src untouched (no double prefix)', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('file:///already/abs.png')).toEqual({
                isUnknownType: false,
                src: 'file:///already/abs.png',
            });
        });
    });

    it('leaves a data: URL untouched', () => {
        const dataUrl
            = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        withDirname(DIRNAME, () => {
            expect(getImageSrc(dataUrl)).toEqual({
                isUnknownType: false,
                src: dataUrl,
            });
        });
    });

    it('flags an extensionless http URL as unknown type', () => {
        withDirname(DIRNAME, () => {
            expect(getImageSrc('https://example.com/image')).toEqual({
                isUnknownType: true,
                src: 'https://example.com/image',
            });
        });
    });
});

describe('getImageSrc — Windows drive + UNC base directories (Phase G review)', () => {
    it('preserves the drive when resolving `..`', () => {
        withDirname('C:/Users/me/docs', () => {
            expect(getImageSrc('../img/a.png').src).toBe('file://C:/Users/me/img/a.png');
        });
    });

    it('clamps `..` at the drive root so the drive is never lost', () => {
        withDirname('C:/docs', () => {
            expect(getImageSrc('../../../a.png').src).toBe('file://C:/a.png');
        });
    });

    it('normalises a Windows-backslash base dir', () => {
        withDirname('C:\\docs', () => {
            expect(getImageSrc('a.png').src).toBe('file://C:/docs/a.png');
        });
    });

    it('resolves against a UNC share base directory', () => {
        withDirname('//server/share/docs', () => {
            expect(getImageSrc('a.png').src).toBe('file:////server/share/docs/a.png');
        });
    });

    it('normalises a backslash UNC base', () => {
        withDirname('\\\\server\\share', () => {
            expect(getImageSrc('sub/a.png').src).toBe('file:////server/share/sub/a.png');
        });
    });

    it('clamps `..` at the UNC share root', () => {
        withDirname('//server/share/docs', () => {
            expect(getImageSrc('../../../a.png').src).toBe('file:////server/share/a.png');
        });
    });
});
