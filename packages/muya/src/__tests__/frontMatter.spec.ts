// @vitest-environment happy-dom

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';
import { replaceBlockByLabel } from '../ui/paragraphQuickInsertMenu/config';

// Coverage for the two front-matter entry points — the desktop Paragraph >
// Front Matter menu item (`muya.updateParagraph('front-matter')`) and the
// paragraph quick-insert menu ("/Front Matter", `replaceBlockByLabel`). Three
// migration regressions are guarded here:
//   G5: front matter must be PREPENDED at document start and be idempotent,
//       never an in-place replacement of the cursor block (which destroyed the
//       block's content and produced invalid mid-document front matter). This
//       must hold for BOTH entry points — they share `insertFrontMatterAtStart`.
//   G2: the frontmatter `lang`/`style` must follow muya.options.frontmatterType
//       so '-'/'+'/';'/'{' serialize as yaml `---` / toml `+++` / json `;;;` /
//       json `{}` instead of always falling through to JSON braces.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, frontmatterType?: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const options = { markdown } as ConstructorParameters<typeof Muya>[1] & { frontmatterType?: string };
    if (frontmatterType !== undefined)
        options.frontmatterType = frontmatterType;
    const muya = new Muya(host, options);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function placeCursorOn(muya: Muya, blockIndex: number): Content {
    const block = muya.editor.scrollPage!.find(blockIndex) as unknown as Parent;
    const content = block.firstContentInDescendant()!;
    muya.editor.activeContentBlock = content;
    return content;
}

// The leaf block that directly wraps the cursor content — the `block` the
// quick-insert menu passes to `replaceBlockByLabel` (`content.parent`).
function leafAt(muya: Muya, blockIndex: number): Parent {
    const content = placeCursorOn(muya, blockIndex);
    return (content as unknown as { parent: Parent }).parent;
}

describe('muya.updateParagraph(\'front-matter\')', () => {
    it('prepends front matter at document start without touching the cursor block', async () => {
        const muya = bootMuya('first para\n\nsecond para\n');
        // Cursor on the SECOND paragraph — legacy behavior ignores the cursor and
        // always targets document start.
        placeCursorOn(muya, 1);
        muya.updateParagraph('front-matter');

        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(3);
            expect(state[0].name).toBe('frontmatter');
        });

        const state = muya.getState();
        // The two original paragraphs are preserved intact, in order, after the
        // new front matter block — none was replaced/destroyed.
        expect(state[1].name).toBe('paragraph');
        expect(state[2].name).toBe('paragraph');
        const md = muya.getMarkdown();
        expect(md).toContain('first para');
        expect(md).toContain('second para');
    });

    it('is idempotent — does not add a second front matter block', async () => {
        const muya = bootMuya('---\ntitle: hi\n---\n\nbody\n');
        expect(muya.getState()[0].name).toBe('frontmatter');
        placeCursorOn(muya, 1);
        muya.updateParagraph('front-matter');

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        const state = muya.getState();
        const fmCount = state.filter(b => b.name === 'frontmatter').length;
        expect(fmCount).toBe(1);
        expect(muya.getMarkdown()).toContain('title: hi');
        expect(muya.getMarkdown()).toContain('body');
    });

    it('default frontmatterType (\'-\') inserts a YAML block (--- fences)', async () => {
        const muya = bootMuya('body\n');
        placeCursorOn(muya, 0);
        muya.updateParagraph('front-matter');

        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('frontmatter');
        });

        // eslint-disable-next-line ts/no-explicit-any
        expect((muya.getState()[0] as any).meta.lang).toBe('yaml');
        expect(muya.getMarkdown().startsWith('---\n')).toBe(true);
    });

    it('frontmatterType \'+\' inserts a TOML block (+++ fences)', async () => {
        const muya = bootMuya('body\n', '+');
        placeCursorOn(muya, 0);
        muya.updateParagraph('front-matter');

        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('frontmatter');
        });

        // eslint-disable-next-line ts/no-explicit-any
        expect((muya.getState()[0] as any).meta.lang).toBe('toml');
        expect(muya.getMarkdown().startsWith('+++\n')).toBe(true);
    });

    it('frontmatterType \';\' inserts a JSON block (;;; fences)', async () => {
        const muya = bootMuya('body\n', ';');
        placeCursorOn(muya, 0);
        muya.updateParagraph('front-matter');

        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('frontmatter');
        });

        // eslint-disable-next-line ts/no-explicit-any
        expect((muya.getState()[0] as any).meta.lang).toBe('json');
        expect(muya.getMarkdown().startsWith(';;;\n')).toBe(true);
    });

    it('frontmatterType \'{\' inserts a JSON block (brace fences)', async () => {
        const muya = bootMuya('body\n', '{');
        placeCursorOn(muya, 0);
        muya.updateParagraph('front-matter');

        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('frontmatter');
        });

        // eslint-disable-next-line ts/no-explicit-any
        const meta = (muya.getState()[0] as any).meta;
        expect(meta.lang).toBe('json');
        expect(meta.style).toBe('{');
        // The `{` style serializes the JSON-braces variant, NOT the `;;;` fences.
        const md = muya.getMarkdown();
        expect(md.startsWith('{\n')).toBe(true);
        expect(md.startsWith(';;;')).toBe(false);
    });
});

// Coverage for the OTHER front-matter entry point: the paragraph quick-insert
// menu ("/Front Matter"), which routes through `replaceBlockByLabel`. The G5
// fix only covered `Muya.updateParagraph`; the quick-insert path still did an
// in-place `block.replaceWith` that could create front matter MID-document by
// converting an empty paragraph — front matter is only valid at document start.
describe('quick-insert front matter (replaceBlockByLabel)', () => {
    it('inserts at document start, not in place, when triggered mid-document', async () => {
        const muya = bootMuya('first para\n\nsecond para\n');
        // Quick-insert is triggered on the SECOND paragraph (mid-document). The
        // menu passes the leaf block at the cursor as `block`.
        const block = leafAt(muya, 1);
        replaceBlockByLabel({ block, muya, label: 'frontmatter' });

        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state[0].name).toBe('frontmatter');
        });

        const state = muya.getState();
        // The new front matter is prepended; both original paragraphs survive
        // intact (the in-place replace bug would have destroyed the second one).
        expect(state.length).toBe(3);
        expect(state[1].name).toBe('paragraph');
        expect(state[2].name).toBe('paragraph');
        const md = muya.getMarkdown();
        expect(md).toContain('first para');
        expect(md).toContain('second para');
    });

    it('is idempotent — no second front matter block when one already exists', async () => {
        const muya = bootMuya('---\ntitle: hi\n---\n\nbody\n');
        expect(muya.getState()[0].name).toBe('frontmatter');
        const block = leafAt(muya, 1);
        replaceBlockByLabel({ block, muya, label: 'frontmatter' });

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        const state = muya.getState();
        expect(state.filter(b => b.name === 'frontmatter').length).toBe(1);
        expect(muya.getMarkdown()).toContain('title: hi');
        expect(muya.getMarkdown()).toContain('body');
    });

    it('honors frontmatterType when inserting via quick-insert (+ -> toml)', async () => {
        const muya = bootMuya('body\n', '+');
        const block = leafAt(muya, 0);
        replaceBlockByLabel({ block, muya, label: 'frontmatter' });

        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('frontmatter');
        });

        // eslint-disable-next-line ts/no-explicit-any
        expect((muya.getState()[0] as any).meta.lang).toBe('toml');
        expect(muya.getMarkdown().startsWith('+++\n')).toBe(true);
    });
});
