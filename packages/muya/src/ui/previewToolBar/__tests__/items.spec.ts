import { describe, expect, it } from 'vitest';
import { PREVIEW_BLOCK_NAMES, previewToolBarItems } from '../config';

function types(blockName: string, hasRenderedMedia = true): string[] {
    return previewToolBarItems(blockName, hasRenderedMedia).map(item => item.type);
}

describe('preview toolbar — blocks that get a toolbar', () => {
    it('covers the three preview blocks', () => {
        expect(PREVIEW_BLOCK_NAMES.has('html-block')).toBe(true);
        expect(PREVIEW_BLOCK_NAMES.has('math-block')).toBe(true);
        expect(PREVIEW_BLOCK_NAMES.has('diagram')).toBe(true);
    });

    it('does not match the inner blocks a diagram is built from', () => {
        expect(PREVIEW_BLOCK_NAMES.has('diagram-preview')).toBe(false);
        expect(PREVIEW_BLOCK_NAMES.has('diagram-container')).toBe(false);
    });

    it('does not match ordinary blocks', () => {
        expect(PREVIEW_BLOCK_NAMES.has('paragraph')).toBe(false);
        expect(PREVIEW_BLOCK_NAMES.has('code-block')).toBe(false);
    });
});

describe('preview toolbar — actions per block', () => {
    it('offers edit and delete on an html block', () => {
        expect(types('html-block')).toEqual(['edit', 'delete']);
    });

    it('offers edit and delete on a math block', () => {
        expect(types('math-block')).toEqual(['edit', 'delete']);
    });

    it('offers view, edit and delete on a diagram block', () => {
        expect(types('diagram')).toEqual(['view', 'edit', 'delete']);
    });

    it('drops view when the diagram has not rendered', () => {
        expect(types('diagram', false)).toEqual(['edit', 'delete']);
    });

    it('keeps delete last so the separator stays in front of it', () => {
        for (const block of ['html-block', 'math-block', 'diagram'])
            expect(types(block).at(-1)).toBe('delete');
    });

    it('gives every action a tooltip key the locales carry', async () => {
        const { en } = await import('../../../locales/en');
        for (const item of previewToolBarItems('diagram', true))
            expect(en.resource).toHaveProperty(item.tooltip);
    });
});
