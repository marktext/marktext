import type Parent from '../block/base/parent';
import type { IBlockQuoteState, TState } from '../state/types';

export const GITHUB_ALERT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const;
export type GithubAlertType = typeof GITHUB_ALERT_TYPES[number];

export function githubAlertType(value: string): GithubAlertType | null {
    const upper = value.toUpperCase();
    return GITHUB_ALERT_TYPES.find(type => type === upper) ?? null;
}

export function matchGithubAlertMarker(text: string): GithubAlertType | null {
    const plain = text.replace(/\\([![\]])/g, '$1');
    const match = /^[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i.exec(plain);
    return match ? githubAlertType(match[1]) : null;
}

export function githubAlertTitle(type: GithubAlertType): string {
    return type[0] + type.slice(1).toLowerCase();
}

export function githubAlertIcon(type: GithubAlertType): string {
    const shapes: Record<GithubAlertType, string> = {
        NOTE: '<circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.5v.5"/>',
        TIP: '<path d="M5.5 11c0-2-2-2.5-2-5a4.5 4.5 0 0 1 9 0c0 2.5-2 3-2 5zM6 13h4M7 15h2"/>',
        IMPORTANT: '<path d="M2 1.5h12v9H8l-4 4v-4H2zM8 4v2.5M8 8v.5"/>',
        WARNING: '<path d="m8 1.5 7 13H1zM8 6v3.5M8 11.5v.5"/>',
        CAUTION: '<path d="M5 1.5h6l3.5 3.5v6L11 14.5H5L1.5 11V5zM8 4v5M8 11v.5"/>',
    };
    return `<svg class="mu-alert-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[type]}</svg>`;
}

export function githubAlertMenuIcon(type: GithubAlertType): string {
    return `data:image/svg+xml,${encodeURIComponent(githubAlertIcon(type).replace('currentColor', '#808080'))}`;
}

function hasContent(state: TState): boolean {
    if ('text' in state)
        return !!state.text.trim();
    if ('children' in state)
        return state.children.some(hasContent);
    return true;
}

export function githubAlertStateType(state: TState, allowDraft = false): GithubAlertType | null {
    if (state.name !== 'block-quote' || state.meta?.style === 'fenced')
        return null;
    const first = state.children[0];
    if (first?.name !== 'paragraph')
        return null;
    const type = matchGithubAlertMarker(first.text);
    return type && (state.children.slice(1).some(hasContent) || (allowDraft && state.children.length > 1)) ? type : null;
}

export function githubAlertBlockMarker(block: Parent): GithubAlertType | null {
    if (block.blockName !== 'block-quote')
        return null;
    const quote = block as Parent & { meta?: IBlockQuoteState['meta'] };
    const first = block.firstChild;
    if (quote.meta?.style === 'fenced' || first?.blockName !== 'paragraph' || !first.isParent())
        return null;
    const type = matchGithubAlertMarker(first.firstContentInDescendant()?.text ?? '');
    return type && !first.domNode?.querySelector('a') ? type : null;
}

export function githubAlertBlockType(block: Parent): GithubAlertType | null {
    if (!block.muya.options.githubAlerts || !block.parent?.isScrollPage || block.domNode?.dataset.alertPending || block.children.length < 2)
        return null;
    return githubAlertBlockMarker(block);
}

export function githubAlertBody(state: IBlockQuoteState): TState[] {
    const first = state.children[0];
    return first?.name === 'paragraph' && matchGithubAlertMarker(first.text) ? state.children.slice(1) : state.children;
}

function renderGithubAlertQuote(original: Element): HTMLElement | null {
    const quote = original.cloneNode(true) as HTMLElement;
    const paragraph = quote.firstElementChild;
    const text = paragraph?.firstChild;
    if (paragraph?.tagName !== 'P' || text?.nodeType !== Node.TEXT_NODE)
        return null;
    const value = text.textContent ?? '';
    const newline = value.indexOf('\n');
    const type = matchGithubAlertMarker(newline === -1 ? value : value.slice(0, newline));
    if (!type)
        return null;
    text.textContent = newline === -1 ? '' : value.slice(newline + 1);
    if (paragraph.firstChild === text && !text.textContent)
        text.remove();
    if (paragraph.firstElementChild?.tagName === 'BR')
        paragraph.firstElementChild.remove();
    if (!paragraph.textContent?.trim() && !paragraph.children.length)
        paragraph.remove();
    if (!quote.textContent?.trim() && !quote.querySelector('img,hr,table,pre,svg'))
        return null;
    const alert = document.createElement('div');
    alert.className = `markdown-alert markdown-alert-${type.toLowerCase()}`;
    const title = document.createElement('p');
    title.className = 'markdown-alert-title';
    title.innerHTML = githubAlertIcon(type);
    title.append(githubAlertTitle(type));
    alert.append(title, ...Array.from(quote.childNodes));
    return alert;
}

/** GitHub recognizes alerts only among the document's top-level blockquotes. */
export function renderGithubAlerts(html: string, enabled = false): string {
    if (!enabled)
        return html.replace(/<blockquote class="mu-fenced-quote">/g, '<blockquote>');
    const root = document.createElement('div');
    root.innerHTML = html;
    for (const original of Array.from(root.children)) {
        if (original.tagName !== 'BLOCKQUOTE')
            continue;
        if (original.classList.contains('mu-fenced-quote')) {
            original.removeAttribute('class');
            continue;
        }
        const alert = renderGithubAlertQuote(original);
        if (alert)
            original.replaceWith(alert);
    }
    return root.innerHTML;
}

/** Restore portable Markdown semantics before Turndown discards generated titles. */
export function restoreGithubAlertQuotes(html: string): string {
    const root = document.createElement('div');
    root.innerHTML = html;
    for (const alert of Array.from(root.querySelectorAll('div.markdown-alert'))) {
        const type = GITHUB_ALERT_TYPES.find(value => alert.classList.contains(`markdown-alert-${value.toLowerCase()}`));
        const title = alert.querySelector(':scope > .markdown-alert-title');
        if (!type || !title)
            continue;
        title.remove();
        const quote = document.createElement('blockquote');
        const marker = document.createElement('p');
        marker.textContent = `[!${type}]`;
        quote.append(marker, ...Array.from(alert.childNodes));
        alert.replaceWith(quote);
    }
    return root.innerHTML;
}

export function splitGithubAlertMarker(state: IBlockQuoteState): IBlockQuoteState {
    const first = state.children[0];
    if (first?.name !== 'paragraph')
        return state;
    const newline = first.text.indexOf('\n');
    if (newline === -1 || !matchGithubAlertMarker(first.text.slice(0, newline)))
        return state;
    return {
        ...state,
        meta: { ...state.meta, alertCompact: true },
        children: [{ name: 'paragraph', text: first.text.slice(0, newline) }, { name: 'paragraph', text: first.text.slice(newline + 1) }, ...state.children.slice(1)],
    };
}
