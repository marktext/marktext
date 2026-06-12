import type { ImageToken } from '../inlineRenderer/types';
import { isWin } from '../config/index';
import { tokenizer } from '../inlineRenderer/lexer';
import { findContentDOM, getOffsetOfParagraph } from '../selection/dom';

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

// A local image path that is already anchored to a filesystem root:
// POSIX (`/foo`), Windows UNC (`\\host\share`), or a drive letter
// (`C:\foo` / `C:/foo`), so absolute paths are NOT resolved against the
// document directory.
const ABSOLUTE_LOCAL_REG = /^(?:\/|\\\\|[a-z]:\\|[a-z]:\/).+/i;

/**
 * Resolve a relative POSIX path against an absolute base directory, mirroring
 * Node's `path.resolve(base, rel)` for the cases `getImageSrc` cares about.
 * Kept self-contained so the engine does not depend on the desktop host's
 * `window.path` polyfill. Windows-style backslashes in `base` are normalised
 * to `/` first (Chromium loads `file://` URLs with forward slashes regardless
 * of platform). `.` and `..` segments are collapsed.
 */
function resolveRelativePath(base: string, relative: string): string {
    const normalizedBase = base.replace(/\\/g, '/').replace(/\/+$/, '');
    const combined = `${normalizedBase}/${relative.replace(/\\/g, '/')}`;
    // Isolate the root that `..` must never collapse past (mirroring
    // `path.resolve`): a UNC share (`//server/share`), a Windows drive (`C:`),
    // or the POSIX root. The root prefix is preserved; `..` beyond it is a no-op.
    const root = combined.match(/^\/\/[^/]+\/[^/]+/)?.[0]
        ?? combined.match(/^[a-z]:/i)?.[0]
        ?? '';
    const body = root ? combined.slice(root.length) : combined;
    const resolved: string[] = [];
    for (const segment of body.split('/')) {
        if (segment === '' || segment === '.')
            continue;

        if (segment === '..')
            resolved.pop();
        else
            resolved.push(segment);
    }
    const tail = resolved.join('/');
    // POSIX root keeps a leading slash; a drive/UNC root prefixes its tail.
    if (root === '')
        return `/${tail}`;

    return tail ? `${root}/${tail}` : root;
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
                src: `file://${resolveRelativePath(baseUrl, src)}`,
            };
        }
        else {
            return {
                isUnknownType: false,
                src: `file://${src}`,
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

export async function loadImage(url: string, detectContentType = false): Promise<{
    url: string;
    width: number;
    height: number;
}> {
    if (detectContentType) {
        const isImage = await checkImageContentType(url);
        if (!isImage)
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

export async function checkImageContentType(url: string) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        const contentType = res.headers.get('content-type');

        if (
            contentType
            && res.status === 200
            && /^image\/(?:jpeg|png|gif|svg\+xml|webp)$/.test(contentType)
        ) {
            return true;
        }

        return false;
    }
    catch {
        return false;
    }
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
