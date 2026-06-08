import { IMAGE_EXT_REG, PARAGRAPH_TYPES, PREVIEW_DOMPURIFY_CONFIG } from '../config';
import { sanitize } from '../utils';

const TIMEOUT = 1500;

export const isOnline = () => navigator.onLine === true;

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

        // The response is HTML — read it as text and pluck `<title>`.
        // Pre-fix this called `res.json()`, which always threw and made
        // the helper silently return '' (marktext 141d25d8 / #1344).
        const body = await res.text();
        const match = body.match(/<title>([\s\S]*?)<\/title>/i);

        return match && match[1] ? match[1].trim() : '';
    }
    catch {
        return '';
    }
}

export async function normalizePastedHTML(html: string) {
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

        if (href === text && typeof href === 'string') {
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
            else {
                const span = document.createElement('span');
                span.innerHTML = text as string;
                link.replaceWith(span);
            }
        }
    }

    return tempWrapper.innerHTML;
}

// Sniffs whether `text` looks like an HTML `<table>` blob and nothing else
// (no surrounding prose). The regex deliberately doesn't enforce "exactly
// one root element" — sibling tables in the same payload still belong on
// the HTML→Markdown path. Some clipboard sources (notably Apple Numbers,
// marktext #1271) put raw HTML into `text/plain` with no `text/html`
// flavour; the paste handler promotes such text into the html slot so it
// goes through `HtmlToMarkdown` instead of being inserted verbatim.
const STANDALONE_TABLE_REG = /^<table\b[\s\S]*<\/table>$/i;
export function isStandaloneTableHtml(text: string) {
    if (!text)
        return false;
    return STANDALONE_TABLE_REG.test(text.trim());
}

/**
 * Resolve the `clipboardFilePath` paste hook to a usable inline-image path.
 *
 * Returns the resolved path only when the hook yields a non-empty string that
 * looks like an image file (its extension matches {@link IMAGE_EXT_REG});
 * otherwise returns `''` so the caller falls through to the normal text/HTML
 * paste. Ported from the legacy `@muyajs` `pasteImage` guard, which inserted
 * the resolved path as an image when it matched the same extension regex.
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
 *
 * @param {string} html
 * @param {string} text
 * @param {string} pasteType normal or pasteAsPlainText
 * return html | text | code, if the return value is html, we'll use html as paste data, we'll use text
 * as paste data if the return value is text, we'll create a html code block if the result is code.
 */
export function getCopyTextType(html: string, text: string, pasteType: string) {
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

    if (pasteType === 'normal')
        return html && text ? 'html' : getTextType(text);
    else
        return getTextType(text);
}
