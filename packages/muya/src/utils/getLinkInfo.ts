// Link renderers store raw text and ranges in dataset attributes for the link popover.

export interface IExtractedLinkInfo {
    href: string | null;
    raw: string;
    text: string;
    range: { start: number; end: number } | null;
}

function readHref(el: HTMLElement): string | null {
    const attr = el.getAttribute('href');
    if (attr)
        return attr;

    // snabbdom stores href as a custom property on Markdown span wrappers, not as an attribute.
    const prop = (el as HTMLElement & { href?: unknown }).href;
    if (typeof prop === 'string' && prop)
        return prop;

    return null;
}

function parseRange(startStr: string | undefined, endStr: string | undefined): { start: number; end: number } | null {
    // Number('') is zero; reject empty offsets before conversion.
    if (!startStr || !endStr)
        return null;

    const start = Number(startStr);
    const end = Number(endStr);
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
