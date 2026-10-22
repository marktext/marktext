import type { UponSanitizeAttributeHook } from 'dompurify';
import { EXPORT_DOMPURIFY_CONFIG } from '../config';
import { addHook, removeHook } from './dompurify';
import { resolveExportImageSrc } from './fileUrl';
import { sanitize } from './index';

// Resolve local URLs before DOMPurify validates schemes, or Windows drives are rejected as c: URLs.
const resolveImageSrc: UponSanitizeAttributeHook = (node, data) => {
    if (node.nodeName === 'IMG' && data.attrName === 'src')
        data.attrValue = resolveExportImageSrc(data.attrValue);
};

// Sanitize export HTML after resolving local image sources to absolute file URLs.
export function sanitizeExportHtml(html: string): string {
    // The purifier is shared, so the hook is attached for this call only.
    addHook('uponSanitizeAttribute', resolveImageSrc);
    try {
        return sanitize(html, EXPORT_DOMPURIFY_CONFIG, false) as string;
    }
    finally {
        removeHook('uponSanitizeAttribute', resolveImageSrc);
    }
}
