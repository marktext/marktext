// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GITHUB_ALERT_TYPES, githubAlertMenuIcon } from '../githubAlerts';

describe('gitHub Alert menu icons', () => {
    it.each(GITHUB_ALERT_TYPES)('produces a standalone SVG image for %s', (type) => {
        const uri = githubAlertMenuIcon(type);
        expect(uri).toMatch(/^data:image\/svg\+xml,/);
        const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
        const image = new DOMParser().parseFromString(svg, 'image/svg+xml');

        expect(image.querySelector('parsererror')).toBeNull();
        expect(image.documentElement.localName).toBe('svg');
        expect(image.documentElement.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(image.documentElement.getAttribute('stroke')).toBe('#808080');
        expect(image.documentElement.children.length).toBeGreaterThan(0);
    });
});
