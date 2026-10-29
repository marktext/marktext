import type { UponSanitizeAttributeHook, UponSanitizeElementHook } from 'dompurify';
import { EXPORT_DOMPURIFY_CONFIG } from '../config';
import { addHook, removeHook } from './dompurify';
import { resolveExportImageSrc } from './fileUrl';
import { sanitize } from './index';

// Resolve local URLs before DOMPurify validates schemes, or Windows drives are rejected as c: URLs.
const resolveImageSrc: UponSanitizeAttributeHook = (node, data) => {
    if (node.nodeName === 'IMG' && data.attrName === 'src')
        data.attrValue = resolveExportImageSrc(data.attrValue);
};

// MathML is removed on export; retain its TeX annotation for accessible and plain-text labels.
const preserveMathSource: UponSanitizeElementHook = (node) => {
    if (!(node instanceof Element) || !node.classList.contains('katex'))
        return;

    const source = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (source != null)
        node.setAttribute('aria-label', source);
};

// Sanitize export HTML after resolving local image sources to absolute file URLs.
export function sanitizeExportHtml(html: string): string {
    // The purifier is shared, so these hooks are attached for this call only.
    addHook('uponSanitizeAttribute', resolveImageSrc);
    addHook('uponSanitizeElement', preserveMathSource);
    try {
        return sanitize(html, EXPORT_DOMPURIFY_CONFIG, false) as string;
    }
    finally {
        removeHook('uponSanitizeElement', preserveMathSource);
        removeHook('uponSanitizeAttribute', resolveImageSrc);
    }
}
