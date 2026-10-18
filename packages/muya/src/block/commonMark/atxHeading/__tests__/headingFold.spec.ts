// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../../../__tests__/muyaHarness';
import { ScrollPage } from '../../../scrollPage';

useMuyaHarness();

const FOLD_TOGGLE_SELECTOR = '.mu-fold-toggle';
const FOLDED_CONTENT_SELECTOR = '.mu-folded-content';

function clickToggle(muya: ReturnType<typeof bootMuya>, index = 0): void {
    muya.domNode.querySelectorAll(FOLD_TOGGLE_SELECTOR)[index]
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('heading fold affordance', () => {
    it('renders a fold toggle on every heading', () => {
        const muya = bootMuya('# One\n\ntext\n\n## Two\n');
        const toggles = muya.domNode.querySelectorAll(FOLD_TOGGLE_SELECTOR);

        expect(toggles.length).toBe(2);
    });

    it('exposes the toggle as an accessible, keyboard-focusable button', () => {
        const muya = bootMuya('# One\n\ntext\n');
        const toggle = muya.domNode.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;

        expect(toggle.getAttribute('role')).toBe('button');
        expect(toggle.getAttribute('tabindex')).toBe('0');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.getAttribute('aria-label')).toBeTruthy();
    });

    it('folds the section (blocks up to the next same-level heading) on click', () => {
        const muya = bootMuya('# One\n\nalpha\n\nbravo\n\n# Two\n\ncharlie\n');
        const firstToggle = muya.domNode.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;

        firstToggle.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );

        // The two paragraphs under "# One" are hidden; the "# Two" heading and
        // its paragraph are not.
        const folded = muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR);
        expect(folded.length).toBe(2);
        expect(firstToggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('unfolds again on a second click', () => {
        const muya = bootMuya('# One\n\nalpha\n\nbravo\n\n# Two\n');
        const firstToggle = muya.domNode.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;

        firstToggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR).length).toBeGreaterThan(0);

        firstToggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR).length).toBe(0);
        expect(firstToggle.getAttribute('aria-expanded')).toBe('true');
    });

    it('folds an h1 including nested deeper headings', () => {
        const muya = bootMuya('# One\n\nalpha\n\n## Sub\n\nbeta\n\n# Two\n');
        const firstToggle = muya.domNode.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;

        firstToggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        // alpha, the "## Sub" heading, and beta are all hidden (3 blocks).
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR).length).toBe(3);
    });

    it('keeps a still-folded inner section hidden after unfolding its ancestor', () => {
        // Regression (CodeRabbit): fold inner ## B, then fold # A, then unfold
        // # A. B is still folded, so B's own content must stay hidden — unfolding
        // A must not reveal content owned by a still-folded descendant.
        const muya = bootMuya('# A\n\na\n\n## B\n\nbeta1\n\nbeta2\n');
        const toggles = muya.domNode.querySelectorAll<HTMLElement>(FOLD_TOGGLE_SELECTOR);
        const [toggleA, toggleB] = Array.from(toggles);

        // The two paragraphs "beta1"/"beta2" belong to B's section.
        const bParagraphs = () =>
            Array.from(muya.domNode.querySelectorAll('p'))
                .filter(p => /beta/.test(p.textContent ?? ''));

        const click = (el: HTMLElement) =>
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        click(toggleB); // fold inner ## B
        expect(bParagraphs().every(p => p.classList.contains('mu-folded-content'))).toBe(true);

        click(toggleA); // fold ancestor # A (hides B and its content too)
        click(toggleA); // unfold ancestor # A

        // B is still folded, so its paragraphs must remain hidden.
        expect(bParagraphs().every(p => p.classList.contains('mu-folded-content'))).toBe(true);
    });
});

describe('folded sections during editing and navigation', () => {
    it('reveals the former section when Backspace converts its heading', async () => {
        const muya = bootMuya('# A\n\nsecret\n\n# B\n');
        const heading = muya.editor.scrollPage!.children.head!;
        if (!heading.isParent())
            throw new Error('Expected heading block');
        clickToggle(muya);
        const content = heading.firstContentInDescendant()!;
        content.setCursor(0, 0, true);
        content.backspaceHandler(new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true }));

        expect(muya.domNode.querySelectorAll(FOLD_TOGGLE_SELECTOR)).toHaveLength(1);
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)).toHaveLength(0);
        await expect.poll(() => muya.getMarkdown()).toBe('A\n\nsecret\n\n# B\n');
    });

    it('keeps a nested section folded when its folded ancestor is deleted', () => {
        const muya = bootMuya('# A\n\nalpha\n\n## B\n\nbeta\n\n# C\n');
        clickToggle(muya, 1);
        clickToggle(muya);
        muya.editor.scrollPage!.children.head!.remove();

        expect([...muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)].map(node => node.textContent)).toEqual(['beta']);
    });

    it('updates visibility when inserting a block into a folded section', () => {
        const muya = bootMuya('# A\n\nsecret\n\n# B\n');
        const heading = muya.editor.scrollPage!.children.head!;
        if (!heading.isParent())
            throw new Error('Expected heading block');
        clickToggle(muya);
        const paragraph = ScrollPage.loadBlock('paragraph').create(muya, { name: 'paragraph', text: 'new' });
        heading.parent!.insertAfter(paragraph, heading);

        expect(paragraph.domNode?.classList.contains('mu-folded-content')).toBe(true);
        clickToggle(muya);
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)).toHaveLength(0);
    });

    it('keeps edits outside the captured section visible until refolding', () => {
        const muya = bootMuya('# A\n\nalpha\n\n# B\n\nbeta\n');
        clickToggle(muya);
        const boundary = muya.editor.scrollPage!.children.tail!.prev!;
        if (!boundary.isParent())
            throw new Error('Expected heading block');
        boundary.replaceWith(ScrollPage.loadBlock('atx-heading').create(muya, { name: 'atx-heading', text: '## B', meta: { level: 2 } }));

        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)).toHaveLength(1);
        clickToggle(muya);
        clickToggle(muya);
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)).toHaveLength(3);
    });

    it('stops at an equal-level Setext heading', () => {
        const muya = bootMuya('# A\n\nalpha\n\nB\n===\n\nbravo\n');
        clickToggle(muya);

        expect([...muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)].map(node => node.textContent)).toEqual(['alpha']);
    });

    it('skips hidden content during ordinary ArrowRight navigation', () => {
        const muya = bootMuya('# A\n\nsecret\n\n# B\n');
        const content = muya.editor.scrollPage!.firstContentInDescendant()!;
        content.setCursor(content.text.length, content.text.length, true);
        clickToggle(muya);
        content.arrowHandler(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));

        expect(muya.editor.activeContentBlock?.text).toBe('# B');
        expect(muya.editor.activeContentBlock?.domNode?.closest(FOLDED_CONTENT_SELECTOR)).toBeNull();
        expect(muya.domNode.querySelector(FOLD_TOGGLE_SELECTOR)?.getAttribute('aria-expanded')).toBe('false');
    });

    it('moves an existing caret out of content being folded', () => {
        const muya = bootMuya('# A\n\nsecret\n');
        const body = muya.editor.scrollPage!.lastContentInDescendant()!;
        body.setCursor(2, 2, true);
        clickToggle(muya);

        expect(muya.editor.activeContentBlock?.text).toBe('# A');
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)).toHaveLength(1);
    });

    it('expands all sections during find-in-document', () => {
        const muya = bootMuya('# A\n\nsecret one\n\n# B\n\nsecret two\n');
        clickToggle(muya);
        clickToggle(muya, 1);
        const result = muya.search('secret', { isRegexp: false });

        expect(result.matches).toHaveLength(2);
        expect(result.matches[0].block.domNode?.closest(FOLDED_CONTENT_SELECTOR)).toBeNull();
        expect(result.matches[1].block.domNode?.closest(FOLDED_CONTENT_SELECTOR)).toBeNull();
        muya.find('next');
        expect(result.matches[1].block.domNode?.closest(FOLDED_CONTENT_SELECTOR)).toBeNull();
    });

    it('reveals nested headings for TOC navigation without expanding the target section', () => {
        const muya = bootMuya('# A\n\n## B\n\nsecret\n');
        clickToggle(muya, 1);
        clickToggle(muya);
        const target = muya.domNode.querySelector('h2')!;
        muya.revealElement(target);

        expect(target.classList.contains('mu-folded-content')).toBe(false);
        expect(target.querySelector(FOLD_TOGGLE_SELECTOR)?.getAttribute('aria-expanded')).toBe('false');
        expect([...muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)].map(node => node.textContent)).toEqual(['secret']);
    });

    it('leaves an earlier captured fold intact when revealing a later section', () => {
        const muya = bootMuya('# A\n\nalpha\n\n# B\n\nbeta\n');
        clickToggle(muya);
        const boundary = muya.editor.scrollPage!.children.tail!.prev!;
        if (!boundary.isParent())
            throw new Error('Expected heading block');
        boundary.replaceWith(ScrollPage.loadBlock('atx-heading').create(muya, { name: 'atx-heading', text: '## B', meta: { level: 2 } }));
        clickToggle(muya, 1);
        muya.editor.scrollPage!.lastContentInDescendant()!.setCursor(1, 1, true);

        expect(muya.domNode.querySelector(FOLD_TOGGLE_SELECTOR)?.getAttribute('aria-expanded')).toBe('false');
        expect([...muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)].map(node => node.textContent)).toEqual(['alpha']);
    });

    it('reveals containing folds across blockquote boundaries before selection', () => {
        const muya = bootMuya('# Outer\n\n> ## Inner\n>\n> secret\n');
        const body = muya.editor.scrollPage!.lastContentInDescendant()!;
        clickToggle(muya, 1);
        clickToggle(muya);
        body.setCursor(1, 1, true);

        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR)).toHaveLength(0);
        expect(muya.editor.selection.anchorBlock).toBe(body);
    });

    it('keeps fold state out of markdown and document state', () => {
        const muya = bootMuya('# A\n\nsecret\n');
        const before = muya.getState();
        clickToggle(muya);

        expect(muya.getState()).toEqual(before);
        expect(muya.getMarkdown()).toBe('# A\n\nsecret\n');
    });

    it.each(['Enter', ' '])('activates the fold button with %j', (key) => {
        const muya = bootMuya('# A\n\nsecret\n');
        const button = muya.domNode.querySelector(FOLD_TOGGLE_SELECTOR)!;
        button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        expect(button.getAttribute('aria-expanded')).toBe('false');
        button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        expect(button.getAttribute('aria-expanded')).toBe('true');
    });
});
