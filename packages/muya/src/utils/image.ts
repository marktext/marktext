import type { HTMLTagToken, ImageToken, Token } from '../inline/model/types';
import { DATA_URL_REG, IMAGE_EXT_REG, isWin, URL_REG } from '../config/index';
import { parseInline } from '../inline/parser/lexer';
import { findContentDOM, getOffsetOfParagraph } from '../selection/dom';
import { ABSOLUTE_LOCAL_REG, encodeDirnameForUrl, localPathToFileUrl, resolveRelativePath } from './fileUrl';
import { encodeLinkTitle, escapeLinkAttribute } from './markdownEscape';

export type TSelectableImageToken = ImageToken | (HTMLTagToken & { tag: 'img'; kind?: 'tag' });

export interface IImageInfo {
    token: TSelectableImageToken;
    imageId: string;
}

export function isImageToken(token: Token | undefined): token is TSelectableImageToken {
    return token?.type === 'image' || (token?.type === 'html_tag' && token.tag === 'img' && token.kind === 'tag');
}

export function getImageInfo(image: HTMLElement): IImageInfo {
    const paragraph = findContentDOM(image)!;
    const raw = image.getAttribute('data-raw')!;
    const offset = getOffsetOfParagraph(image, paragraph);
    const tokens = parseInline(raw);
    const token = tokens[0];
    if (!isImageToken(token))
        throw new Error('Image wrapper does not contain an image token');
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
    const imageExtension = IMAGE_EXT_REG.test(src);
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

// Encode parentheses explicitly so an unmatched ')' cannot truncate the destination (#3060).
export function encodeImageSrc(src: string): string {
    // A URL hash starts a fragment; a local-path hash belongs to the filename.
    const destination = URL_REG.test(src) ? src : src.replace(/#/g, '%23');
    const encoded = destination
        .replace(/ /g, '%20')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
    return escapeLinkAttribute(encoded);
}

// alt is Markdown source; src and title are decoded attribute values.
export function imageToMarkdown({ src, alt = '', title = '' }: { src: string; alt?: string; title?: string }): string {
    const caption = title ? ` "${encodeLinkTitle(title)}"` : '';
    return `![${alt}](${encodeImageSrc(src)}${caption})`;
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
