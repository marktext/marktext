// @vitest-environment happy-dom

import type { Muya } from '../../../../muya';
import type AtxHeading from '../index';
import { describe, expect, it } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../../../__tests__/muyaHarness';

// Integration coverage for the heading fold affordance on the new engine:
// the toggle renders as an accessible button, clicking it folds every block
// down to the next same-or-higher-level heading, and toggling is idempotent.

useMuyaHarness();

const FOLD_TOGGLE_SELECTOR = '.mu-fold-toggle';
const FOLDED_CONTENT_SELECTOR = '.mu-folded-content';

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

    it('unfolds again on a second click (idempotent toggle)', () => {
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

    it('marks the folded heading so the collapsed-section indicator can show', () => {
        // The "…" marker element is shown via the `.mu-folded` class on both the
        // heading and the marker; assert that contract (its CSS visibility is
        // not observable in happy-dom).
        const muya = bootMuya('# One\n\nalpha\n\n# Two\n');
        const heading = muya.domNode.querySelector<HTMLElement>('.mu-atx-heading')!;
        const toggle = heading.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;

        expect(heading.classList.contains('mu-folded')).toBe(false);

        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(heading.classList.contains('mu-folded')).toBe(true);

        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(heading.classList.contains('mu-folded')).toBe(false);
    });
});

const MARKER_SELECTOR = '.mu-fold-marker';

describe('clickable collapsed-section marker', () => {
    it('renders a marker on every heading, hidden until folded', () => {
        const muya = bootMuya('# One\n\nalpha\n\n# Two\n');
        const heading = muya.domNode.querySelector<HTMLElement>('.mu-atx-heading')!;
        const marker = heading.querySelector<HTMLElement>(MARKER_SELECTOR)!;

        // Present in the DOM, but not marked folded and hidden from a11y tree.
        expect(marker).toBeTruthy();
        expect(marker.classList.contains('mu-folded')).toBe(false);
        expect(marker.getAttribute('aria-hidden')).toBe('true');
        expect(marker.getAttribute('tabindex')).toBe('-1');
    });

    it('exposes the marker to a11y + tab order once folded', () => {
        const muya = bootMuya('# One\n\nalpha\n\n# Two\n');
        const heading = muya.domNode.querySelector<HTMLElement>('.mu-atx-heading')!;
        const toggle = heading.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;
        const marker = heading.querySelector<HTMLElement>(MARKER_SELECTOR)!;

        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(marker.classList.contains('mu-folded')).toBe(true);
        expect(marker.getAttribute('aria-hidden')).toBe('false');
        expect(marker.getAttribute('tabindex')).toBe('0');
        expect(marker.getAttribute('aria-label')).toBeTruthy();
    });

    it('unfolds the section when the marker is clicked', () => {
        const muya = bootMuya('# One\n\nalpha\n\nbravo\n\n# Two\n');
        const heading = muya.domNode.querySelector<HTMLElement>('.mu-atx-heading')!;
        const toggle = heading.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;
        const marker = heading.querySelector<HTMLElement>(MARKER_SELECTOR)!;

        // Fold first, then unfold via the marker.
        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR).length).toBeGreaterThan(0);

        marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(muya.domNode.querySelectorAll(FOLDED_CONTENT_SELECTOR).length).toBe(0);
        expect(heading.classList.contains('mu-folded')).toBe(false);
    });

    it('does not pollute the heading textContent when folded', () => {
        // Regression: the desktop TOC/outline/search read `heading.textContent`
        // (stripping the leading "# " markers, as toc-scroll's `normalize` does)
        // and compare it to the heading text. The marker's "…" must come from
        // CSS (::after), not element text, or a folded heading would read as
        // "Heading…" and break those consumers (headingIndexByText → -1).
        const muya = bootMuya('# Heading Number 12\n\nbody\n\n# Next\n');
        const heading = muya.domNode.querySelector<HTMLElement>('.mu-atx-heading')!;
        const toggle = heading.querySelector<HTMLElement>(FOLD_TOGGLE_SELECTOR)!;
        // Mirror the desktop consumer: strip leading markdown hashes/space.
        const headingText = () => (heading.textContent ?? '').replace(/^[#\s]+/, '').trim();

        expect(headingText()).toBe('Heading Number 12');

        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(heading.classList.contains('mu-folded')).toBe(true);
        // Still exactly the heading text — no "…" leaked into textContent.
        expect(headingText()).toBe('Heading Number 12');
    });
});

describe('document-wide fold operations', () => {
    // Reach the heading blocks through the tree to call the document-wide API.
    // The tree exposes a `blockName`/`next` linked list; narrow heading nodes to
    // AtxHeading (guarded by the blockName check) without `any`.
    interface IWalkNode {
        blockName: string;
        next: IWalkNode | null;
        meta?: { level: number };
    }

    function headingBlocks(muya: Muya): AtxHeading[] {
        const heads: AtxHeading[] = [];
        let node = muya.editor.scrollPage?.firstChild as unknown as IWalkNode | null;
        while (node) {
            if (node.blockName === 'atx-heading')
                heads.push(node as unknown as AtxHeading);
            node = node.next;
        }
        return heads;
    }

    it('foldAll collapses every heading (full outline)', () => {
        const muya = bootMuya('# A\n\na\n\n## B\n\nb\n\n# C\n\nc\n');
        const [h1a] = headingBlocks(muya);

        h1a.foldAll();

        // Every heading is folded: the two h1s and the nested h2.
        const foldedHeadings = muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded');
        expect(foldedHeadings.length).toBe(3);
    });

    it('unfoldAll reopens everything', () => {
        const muya = bootMuya('# A\n\na\n\n## B\n\nb\n\n# C\n\nc\n');
        const [h1a] = headingBlocks(muya);

        h1a.foldAll();
        expect(muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded').length).toBeGreaterThan(0);

        h1a.unfoldAll();
        expect(muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded').length).toBe(0);
    });

    it('foldToLevel(2) keeps h1/h2 open and folds deeper headings', () => {
        const muya = bootMuya('# A\n\n## B\n\n### C\n\nc\n');
        const heads = headingBlocks(muya);

        heads[0].foldToLevel(2);

        // Only the h3 ("### C", level 3 > 2) is folded.
        const folded = Array.from(
            muya.domNode.querySelectorAll('.mu-atx-heading.mu-folded'),
        );
        expect(folded.length).toBe(1);
        expect(folded[0].tagName.toLowerCase()).toBe('h3');
    });

    it('keeps a still-folded inner section hidden after unfolding its ancestor', () => {
        // Regression (CodeRabbit): fold inner ## B, then fold # A, then unfold
        // # A. B is still folded, so B's own content must stay hidden — unfolding
        // A must not reveal content owned by a still-folded descendant.
        const muya = bootMuya('# A\n\na\n\n## B\n\nbeta1\n\nbeta2\n');
        const [hA, hB] = headingBlocks(muya);
        expect(hA.meta.level).toBe(1);
        expect(hB.meta.level).toBe(2);

        // The two paragraphs "beta1"/"beta2" belong to B's section.
        const bParagraphs = () =>
            Array.from(muya.domNode.querySelectorAll('p'))
                .filter(p => /beta/.test(p.textContent ?? ''));

        hB.toggleFold(true); // fold inner
        expect(bParagraphs().every(p => p.classList.contains('mu-folded-content'))).toBe(true);

        hA.toggleFold(true); // fold ancestor (hides B and its content too)
        hA.toggleFold(false); // unfold ancestor

        // B is still folded, so its paragraphs must remain hidden.
        expect(hB.folded).toBe(true);
        expect(bParagraphs().every(p => p.classList.contains('mu-folded-content'))).toBe(true);
    });
});
