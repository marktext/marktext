import { isValidAttribute } from './dompurify';

export function sanitizeHyperlink(rawLink: string) {
    if (
        rawLink
        && typeof rawLink === 'string'
        && isValidAttribute('a', 'href', rawLink)
    ) {
        return rawLink;
    }

    return '';
}
