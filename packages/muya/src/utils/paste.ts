import type { IMuyaOptions } from '../types';
import { PasteType } from '../clipboard/types';
import { IMAGE_EXT_REG, PARAGRAPH_TYPES, PREVIEW_DOMPURIFY_CONFIG } from '../config';
import { sanitize } from '../utils';

const TIMEOUT = 1500;

interface INormalizePastedHTMLOptions {
    preserveBareUrlLinks?: boolean;
    fetchLinkHtml?: IMuyaOptions['fetchLinkHtml'];
    resolveLinkTitles?: boolean;
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

export function isHttpUrl(text: string): boolean {
    if (!/^https?:\/\//i.test(text) || /\s/.test(text))
        return false;
    try {
        return Boolean(new URL(text).hostname);
    }
    catch {
        return false;
    }
}

export async function getPageTitle(url: string, fetchLinkHtml?: IMuyaOptions['fetchLinkHtml']) {
    if (!isHttpUrl(url) || (!fetchLinkHtml && !isOnline()))
        return '';

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const loadTitle = async () => {
            let body: string;
            if (fetchLinkHtml) {
                body = await fetchLinkHtml(url);
            }
            else {
                const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', signal: controller.signal });
                const contentType = res.headers.get('content-type');
                if (res.status !== 200 || !contentType || !/text\/html/i.test(contentType))
                    return '';
                body = await res.text();
            }
            // textContent decodes entities without rendering untrusted page content.
            const doc = new DOMParser().parseFromString(body, 'text/html');
            return doc.querySelector('title')?.textContent?.trim() || '';
        };
        return await Promise.race([
            loadTitle(),
            new Promise<string>((resolve) => {
                timer = setTimeout(() => {
                    controller.abort();
                    resolve('');
                }, TIMEOUT);
            }),
        ]);
    }
    catch {
        return '';
    }
    finally {
        clearTimeout(timer);
    }
}

export async function normalizePastedHTML(
    html: string,
    options: INormalizePastedHTMLOptions = {},
) {
    if (/<body>[\s\S]*<\/body>/.test(html)) {
        const match = /<body>([\s\S]*)<\/body>/.exec(html);
        if (match && typeof match[1] === 'string')
            html = match[1];
    }

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

        if (typeof href === 'string' && isHttpUrl(href) && href === text) {
            const title = options.resolveLinkTitles === false
                ? ''
                : await getPageTitle(href, options.fetchLinkHtml);
            if (title) {
                link.textContent = title as string;
            }
            else if (!options.preserveBareUrlLinks) {
                // Escape fallback text so angle brackets cannot become live markup.
                const span = document.createElement('span');
                span.innerHTML = sanitize(text as string, PREVIEW_DOMPURIFY_CONFIG, true) as string;
                link.replaceWith(span);
            }
        }
    }

    return tempWrapper.innerHTML;
}

// A table-only paste must have exactly one root element and no surrounding prose.
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

// Return an image path, or an empty string when the hook is missing or its result is unusable.
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

// Prefer image files, falling back to items.getAsFile() for bitmap-only clipboards.
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

// Read a bitmap as a data URL; return an empty string when reading is unavailable or fails.
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

    // Missing fallback APIs must resolve to an empty string rather than reject the paste.
    if (typeof file.arrayBuffer !== 'function' || typeof btoa !== 'function')
        return Promise.resolve('');

    return file
        .arrayBuffer()
        .then(bufferToDataURL(file.type))
        .catch(() => '');
}

// Encode bytes in chunks to avoid a large intermediate per-byte string.
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

// Choose rich HTML, Markdown text or block HTML insertion according to clipboard provenance and paste mode.
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
