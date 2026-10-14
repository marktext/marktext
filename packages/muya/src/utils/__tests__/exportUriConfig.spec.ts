// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { EXPORT_DOMPURIFY_CONFIG } from '../../config';
import sanitize from '../dompurify';

describe('export URI allowlist (#3323)', () => {
    it.each(['C:\\pics\\photo.png', 'C:/pics/photo.png', 'C:%5Cpics%5Cphoto.png'])(
        'preserves the drive path %s for the downstream resolver',
        (src) => {
            expect(sanitize(`<img src="${src}">`, EXPORT_DOMPURIFY_CONFIG)).toContain(`src="${src}"`);
        },
    );

    it.each(['javascript:alert(1)', 'vbscript:msgbox(1)', 'custom:photo.png', 'c:photo.png'])(
        'rejects the unsupported scheme %s',
        (src) => {
            const html = sanitize(`<img src="${src}"><a href="${src}">link</a>`, EXPORT_DOMPURIFY_CONFIG);
            expect(html).not.toContain('src=');
            expect(html).not.toContain('href=');
        },
    );
});
