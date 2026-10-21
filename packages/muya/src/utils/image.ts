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
    const URL_REG
        = /^https?:\/\/(?:[\w\-.~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(?::\d{1,5})?\/\S+/i;
    const DATA_URL_REG
        = /^data:image\/[\w+-]+(?:;[\w-]+=[\w-]+|;base64)*,[a-zA-Z0-9+/]+={0,2}$/;
    const imageExtension = EXT_REG.test(src);
    const isFileUrl = /^file:\/\//i.test(src);
    const isUrl = URL_REG.test(src) || (imageExtension && isFileUrl);
    if (imageExtension) {
        const isAbsoluteLocal = ABSOLUTE_LOCAL_REG.test(src);
        // Resolve relative paths against the host document directory; retain relative form when unavailable.
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

// CSS Images default object dimensions for images without intrinsic size (300×150).
const DEFAULT_OBJECT_WIDTH = 300;
const DEFAULT_OBJECT_HEIGHT = 150;

// Detect a possible CSS fallback size, including viewBox-only SVGs.
// Real images can share these dimensions, so callers must separately exclude bitmaps.
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
        // An unavailable HEAD result is not proof of failure; img-src may still permit loading (#3837).
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

// Cross-origin headers are unreadable under CORS and renderer CSP blocks the HEAD request.
function isSameOrigin(url: string): boolean {
    try {
        return new URL(url, window.location.href).origin === window.location.origin;
    }
    catch {
        return true;
    }
}

// Return null when Content-Type cannot be checked. The caller must still try the img load.
export async function checkImageContentType(url: string): Promise<boolean | null> {
    // Skip unreadable cross-origin HEAD requests and allow the actual image load.
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
            // POSIX absolute paths intentionally remain unchanged.
        }
    }

    return src;
}
