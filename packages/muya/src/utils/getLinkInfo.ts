// Extract the `linkInfo` payload that the linkTools popover hands back to
// `contentState.unlink` / `options.jumpClick`.
//
// The link renderers (`link.ts`, `referenceLink.ts`,
// `htmlTag.ts`) all emit `dataset.{start,end,raw}` on the rendered link
// wrapper plus an `href` — markdown `[]()` via snabbdom `props.href`
// (DOM property on the `<span>`), HTML `<a>` and reference link via real
// `href` attribute on the `<a>`. We read both forms so the caller doesn't
// need to know which renderer produced the element.

export interface IExtractedLinkInfo {
    href: string | null;
    raw: string;
    text: string;
    range: { start: number; end: number } | null;
}

function readHref(el: HTMLElement): string | null {
    // Real attribute on a rendered <a> (reference link with resolved href,
    // or html_tag <a href=...>).
    const attr = el.getAttribute('href');
    if (attr)
        return attr;

    // snabbdom `props.href` on the markdown `<span class="mu-link">` wrapper
    // sets `elm.href` as a custom DOM property (no attribute). HTMLElement
    // has no such field in lib.dom; declare only the slice we read.
    const prop = (el as HTMLElement & { href?: unknown }).href;
    if (typeof prop === 'string' && prop)
        return prop;

    return null;
}

function parseRange(startStr: string | undefined, endStr: string | undefined): { start: number; end: number } | null {
    // Reject missing or empty dataset values up front — `Number('')` is 0,
    // not NaN, so without this check an empty attribute would silently
    // produce `{ start: 0, end: 0 }`.
    if (!startStr || !endStr)
        return null;

    const start = Number(startStr);
    const end = Number(endStr);
    // Reject NaN / Infinity from non-numeric dataset values so consumers
    // never receive `{ start: NaN, end: NaN }`.
    if (!Number.isFinite(start) || !Number.isFinite(end))
        return null;

    return { start, end };
}

export function getLinkInfo(el: HTMLElement): IExtractedLinkInfo | null {
    const raw = el.dataset.raw;
    if (!raw)
        return null;

    return {
        href: readHref(el),
        raw,
        text: el.textContent ?? '',
        range: parseRange(el.dataset.start, el.dataset.end),
    };
}
