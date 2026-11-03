import type { Token } from '../model/types';
import { sanitizeHyperlink } from '../../utils/url';

export function hyperlinkProps(href: string, title?: string, target?: string) {
    return {
        href: sanitizeHyperlink(href),
        ...(title !== undefined ? { title } : {}),
        ...(target !== undefined ? { target } : {}),
    };
}

export function sourceDataset(token: Token) {
    return { start: String(token.range.start), end: String(token.range.end), raw: token.raw };
}
