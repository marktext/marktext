// @vitest-environment happy-dom

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
