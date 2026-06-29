// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// #1632 — re-rendering a math/diagram/html block via update() (the path taken
// by undo/redo: editor.applyTextEdit -> sd.update()) must refresh the rendered
// preview, not only the source text. inputHandler/backspaceHandler called
// _updatePreviewIfHave explicitly, but update() did not, so undoing an edit to
// a math block left a stale formula in the preview.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('math block preview refresh on update() (#1632)', () => {
    it('update() re-renders the preview after the text changes', () => {
        const muya = bootMuya('$$\nalpha\n$$\n');
        const preview = muya.domNode.querySelector<HTMLElement>('.mu-math-preview')!;
        expect(preview).not.toBeNull();

        // The math content block (editable source inside the math container).
        const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as {
            text: string;
            update: () => void;
        };

        // Simulate what undo does: mutate the text and re-render via update()
        // WITHOUT going through inputHandler/backspaceHandler.
        content.text = 'omega';
        content.update();

        // The preview must reflect the new formula, not the stale one.
        expect(preview.textContent).toContain('omega');
        expect(preview.textContent).not.toContain('alpha');
    });
});
