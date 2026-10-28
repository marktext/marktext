// Rich HTML cannot retain source-only markers such as `#.` or non-sequential
// numbers. The wrapper identifies Markdown in the accompanying text/plain slot.
export function withMarkdownSource(html: string): string {
    return `<div data-marktext-markdown="1">${html}</div>`;
}

export function hasMarkdownSource(html: string): boolean {
    if (!html.includes('data-marktext-markdown'))
        return false;
    const { body } = new DOMParser().parseFromString(html, 'text/html');

    return body.children.length === 1 && body.firstElementChild!.matches('div[data-marktext-markdown="1"]');
}
