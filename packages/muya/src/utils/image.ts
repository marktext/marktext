import type { ImageToken } from '../inlineRenderer/types';
import { isWin } from '../config/index';
import { tokenizer } from '../inlineRenderer/lexer';
import { findContentDOM, getOffsetOfParagraph } from '../selection/dom';
import { ABSOLUTE_LOCAL_REG, encodeDirnameForUrl, localPathToFileUrl, resolveRelativePath } from './fileUrl';

export interface IImageInfo {
    token: ImageToken;
    imageId: string;
}

export function getImageInfo(image: HTMLElement): IImageInfo {
    const paragraph = findContentDOM(image)!;
    const raw = image.getAttribute('data-raw')!;
    const offset = getOffsetOfParagraph(image, paragraph);
    const tokens = tokenizer(raw);
    const token = tokens[0] as ImageToken;
    token.range = {
        start: offset,
        end: offset + raw.length,
    };

    return {
        token,
        imageId: image.id,
    };
}

export function getImageSrc(src: string) {
    const EXT_REG = /\.(?:jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i;
    // http[s] (domain or IPv4 or localhost or IPv6) [port] /not-white-space
    const URL_REG
        = /^https?:\/\/(?:[\w\-.~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(?::\d{1,5})?\/\S+/i;
    const DATA_URL_REG
        = /^data:image\/[\w+-]+(?:;[\w-]+=[\w-]+|;base64)*,[a-zA-Z0-9+/]+={0,2}$/;
    const imageExtension = EXT_REG.test(src);
    // An already-`file://` src must not be re-prefixed (avoids `file://file://`).
    const isFileUrl = /^file:\/\//i.test(src);
    const isUrl = URL_REG.test(src) || (imageExtension && isFileUrl);
    if (imageExtension) {
        const isAbsoluteLocal = ABSOLUTE_LOCAL_REG.test(src);
        // Anchor a relative local path to the document directory. The
        // engine runs in the host renderer where `window.DIRNAME` tracks the
        // current document's directory; when it is absent (headless / no open
        // file) we fall back to the `file://${src}` form.
        const baseUrl
            = typeof window !== 'undefined' ? window.DIRNAME : undefined;
        if (isUrl) {
            return {
                isUnknownType: false,
                src,
            };
        }
        else if (!isAbsoluteLocal && baseUrl) {
            return {
                isUnknownType: false,
                src: localPathToFileUrl(resolveRelativePath(encodeDirnameForUrl(baseUrl), src)),
            };
        }
        else {
            return {
                isUnknownType: false,
                src: localPathToFileUrl(src),
            };
        }
    }
    else if (isUrl && !imageExtension) {
        return {
            isUnknownType: true,
            src,
        };
    }
    else {
        const isDataUrl = DATA_URL_REG.test(src);
        if (isDataUrl) {
            return {
                isUnknownType: false,
                src,
            };
        }
        else {
            return {
                isUnknownType: false,
                src: '',
            };
        }
    }
}

// The CSS default object size (CSS Images 3 §5.4) a browser falls back to for
// an image that states no size of its own. An image that carries an aspect
// ratio is contained inside that box, so one of its two dimensions always
// lands on the box.
const DEFAULT_OBJECT_WIDTH = 300;
const DEFAULT_OBJECT_HEIGHT = 150;

/**
 * Whether a loaded image's measured size is that fallback rather than a size of
 * its own — true for an SVG carrying only a `viewBox`. An image that really is
 * 300px wide (or 150px tall) answers `true` as well; that costs nothing, since
 * the width callers pin for it is its own intrinsic width.
 */
export function usesDefaultObjectSize(width?: number, height?: number): boolean {
    if (typeof width !== 'number' || typeof height !== 'number')
        return false;

    return width === DEFAULT_OBJECT_WIDTH || height === DEFAULT_OBJECT_HEIGHT;
}

export async function loadImage(url: string, detectContentType = false): Promise<{
    url: string;
    width: number;
    height: number;
}> {
    if (detectContentType) {
        const isImage = await checkImageContentType(url);
        // Only bail out when we positively know it is NOT an image. `null`
        // means we couldn't check (e.g. a cross-origin HEAD blocked by CSP);
        // fall through to the actual load, which `img-src` permits (#3837).
        if (isImage === false)
            // eslint-disable-next-line prefer-promise-reject-errors
            return Promise.reject('not an image.');
    }

    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            resolve({
                url,
                width: image.width,
                height: image.height,
            });
        };

        image.onerror = (err) => {
            reject(err);
        };
        image.src = url;
    });
}

// Only a same-origin URL can have its Content-Type read from the renderer: a
// cross-origin response has its headers stripped by CORS, and the app's CSP
// (no `connect-src`, so it falls back to `default-src 'self'`) refuses the
// request outright. Relative/opaque URLs are treated as same-origin so the
// check is still attempted.
function isSameOrigin(url: string): boolean {
    try {
        return new URL(url, window.location.href).origin === window.location.origin;
    }
    catch {
        return true;
    }
}

// Returns `true`/`false` when a HEAD response positively identifies the URL as
// an image (or not), or `null` when that can't be determined. A `null` must NOT
// be read as "not an image": the actual <img> load is governed by the far more
// permissive `img-src`, so callers should still attempt it (#3837 — shields.io
// badges and other extensionless remote images).
export async function checkImageContentType(url: string): Promise<boolean | null> {
    // Don't fire a HEAD we could never read: a cross-origin request is refused
    // by the CSP (logging a console error) and unreadable under CORS anyway.
    // Report "undetermined" and let the caller fall through to the <img> load.
    if (!isSameOrigin(url))
        return null;

    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.status !== 200)
            return null;

        // Content-Type can carry parameters (e.g. `image/svg+xml;charset=utf-8`);
        // match only the MIME type.
        const contentType = res.headers.get('content-type')?.split(';')[0].trim();
        if (!contentType)
            return null;

        return /^image\/(?:jpeg|png|gif|svg\+xml|webp)$/.test(contentType);
    }
    catch {
        return null;
    }
}

// Percent-encode the chars that break a markdown image destination — an
// unbalanced `)` truncates the path (#3060). `encodeURIComponent` leaves `(`/`)`
// untouched, so encode them explicitly.
export function encodeImageSrc(src: string): string {
    return src
        .replace(/ /g, encodeURI(' '))
        .replace(/#/g, encodeURIComponent('#'))
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
}

export function correctImageSrc(src: string) {
    if (src) {
    // Fix ASCII and UNC paths on Windows (#1997).
        if (isWin && /^(?:[a-z]:\\|[a-z]:\/).+/i.test(src)) {
            src = `file:///${src.replace(/\\/g, '/')}`;
        }
        else if (isWin && /^\\\\\?\\.+/.test(src)) {
            src = `file:///${src.substring(4).replace(/\\/g, '/')}`;
        }
        else if (/^\/.+/.test(src)) {
            // Also adding file protocol on UNIX.
            // Do nothing: src = src
        }
    }

    return src;
}
