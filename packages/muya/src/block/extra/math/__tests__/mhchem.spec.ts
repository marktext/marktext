import katex from 'katex';
import { describe, expect, it } from 'vitest';
import '../mathPreview';

describe('mhchem (\\ce) extension registration', () => {
    it('patches the same katex instance the renderers use', () => {
        expect(() =>
            katex.renderToString('\\ce{Zn^2+ <=> Zn(OH)2}', {
                displayMode: true,
            }),
        ).not.toThrow();
    });
});
