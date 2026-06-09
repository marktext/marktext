// @vitest-environment happy-dom

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for muya.updateParagraph('front-matter') — the desktop Paragraph >
// Front Matter menu item. Two migration regressions are guarded here:
//   G5: front matter must be PREPENDED at document start and be idempotent,
//       never an in-place replacement of the cursor block (which destroyed the
//       block's content and produced invalid mid-document front matter).
//   G2: the frontmatter `lang` must follow muya.options.frontmatterType so YAML
//       ('-') and TOML ('+') serialize with `---`/`+++` fences instead of
//       always falling through to JSON braces.

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
});
