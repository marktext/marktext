import type Parent from '../block/base/parent';
import type { IGithubAlertState } from '../state/types';

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

export function githubAlertMarker(meta: IGithubAlertState['meta']): string {
    return meta.marker ?? `[!${meta.type}]`;
}

export function githubAlertBlockType(block: Parent): GithubAlertType | null {
    const alert = block as Parent & { meta?: IGithubAlertState['meta'] };
    return block.blockName === 'github-alert' ? alert.meta?.type ?? null : null;
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
