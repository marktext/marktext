import { describe, expect, it } from 'vitest';
import { MENU_CONFIG } from '../config';

// Lock the quick-insert menu's diagram section to all five supported diagram
// engines. flowchart + sequence were restored for parity with the legacy
// muyajs engine; a future refactor of the menu config shouldn't silently drop
// them.
describe('quick-insert menu — diagram entries', () => {
    const diagramSection = MENU_CONFIG.find(section => section.name === 'diagrams');

    it('has a diagrams section', () => {
        expect(diagramSection).toBeDefined();
    });

    it('exposes flowchart and sequence insert entries', () => {
        const labels = diagramSection!.children.map(child => child.label);
        expect(labels).toContain('diagram flowchart');
        expect(labels).toContain('diagram sequence');
    });

    it('keeps the existing mermaid / plantuml / vega-lite entries', () => {
        const labels = diagramSection!.children.map(child => child.label);
        expect(labels).toContain('diagram mermaid');
        expect(labels).toContain('diagram plantuml');
        expect(labels).toContain('diagram vega-lite');
    });

    it('gives every diagram entry an icon', () => {
        for (const child of diagramSection!.children)
            expect(child.icon, `${child.label} should have an icon`).toBeTruthy();
    });
});
