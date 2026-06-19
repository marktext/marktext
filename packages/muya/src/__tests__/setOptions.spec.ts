// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for the runtime option API added for the muyajs -> @muyajs/core
// migration: setOptions / setFont / setTabSize / setListIndentation. Every
// desktop Preferences toggle depends on options updating live. setOptions with
// forceRender re-renders from current state (so render-affecting options take
// effect) WITHOUT clearing undo history, and preserves the document content.

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('muya runtime options', () => {
    it('setOptions merges into muya.options', () => {
        const muya = bootMuya('hello\n');
        muya.setOptions({ footnote: true, superSubScript: false });
        expect(muya.options.footnote).toBe(true);
        expect(muya.options.superSubScript).toBe(false);
    });

    it('setOptions with forceRender preserves the document content', () => {
        const muya = bootMuya('# Heading\n\nsome text\n');
        const before = muya.getMarkdown();
        muya.setOptions({ footnote: true }, true);
        // A forced re-render rebuilds the block tree from current state, so the
        // serialized document is unchanged.
        expect(muya.getMarkdown()).toBe(before);
    });

    it('setOptions with forceRender does not clear the undo history', async () => {
        const muya = bootMuya('one\n');
        muya.editor.activeContentBlock = muya.editor.scrollPage!.firstContentInDescendant()!;
        // Make an edit so the undo stack is non-empty.
        muya.insertParagraph();
        await vi.waitFor(() => {
            expect(muya.getState().length).toBe(2);
            // the edit was recorded onto the undo stack
            expect(muya.editor.history.canUndo()).toBe(true);
        });

        // A forced re-render rebuilds the tree via ScrollPage.updateState, which
        // uses the 'api' source (no json-change dispatch), so it neither clears
        // the history (unlike setContent) nor pollutes it with re-render ops.
        muya.setOptions({ footnote: true }, true);

        expect(muya.editor.history.canUndo()).toBe(true);
    });

    it('setOptions reflects spellcheckEnabled on the container', () => {
        const muya = bootMuya('x\n');
        muya.setOptions({ spellcheckEnabled: true });
        expect(muya.domNode.getAttribute('spellcheck')).toBe('true');
        muya.setOptions({ spellcheckEnabled: false });
        expect(muya.domNode.getAttribute('spellcheck')).toBe('false');
    });

    it('setFont and setTabSize update options', () => {
        const muya = bootMuya('x\n');
        muya.setFont({ fontSize: 18, lineHeight: 1.8 });
        expect(muya.options.fontSize).toBe(18);
        expect(muya.options.lineHeight).toBe(1.8);
        muya.setTabSize(2);
        expect(muya.options.tabSize).toBe(2);
    });

    it('setListIndentation updates options and preserves content', () => {
        const muya = bootMuya('- a\n- b\n');
        const before = muya.getMarkdown();
        muya.setListIndentation(2);
        expect(muya.options.listIndentation).toBe(2);
        expect(muya.getMarkdown()).toBe(before);
    });

    // Regression: getMarkdown() must serialize nested lists using the live
    // `listIndentation` option. The legacy muyajs engine threaded it
    // (muyajs/lib/index.js getMarkdown -> new ExportMarkdown(blocks,
    // listIndentation, ...)), but the migrated JSONState.getMarkdownFromState
    // constructed `new StateToMarkdown()` with no options, so it always fell
    // back to the 1-space default and the desktop Preferences toggle had zero
    // effect on source mode / saved files. A flat list (the test above) can't
    // catch this — only a nested list exposes the indentation width.
    it('setListIndentation drives the serialized nested-list indentation', () => {
        const muya = bootMuya('- a\n  - b\n');
        // Default listIndentation = 1 -> nested bullet at marker width (2).
        expect(muya.getMarkdown()).toBe('- a\n  - b\n');

        // listIndentation = 4 -> marker width (2) + (4 - 1) = 5 spaces.
        muya.setListIndentation(4);
        expect(muya.getMarkdown()).toBe('- a\n     - b\n');
    });
});

// Render-affecting options: the inline renderer (`InlineRenderer.tokenizer`)
// reads `muya.options` live on every render pass, so superSubScript governs
// whether `^x^` / `~x~` are tokenized into <sup>/<sub> or left as literal
// text. The serialized markdown is identical either way (the markers stay in
// the source); the option only changes the rendered DOM, so these are asserted
// against the rendered tree, not getMarkdown().
describe('muya render-affecting options', () => {
    function bootMuyaWith(markdown: string, options: Record<string, unknown>): Muya {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        bootedHosts.push(muya.domNode);
        return muya;
    }

    it('superSubScript:false renders literal ^sup^ (no <sup> element)', async () => {
        const muya = bootMuyaWith('^sup^\n', { superSubScript: false });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        expect(muya.domNode.querySelectorAll('sup').length).toBe(0);
        expect(muya.domNode.textContent).toContain('^sup^');
        // The source markdown is unchanged — the option only governs rendering.
        expect(muya.getMarkdown()).toBe('^sup^\n');
    });

    it('superSubScript:true renders a <sup> element for ^sup^', async () => {
        const muya = bootMuyaWith('^sup^\n', { superSubScript: true });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        expect(muya.domNode.querySelectorAll('sup').length).toBe(1);
        // The marker is preserved in the serialized markdown regardless.
        expect(muya.getMarkdown()).toBe('^sup^\n');
    });

    it('setOptions superSubScript with forceRender toggles the <sup> live', async () => {
        const muya = bootMuyaWith('^sup^\n', { superSubScript: true });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        expect(muya.domNode.querySelectorAll('sup').length).toBe(1);

        muya.setOptions({ superSubScript: false }, true);
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        expect(muya.domNode.querySelectorAll('sup').length).toBe(0);
        expect(muya.domNode.textContent).toContain('^sup^');

        muya.setOptions({ superSubScript: true }, true);
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        expect(muya.domNode.querySelectorAll('sup').length).toBe(1);
    });

    it('frontmatterType:false drives the option onto muya.options', () => {
        const muya = bootMuyaWith('body\n', {});
        muya.setOptions({ frontmatterType: '+' });
        expect(muya.options.frontmatterType).toBe('+');
    });

    // CHARACTERIZATION: setOptions({ frontmatterType }, forceRender) does NOT
    // retroactively rewrite an existing frontmatter block's fences. The
    // serializer (`serializeFrontMatter`) keys off the BLOCK's own
    // `meta.lang`/`meta.style` (baked in at parse time), and `_forceRender`
    // rebuilds the tree from the unchanged state, so a YAML (`---`) block stays
    // YAML even after switching the option to TOML (`+`). The option only
    // affects NEWLY inserted frontmatter (`insertFrontMatterAtStart`).
    it('setOptions({frontmatterType}, true) does NOT rewrite existing frontmatter fences', async () => {
        const muya = bootMuyaWith('---\ntitle: hi\n---\n\nbody\n', {});
        const before = muya.getMarkdown();
        expect((muya.getState()[0] as { meta: { lang: string } }).meta.lang).toBe('yaml');

        muya.setOptions({ frontmatterType: '+' }, true);
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        // The fences are still `---` (yaml), NOT `+++` (toml) — the existing
        // block's meta is unchanged by the option switch.
        expect(muya.getMarkdown()).toBe(before);
        expect(muya.getMarkdown().startsWith('---\n')).toBe(true);
        expect((muya.getState()[0] as { meta: { lang: string } }).meta.lang).toBe('yaml');
    });

    it('frontmatterType set via setOptions applies to NEWLY inserted frontmatter', async () => {
        const muya = bootMuyaWith('body\n', {});
        muya.setOptions({ frontmatterType: '+' });
        // Place the cursor so updateParagraph has a target block.
        muya.editor.activeContentBlock = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.updateParagraph('front-matter');

        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('frontmatter');
        });

        // The freshly inserted block follows the updated option: TOML `+++`.
        expect((muya.getState()[0] as { meta: { lang: string } }).meta.lang).toBe('toml');
        expect(muya.getMarkdown().startsWith('+++\n')).toBe(true);
    });
});
