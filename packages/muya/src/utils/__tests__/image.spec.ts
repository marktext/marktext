// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { getImageSrc } from '../image';

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
