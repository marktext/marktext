import type { Token } from './types';
import { tokenEvents } from './tokenTraversal';

function wrapperParts(token: Token): [string, string] | null {
    switch (token.type) {
        case 'strong':
        case 'em':
        case 'del':
        case 'mark':
            return [token.marker, token.backlash + token.marker];
        case 'html_tag':
            return token.closeTag !== undefined && token.children !== undefined ? [token.openTag, token.closeTag] : null;
        default:
            return null;
    }
}

// Rebuild wrappers for child edits (#2063); raw preserves marker edits from Backspace.
export function generator(tokens: Token[], mode: boolean | 'preserve-source' | 'rebuild-wrappers' = 'preserve-source'): string {
    if (mode === false || mode === 'preserve-source')
        return tokens.map(token => token.raw).join('');
    const parts: string[] = [];
    for (const { token, exiting } of tokenEvents(tokens, token => wrapperParts(token) !== null)) {
        const wrapper = wrapperParts(token);
        if (wrapper)
            parts.push(wrapper[exiting ? 1 : 0]);
        else if (!exiting)
            parts.push(token.raw);
    }
    return parts.join('');
}
