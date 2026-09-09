// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// Integration coverage for the heading fold affordance on the new engine:
// the toggle renders as an accessible button, clicking it folds every block
// down to the next same-or-higher-level heading, and toggling is idempotent.

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
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
    bootedMuyas.push(muya);
    return muya;
}

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
});

describe('document-wide fold operations', () => {
    // Reach the heading blocks through the tree to call the document-wide API.
    function headingBlocks(muya: Muya) {
        const heads: any[] = [];
        let node: any = muya.editor.scrollPage?.firstChild;
        while (node) {
            if (node.blockName === 'atx-heading')
                heads.push(node);
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
});
