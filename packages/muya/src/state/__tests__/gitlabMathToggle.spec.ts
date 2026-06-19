// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// Regression coverage for the live `isGitlabCompatibilityEnabled` toggle.
// Toggling the preference drives `editor.setOptions({ isGitlabCompatibilityEnabled }, true)`
// in the desktop renderer. Because GitLab compatibility is a PARSE-time option
// (markdownToState / walkTokens decide whether ```math becomes a math block),
// a render-only rebuild from the already-parsed state cannot reclassify an
// existing ```math fence. These specs pin that the toggle re-parses so a
// ```math block switches between code-block and math-block in both directions.

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

function bootMuya(markdown: string, options: Partial<ConstructorParameters<typeof Muya>[1]> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// eslint-disable-next-line ts/no-explicit-any
function firstBlock(muya: Muya): any {
    return muya.getState()[0];
}

const MATH_FENCE = '```math\nx^2\n```\n';

describe('isGitlabCompatibilityEnabled — live toggle re-parses ```math', () => {
    it('starts as a code block when gitlab compatibility is off', () => {
        const muya = bootMuya(MATH_FENCE, { math: true, isGitlabCompatibilityEnabled: false });
        expect(firstBlock(muya).name).toBe('code-block');
    });

    it('promotes an existing ```math code block to a math block when toggled ON', () => {
        const muya = bootMuya(MATH_FENCE, { math: true, isGitlabCompatibilityEnabled: false });
        expect(firstBlock(muya).name).toBe('code-block');

        muya.setOptions({ isGitlabCompatibilityEnabled: true }, true);

        expect(firstBlock(muya).name).toBe('math-block');
        expect(firstBlock(muya).meta.mathStyle).toBe('gitlab');
    });

    it('demotes an existing ```math math block back to a code block when toggled OFF', () => {
        const muya = bootMuya(MATH_FENCE, { math: true, isGitlabCompatibilityEnabled: true });
        expect(firstBlock(muya).name).toBe('math-block');

        muya.setOptions({ isGitlabCompatibilityEnabled: false }, true);

        expect(firstBlock(muya).name).toBe('code-block');
        expect(firstBlock(muya).meta.lang).toBe('math');
    });

    it('leaves $$ math blocks untouched across a toggle', () => {
        const muya = bootMuya('$$\nx^2\n$$\n', { math: true, isGitlabCompatibilityEnabled: false });
        expect(firstBlock(muya).name).toBe('math-block');

        muya.setOptions({ isGitlabCompatibilityEnabled: true }, true);

        expect(firstBlock(muya).name).toBe('math-block');
        expect(firstBlock(muya).meta.mathStyle).toBe('');
    });
});
