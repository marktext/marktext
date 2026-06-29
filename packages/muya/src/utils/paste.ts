import { PasteType } from '../clipboard/types';
import { IMAGE_EXT_REG, PARAGRAPH_TYPES, PREVIEW_DOMPURIFY_CONFIG, URL_REG } from '../config';
import { sanitize } from '../utils';

const TIMEOUT = 1500;

interface INormalizePastedHTMLOptions {
    preserveBareUrlLinks?: boolean;
}

export const isOnline = () => navigator.onLine === true;

function expandTableColspans(table: HTMLTableElement) {
    for (const row of Array.from(table.rows)) {
        const cells = Array.from(row.cells);

        for (const cell of cells) {
            const colSpan = Math.max(1, Math.trunc(cell.colSpan || 1));
            if (colSpan <= 1)
                continue;

            cell.removeAttribute('colspan');

            const placeholders: HTMLTableCellElement[] = [];
            for (let i = 1; i < colSpan; i++) {
                placeholders.push(
                    document.createElement(cell.tagName.toLowerCase()) as HTMLTableCellElement,
                );
            }

            cell.after(...placeholders);
        }
    }
}

export async function getPageTitle(url: string) {
    // No need to request the title when it's not url.
    if (!url.startsWith('http'))
        return '';

    // No need to request the title when off line.
    if (!isOnline())
        return '';

    try {
        const res = await fetch(url, { method: 'GET', mode: 'cors' });
        const contentType = res.headers.get('content-type');

        if (res.status !== 200 || !contentType || !/text\/html/i.test(contentType))
            return '';

        // Parse inertly and read `<title>` textContent, which decodes HTML
        // entities so they don't leak into the pasted link text (#2525).
        const body = await res.text();
        const doc = new DOMParser().parseFromString(body, 'text/html');
        const title = doc.querySelector('title')?.textContent?.trim();

        return title || '';
    }
    catch {
        return '';
    }
}

export async function normalizePastedHTML(
    html: string,
    options: INormalizePastedHTMLOptions = {},
) {
    // Only extract the `body.innerHTML` when the `html` is a full HTML Document.
    if (/<body>[\s\S]*<\/body>/.test(html)) {
        const match = /<body>([\s\S]*)<\/body>/.exec(html);
        if (match && typeof match[1] === 'string')
            html = match[1];
    }

    // Prevent XSS and sanitize HTML.
    const sanitizedHtml = sanitize(
        html,
        PREVIEW_DOMPURIFY_CONFIG,
        false,
    ) as string;
    const tempWrapper = document.createElement('div');
    tempWrapper.innerHTML = sanitizedHtml;

    // Special process for turndown.js, needed for Number app on macOS.
    const tables = Array.from(tempWrapper.querySelectorAll('table'));

    for (const table of tables) {
        expandTableColspans(table);

        const row = table.querySelector('tr');
        if (row && row.firstElementChild?.tagName !== 'TH') {
            [...row.children].forEach((cell) => {
                const th = document.createElement('th');
                th.innerHTML = cell.innerHTML;
                cell.replaceWith(th);
            });
        }
        const paragraphs = Array.from(table.querySelectorAll('p'));

        for (const p of paragraphs) {
            const span = document.createElement('span');
            span.innerHTML = p.innerHTML;
            p.replaceWith(span);
        }

        const tds = table.querySelectorAll('td');

        for (const td of tds) {
            const rawHtml = td.innerHTML;
            if (/<br>/.test(rawHtml))
                td.innerHTML = rawHtml.replace(/<br>/g, '&lt;br&gt;');
        }
    }

    // Prevent it parse into a link if copy a url.
    const links: HTMLElement[] = Array.from(
        tempWrapper.querySelectorAll('a'),
    );

    for (const link of links) {
        const href = link.getAttribute('href');
        const text = link.textContent;

        // Only unlink a bare URL (text === href). muyajs guards with
        // `URL_REG.test(href)` so a non-URL link whose text happens to equal its
        // href (e.g. `<a href="foo">foo</a>`) survives instead of collapsing.
        if (typeof href === 'string' && URL_REG.test(href) && href === text) {
            // Resolve empty string when `TIMEOUT` passed.
            const timer = new Promise((resolve) => {
                setTimeout(() => {
                    resolve('');
                }, TIMEOUT);
            });

            const title = await Promise.race([getPageTitle(href), timer]);
            if (title) {
                link.textContent = title as string;
            }
            else if (!options.preserveBareUrlLinks) {
                // Escape + sanitize the fallback text (muyajs uses
                // `sanitize(text, PREVIEW_DOMPURIFY_CONFIG, true)`) so a stray
                // angle bracket can't re-enter as live markup.
                const span = document.createElement('span');
                span.innerHTML = sanitize(text as string, PREVIEW_DOMPURIFY_CONFIG, true) as string;
                link.replaceWith(span);
            }
        }
    }

    return tempWrapper.innerHTML;
}

// Sniffs whether `text` looks like a single HTML `<table>` blob and nothing
// else (no surrounding prose, no sibling root element). The regex match is
// followed by a parse + `childElementCount === 1` check, so a payload whose
// greedy regex spans two sibling
// tables falls through to the normal HTML→Markdown path. Some clipboard sources
// (notably Apple Numbers, marktext #1271) put raw HTML into `text/plain` with
// no `text/html` flavour; the paste handler promotes such text into the html
// slot so it goes through `HtmlToMarkdown` instead of being inserted verbatim.
const STANDALONE_TABLE_REG = /^<table\b[\s\S]*<\/table>$/i;
export function isStandaloneTableHtml(text: string) {
    if (!text)
        return false;

    const trimmed = text.trim();
    if (!STANDALONE_TABLE_REG.test(trimmed))
        return false;

    // The greedy regex above also matches two sibling `<table>`s, so parse the
    // blob into a temporary container and require exactly one root element.
    if (typeof document === 'undefined')
        return true;

    const tmp = document.createElement('div');
    tmp.innerHTML = trimmed;

    return tmp.childElementCount === 1;
}

/**
 * Resolve the `clipboardFilePath` paste hook to a usable inline-image path.
 *
 * Returns the resolved path only when the hook yields a non-empty string that
 * looks like an image file (its extension matches {@link IMAGE_EXT_REG});
 * otherwise returns `''` so the caller falls through to the normal text/HTML
 * paste.
 *
 * @param hook the `options.clipboardFilePath` callback, if configured
 */
export async function resolveClipboardImagePath(
    hook: (() => Promise<string>) | undefined,
): Promise<string> {
    if (typeof hook !== 'function')
        return '';

    const path = await hook();

    if (typeof path === 'string' && path && IMAGE_EXT_REG.test(path))
        return path;

    return '';
}

/**
 * Extract an in-memory image `File` from a paste `DataTransfer`.
 *
 * Covers the bitmap clipboard case: screenshots and browser
 * "Copy Image" put image bytes — not a file path — on the clipboard. We
 * prefer `clipboardData.files` and fall back to scanning `clipboardData.items`
 * for the first `image/*` entry. Returns `null` when no image is present.
 */
export function getClipboardImageFile(
    clipboardData: DataTransfer | null,
): File | null {
    if (!clipboardData)
        return null;

    const { files, items } = clipboardData;

    if (files && files.length > 0) {
        for (const file of Array.from(files)) {
            if (file.type.startsWith('image/'))
                return file;
        }
    }

    if (items) {
        for (const item of Array.from(items)) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file)
                    return file;
            }
        }
    }

    return null;
}

/**
 * Read a `File`/`Blob` as a base64 `data:` URL.
 *
 * Used to turn a pasted bitmap into a `data:` URL that the embedder's
 * `imageAction` can persist. Prefers the native {@link FileReader}
 * (`readAsDataURL`), covering the
 * `chrome70` build target where `Blob.arrayBuffer()` is unavailable; falls
 * back to `Blob.arrayBuffer()` + `btoa` where `FileReader` is absent (e.g. the
 * Node test environment). Resolves to `''` on read error.
 */
export function readFileAsDataURL(file: File): Promise<string> {
    if (typeof FileReader !== 'undefined') {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                resolve(typeof reader.result === 'string' ? reader.result : '');
            });
            reader.addEventListener('error', () => resolve(''));
            reader.readAsDataURL(file);
        });
    }

    // Fallback for environments without `FileReader` (e.g. Node tests). Guard
    // the dependencies so a missing API resolves to '' rather than throwing
    // out of the `Promise<string>` contract.
    if (typeof file.arrayBuffer !== 'function' || typeof btoa !== 'function')
        return Promise.resolve('');

    return file
        .arrayBuffer()
        .then(bufferToDataURL(file.type))
        .catch(() => '');
}

/**
 * Base64-encode an `ArrayBuffer` into a `data:` URL of the given MIME type.
 * Processes the bytes in chunks so a large blob doesn't build one huge
 * intermediate string via per-byte concatenation.
 */
function bufferToDataURL(mimeType: string) {
    return (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        const CHUNK = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
            const chunk = bytes.subarray(i, i + CHUNK);
            binary += String.fromCharCode(...chunk);
        }
        return `data:${mimeType};base64,${btoa(binary)}`;
    };
}

/**
 *
 * @param {string} html
 * @param {string} text
 * @param {string} pasteType normal or pasteAsPlainText
 * return html | text | code, if the return value is html, we'll use html as paste data, we'll use text
 * as paste data if the return value is text, we'll create a html code block if the result is code.
 */
export function getCopyTextType(html: string, text: string, pasteType: PasteType) {
    const getTextType = (text: string) => {
        const match
        // eslint-disable-next-line regexp/no-super-linear-backtracking
            = /^<([a-z\d-]+)(?=\s|>).*?>[\s\S]+?<\/[a-z\d-]+>$/i.exec(
                text.trim(),
            );
        if (match && match[1]) {
            // The regex is case-insensitive, so `<P>` yields `tag = 'P'`;
            // PARAGRAPH_TYPES is all lowercase. Normalize before checking.
            const tag = match[1].toLowerCase();

            return PARAGRAPH_TYPES.includes(tag) ? 'code' : 'text';
        }

        return 'text';
    };

    if (pasteType === PasteType.NORMAL)
        return html && text ? 'html' : getTextType(text);
    else
        return getTextType(text);
}
