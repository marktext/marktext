import type { UponSanitizeAttributeHook } from 'dompurify';
import { EXPORT_DOMPURIFY_CONFIG } from '../config';
import { addHook, removeHook } from './dompurify';
import { resolveExportImageSrc } from './fileUrl';
import { sanitize } from './index';

// Runs before DOMPurify validates the attribute, so the allowlist checks the
// final `file://` URL. Covers Markdown images and raw `<img>` tags alike; a
// Windows drive path would otherwise be dropped as an unknown `c:` scheme
// (#3323).
const resolveImageSrc: UponSanitizeAttributeHook = (node, data) => {
    if (node.nodeName === 'IMG' && data.attrName === 'src')
        data.attrValue = resolveExportImageSrc(data.attrValue);
};

/**
 * Sanitize rendered export HTML with `EXPORT_DOMPURIFY_CONFIG`, resolving every
 * local `<img>` src to an absolute `file://` URL on the way.
 */
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
